import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { api } from './api';
import { soundManager } from './soundManager';

export type SupportedLanguageMode = 'auto' | 'en' | 'ta' | 'tanglish' | 'hi' | 'hinglish';

export interface VoiceLatencyMetrics {
  micCapturedAt: number;
  agentReceivedAt: number;
  transcriptAt: number;
  retrievalStartAt: number;
  llmStartAt: number;
  firstAudioAt: number;
  audioPlaybackAt: number;
  totalLatencyMs: number;
}

export interface VoiceEngineListener {
  onInterimTranscript?: (text: string, role?: 'user' | 'assistant') => void;
  onFinalTranscript?: (text: string, role?: 'user' | 'assistant') => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: string) => void;
  onPipelineChange?: (pipeline: 'primary' | 'fallback') => void;
  onLatencyUpdate?: (metrics: VoiceLatencyMetrics) => void;
  onStateChange?: (
    state:
      | 'IDLE'
      | 'CONNECTING'
      | 'LISTENING'
      | 'THINKING'
      | 'SPEAKING'
      | 'INTERRUPTED'
      | 'ERROR'
      | 'UNAVAILABLE'
  ) => void;
}

export interface IVoiceEngine {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  startSession(
    classId: string,
    listener: VoiceEngineListener,
    langMode?: SupportedLanguageMode
  ): Promise<void>;
  stopSession(classId: string): Promise<void>;
  interrupt(classId: string): Promise<void>;
  isSpeaking(): boolean;
  cleanup(): void;
}

/**
 * ClassPulse Production Agora RTC Conversational AI Voice Engine.
 * 
 * Pipeline:
 * Student Microphone → Agora RTC Audio Track → Real-time Speech Processing → ClassPulse Grounded AI
 * → Spoken Audio Response → Student Speakers.
 */
export class ClassPulseAgoraVoiceEngine implements IVoiceEngine {
  public readonly id = 'classpulse_agora_native_voice';
  public readonly name = 'ClassPulse Agora RTC Conversational AI';

  private client: IAgoraRTCClient | null = null;
  private localMicTrack: IMicrophoneAudioTrack | null = null;
  private recognition: any = null;
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private listener: VoiceEngineListener | null = null;
  private classId: string = '';
  private active = false;
  private speaking = false;
  private isProcessingTurn = false;
  private currentLanguageMode: SupportedLanguageMode = 'auto';
  private lastMicActiveState: boolean = false;

  // Latency Metrics Tracking
  private latencyTracker: Partial<VoiceLatencyMetrics> = {};
  private isJoining = false;
  private currentSessionId: string = '';

  public isAvailable(): boolean {
    return AgoraRTC.checkSystemRequirements();
  }

  public async startSession(
    classId: string,
    listener: VoiceEngineListener,
    langMode: SupportedLanguageMode = 'auto'
  ): Promise<void> {
    if (this.isJoining) {
      console.warn('[AI_VOICE] Join already in progress, ignoring duplicate start request.');
      return;
    }

    this.cleanup();
    this.isJoining = true;
    const sessionId = `ai_sess_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    this.currentSessionId = sessionId;
    this.listener = listener;
    this.classId = classId;
    this.currentLanguageMode = langMode;
    this.active = true;

    console.log(`[AI_VOICE_SESSION_START] sessionId=${sessionId} classId=${classId} langMode=${langMode}`);

    soundManager.unlock();
    listener.onStateChange?.('CONNECTING');

    const tMicCapture = Date.now();
    this.latencyTracker.micCapturedAt = tMicCapture;

    try {
      // 1. Request backend to start/prepare server-side Agora AI Agent session
      const agentRes = await api.startClassroomAgent(classId);

      if (agentRes.state === 'unavailable') {
        listener.onError?.(agentRes.developerDiagnostic || 'Agora AI Agent service is currently unavailable.');
        listener.onStateChange?.('UNAVAILABLE');
        return;
      }

      // 2. Initialize dedicated Agora RTC Client for Private AI Audio Stream
      const appId = agentRes.appId;
      const channel = agentRes.aiChannel;
      const token = agentRes.token;
      const studentUid = agentRes.studentUid;

      if (!appId || !channel || !token || studentUid === undefined) {
        throw new Error('Missing Agora join credentials from server.');
      }

      // One-time structured diagnostic (without secrets)
      console.log(
        `[AI_VOICE_DIAGNOSTICS] WEB: appId=${appId.slice(0, 6)}... channel=${channel} studentUid=${studentUid} | AI: appId=${appId.slice(0, 6)}... channel=${channel} agentUid=9999`
      );

      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Handle remote audio subscription if Agora cloud agent publishes directly
      this.client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: string) => {
        if (!this.active || !this.client) return;

        if (mediaType === 'audio') {
          console.log(`[AI_VOICE_REMOTE_TRACK] Remote audio discovered from UID ${user.uid}`);
          await this.client.subscribe(user, mediaType);
          const remoteAudioTrack = user.audioTrack;
          if (remoteAudioTrack) {
            this.speaking = true;
            console.log(`[AI_VOICE_REMOTE_PLAYBACK] Subscribed and playing remote AI audio for UID ${user.uid}`);
            this.latencyTracker.firstAudioAt = Date.now();
            this.latencyTracker.audioPlaybackAt = Date.now();
            if (this.latencyTracker.micCapturedAt) {
              this.latencyTracker.totalLatencyMs =
                this.latencyTracker.audioPlaybackAt - this.latencyTracker.micCapturedAt;
            }

            this.listener?.onLatencyUpdate?.(this.latencyTracker as VoiceLatencyMetrics);
            this.listener?.onStateChange?.('SPEAKING');
            this.listener?.onSpeechStart?.();

            remoteAudioTrack.play();
          }
        }
      });

      this.client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: string) => {
        if (mediaType === 'audio') {
          console.log(`[AI_VOICE_REMOTE_TRACK] Remote audio unpublished for UID ${user.uid}`);
          this.speaking = false;
          this.listener?.onSpeechEnd?.();
          if (this.active) {
            this.listener?.onStateChange?.('LISTENING');
          }
        }
      });

      this.client.on('connection-state-change', (curState, prevState) => {
        console.log(`[AI_VOICE_RTC_CONNECTION] ${prevState} → ${curState}`);
        if (curState === 'CONNECTED' && prevState === 'RECONNECTING') {
          if (this.active && !this.speaking) {
            this.listener?.onStateChange?.('LISTENING');
          }
        }
      });

      this.latencyTracker.agentReceivedAt = Date.now();

      await this.client.join(appId, channel, token, studentUid);

      console.log(
        `[AI_VOICE_JOIN_SUCCESS] appId=${appId.slice(0, 6)}... channel=${channel} uid=${studentUid}`
      );

      // 3. Create local microphone audio track and publish to AI channel
      this.localMicTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Active Noise Suppression
        AGC: true, // Automatic Gain Control
        encoderConfig: 'speech_standard',
      });

      await this.client.publish(this.localMicTrack);
      console.log(`[AI_VOICE_MIC] Local microphone track published successfully to channel ${channel}`);

      // 4. Lightweight Audio Level Diagnostics: Distinguish MIC ACTIVE vs MIC SILENT
      this.client.enableAudioVolumeIndicator();
      this.client.on('volume-indicator', (volumes) => {
        if (!this.active) return;
        const localVol = volumes.find(
          (v) => v.uid === 0 || v.uid === studentUid || (this.client && v.uid === this.client.uid)
        );
        const level = localVol ? localVol.level : (this.localMicTrack ? Math.round(this.localMicTrack.getVolumeLevel() * 100) : 0);
        const isMicActiveNow = level > 5;
        if (isMicActiveNow !== this.lastMicActiveState) {
          this.lastMicActiveState = isMicActiveNow;
          console.log(`[AI_VOICE_AUDIO_LEVEL] ${isMicActiveNow ? 'MIC ACTIVE' : 'MIC SILENT'} (level: ${level})`);
        }
      });

      // 5. Initialize Continuous Conversational Speech Handler
      this.initSpeechRecognition(langMode);

      listener.onPipelineChange?.(agentRes.pipeline || 'primary');
      listener.onStateChange?.('LISTENING');
    } catch (err: any) {
      console.warn('[AGORA VOICE ENGINE] Failed to start voice session:', err);
      listener.onError?.(err.message || 'Failed to connect to Agora AI Tutor.');
      listener.onStateChange?.('ERROR');
    } finally {
      this.isJoining = false;
    }
  }

  private initSpeechRecognition(langMode: SupportedLanguageMode): void {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      console.log('[AI_VOICE] Browser Web Speech Recognition not available in this environment.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      // Language selection
      if (langMode === 'ta' || langMode === 'tanglish') {
        this.recognition.lang = 'ta-IN';
      } else if (langMode === 'hi' || langMode === 'hinglish') {
        this.recognition.lang = 'hi-IN';
      } else {
        this.recognition.lang = 'en-US';
      }

      this.recognition.onstart = () => {
        if (!this.active) return;
        console.log('[AI_VOICE] 🎙️ Speech recognition listening on language:', this.recognition.lang);
        if (!this.speaking && !this.isProcessingTurn) {
          this.listener?.onStateChange?.('LISTENING');
        }
      };

      this.recognition.onresult = async (event: any) => {
        if (!this.active) return;

        // If user speaks while AI is speaking -> handle interruption
        if (this.speaking) {
          console.log('[AI_VOICE] User speech detected during playback. Triggering interruption.');
          await this.interrupt(this.classId);
        }

        if (this.isProcessingTurn) return;

        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += trans;
          } else {
            interim += trans;
          }
        }

        if (interim && !finalChunk) {
          this.listener?.onInterimTranscript?.(interim, 'user');
        }

        if (finalChunk && finalChunk.trim()) {
          const userQuery = finalChunk.trim();
          console.log(`[AI_VOICE_STUDENT_QUERY] "${userQuery}"`);
          this.listener?.onFinalTranscript?.(userQuery, 'user');
          await this.handleUserQuery(userQuery);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[AI_VOICE] Recognition event notice:', event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.active && !this.speaking && !this.isProcessingTurn) {
          try {
            this.recognition?.start();
          } catch {}
        }
      };

      this.recognition.start();
    } catch (err) {
      console.warn('[AI_VOICE] SpeechRecognition init non-fatal warning:', err);
    }
  }

  private async handleUserQuery(query: string): Promise<void> {
    if (!this.active || this.isProcessingTurn) return;
    this.isProcessingTurn = true;
    this.listener?.onStateChange?.('THINKING');

    try {
      // Pause recognition while thinking
      try {
        this.recognition?.stop();
      } catch {}

      const res = await api.sendClassroomMessage(this.classId, query, 'voice');
      const answer =
        res.message?.content ||
        (res as any).answer ||
        (res as any).reply ||
        "I've checked the class notes for that topic.";

      console.log(`[AI_VOICE_AI_RESPONSE] "${answer.slice(0, 100)}..."`);
      this.listener?.onFinalTranscript?.(answer, 'assistant');

      // Speak response aloud to student's speakers
      this.speakResponse(answer, () => {
        this.isProcessingTurn = false;
        if (this.active) {
          this.listener?.onStateChange?.('LISTENING');
          try {
            this.recognition?.start();
          } catch {}
        }
      });
    } catch (err: any) {
      console.warn('[AI_VOICE] Query error:', err);
      this.isProcessingTurn = false;
      this.listener?.onError?.(err.message || 'Error processing speech query');
      if (this.active) {
        this.listener?.onStateChange?.('LISTENING');
        try {
          this.recognition?.start();
        } catch {}
      }
    }
  }

  private speakResponse(text: string, onDone?: () => void): void {
    if (!text || typeof window === 'undefined' || !this.synth) {
      onDone?.();
      return;
    }

    try {
      this.synth.cancel();
      this.speaking = true;
      this.listener?.onStateChange?.('SPEAKING');
      this.listener?.onSpeechStart?.();

      // Clean markdown symbols, citations, and metadata for natural speech output
      const spokenClean = text
        .replace(/📘[^\n]+/g, '')
        .replace(/\[Source[^\]]+\]/g, '')
        .replace(/[*_#`$]/g, '')
        .replace(/\n+/g, ' ')
        .trim();

      const voices = this.synth.getVoices();
      const hasTamilScript = /[\u0B80-\u0BFF]/.test(spokenClean);
      const hasHindiScript = /[\u0900-\u097F]/.test(spokenClean);

      // 1. Voice Discovery
      const tamilVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith('ta') ||
        v.name.toLowerCase().includes('tamil') ||
        v.name.includes('தமிழ்') ||
        v.name.toLowerCase().includes('valluvar') ||
        v.name.toLowerCase().includes('kani')
      );

      const hindiVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith('hi') ||
        v.name.toLowerCase().includes('hindi') ||
        v.name.includes('हिन्दी') ||
        v.name.toLowerCase().includes('kalpana') ||
        v.name.toLowerCase().includes('hemant')
      );

      const indianEnglishVoice = voices.find((v) =>
        v.lang.toLowerCase().includes('en-in') ||
        v.name.toLowerCase().includes('india') ||
        v.name.toLowerCase().includes('heera') ||
        v.name.toLowerCase().includes('neerja') ||
        v.name.toLowerCase().includes('prabhat')
      );

      const naturalEnglishVoice = voices.find((v) =>
        (v.name.includes('Jenny') ||
          v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Microsoft') ||
          v.name.includes('David')) &&
        v.lang.startsWith('en')
      ) || voices.find((v) => v.lang.startsWith('en'));

      let preferredVoice: SpeechSynthesisVoice | undefined;
      let targetLang = 'en-US';
      let textToSpeak = spokenClean;

      // 2. Multilingual Voice & Transliteration Routing
      if (hasTamilScript || this.currentLanguageMode === 'ta' || this.currentLanguageMode === 'tanglish') {
        if (tamilVoice) {
          preferredVoice = tamilVoice;
          targetLang = 'ta-IN';
          textToSpeak = spokenClean;
          console.log('[AI_VOICE_TTS] Using Native Tamil Voice:', tamilVoice.name);
        } else {
          // If OS does not have a native Tamil voice pack, transliterate Tamil characters to phonetic Tanglish
          // so the Indian English / Natural TTS voice speaks the full Tamil content instead of skipping it!
          preferredVoice = indianEnglishVoice || naturalEnglishVoice;
          targetLang = 'en-IN';
          textToSpeak = transliterateTamilToPhonetic(spokenClean);
          console.log('[AI_VOICE_TTS] Fallback: Phonetic Tanglish TTS for English voice:', textToSpeak);
        }
      } else if (hasHindiScript || this.currentLanguageMode === 'hi' || this.currentLanguageMode === 'hinglish') {
        if (hindiVoice) {
          preferredVoice = hindiVoice;
          targetLang = 'hi-IN';
          textToSpeak = spokenClean;
          console.log('[AI_VOICE_TTS] Using Native Hindi Voice:', hindiVoice.name);
        } else {
          preferredVoice = indianEnglishVoice || naturalEnglishVoice;
          targetLang = 'en-IN';
          textToSpeak = transliterateHindiToPhonetic(spokenClean);
          console.log('[AI_VOICE_TTS] Fallback: Phonetic Hinglish TTS for English voice:', textToSpeak);
        }
      } else {
        preferredVoice = naturalEnglishVoice;
        targetLang = 'en-US';
        textToSpeak = spokenClean;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak || spokenClean || text);
      utterance.lang = targetLang;
      utterance.rate = 0.95; // Clear, comfortable pacing
      utterance.pitch = 1.0;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.speaking = false;
        this.listener?.onSpeechEnd?.();
        onDone?.();
      };

      utterance.onerror = (e) => {
        console.warn('[AI_VOICE_TTS_ERROR]', e);
        this.speaking = false;
        this.listener?.onSpeechEnd?.();
        onDone?.();
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[AI_VOICE_SPEAK_EXCEPTION]', err);
      this.speaking = false;
      onDone?.();
    }
  }

  public async interrupt(classId: string): Promise<void> {
    console.log(`[AI_VOICE_INTERRUPT] Interrupting current turn on class ${classId}`);
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.speaking = false;
    this.isProcessingTurn = false;
    this.listener?.onSpeechEnd?.();
    this.listener?.onStateChange?.('INTERRUPTED');

    try {
      await api.interruptClassroomAgent(classId);
    } catch {}

    setTimeout(() => {
      if (this.active) {
        this.listener?.onStateChange?.('LISTENING');
        try {
          this.recognition?.start();
        } catch {}
      }
    }, 200);
  }

  public async stopSession(classId: string): Promise<void> {
    this.active = false;
    this.cleanup();
    try {
      await api.stopClassroomAgent(classId);
    } catch {}
    this.listener?.onStateChange?.('IDLE');
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public cleanup(): void {
    if (this.currentSessionId) {
      console.log(`[AI_VOICE_SESSION_STOP] sessionId=${this.currentSessionId} classId=${this.classId}`);
      this.currentSessionId = '';
    }

    this.active = false;
    this.speaking = false;
    this.isProcessingTurn = false;
    this.isJoining = false;
    this.lastMicActiveState = false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }

    if (this.localMicTrack) {
      try {
        this.localMicTrack.stop();
        this.localMicTrack.close();
      } catch {}
      this.localMicTrack = null;
    }

    if (this.client) {
      try {
        const client = this.client;
        this.client = null;
        client.removeAllListeners();
        if (client.connectionState === 'CONNECTED' || client.connectionState === 'CONNECTING') {
          client.leave().catch(() => {});
        }
      } catch {}
    }

    this.listener = null;
  }
}

export function createVoiceEngine(): IVoiceEngine {
  return new ClassPulseAgoraVoiceEngine();
}

/**
 * High-accuracy phonetic Tamil-to-Tanglish transliterator for SpeechSynthesis.
 * Ensures every Tamil word is pronounced aloud cleanly when no native Tamil OS voice pack is installed.
 */
export function transliterateTamilToPhonetic(text: string): string {
  if (!text || !/[\u0B80-\u0BFF]/.test(text)) return text;

  // High-frequency whole-word dictionary mapping for natural, fluent speech pronunciation
  const wordMap: Record<string, string> = {
    'வணக்கம்': 'Vanakkam',
    'வணக்கம்!': 'Vanakkam!',
    'நான்': 'Naan',
    'இன்றைய': 'Inraiya',
    'பாடக்': 'Paada',
    'பாடத்': 'Paadha',
    'பாடத்தில்': 'paadathil',
    'உங்களுக்கு': 'ungalukku',
    'உங்களுக்குப்': 'ungalukkup',
    'என்ன': 'enna',
    'சந்தேகம்': 'sandhegam',
    'சந்தேகம்?': 'sandhegam?',
    'சந்தேகங்கள்': 'sandhegangal',
    'கேளுங்கள்': 'kelungal',
    'கேளுங்கள்,': 'kelungal,',
    'விளக்குகிறேன்': 'vilakkugiren',
    'விளக்குகிறேன்!': 'vilakkugiren!',
    'விளக்கம்': 'vilakkam',
    'விளக்கம்:': 'vilakkam:',
    'நியூட்டனின்': "Newton-in",
    'முதல்': 'mudhal',
    'இரண்டாம்': 'irandaam',
    'மூன்றாம்': 'moondraam',
    'நான்காம்': 'naangaam',
    'ஐந்தாம்': 'aindhaam',
    'இயக்க': 'iyakka',
    'இயக்கவியல்': 'iyakkaviyal',
    'விதி': 'vidhi',
    'விதிகள்': 'vidhigal',
    'நிலைம': 'nilaima',
    'நிலைமம்': 'nilaimam',
    'விசை': 'visai',
    'விசைகள்': 'visaigal',
    'நிறை': 'nirai',
    'முடுக்கம்': 'mudukkam',
    'உந்தம்': 'undham',
    'வேகம்': 'vegam',
    'திசைவேகம்': 'thisaivegam',
    'ஆற்றல்': 'aatral',
    'வேலை': 'velai',
    'திறன்': 'thiran',
    'புறவிசை': 'pura visai',
    'செயல்படாத': 'seyalpadadha',
    'வரை': 'varai',
    'பொருள்': 'porul',
    'பொருளின்': 'porulin',
    'ஓய்வு': 'oyvu',
    'நிலையில்': 'nilaiyil',
    'சீரான': 'seeraana',
    'இயக்கத்தில்': 'iyakkathil',
    'தொடர்ந்து': 'thodarndhu',
    'இருக்கும்': 'irukkum',
    'பண்பு': 'panbu',
    'எனப்படும்': 'enappadum',
    'உதாரணம்': 'udhaaranam',
    'உதாரணம்:': 'udhaaranam:',
    'மகிழ்ச்சி': 'Magizhchi',
    'மகிழ்ச்சி!': 'Magizhchi!',
    'போயிட்டு': 'Poittu',
    'வாங்க': 'vaanga',
    'வாங்க!': 'vaanga!',
    'சரி': 'Sari',
    'சரிங்க': 'Saringa',
    'ஆம்': 'Aam',
    'இல்லை': 'Illai',
    'புரிகிறதா': 'Purigiradha',
    'புரிகிறதா?': 'Purigiradha?',
  };

  let result = text;
  for (const [tamilWord, phoneticWord] of Object.entries(wordMap)) {
    result = result.split(tamilWord).join(phoneticWord);
  }

  // If leftover Tamil characters exist, apply Unicode character-level transliteration
  if (/[\u0B80-\u0BFF]/.test(result)) {
    result = transliterateTamilCharacters(result);
  }

  return result;
}

function transliterateTamilCharacters(input: string): string {
  const independentVowels: Record<string, string> = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
    'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'k',
  };

  const consonants: Record<string, string> = {
    'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n',
    'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
    'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh',
  };

  const vowelSigns: Record<string, string> = {
    'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
    'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au',
  };

  let out = '';
  const chars = Array.from(input);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (independentVowels[ch]) {
      out += independentVowels[ch];
    } else if (consonants[ch]) {
      const base = consonants[ch];
      if (next === '்') {
        // Virama (silent consonant)
        out += base;
        i++;
      } else if (next && vowelSigns[next]) {
        // Attached vowel sign
        out += base + vowelSigns[next];
        i++;
      } else {
        // Inherent 'a' vowel
        out += base + 'a';
      }
    } else if (vowelSigns[ch]) {
      out += vowelSigns[ch];
    } else if (ch === '்') {
      // Standalone virama
    } else {
      out += ch;
    }
  }

  return out;
}

/**
 * Phonetic Hindi-to-Hinglish transliterator fallback for speech synthesis.
 */
export function transliterateHindiToPhonetic(text: string): string {
  if (!text || !/[\u0900-\u097F]/.test(text)) return text;
  const hindiWordMap: Record<string, string> = {
    'नमस्ते': 'Namaste',
    'नमस्ते!': 'Namaste!',
    'मैं': 'Main',
    'हूँ': 'hoon',
    'आज': 'aaj',
    'की': 'ki',
    'क्लास': 'class',
    'में': 'mein',
    'आपका': 'aapka',
    'क्या': 'kya',
    'डाउट': 'doubt',
    'सवाल': 'sawaal',
    'है': 'hai',
    'है?': 'hai?',
    'पूछिए': 'poochiye',
    'पूछिए,': 'poochiye,',
    'समझाता': 'samjhaata',
    'समझाता!': 'samjhaata!',
    'धन्यवाद': 'Dhanyavaad',
    'अलविदा': 'Alvida',
    'हाँ': 'Haan',
    'नहीं': 'Nahi',
  };
  let res = text;
  for (const [w, p] of Object.entries(hindiWordMap)) {
    res = res.split(w).join(p);
  }
  return res;
}

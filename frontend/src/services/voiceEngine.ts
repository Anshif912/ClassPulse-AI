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
 * Strict Architecture:
 * Student Microphone → Agora RTC Audio Track → Agora Conversational AI / Gemini Live Server Agent
 * → Agent Raw Audio (UID 9999) → Student Speakers.
 * 
 * Strictly NO window.speechSynthesis or webkitSpeechRecognition.
 */
export class ClassPulseAgoraVoiceEngine implements IVoiceEngine {
  public readonly id = 'classpulse_agora_native_voice';
  public readonly name = 'ClassPulse Agora RTC Conversational AI';

  private client: IAgoraRTCClient | null = null;
  private localMicTrack: IMicrophoneAudioTrack | null = null;
  private listener: VoiceEngineListener | null = null;
  private classId: string = '';
  private active = false;
  private speaking = false;
  private isProcessingTurn = false;
  private currentLanguageMode: SupportedLanguageMode = 'auto';

  // Latency Metrics Tracking
  private latencyTracker: Partial<VoiceLatencyMetrics> = {};

  public isAvailable(): boolean {
    return AgoraRTC.checkSystemRequirements();
  }

  public async startSession(
    classId: string,
    listener: VoiceEngineListener,
    langMode: SupportedLanguageMode = 'auto'
  ): Promise<void> {
    this.cleanup();
    this.listener = listener;
    this.classId = classId;
    this.currentLanguageMode = langMode;
    this.active = true;

    soundManager.unlock();
    listener.onStateChange?.('CONNECTING');

    const tMicCapture = Date.now();
    this.latencyTracker.micCapturedAt = tMicCapture;

    try {
      // 1. Initialize dedicated Agora RTC Client for Private AI Audio Stream
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Handle remote audio subscription from Agora AI Agent (UID 9999)
      this.client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: string) => {
        if (!this.active || !this.client) return;

        if (mediaType === 'audio') {
          await this.client.subscribe(user, mediaType);
          const remoteAudioTrack = user.audioTrack;
          if (remoteAudioTrack) {
            this.speaking = true;
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
          this.speaking = false;
          this.listener?.onSpeechEnd?.();
          if (this.active) {
            this.listener?.onStateChange?.('LISTENING');
          }
        }
      });

      // 2. Request backend to start/prepare server-side Agora AI Agent session
      const agentRes = await api.startClassroomAgent(classId);

      if (agentRes.state === 'unavailable') {
        listener.onError?.(agentRes.developerDiagnostic || 'Agora AI Agent service is currently unavailable.');
        listener.onStateChange?.('UNAVAILABLE');
        return;
      }

      // 3. Join the private AI voice channel
      const appId = agentRes.appId || 'demo_app_id';
      const channel = agentRes.aiChannel;
      const token = agentRes.token;
      const studentUid = Math.floor(100000 + Math.random() * 899999);

      this.latencyTracker.agentReceivedAt = Date.now();

      await this.client.join(appId, channel, token, studentUid);

      // 4. Create local microphone audio track and publish to AI channel
      this.localMicTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Active Noise Suppression
        AGC: true, // Automatic Gain Control
        encoderConfig: 'speech_standard',
      });

      await this.client.publish(this.localMicTrack);

      console.log(`[AGORA VOICE ENGINE] Connected to AI Voice Channel: ${channel} as UID ${studentUid}`);
      listener.onPipelineChange?.(agentRes.pipeline || 'primary');
      listener.onStateChange?.('LISTENING');
    } catch (err: any) {
      console.warn('[AGORA VOICE ENGINE] Failed to start voice session:', err);
      listener.onError?.(err.message || 'Failed to connect to Agora AI Tutor.');
      listener.onStateChange?.('ERROR');
    }
  }

  public async interrupt(classId: string): Promise<void> {
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
    this.active = false;
    this.speaking = false;
    this.isProcessingTurn = false;

    if (this.localMicTrack) {
      try {
        this.localMicTrack.stop();
        this.localMicTrack.close();
      } catch {}
      this.localMicTrack = null;
    }

    if (this.client) {
      try {
        this.client.leave();
        this.client.removeAllListeners();
      } catch {}
      this.client = null;
    }

    this.listener = null;
  }
}

export function createVoiceEngine(): IVoiceEngine {
  return new ClassPulseAgoraVoiceEngine();
}

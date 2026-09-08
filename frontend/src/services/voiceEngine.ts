import { api } from './api';
import { soundManager } from './soundManager';

export interface VoiceEngineListener {
  onInterimTranscript?: (text: string, role?: 'user' | 'assistant') => void;
  onFinalTranscript?: (text: string, role?: 'user' | 'assistant') => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: string) => void;
  onPipelineChange?: (pipeline: 'primary' | 'fallback') => void;
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
  startSession(classId: string, listener: VoiceEngineListener): Promise<void>;
  stopSession(classId: string): Promise<void>;
  interrupt(classId: string): Promise<void>;
  isSpeaking(): boolean;
  cleanup(): void;
}

export class ClassPulseResponsiveVoiceEngine implements IVoiceEngine {
  public readonly id = 'classpulse_responsive_voice';
  public readonly name = 'ClassPulse AI Voice (RAG Grounded)';

  private recognition: any = null;
  private listener: VoiceEngineListener | null = null;
  private classId: string = '';
  private active = false;
  private speaking = false;
  private isProcessingTurn = false;

  public isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public async startSession(classId: string, listener: VoiceEngineListener): Promise<void> {
    this.cleanup();
    this.listener = listener;
    this.classId = classId;
    this.active = true;

    soundManager.unlock();
    listener.onStateChange?.('CONNECTING');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      listener.onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      listener.onStateChange?.('UNAVAILABLE');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        if (!this.active) return;
        console.log('[AI VOICE] 🎙️ Speech recognition active and listening...');
        this.listener?.onStateChange?.('LISTENING');
      };

      this.recognition.onresult = async (event: any) => {
        if (!this.active || this.speaking || this.isProcessingTurn) return;

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

        if (interim) {
          this.listener?.onInterimTranscript?.(interim, 'user');
        }

        if (finalChunk && finalChunk.trim()) {
          const userQuery = finalChunk.trim();
          console.log(`[USER VOICE QUERY] ${userQuery}`);
          this.listener?.onFinalTranscript?.(userQuery, 'user');
          await this.handleUserQuery(userQuery);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[AI VOICE] Recognition event:', event.error);
        if (event.error === 'not-allowed') {
          this.listener?.onError?.('Microphone access denied. Please allow microphone permissions.');
          this.listener?.onStateChange?.('ERROR');
        } else if (event.error !== 'no-speech') {
          // Non-fatal
        }
      };

      this.recognition.onend = () => {
        // Auto-restart recognition if session is still active and not speaking
        if (this.active && !this.speaking && !this.isProcessingTurn) {
          try {
            this.recognition?.start();
          } catch {}
        }
      };

      this.recognition.start();

      // Play greeting announcement
      this.speakText(
        'Hello! I am your ClassPulse AI tutor. Ask me anything about your class notes.',
        () => {
          if (this.active) {
            this.listener?.onStateChange?.('LISTENING');
          }
        }
      );
    } catch (err: any) {
      console.error('[AI VOICE ERROR]', err);
      listener.onError?.(err.message || 'Failed to start AI Voice');
      listener.onStateChange?.('ERROR');
    }
  }

  private async handleUserQuery(query: string): Promise<void> {
    if (!this.active || this.isProcessingTurn) return;
    this.isProcessingTurn = true;
    this.listener?.onStateChange?.('THINKING');

    try {
      // Temporarily pause recognition while thinking
      try {
        this.recognition?.stop();
      } catch {}

      const res = await api.sendClassroomMessage(this.classId, query, 'voice');
      const answer = res.message?.content || (res as any).answer || "I couldn't find information on that in the notes.";

      console.log(`[AI VOICE ANSWER] ${answer}`);
      this.listener?.onFinalTranscript?.(answer, 'assistant');

      // Speak response aloud
      this.speakText(answer, () => {
        this.isProcessingTurn = false;
        if (this.active) {
          this.listener?.onStateChange?.('LISTENING');
          try {
            this.recognition?.start();
          } catch {}
        }
      });
    } catch (err: any) {
      console.warn('[AI VOICE QUERY ERROR]', err);
      this.isProcessingTurn = false;
      this.listener?.onError?.(err.message || 'Error answering question');
      if (this.active) {
        this.listener?.onStateChange?.('LISTENING');
        try {
          this.recognition?.start();
        } catch {}
      }
    }
  }

  private speakText(text: string, onDone?: () => void): void {
    // Browser speechSynthesis is completely removed per production voice architecture.
    // Conversational AI voice is streamed directly over Agora RTC channel 9999.
    this.speaking = false;
    this.listener?.onSpeechEnd?.();
    onDone?.();
  }

  public async interrupt(classId: string): Promise<void> {
    this.speaking = false;
    this.isProcessingTurn = false;
    this.listener?.onSpeechEnd?.();
    this.listener?.onStateChange?.('INTERRUPTED');
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
    this.listener?.onStateChange?.('IDLE');
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public cleanup(): void {
    this.active = false;
    this.speaking = false;
    this.isProcessingTurn = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.listener = null;
  }
}

export function createVoiceEngine(): IVoiceEngine {
  return new ClassPulseResponsiveVoiceEngine();
}

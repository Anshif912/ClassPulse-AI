import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { VoiceState } from '../types';

interface UseVoiceOptions {
  voiceMode: 'agora' | 'browser_fallback';
  agoraConfig?: {
    appId: string;
    channelName: string;
    token: string;
    uid: number;
    agentConfigured: boolean;
  };
  onRecognizedSpeech?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoice({ voiceMode, agoraConfig, onRecognizedSpeech, onError }: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [activeVoiceMode, setActiveVoiceMode] = useState<'agora' | 'browser_fallback'>(voiceMode);

  // Agora refs
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  // Web Speech API refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Auto-stop inactivity timer (Fix 4)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[VOICE] Inactivity timeout (5 mins) reached. Stopping local microphone.');
      stopListening();
    }, 5 * 60 * 1000);
  }, []);

  // Initialize Speech Recognition for Browser Fallback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setVoiceState('listening');
          setIsMicActive(true);
          resetInactivityTimer();
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);

          if (event.results[0].isFinal) {
            setVoiceState('thinking');
            if (onRecognizedSpeech && currentTranscript.trim()) {
              onRecognizedSpeech(currentTranscript.trim());
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[SPEECH RECOGNITION ERROR]', event.error);
          if (event.error === 'not-allowed') {
            onError?.('Microphone access was denied. Please allow microphone permissions in your browser.');
          } else if (event.error !== 'no-speech') {
            onError?.(`Voice error: ${event.error}`);
          }
          setVoiceState('idle');
          setIsMicActive(false);
        };

        recognition.onend = () => {
          setIsMicActive(false);
          setVoiceState(prev => (prev === 'listening' ? 'idle' : prev));
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [onRecognizedSpeech, onError, resetInactivityTimer]);

  // Clean teardown on unmount & beforeunload (Fix 4)
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopAllAudio();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopAllAudio();
    };
  }, []);

  const stopAllAudio = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    if (synthRef.current) {
      try { synthRef.current.cancel(); } catch {}
    }
    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
      } catch {}
      localAudioTrackRef.current = null;
    }
    if (agoraClientRef.current) {
      try { agoraClientRef.current.leave(); } catch {}
      agoraClientRef.current = null;
    }
    setVoiceState('idle');
    setIsMicActive(false);
  }, []);

  // Speak AI answer aloud with natural female voice
  const speakText = useCallback((text: string, onComplete?: () => void) => {
    if (!text || typeof window === 'undefined') return;

    if (synthRef.current) {
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find(
        v => (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Google UK English Female') || v.name.includes('Zira')) && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setVoiceState('speaking');
        resetInactivityTimer();
      };

      utterance.onend = () => {
        setVoiceState('idle');
        onComplete?.();
      };

      utterance.onerror = () => {
        setVoiceState('idle');
        onComplete?.();
      };

      synthRef.current.speak(utterance);
    }
  }, [resetInactivityTimer]);

  const startListening = useCallback(() => {
    setTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('[VOICE] Speech recognition start notice:', err.message);
      }
    } else {
      onError?.('Speech recognition is not supported in this browser. Please use Chrome or Edge, or type your question.');
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsMicActive(false);
    setVoiceState(prev => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const toggleListening = useCallback(() => {
    if (isMicActive) {
      stopListening();
    } else {
      startListening();
    }
  }, [isMicActive, startListening, stopListening]);

  return {
    voiceState,
    setVoiceState,
    isMicActive,
    transcript,
    activeVoiceMode,
    startListening,
    stopListening,
    toggleListening,
    speakText,
    stopAllAudio,
  };
}

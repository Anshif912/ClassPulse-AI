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

  // Auto-stop inactivity timer (Fix 4)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[VOICE] Inactivity timeout (5 mins) reached. Stopping local microphone.');
      stopListening();
    }, 5 * 60 * 1000);
  }, []);

  // Browser Web Speech API strictly disabled in favor of Agora Conversational AI Agent
  useEffect(() => {
    // Zero browser fallback: Web Speech API is permanently disabled in production
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [onRecognizedSpeech, onError, resetInactivityTimer]);

  // Clean teardown on unmount & beforeunload
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

  const speakText = useCallback((_text: string, onComplete?: () => void) => {
    // Browser speechSynthesis is completely removed. Agent audio is streamed over Agora RTC.
    onComplete?.();
  }, []);

  const startListening = useCallback(() => {
    onError?.('Direct microphone voice is powered by Agora Conversational AI Agent in the classroom panel.');
  }, [onError]);

  const stopListening = useCallback(() => {
    setIsMicActive(false);
    setVoiceState('idle');
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

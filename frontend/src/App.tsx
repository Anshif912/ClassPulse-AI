import React, { useState, useCallback } from 'react';
import { Session, ChatMessage, SessionSummary } from './types';
import { LandingPage } from './components/LandingPage';
import { CompanionView } from './components/CompanionView';
import { DemoModeBar } from './components/DemoModeBar';
import { MeetSidePanel } from './components/addon/MeetSidePanel';
import { MeetMainStage } from './components/addon/MeetMainStage';
import { useVoice } from './hooks/useVoice';
import { api } from './services/api';
import {
  DEMO_SCRIPT_STEPS,
  createMockDemoSession,
  generateDemoSummary,
} from './services/demoScript';

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [successStatus, setSuccessStatus] = useState<string | undefined>(undefined);
  const [proactiveSuggestion, setProactiveSuggestion] = useState<string | undefined>(undefined);

  // Demo Mode State
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStepIndex, setDemoStepIndex] = useState(0);

  // Agora Voice & Fallback hook
  const {
    voiceState,
    isMicActive,
    transcript,
    activeVoiceMode,
    toggleListening,
    speakText,
    stopAllAudio,
  } = useVoice({
    voiceMode: 'browser_fallback',
    onRecognizedSpeech: (recognizedText) => {
      handleSendMessage(recognizedText, 'voice');
    },
    onError: (err) => {
      console.warn('[VOICE HOOK ERROR]', err);
    },
  });

  // Handle Joining Live Class Session
  const handleJoinSession = async (meetUrl: string, participantName: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    setSuccessStatus(undefined);

    const trimmedInput = meetUrl.trim();

    // Frontend Development Debug Logging (Item 9)
    console.log('%c[ClassPulse Meet Debug — Join Attempt]', 'color: #3b82f6; font-weight: bold; font-size: 13px;');
    console.log('• Original User Input:', meetUrl);
    console.log('• Trimmed Input:      ', trimmedInput);

    try {
      // 1. Create session on backend
      const res = await api.createSession(trimmedInput, participantName);
      
      const targetMeetUrl = res.session.meetingUrl || res.session.normalizedMeetingUrl || trimmedInput;

      // Debugging logs (Item 9)
      console.log('• Validation Result:   VALID');
      console.log('• Final URL Opened:   ', targetMeetUrl);
      console.log('• Was URL Modified:   ', meetUrl !== targetMeetUrl);
      console.log('• Delivery Method:     External Window/Tab (window.open — NO iframe)');
      console.log('----------------------------------------------------');

      setSuccessStatus('The meeting link is valid. Opening Google Meet in a new window.');

      // 2. Open Real Google Meet in New Tab (Core Companion Architecture)
      // We use standard window.open without 'noreferrer' so Google login sessions continue smoothly
      try {
        const openedWindow = window.open(targetMeetUrl, '_blank');
        if (!openedWindow) {
          console.warn('[ClassPulse] Popup may be blocked by browser. Please allow popups or click "Google Meet Tab".');
        }
      } catch (e) {
        console.warn('Could not auto-open new tab, popup might be blocked:', e);
      }

      // 3. Mount Companion in current tab
      setSession(res.session);
      setMessages([]);
      setIsDemoMode(false);

      // Start Agora agent if configured
      if (res.voiceMode === 'agora' && res.agora?.channelName) {
        api.startAgoraAgent(res.agora.channelName, res.session.id).catch(console.warn);
      }
    } catch (err: any) {
      console.error('[ClassPulse Meet Validation Error]', err);
      setErrorMessage(
        err.message || 'Invalid Google Meet link. Please paste the complete meeting URL (e.g. https://meet.google.com/abc-defg-hij).'
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle User Message (Text or Voice)
  const handleSendMessage = useCallback(
    async (text: string, source: 'text' | 'voice' = 'text') => {
      if (!text.trim() || isProcessing) return;

      const now = new Date().toISOString();
      const studentMsg: ChatMessage = {
        id: `msg_${Date.now()}_student`,
        sessionId: session?.id || 'demo_session',
        role: 'student',
        content: text,
        timestamp: now,
      };

      setMessages((prev) => [...prev, studentMsg]);
      setIsProcessing(true);

      // --- DEMO MODE HANDLER ---
      if (isDemoMode) {
        setTimeout(() => {
          const match = DEMO_SCRIPT_STEPS.find(
            (s) => s.userPrompt.toLowerCase() === text.toLowerCase() ||
                   text.toLowerCase().includes(s.userPrompt.toLowerCase())
          ) || DEMO_SCRIPT_STEPS[demoStepIndex] || DEMO_SCRIPT_STEPS[0];

          const companionMsg: ChatMessage = {
            id: `msg_${Date.now()}_companion`,
            sessionId: 'demo_session',
            role: 'companion',
            content: match.companionAnswer,
            timestamp: new Date().toISOString(),
            intent: match.intent,
            ragContext: match.topic ? {
              topic: match.topic,
              chapter: match.chapter || '',
              relevanceScore: 1.0,
              matchedKeywords: [match.topic],
            } : undefined,
          };

          setMessages((prev) => [...prev, companionMsg]);
          setIsProcessing(false);

          speakText(match.spokenAudioText);
        }, 600);
        return;
      }

      // --- LIVE BACKEND HANDLER ---
      if (!session) return;

      try {
        const res = await api.sendMessage(session.id, text, source);
        setMessages((prev) => [...prev, res.message]);

        if (res.proactiveSuggestion) {
          setProactiveSuggestion(res.proactiveSuggestion);
        }

        if (res.spokenText) {
          speakText(res.spokenText);
        }
      } catch (err: any) {
        console.error('Chat error:', err);
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_error`,
          sessionId: session.id,
          role: 'companion',
          content: 'Sorry, I encountered an issue analyzing that question. Please try rephrasing.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [session, isDemoMode, isProcessing, demoStepIndex, speakText]
  );

  // Handle Ending Session
  const handleEndSession = async (): Promise<SessionSummary> => {
    stopAllAudio();

    if (isDemoMode) {
      return generateDemoSummary(messages);
    }

    if (!session) {
      throw new Error('No active session.');
    }

    try {
      const res = await api.endSession(session.id);
      return res.summary;
    } catch (err: any) {
      console.error('Error ending backend session:', err);
      return generateDemoSummary(messages);
    }
  };

  // Launch Scripted Demo Mode
  const handleLaunchDemoMode = () => {
    stopAllAudio();
    const mock = createMockDemoSession();
    setSession(mock);
    setMessages([]);
    setIsDemoMode(true);
    setDemoStepIndex(0);
    setErrorMessage(undefined);
    setSuccessStatus(undefined);
  };

  // Demo Step Selector
  const handleSelectDemoStep = (stepIndex: number) => {
    const step = DEMO_SCRIPT_STEPS[stepIndex];
    if (!step) return;
    setDemoStepIndex(stepIndex);
    handleSendMessage(step.userPrompt, 'text');
  };

  const handleNextDemoStep = () => {
    const nextIdx = (demoStepIndex + 1) % DEMO_SCRIPT_STEPS.length;
    handleSelectDemoStep(nextIdx);
  };

  const handleExitDemo = () => {
    stopAllAudio();
    setSession(null);
    setMessages([]);
    setIsDemoMode(false);
  };

  const currentPath = window.location.pathname.toLowerCase();

  // 1. Google Meet Add-on Side Panel Route (Rendered inside Meet Activities panel)
  if (currentPath.includes('/addon/side-panel') || currentPath.includes('/addon-sidepanel')) {
    return <MeetSidePanel />;
  }

  // 2. Google Meet Add-on Main Stage Route (Rendered inside Meet collaborative stage)
  if (currentPath.includes('/addon/main-stage') || currentPath.includes('/addon-mainstage')) {
    return <MeetMainStage />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      {isDemoMode && (
        <DemoModeBar
          currentStepIndex={demoStepIndex}
          onSelectStep={handleSelectDemoStep}
          onNextStep={handleNextDemoStep}
          onExitDemo={handleExitDemo}
        />
      )}

      {!session ? (
        <LandingPage
          onJoinSession={handleJoinSession}
          onLaunchDemoMode={handleLaunchDemoMode}
          isLoading={isLoading}
          errorMessage={errorMessage}
          successStatus={successStatus}
        />
      ) : (
        <CompanionView
          session={session}
          messages={messages}
          voiceState={voiceState}
          isMicActive={isMicActive}
          transcript={transcript}
          voiceMode={activeVoiceMode}
          proactiveSuggestion={proactiveSuggestion}
          isProcessing={isProcessing}
          onSendMessage={handleSendMessage}
          onToggleMic={toggleListening}
          onEndSession={handleEndSession}
          onExitToHome={() => {
            stopAllAudio();
            setSession(null);
            setMessages([]);
            setIsDemoMode(false);
          }}
          onUploadNote={async (note) => {
            if (session && !isDemoMode) {
              await api.uploadNotes(session.id, note);
            }
          }}
        />
      )}
    </div>
  );
};

export default App;

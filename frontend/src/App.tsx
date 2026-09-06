import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { Session, ChatMessage, SessionSummary } from './types';

// ── Auth ──────────────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';

// ── Native Classroom Routes ────────────────────────────────────────────────────
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { ClassroomPage } from './components/ClassroomPage';
import { SettingsPage } from './components/SettingsPage';

// ── Legacy Companion Routes (preserved) ────────────────────────────────────────
import { CompanionView } from './components/CompanionView';
import { DemoModeBar } from './components/DemoModeBar';
import { LandingPage } from './components/LandingPage';
import { MeetSidePanel } from './components/addon/MeetSidePanel';
import { MeetMainStage } from './components/addon/MeetMainStage';
import { useVoice } from './hooks/useVoice';
import { api } from './services/api';
import {
  DEMO_SCRIPT_STEPS,
  createMockDemoSession,
  generateDemoSummary,
} from './services/demoScript';

// ─── Auth callback page — handles ?auth_error= from OAuth redirect ────────────
function AuthCallbackPage() {
  const [params] = useSearchParams();
  const authError = params.get('auth_error');
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage authError={authError} />;
}

// ─── Protected dashboard — routes by role ─────────────────────────────────────
function DashboardRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'TEACHER') return <TeacherDashboard />;
  return <StudentDashboard />;
}

// ─── Protected classroom route ────────────────────────────────────────────────
function ProtectedClassroomRoute() {
  const { user, isLoading } = useAuth();
  const [params] = useSearchParams();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Preserve the current path so we can redirect back after login
    return <Navigate to="/" replace />;
  }

  return <ClassroomPage />;
}

// ─── Legacy Google Meet companion app (preserved at /companion) ───────────────
function LegacyCompanionApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [successStatus, setSuccessStatus] = useState<string | undefined>(undefined);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStepIndex, setDemoStepIndex] = useState(0);

  const { voiceState, isMicActive, transcript, activeVoiceMode, toggleListening, speakText, stopAllAudio } =
    useVoice({
      voiceMode: 'browser_fallback',
      onRecognizedSpeech: (t) => handleSendMessage(t, 'voice'),
      onError: (err) => console.warn('[VOICE]', err),
    });

  const handleJoinSession = async (meetUrl: string, participantName: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const res = await api.createSession(meetUrl, participantName);
      try { window.open(res.session.meetingUrl || meetUrl, '_blank'); } catch {}
      setSuccessStatus('The meeting link is valid. Opening Google Meet in a new window.');
      setSession(res.session);
      setMessages([]);
      setIsDemoMode(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid Google Meet link.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(async (text: string, source: 'text' | 'voice' = 'text') => {
    if (!text.trim() || isProcessing) return;
    const studentMsg: ChatMessage = {
      id: `msg_${Date.now()}_student`,
      sessionId: session?.id || 'demo',
      role: 'student',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, studentMsg]);
    setIsProcessing(true);

    if (isDemoMode) {
      setTimeout(() => {
        const match = DEMO_SCRIPT_STEPS[demoStepIndex] || DEMO_SCRIPT_STEPS[0];
        const companionMsg: ChatMessage = {
          id: `msg_${Date.now()}_companion`,
          sessionId: 'demo',
          role: 'companion',
          content: match.companionAnswer,
          timestamp: new Date().toISOString(),
          intent: match.intent,
        };
        setMessages((prev) => [...prev, companionMsg]);
        setIsProcessing(false);
        speakText(match.spokenAudioText);
      }, 600);
      return;
    }

    if (!session) return;
    try {
      const res = await api.sendMessage(session.id, text, source);
      setMessages((prev) => [...prev, res.message]);
      if (res.spokenText) speakText(res.spokenText);
    } catch {
      setMessages((prev) => [...prev, {
        id: `msg_${Date.now()}_err`,
        sessionId: session.id,
        role: 'companion',
        content: 'Sorry, I encountered an issue.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [session, isDemoMode, isProcessing, demoStepIndex, speakText]);

  const handleEndSession = async (): Promise<SessionSummary> => {
    stopAllAudio();
    if (isDemoMode) return generateDemoSummary(messages);
    if (!session) throw new Error('No session.');
    try { return (await api.endSession(session.id)).summary; } catch { return generateDemoSummary(messages); }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      {isDemoMode && (
        <DemoModeBar
          currentStepIndex={demoStepIndex}
          onSelectStep={(i) => { setDemoStepIndex(i); handleSendMessage(DEMO_SCRIPT_STEPS[i].userPrompt); }}
          onNextStep={() => { const n = (demoStepIndex + 1) % DEMO_SCRIPT_STEPS.length; setDemoStepIndex(n); handleSendMessage(DEMO_SCRIPT_STEPS[n].userPrompt); }}
          onExitDemo={() => { stopAllAudio(); setSession(null); setMessages([]); setIsDemoMode(false); }}
        />
      )}
      {!session ? (
        <LandingPage
          onJoinSession={handleJoinSession}
          onLaunchDemoMode={() => { stopAllAudio(); setSession(createMockDemoSession()); setMessages([]); setIsDemoMode(true); setDemoStepIndex(0); }}
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
          isProcessing={isProcessing}
          onSendMessage={handleSendMessage}
          onToggleMic={toggleListening}
          onEndSession={handleEndSession}
          onExitToHome={() => { stopAllAudio(); setSession(null); setMessages([]); setIsDemoMode(false); }}
          onUploadNote={async (note) => { if (session && !isDemoMode) await api.uploadNotes(session.id, note); }}
        />
      )}
    </div>
  );
}

// ─── 404 ─────────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-6xl font-black text-slate-800">404</p>
        <p className="text-xl font-bold">Page Not Found</p>
        <a href="/" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors mt-2">
          Go Home
        </a>
      </div>
    </div>
  );
}

// ─── Google Meet Add-on routes (must run before React Router) ─────────────────
const currentPath = window.location.pathname.toLowerCase();

// ─── Protected settings route ────────────────────────────────────────────────
function ProtectedSettingsRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return <SettingsPage />;
}


// ─── Root App ─────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  // Meet add-on routes don't need auth
  if (currentPath.includes('/addon/side-panel')) return <MeetSidePanel />;
  if (currentPath.includes('/addon/main-stage')) return <MeetMainStage />;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — Landing / Hero */}
          <Route path="/" element={<LandingPage />} />

          {/* Public — Login / OAuth callback */}
          <Route path="/login" element={<AuthCallbackPage />} />

          {/* Protected — role-based dashboard */}
          <Route path="/dashboard" element={<DashboardRoute />} />

          {/* Protected — classroom */}
          <Route path="/class/:classId" element={<ProtectedClassroomRoute />} />

          {/* Protected — settings */}
          <Route path="/settings" element={<ProtectedSettingsRoute />} />

          {/* Legacy Google Meet companion (no auth required) */}
          <Route path="/companion" element={<LegacyCompanionApp />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;


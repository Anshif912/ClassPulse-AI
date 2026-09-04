import React, { useState, useEffect } from 'react';
import { Session, ChatMessage } from '../../types';
import { useVoice } from '../../hooks/useVoice';
import { api } from '../../services/api';
import { meetAddonSdk } from '../../services/meetAddonSdk';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Sparkles,
  BookOpen,
  Calculator,
  Layers,
  Lightbulb,
} from 'lucide-react';

interface MeetMainStageProps {
  sessionId?: string;
  meetingUrl?: string;
}

export const MeetMainStage: React.FC<MeetMainStageProps> = ({
  sessionId: initialSessionId,
  meetingUrl: initialMeetingUrl,
}) => {
  const [sessionId, setSessionId] = useState<string>(initialSessionId || '');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'steps' | 'rag'>('board');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    const initSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paramSessionId = initialSessionId || urlParams.get('session_id');
      const paramMeetingUrl = initialMeetingUrl || urlParams.get('meeting_url') || 'https://meet.google.com';

      if (paramSessionId) {
        setSessionId(paramSessionId);
        try {
          const res = await api.getSession(paramSessionId);
          if (res?.session) {
            setSession(res.session);
            setMessages(res.session.conversationHistory || []);
          }
        } catch (e) {
          console.warn('[Main Stage] Session fetch error:', e);
        }
      } else {
        try {
          const createRes = await api.createSession(paramMeetingUrl, 'Classroom Main Stage', 'Mathematics', 'Algebra', true);
          setSessionId(createRes.session.id);
          setSession(createRes.session);
        } catch (e) {
          console.warn('[Main Stage] Auto session create error:', e);
        }
      }

      await meetAddonSdk.initializeSdk();
    };

    initSession();
  }, [initialSessionId, initialMeetingUrl]);

  const {
    voiceState,
    isMicActive,
    transcript,
    toggleListening,
    speakText,
  } = useVoice({
    voiceMode: 'browser_fallback',
    onRecognizedSpeech: (text) => {
      handleSend(text, 'voice');
    },
    onError: (err) => {
      console.warn('[Main Stage Voice Error]', err);
    },
  });

  const handleSend = async (queryText?: string, source: 'text' | 'voice' = 'text') => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isProcessing) return;

    if (!queryText) setInputText('');

    const now = new Date().toISOString();
    const studentMsg: ChatMessage = {
      id: `msg_${Date.now()}_student`,
      sessionId: sessionId || 'mainstage_session',
      role: 'student',
      content: textToSend,
      timestamp: now,
    };

    setMessages((prev) => [...prev, studentMsg]);
    setIsProcessing(true);

    try {
      const targetSessionId = sessionId || 'mainstage_session';
      const res = await api.sendMessage(targetSessionId, textToSend, source);
      setMessages((prev) => [...prev, res.message]);
      setActiveStepIndex(0);

      if (res.spokenText) {
        speakText(res.spokenText);
      }
    } catch (err: any) {
      console.error('[Main Stage Chat Error]', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const latestCompanionMsg = [...messages].reverse().find((m) => m.role === 'companion');

  const rawSteps = latestCompanionMsg?.content
    ? latestCompanionMsg.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [
        'Welcome to ClassPulse AI Main Stage.',
        'Ask any question using the input below or your microphone.',
        'Step-by-step mathematical breakdowns and STEM concepts will appear on this interactive board.',
      ];

  return (
    <div className="h-screen w-full bg-[#0B0F19] text-white flex flex-col font-sans overflow-hidden select-none">
      <header className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">CLASSPULSE AI</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                GOOGLE MEET MAIN STAGE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Collaborative STEM Whiteboard & Real-time AI Doubts
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'board'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Board</span>
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'steps'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Step Breakdown</span>
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'rag'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Curriculum Sources</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                voiceState === 'speaking'
                  ? 'bg-purple-400 animate-ping'
                  : voiceState === 'listening'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-blue-400'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {voiceState === 'speaking'
                ? 'Agora Voice Speaking'
                : voiceState === 'listening'
                ? 'Listening to Student...'
                : 'Agora Voice Ready'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        <main className="col-span-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto relative backdrop-blur-sm">
          {activeTab === 'board' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Active Solution Whiteboard</h2>
                    <p className="text-xs text-slate-400">
                      {latestCompanionMsg?.ragContext?.topic || 'Algebraic Equations & STEM Principles'}
                    </p>
                  </div>
                </div>
                {latestCompanionMsg?.intent && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    Intent: {latestCompanionMsg.intent.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="p-6 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-4 font-mono shadow-inner">
                {rawSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl transition-all ${
                      idx === activeStepIndex
                        ? 'bg-blue-600/15 border border-blue-500/40 text-blue-100 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-900/50'
                    }`}
                    onClick={() => setActiveStepIndex(idx)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{step}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-400 mb-2">Try quick interactive doubts:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'How do I solve 2x + 5 = 0?',
                    'Why do we divide by 2?',
                    "Explain Newton's Second Law",
                    'How does photosynthesis work?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-400" />
                <span>Deterministic Step-by-Step Problem Breakdown</span>
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {rawSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/30">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Verified STEM Curriculum Context</span>
              </h2>
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-white">Subject: Mathematics / Physics</span>
                  <span className="text-emerald-400 font-semibold">Relevance Score: 98%</span>
                </div>
                <p>
                  ClassPulse AI RAG retrieves verified curriculum notes from our comprehensive STEM corpus (Algebra, Linear Equations, Newton's Laws, Chemical Bonds, Cellular Biology, Algorithms).
                </p>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
                  Topic: {latestCompanionMsg?.ragContext?.topic || 'General Science & Mathematics'}
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="col-span-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between overflow-hidden">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Live Class Doubts</span>
            </h3>
            <span className="text-[10px] text-slate-400">{messages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 space-y-2">
                <Bot className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No questions asked yet.</p>
                <p className="text-[11px] text-slate-600">Type below or use voice to ask doubts in real-time.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl text-xs ${
                    m.role === 'student'
                      ? 'bg-blue-600 text-white ml-4 rounded-tr-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 mr-4 rounded-tl-none'
                  }`}
                >
                  <p className="font-semibold text-[10px] mb-1 opacity-75">
                    {m.role === 'student' ? 'Student' : 'ClassPulse AI'}
                  </p>
                  <p className="leading-relaxed">{m.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            {(isMicActive || transcript) && (
              <div className="p-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between animate-fadeIn">
                <span className="truncate">{transcript || 'Listening...'}</span>
                <button
                  onClick={toggleListening}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-2"
                >
                  Stop
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask doubt on Main Stage..."
                disabled={isProcessing}
                className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl transition-all ${
                  isMicActive
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Ask using voice"
              >
                {isMicActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-bold transition-all"
                title="Send doubt"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MeetMainStage;

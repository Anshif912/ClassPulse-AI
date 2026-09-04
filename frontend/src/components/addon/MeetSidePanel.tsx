import React, { useState, useEffect, useRef } from 'react';
import { Session, ChatMessage, VoiceState } from '../../types';
import { useVoice } from '../../hooks/useVoice';
import { api } from '../../services/api';
import { meetAddonSdk } from '../../services/meetAddonSdk';
import {
  Bot,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Maximize2,
  BookOpen,
  Volume2,
  AlertCircle,
  HelpCircle,
  Calculator,
} from 'lucide-react';

interface MeetSidePanelProps {
  sessionId?: string;
  meetingUrl?: string;
}

export const MeetSidePanel: React.FC<MeetSidePanelProps> = ({
  sessionId: initialSessionId,
  meetingUrl: initialMeetingUrl,
}) => {
  const [sessionId, setSessionId] = useState<string>(initialSessionId || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('Mathematics & Algebra');
  const [isAddonActive, setIsAddonActive] = useState(true);

  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Initialize or fetch session
  useEffect(() => {
    const initSession = async () => {
      // Extract from URL query params if omitted
      const urlParams = new URLSearchParams(window.location.search);
      const paramSessionId = initialSessionId || urlParams.get('session_id');
      const paramMeetingUrl = initialMeetingUrl || urlParams.get('meeting_url') || 'https://meet.google.com';

      if (paramSessionId) {
        setSessionId(paramSessionId);
        try {
          const res = await api.getSession(paramSessionId);
          if (res?.session) {
            setMessages(res.session.conversationHistory || []);
            if (res.session.currentTopic) setActiveTopic(res.session.currentTopic);
          }
        } catch (e) {
          console.warn('[Addon Side Panel] Session fetch notice:', e);
        }
      } else {
        // Auto-create addon session
        try {
          const createRes = await api.createSession(paramMeetingUrl, 'Student (Meet)', 'Mathematics', 'Algebra', true);
          setSessionId(createRes.session.id);
        } catch (e) {
          console.warn('[Addon Side Panel] Auto session create notice:', e);
        }
      }

      // Initialize Meet Add-ons SDK
      await meetAddonSdk.initializeSdk();
    };

    initSession();
  }, [initialSessionId, initialMeetingUrl]);

  // Hook for speech synthesis and voice recognition
  const {
    voiceState,
    isMicActive,
    transcript,
    activeVoiceMode,
    toggleListening,
    speakText,
  } = useVoice({
    voiceMode: 'browser_fallback',
    onRecognizedSpeech: (text) => {
      handleSend(text, 'voice');
    },
    onError: (err) => {
      console.warn('[Side Panel Voice Error]', err);
    },
  });

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = async (queryText?: string, source: 'text' | 'voice' = 'text') => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isProcessing) return;

    if (!queryText) setInputText('');

    const now = new Date().toISOString();
    const studentMsg: ChatMessage = {
      id: `msg_${Date.now()}_student`,
      sessionId: sessionId || 'addon_session',
      role: 'student',
      content: textToSend,
      timestamp: now,
    };

    setMessages((prev) => [...prev, studentMsg]);
    setIsProcessing(true);

    try {
      // If we have an active backend session
      const targetSessionId = sessionId || 'addon_session';
      const res = await api.sendMessage(targetSessionId, textToSend, source);
      setMessages((prev) => [...prev, res.message]);

      if (res.message.ragContext?.topic) {
        setActiveTopic(res.message.ragContext.topic);
      }

      // Agora Conversational AI Voice / Natural Female Voice playback (Phase 9 & 10)
      if (res.spokenText) {
        speakText(res.spokenText);
      }
    } catch (err: any) {
      console.error('[Addon Chat Error]', err);
      // Fallback local response
      const fallbackMsg: ChatMessage = {
        id: `msg_${Date.now()}_companion`,
        sessionId: sessionId || 'addon_session',
        role: 'companion',
        content: `I analyzed your doubt: "${textToSend}". In Algebra, isolate variables step by step by applying inverse operations to both sides of the equation.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speakText(`Regarding your question: isolate variables step by step by applying inverse operations to both sides.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExpandToMainStage = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const meetingUrl = urlParams.get('meeting_url') || 'https://meet.google.com';
    const mainStageUrl = `${window.location.origin}/addon/main-stage?session_id=${sessionId}&meeting_url=${encodeURIComponent(meetingUrl)}`;
    await meetAddonSdk.promoteToMainStage(mainStageUrl);
  };

  if (!isAddonActive) {
    return (
      <div className="p-4 bg-[#0B0F19] text-white h-screen flex flex-col items-center justify-center text-center space-y-3">
        <Bot className="w-8 h-8 text-blue-400" />
        <p className="text-xs text-slate-300">ClassPulse AI is minimized. You are still in your Google Meet class.</p>
        <button
          onClick={() => setIsAddonActive(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
        >
          Re-open ClassPulse AI
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0B0F19] text-white flex flex-col justify-between border-l border-slate-800 selection:bg-blue-600 selection:text-white font-sans overflow-hidden">
      {/* Side Panel Header */}
      <header className="p-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-tight text-white flex items-center gap-1">
              CLASS PULSE AI
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {voiceState === 'speaking'
                  ? 'Speaking...'
                  : voiceState === 'listening'
                  ? 'Listening...'
                  : voiceState === 'thinking'
                  ? 'Thinking...'
                  : 'Ready to Help'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExpandToMainStage}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors"
            title="Expand to Google Meet Main Stage"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Doubts Conversation Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3 text-slate-400">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-white">Ask Doubts Privately</h3>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Ask your question anytime during class without unmuting or disrupting the teacher.
              </p>
            </div>
            <div className="space-y-1.5 w-full pt-1">
              <button
                onClick={() => handleSend('How do I solve 2x + 5 = 0?')}
                className="w-full text-left p-2 rounded-xl text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                📐 How do I solve 2x + 5 = 0?
              </button>
              <button
                onClick={() => handleSend('Why do we divide by 2?')}
                className="w-full text-left p-2 rounded-xl text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                ❓ Why do we divide by 2?
              </button>
              <button
                onClick={() => handleSend("Can you explain Newton's first law?")}
                className="w-full text-left p-2 rounded-xl text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              >
                🍎 Newton's first law?
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isStudent = msg.role === 'student';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'} animate-fadeIn`}
              >
                <div
                  className={`max-w-[92%] p-3 rounded-2xl text-xs ${
                    isStudent
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {!isStudent && msg.ragContext?.topic && (
                    <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-blue-400 font-semibold">
                      {msg.intent === 'equation' ? (
                        <Calculator className="w-3 h-3" />
                      ) : (
                        <BookOpen className="w-3 h-3" />
                      )}
                      <span>{msg.ragContext.topic}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                  <div className="mt-1 text-[9px] text-right text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>ClassPulse is analyzing doubt...</span>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Voice Transcript Preview */}
      {(isMicActive || transcript) && (
        <div className="p-2 px-3 bg-slate-950 border-t border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-semibold text-emerald-400 shrink-0">Hearing:</span>
            <span className="truncate italic text-slate-200">{transcript || 'Listening...'}</span>
          </div>
          <button
            onClick={toggleListening}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-medium shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input Area */}
      <footer className="p-2.5 bg-slate-900/95 border-t border-slate-800 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask your doubt..."
            disabled={isProcessing}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessing}
            className={`p-2 rounded-xl text-xs transition-colors shrink-0 ${
              isMicActive
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isMicActive ? 'Stop Listening' : 'Ask using voice'}
          >
            {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
          >
            <span>Ask AI</span>
            <Send className="w-3 h-3" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[9px] text-slate-500 px-1">
          <span>Private Doubts • ClassPulse Companion</span>
          <span className="text-blue-400 font-medium">Agora AI Voice: Active</span>
        </div>
      </footer>
    </div>
  );
};

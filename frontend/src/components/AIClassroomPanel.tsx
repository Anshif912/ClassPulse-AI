import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  MicOff,
  X,
  Sparkles,
  Loader2,
  FileText,
  Mic,
  ChevronDown,
  ArrowDown,
  Info,
  Volume2,
  Compass,
} from 'lucide-react';
import { ChatMessage } from '../types';
import { api } from '../services/api';
import { createVoiceEngine, IVoiceEngine } from '../services/voiceEngine';
import { soundManager } from '../services/soundManager';
import { StudentLearningDrawer } from './StudentLearningDrawer';

interface AIClassroomPanelProps {
  classId: string;
  subject: string;
  className?: string;
  onClose?: () => void;
}

export type AIVoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupting'
  | 'error'
  | 'unsupported';

export type SupportedLang = 'auto' | 'en' | 'ta' | 'hi';

const isVoiceActive = (s: AIVoiceState) =>
  s === 'connecting' || s === 'listening' || s === 'thinking' ||
  s === 'speaking' || s === 'interrupting';

const stateLabel: Record<AIVoiceState, string> = {
  idle:                  'Ready to help',
  requesting_permission: 'Connecting mic...',
  connecting:            'Connecting Agora Agent...',
  listening:             'Listening to you...',
  thinking:              'Thinking...',
  speaking:              'Speaking...',
  interrupting:          'Interrupted...',
  error:                 'AI Voice unavailable',
  unsupported:           'AI Voice unavailable',
};

export function AIClassroomPanel({
  classId,
  subject,
  className = '',
  onClose,
}: AIClassroomPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Scroll & Viewport State
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedRationaleId, setExpandedRationaleId] = useState<string | null>(null);

  // Voice State
  const [voiceState, setVoiceState] = useState<AIVoiceState>('idle');
  const [selectedLang, setSelectedLang] = useState<SupportedLang>('ta');
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Real Agent Diagnostics
  const [agentDiagnostics, setAgentDiagnostics] = useState<{
    transport: string;
    agentProvider: string;
    model: string;
    voiceMode: string;
    sessionStatus: string;
    voice: string;
    developerDiagnostic?: string;
    knowledgeMode?: string;
  }>({
    transport: 'Agora RTC',
    agentProvider: 'Agora Conversational AI Agent',
    model: 'ClassPulse Grounded AI',
    voiceMode: 'Agora Realtime Audio',
    sessionStatus: 'Idle',
    voice: 'Natural Warm Female (en-US-JennyNeural)',
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const conversationBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voiceEngineRef = useRef<IVoiceEngine | null>(null);
  const transcriptTimerRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isAtBottomRef = useRef(true);
  isAtBottomRef.current = isAtBottom;

  // Canonical Scroll to Bottom (WhatsApp / ChatGPT pattern)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (conversationBottomRef.current) {
      conversationBottomRef.current.scrollIntoView({
        behavior,
        block: 'end',
      });
      setHasUnreadBelow(false);
    }
  }, []);

  // Monitor Scroll Position in the dedicated Conversation Viewport
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 75;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasUnreadBelow(false);
    }
  }, []);

  // Initialize Voice Engine & Load Backend Diagnostics
  useEffect(() => {
    isMountedRef.current = true;
    voiceEngineRef.current = createVoiceEngine();

    api.getAgentDiagnostics()
      .then((diag) => {
        if (isMountedRef.current) {
          if (!diag.configured && !diag.agoraConfigured) {
            setAgentDiagnostics((prev) => ({
              ...prev,
              sessionStatus: 'Agora credentials not configured',
              developerDiagnostic: 'AGORA_APP_ID and AGORA_APP_CERTIFICATE required',
            }));
          }
        }
      })
      .catch(() => {});

    return () => {
      isMountedRef.current = false;
      if (transcriptTimerRef.current) {
        clearTimeout(transcriptTimerRef.current);
      }
      if (voiceEngineRef.current) {
        voiceEngineRef.current.cleanup();
      }
    };
  }, []);

  // Smart Auto-Scroll when messages update
  useEffect(() => {
    if (messages.length === 0) return;

    if (isAtBottomRef.current) {
      // User is at bottom -> follow newest message smoothly
      scrollToBottom('smooth');
    } else {
      // User is reading history -> show unread pill
      setHasUnreadBelow(true);
    }
  }, [messages, liveTranscript, scrollToBottom]);

  // Stop / Interrupt Voice
  const handleInterrupt = useCallback(async () => {
    if (voiceEngineRef.current && isVoiceActive(voiceState)) {
      soundManager.play('ai_interrupted');
      await voiceEngineRef.current.interrupt(classId);
      setVoiceState('interrupting');
      setTimeout(() => {
        if (isMountedRef.current) setVoiceState('listening');
      }, 250);
    }
  }, [classId, voiceState]);

  // Send Text Message
  const sendMessage = useCallback(
    async (text: string, source: 'text' | 'voice' = 'text') => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      soundManager.unlock();
      setLiveTranscript(null);
      if (isVoiceActive(voiceState) && voiceState === 'speaking') {
        handleInterrupt();
      }

      setError(null);

      const studentMsg: ChatMessage = {
        id: `msg_${Date.now()}_student`,
        sessionId: `cls_${classId}`,
        role: 'student',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, studentMsg]);
      setInputText('');
      setIsProcessing(true);

      // Instantly scroll for user action
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 50);

      try {
        const res = await api.sendClassroomMessage(classId, trimmed, source);
        soundManager.play('chat_message');
        setMessages((prev) => [...prev, res.message]);

        const knowledgeLabel =
          res.evidenceState === 'STRONG_EVIDENCE' || (res.sources && res.sources.length > 0)
            ? 'Course-grounded'
            : res.isEducational
            ? 'General explanation'
            : 'Conversation';

        setAgentDiagnostics((prev) => ({
          ...prev,
          knowledgeMode: knowledgeLabel,
        }));
      } catch (err: any) {
        soundManager.play('ai_error');
        setError(err.message || 'ClassPulse AI is temporarily unavailable.');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_error`,
            sessionId: `cls_${classId}`,
            role: 'companion',
            content: "I couldn't retrieve an answer right now. Please try again.",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsProcessing(false);
        setLiveTranscript(null);
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    },
    [classId, isProcessing, voiceState, handleInterrupt, scrollToBottom]
  );

  const handleOneTapAction = useCallback(
    async (
      actionType: 'SIMPLER' | 'EXAMPLE' | 'TEST_ME' | 'PRACTICE' | 'CATCH_UP' | 'CHALLENGE',
      msg: ChatMessage
    ) => {
      const topicId = msg.tutorDecision?.topicId || 'current_topic';

      if (actionType === 'CATCH_UP' || actionType === 'TEST_ME' || actionType === 'PRACTICE') {
        setIsDrawerOpen(true);
        return;
      }

      if (actionType === 'SIMPLER') {
        api.recordLearningEvent({
          classId,
          topicId,
          category: 'EXPLANATION_PREFERENCE',
          metrics: { strategyUsed: 'ANALOGY_EXAMPLE' },
          contextSummary: 'Student requested a simpler explanation',
        }).catch(() => {});
        sendMessage('Can you explain this simpler and more straightforwardly?', 'text');
      } else if (actionType === 'EXAMPLE') {
        api.recordLearningEvent({
          classId,
          topicId,
          category: 'EXPLANATION_PREFERENCE',
          metrics: { strategyUsed: 'ANALOGY_EXAMPLE' },
          contextSummary: 'Student requested a concrete analogy/example',
        }).catch(() => {});
        sendMessage('Can you give me a real-world analogy or concrete example for this?', 'text');
      } else if (actionType === 'CHALLENGE') {
        api.recordLearningEvent({
          classId,
          topicId,
          category: 'DIFFICULTY_PREFERENCE',
          metrics: { difficulty: 'HARD' },
          contextSummary: 'Student requested an advanced challenge question',
        }).catch(() => {});
        sendMessage('Give me a challenging concept or problem related to this.', 'text');
      }
    },
    [classId, sendMessage]
  );

  // Toggle Private AI Agent Voice Session
  const handleTogglePrivateMic = async () => {
    soundManager.unlock();
    if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
    setLiveTranscript(null);
    if (isVoiceActive(voiceState)) {
      // Stop session
      if (voiceEngineRef.current) {
        await voiceEngineRef.current.stopSession(classId);
      }
      setVoiceState('idle');
      setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Idle' }));
      return;
    }

    soundManager.play('ai_ready');
    setError(null);
    setVoiceState('connecting');
    setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Connecting...' }));

    if (!voiceEngineRef.current) {
      voiceEngineRef.current = createVoiceEngine();
    }

    try {
      await voiceEngineRef.current.startSession(classId, {
        onInterimTranscript: (text, role) => {
          if (!isMountedRef.current) return;
          if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
          if (!text || !text.trim()) {
            setLiveTranscript(null);
            return;
          }
          const prefix = role === 'user' ? '🎙️ You: ' : '✨ ClassPulse: ';
          setLiveTranscript(`${prefix}${text}`);
          // Auto-clear lingering transcript after 2.5s if no final result comes
          transcriptTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setLiveTranscript(null);
          }, 2500);
        },
        onFinalTranscript: (text, role) => {
          if (!isMountedRef.current) return;
          if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
          setLiveTranscript(null);
          if (text && text.trim()) {
            const chatRole = role === 'user' ? 'student' : 'companion';
            setMessages((prev) => [
              ...prev,
              {
                id: `msg_${Date.now()}_${chatRole}`,
                sessionId: `cls_${classId}`,
                role: chatRole,
                content: text.trim(),
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        },
        onLatencyUpdate: (metrics) => {
          if (!isMountedRef.current) return;
          console.log(`[VOICE LATENCY] Total End-to-End: ${metrics.totalLatencyMs}ms`);
        },
        onPipelineChange: (_pipeline) => {
          if (!isMountedRef.current) return;
          setAgentDiagnostics((prev) => ({
            ...prev,
            agentProvider: 'Agora Conversational AI Agent',
            model: 'ClassPulse Grounded AI',
            voiceMode: 'Agora Realtime Audio',
            sessionStatus: 'Connected',
          }));
        },
        onStateChange: (state) => {
          if (!isMountedRef.current) return;
          if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
          if (state !== 'LISTENING') {
            setLiveTranscript(null);
          }
          switch (state) {
            case 'CONNECTING':
              setVoiceState('connecting');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Connecting...' }));
              break;
            case 'LISTENING':
              setVoiceState('listening');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Connected' }));
              break;
            case 'SPEAKING':
              setVoiceState('speaking');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Speaking' }));
              break;
            case 'INTERRUPTED':
              soundManager.play('ai_interrupted');
              setVoiceState('interrupting');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Interrupted' }));
              break;
            case 'UNAVAILABLE':
              soundManager.play('ai_error');
              setVoiceState('unsupported');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'AI Voice Unavailable' }));
              break;
            case 'ERROR':
              soundManager.play('ai_error');
              setVoiceState('error');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Error' }));
              break;
            default:
              setVoiceState('idle');
              setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Idle' }));
          }
        },
        onError: (err) => {
          if (!isMountedRef.current) return;
          console.warn('[AIClassroomPanel Voice Error]', err);
          if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
          soundManager.play('ai_error');
          setError(err);
          setVoiceState('unsupported');
          setLiveTranscript(null);
          setAgentDiagnostics((prev) => ({ ...prev, sessionStatus: 'Unavailable' }));
        },
      }, selectedLang);
    } catch (err: any) {
      if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
      soundManager.play('ai_error');
      setError(err.message || 'Could not start Agora Voice Agent.');
      setVoiceState('error');
      setLiveTranscript(null);
    }
  };

  const handleLanguageChange = (lang: SupportedLang) => {
    setSelectedLang(lang);
    setIsLangOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText, 'text');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const renderMessageContent = (content: string, isAi: boolean) => {
    if (!isAi) return <span>{content}</span>;

    const parts = content.split('\n');
    const elements: React.ReactNode[] = [];

    parts.forEach((part, index) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('📘') || trimmed.startsWith('[Source:')) {
        elements.push(
          <div
            key={index}
            className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold bg-cyan-950/40 border border-cyan-800/40 rounded-xl px-2.5 py-1.5 mt-2"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>{trimmed.replace(/^📘\s*/, '')}</span>
          </div>
        );
      } else if (trimmed.startsWith('###')) {
        elements.push(
          <h4 key={index} className="font-bold text-slate-100 text-xs mt-2 mb-1">
            {trimmed.replace(/^###\s*/, '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ')) {
        const text = trimmed.substring(2);
        const boldMatch = text.match(/^\*\*([^*]+)\*\*(.*)$/);
        if (boldMatch) {
          elements.push(
            <li key={index} className="ml-3 text-slate-300 text-xs list-disc">
              <strong className="text-white font-semibold">{boldMatch[1]}</strong>
              {boldMatch[2]}
            </li>
          );
        } else {
          elements.push(
            <li key={index} className="ml-3 text-slate-300 text-xs list-disc">{text}</li>
          );
        }
      } else {
        elements.push(
          <p key={index} className="text-slate-200 text-xs leading-relaxed">{trimmed}</p>
        );
      }
    });

    return <div className="space-y-0.5">{elements}</div>;
  };

  const micActive = isVoiceActive(voiceState);

  const langLabels: Record<SupportedLang, string> = {
    auto: 'Auto', en: 'English', ta: 'தமிழ்', hi: 'हिन्दी',
  };

  const starterPrompts = selectedLang === 'ta' ? [
    `${subject} பற்றிய முக்கிய கருத்தை விளக்குங்கள்`,
    'இந்த தலைப்பின் முக்கிய பயன்பாடுகள் என்ன?',
    'எளிய உதாரணத்துடன் விளக்குங்கள்',
    'பாடக் குறிப்புகளை சுருக்கமாகக் கூறுங்கள்',
  ] : selectedLang === 'hi' ? [
    `${subject} के मुख्य विषय को समझाइए`,
    'इसके व्यावहारिक उदाहरण क्या हैं?',
    'सरल भाषा में समझाइए',
    'कक्षा के नोट्स का सारांश दीजिए',
  ] : [
    `Explain a key concept in ${subject}`,
    'What are the real-world applications of this topic?',
    'Give me a simple concrete example',
    'Summarize the course reading notes',
  ];

  return (
    <aside
      aria-label="ClassPulse AI Assistant"
      className={`flex flex-col bg-[#070B18] border-l border-slate-800/80 h-full w-full select-none text-slate-100 shadow-2xl relative overflow-hidden min-h-0 ${className}`}
    >
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. FIXED HEADER
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-xs text-white leading-tight">AI Tutor</h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[130px]">{subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-[10px] font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-all"
            >
              <span>文 {langLabels[selectedLang]}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
            {isLangOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1 min-w-[100px]">
                {(['ta', 'en', 'hi', 'auto'] as SupportedLang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      selectedLang === l ? 'text-purple-400 bg-purple-950/40' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {langLabels[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 1-to-1 Personal Learning Frontier Drawer */}
          <button
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[10px] font-bold transition-all shadow-sm ${
              isDrawerOpen
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-900/60'
            }`}
            title="Open Personal Learning Frontier & Adaptive Checks"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Path</span>
          </button>

          {/* Diagnostics info toggle */}
          <button
            onClick={() => setShowDiagnostics((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showDiagnostics
                ? 'bg-purple-950/60 border-purple-600 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Engine Diagnostics"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close AI panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. COMPACT VOICE & ASSISTANT STATUS BAR (Fixed, Non-Displacing)
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="px-3.5 py-2 border-b border-slate-800/60 bg-slate-950/50 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={handleTogglePrivateMic}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
              voiceState === 'speaking'
                ? 'bg-purple-500 shadow-md shadow-purple-500/50 animate-pulse'
                : voiceState === 'listening'
                ? 'bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse'
                : voiceState === 'connecting'
                ? 'bg-amber-500 animate-spin'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title={micActive ? 'Stop Voice Session' : 'Start Agora Realtime Voice'}
          >
            {voiceState === 'speaking' ? (
              <Volume2 className="w-3.5 h-3.5 text-white animate-bounce" />
            ) : micActive ? (
              <Mic className="w-3.5 h-3.5 text-white" />
            ) : (
              <Sparkles className="w-3 h-3 text-purple-400" />
            )}
          </button>

          <div className="truncate">
            <span className="text-[11px] font-semibold text-slate-200">
              {stateLabel[voiceState]}
            </span>
            <span className="text-[9px] text-slate-400 block truncate">
              Agora RTC • ClassPulse AI Voice
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isVoiceActive(voiceState) ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/50 border border-emerald-800/40 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 border border-slate-700/50 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Standby
            </span>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. COLLAPSIBLE DIAGNOSTICS DRAWER (Does NOT push message scroll region)
          ───────────────────────────────────────────────────────────────────────────── */}
      {showDiagnostics && (
        <div className="p-3 bg-slate-950/95 border-b border-purple-900/40 text-[10px] text-slate-300 space-y-1 shrink-0 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80 text-[11px] font-bold text-purple-300">
            <span>Engine Diagnostics</span>
            <span className="text-emerald-400">● 100% Agora Native</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px]">
            <div>Transport: <strong className="text-white">{agentDiagnostics.transport}</strong></div>
            <div>Agent: <strong className="text-purple-300">{agentDiagnostics.agentProvider}</strong></div>
            <div>Model: <strong className="text-cyan-300">{agentDiagnostics.model}</strong></div>
            <div>Mode: <strong className="text-emerald-300">{agentDiagnostics.voiceMode}</strong></div>
            <div>Voice: <strong className="text-slate-200">{agentDiagnostics.voice}</strong></div>
            <div>Status: <strong className={micActive ? 'text-emerald-400' : 'text-slate-400'}>{agentDiagnostics.sessionStatus}</strong></div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. CONVERSATION VIEWPORT (THE ONLY SCROLLABLE REGION — min-h-0 flex-1)
          ───────────────────────────────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3 relative scroll-pt-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Empty state — ONLY shown when no messages have been sent yet */}
        {messages.length === 0 && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
            <div
              onClick={handleTogglePrivateMic}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-xl shadow-purple-600/20 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center"
              title="Click to start Agora Realtime AI Voice"
            >
              <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center border border-slate-800">
                <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white tracking-tight">
                ClassPulse AI Tutor
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-[220px]">
                Ask questions by voice or text. Grounded in live course materials.
              </p>
            </div>

            <div className="w-full space-y-1.5 pt-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block text-left">
                Suggested Prompts
              </span>
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt, 'text')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/40 text-xs text-slate-300 hover:text-white transition-all shadow-sm flex items-center justify-between group"
                >
                  <span className="truncate">{prompt}</span>
                  <Send className="w-3 h-3 text-slate-600 group-hover:text-purple-400 shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Timeline */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'student' ? 'items-end' : 'items-start'} animate-fade-in`}
          >
            {/* Adaptive Strategy Badge for Companion */}
            {msg.role === 'companion' && msg.tutorDecision && (
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-purple-300 font-medium">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-800/50 text-[9px] font-semibold text-purple-200 shadow-sm">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  {msg.tutorDecision.strategy === 'ANALOGY_EXAMPLE' || msg.tutorDecision.strategy === 'ANALOGY'
                    ? 'Guided Analogy'
                    : msg.tutorDecision.strategy === 'CONCRETE_EXAMPLE' || msg.tutorDecision.strategy === 'VISUAL_STRUCTURED'
                    ? 'Visual & Structured'
                    : msg.tutorDecision.strategy === 'STEP_BY_STEP'
                    ? 'Step-by-Step'
                    : 'Direct Explanation'}
                  {' · '}
                  {msg.tutorDecision.pace === 'FAST' || msg.tutorDecision.pace === 'ACCELERATED'
                    ? 'Fast Pace'
                    : msg.tutorDecision.pace === 'GENTLE' || msg.tutorDecision.pace === 'SLOW'
                    ? 'Gentle Pace'
                    : 'Comfortable Pace'}
                  {msg.tutorDecision.difficulty === 'HARD' ? ' · Challenge' : ''}
                </span>

                {msg.transparencyRationale && (
                  <button
                    onClick={() =>
                      setExpandedRationaleId(
                        expandedRationaleId === msg.id ? null : msg.id
                      )
                    }
                    className="text-[9px] text-slate-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                    title="Why was this explanation tailored this way?"
                  >
                    Why this style?
                  </button>
                )}
              </div>
            )}

            {/* Transparency Rationale Box */}
            {msg.role === 'companion' &&
              expandedRationaleId === msg.id &&
              msg.transparencyRationale && (
                <div className="mb-2 max-w-[88%] p-2.5 rounded-xl bg-purple-950/80 border border-purple-700/50 text-[10px] text-purple-200 leading-relaxed shadow-lg animate-fade-in space-y-1">
                  <div className="flex items-center justify-between font-bold text-purple-300 pb-1 border-b border-purple-800/40">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Pedagogical Rationale
                    </span>
                    <button
                      onClick={() => setExpandedRationaleId(null)}
                      className="text-purple-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-slate-200">{msg.transparencyRationale}</p>
                  {msg.tutorDecision?.prerequisiteSupportRequired && (
                    <div className="text-[9px] text-amber-300 font-semibold pt-0.5">
                      ⚡ Included foundational context for current topic prerequisite.
                    </div>
                  )}
                </div>
              )}

            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-lg ${
                msg.role === 'student'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-900/95 border border-slate-800/90 text-slate-200 rounded-bl-sm space-y-1'
              }`}
            >
              {renderMessageContent(msg.content, msg.role === 'companion')}

              {/* Contextual One-Tap Learning Action Pills */}
              {msg.role === 'companion' && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] text-slate-500 font-medium mr-0.5">Quick Actions:</span>
                  <button
                    onClick={() => handleOneTapAction('SIMPLER', msg)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all shadow-xs"
                  >
                    Explain simpler
                  </button>
                  <button
                    onClick={() => handleOneTapAction('EXAMPLE', msg)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all shadow-xs"
                  >
                    Give me an example
                  </button>
                  <button
                    onClick={() => handleOneTapAction('TEST_ME', msg)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 hover:text-white transition-all shadow-xs"
                  >
                    Test me
                  </button>
                  <button
                    onClick={() => handleOneTapAction('CHALLENGE', msg)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/50 text-purple-300 hover:text-white transition-all shadow-xs"
                  >
                    Challenge me
                  </button>
                  <button
                    onClick={() => handleOneTapAction('CATCH_UP', msg)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 hover:text-white transition-all shadow-xs"
                  >
                    Catch me up
                  </button>
                </div>
              )}

              {/* Suggested Follow-up Practice */}
              {msg.role === 'companion' && msg.suggestedFollowUpPractice && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Sparkles className="w-3 h-3" />
                      Suggested Check:
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (msg.suggestedFollowUpPractice) {
                        setInputText(msg.suggestedFollowUpPractice);
                        inputRef.current?.focus();
                      }
                    }}
                    className="text-left text-[11px] p-2 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/40 text-indigo-200 transition-colors group flex items-center justify-between"
                  >
                    <span>{msg.suggestedFollowUpPractice}</span>
                    <Send className="w-3 h-3 text-indigo-400 group-hover:text-white shrink-0 ml-1.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Interim Transcript Bubble */}
        {liveTranscript && (
          <div className="flex flex-col items-start animate-fade-in">
            <div className="max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-purple-950/60 border border-purple-800/60 text-purple-200 rounded-bl-sm flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" />
              <span className="italic">{liveTranscript}</span>
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-1.5 px-2 animate-fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>ClassPulse is thinking...</span>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center justify-between gap-2 shadow-md">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* CANONICAL BOTTOM SENTINEL */}
        <div ref={conversationBottomRef} className="h-6 shrink-0" />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. FLOATING "↓ NEW RESPONSE" PILL (Appears ONLY when user is scrolled up)
          ───────────────────────────────────────────────────────────────────────────── */}
      {hasUnreadBelow && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={() => scrollToBottom('smooth')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-2xl shadow-purple-600/50 border border-purple-400/40 transition-transform active:scale-95"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>New response</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. FIXED COMPOSER (Anchored at the bottom, shrink-0)
          ───────────────────────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800/80 bg-slate-950/95 shrink-0 z-20">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-2xl px-3 py-1.5 focus-within:border-purple-500 transition-colors shadow-inner">
          <button
            type="button"
            onClick={handleTogglePrivateMic}
            className={`p-1.5 rounded-xl transition-all ${
              micActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={micActive ? 'Turn off Agora AI Voice' : 'Start Agora Realtime AI Voice'}
          >
            {micActive ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-slate-500" />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              micActive
                ? 'Agora Realtime AI Active... or type query'
                : 'Ask in Tamil, English, Tanglish, Hindi...'
            }
            disabled={isProcessing}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none py-1.5"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="p-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 rounded-xl text-white transition-all shadow-md shadow-purple-600/20 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* 1-to-1 Adaptive Learning Frontier Drawer */}
      <StudentLearningDrawer
        classId={classId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onAskDoubt={(q) => {
          setInputText(q);
          setIsDrawerOpen(false);
        }}
      />
    </aside>
  );
}

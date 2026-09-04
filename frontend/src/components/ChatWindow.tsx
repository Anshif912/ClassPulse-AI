import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Bot, User, Sparkles, BookOpen, Calculator, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  messages: ChatMessage[];
  proactiveSuggestion?: string;
  onSuggestionClick?: (query: string) => void;
  isProcessing?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  proactiveSuggestion,
  onSuggestionClick,
  isProcessing,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const renderMessageContent = (content: string) => {
    // Render lines and math blocks simply and cleanly
    return content.split('\n\n').map((paragraph, pIdx) => {
      // Step bullet or key concepts
      if (paragraph.startsWith('### ')) {
        return (
          <h4 key={pIdx} className="text-sm font-bold text-blue-300 mt-2 mb-1">
            {paragraph.replace('### ', '')}
          </h4>
        );
      }
      if (paragraph.startsWith('> ')) {
        return (
          <blockquote key={pIdx} className="pl-3 py-1 my-2 border-l-2 border-blue-500 bg-blue-950/30 text-xs italic text-blue-200 rounded-r-lg">
            {paragraph.replace('> ', '')}
          </blockquote>
        );
      }
      if (paragraph.startsWith('$$') && paragraph.endsWith('$$')) {
        const mathExpr = paragraph.replace(/\$\$/g, '');
        return (
          <div key={pIdx} className="my-2 p-2.5 bg-slate-950/80 border border-blue-500/30 rounded-xl font-mono text-xs text-blue-300 text-center tracking-wide">
            {mathExpr}
          </div>
        );
      }
      return (
        <p key={pIdx} className="text-xs sm:text-sm leading-relaxed text-slate-200 mb-1.5 whitespace-pre-line">
          {paragraph}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {/* Welcome intro message if no messages yet */}
      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">ClassPulse AI is Ready</h3>
            <p className="text-xs text-slate-400">
              Your Google Meet is open. Ask any doubt anytime through text or voice without disturbing your live class.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <button
              onClick={() => onSuggestionClick?.('How do I solve 2x + 5 = 0?')}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              📐 How do I solve 2x + 5 = 0?
            </button>
            <button
              onClick={() => onSuggestionClick?.("Can you explain Newton's first law?")}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              🍎 Newton's first law?
            </button>
            <button
              onClick={() => onSuggestionClick?.('What is photosynthesis?')}
              className="px-3 py-1.5 rounded-xl text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              🌿 What is photosynthesis?
            </button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      {messages.map((msg) => {
        const isStudent = msg.role === 'student';

        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${isStudent ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            {/* Companion Icon */}
            {!isStudent && (
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-lg ${
                isStudent
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-tr-sm'
                  : 'bg-slate-900/95 border border-slate-800 text-slate-200 rounded-tl-sm'
              }`}
            >
              {/* Educational Topic / Chapter Badge */}
              {!isStudent && msg.ragContext?.topic && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800 text-[11px] text-blue-400 font-medium">
                  {msg.intent === 'equation' ? (
                    <Calculator className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{msg.ragContext.topic}</span>
                  {msg.ragContext.chapter && (
                    <span className="text-slate-500">• {msg.ragContext.chapter}</span>
                  )}
                </div>
              )}

              {/* Message Content */}
              <div>{renderMessageContent(msg.content)}</div>

              {/* Timestamp */}
              <div
                className={`text-[10px] mt-2 flex items-center justify-end gap-1 ${
                  isStudent ? 'text-blue-200/80' : 'text-slate-500'
                }`}
              >
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Student Icon */}
            {isStudent && (
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}

      {/* Processing Loader Indicator */}
      {isProcessing && (
        <div className="flex items-center gap-3 animate-fadeIn">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-2 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="ml-1">ClassPulse is computing answer...</span>
          </div>
        </div>
      )}

      {/* Non-Disruptive Proactive Suggestion Banner */}
      {proactiveSuggestion && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{proactiveSuggestion}</span>
          </div>
          <button
            onClick={() => onSuggestionClick?.('Give me a step by step practice problem on this topic.')}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-[11px] shrink-0 transition-colors"
          >
            Practice Problem
          </button>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};

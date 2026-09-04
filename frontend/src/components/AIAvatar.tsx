import React from 'react';
import { VoiceState } from '../types';
import { Bot, Mic, Sparkles, Volume2, AlertCircle } from 'lucide-react';

interface AIAvatarProps {
  voiceState: VoiceState;
  voiceMode: 'agora' | 'browser_fallback';
}

export const AIAvatar: React.FC<AIAvatarProps> = ({ voiceState, voiceMode }) => {
  const getStatusColor = () => {
    switch (voiceState) {
      case 'listening':
        return 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/20';
      case 'thinking':
        return 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-amber-500/20';
      case 'speaking':
        return 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-blue-500/20';
      case 'error':
        return 'border-rose-500 bg-rose-500/10 text-rose-400 shadow-rose-500/20';
      default:
        return 'border-slate-700 bg-slate-800/60 text-slate-300 shadow-slate-900/50';
    }
  };

  const getStatusLabel = () => {
    switch (voiceState) {
      case 'listening':
        return 'Listening to your microphone...';
      case 'thinking':
        return 'Analyzing question & RAG...';
      case 'speaking':
        return 'Speaking explanation...';
      case 'error':
        return 'Voice temporarily unavailable';
      default:
        return 'Ready for questions';
    }
  };

  const getStatusIcon = () => {
    switch (voiceState) {
      case 'listening':
        return <Mic className="w-4 h-4 animate-pulse text-emerald-400" />;
      case 'thinking':
        return <Sparkles className="w-4 h-4 animate-spin text-amber-400" />;
      case 'speaking':
        return <Volume2 className="w-4 h-4 animate-bounce text-blue-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Bot className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl shadow-xl">
      {/* Avatar Circle with Glow */}
      <div className="relative">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 shadow-lg ${getStatusColor()}`}
        >
          <Bot className="w-6 h-6" />
        </div>

        {/* Pulse ring when active */}
        {voiceState !== 'idle' && (
          <div
            className={`absolute -inset-1 rounded-2xl border animate-ping opacity-30 ${
              voiceState === 'listening'
                ? 'border-emerald-500'
                : voiceState === 'thinking'
                ? 'border-amber-500'
                : 'border-blue-500'
            }`}
          />
        )}
      </div>

      {/* Info & Status */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide text-white">ClassPulse AI</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            ● Study Companion Active
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            {getStatusIcon()}
            <span>AI Status: <strong className="text-slate-200">{getStatusLabel()}</strong></span>
          </div>

          <span className="text-slate-600">•</span>

          {/* Honest Voice Mode Indicator */}
          <span className="text-[11px] text-slate-400">
            {voiceMode === 'agora' ? (
              <span className="text-blue-400 font-medium">Voice: Agora Engine</span>
            ) : (
              <span className="text-slate-400">Voice: Browser Engine</span>
            )}
          </span>
        </div>
      </div>

      {/* Audio Wave Visualization during speech */}
      {voiceState === 'speaking' && (
        <div className="ml-auto flex items-center gap-1 px-3 py-1 bg-blue-950/40 border border-blue-800/40 rounded-xl">
          <div className="w-1 bg-blue-400 rounded-full animate-wave-bar" style={{ animationDelay: '0ms' }} />
          <div className="w-1 bg-blue-400 rounded-full animate-wave-bar" style={{ animationDelay: '200ms' }} />
          <div className="w-1 bg-blue-400 rounded-full animate-wave-bar" style={{ animationDelay: '400ms' }} />
          <div className="w-1 bg-blue-400 rounded-full animate-wave-bar" style={{ animationDelay: '600ms' }} />
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Mic, MicOff, Send, Sparkles, Volume2 } from 'lucide-react';
import { VoiceState } from '../types';

interface VoiceControllerProps {
  onSendMessage: (text: string, source: 'text' | 'voice') => void;
  voiceState: VoiceState;
  isMicActive: boolean;
  transcript: string;
  onToggleMic: () => void;
  disabled?: boolean;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({
  onSendMessage,
  voiceState,
  isMicActive,
  transcript,
  onToggleMic,
  disabled,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim(), 'text');
    setInputText('');
  };

  return (
    <div className="p-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur space-y-3">
      {/* Speech-to-Text Live Preview Bar */}
      {(isMicActive || transcript) && (
        <div className="p-2.5 bg-slate-950 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="font-semibold text-emerald-400 shrink-0">You asked:</span>
            <span className="truncate italic text-slate-200">{transcript || 'Listening...'}</span>
          </div>
          <button
            onClick={onToggleMic}
            className="px-2 py-0.5 text-[11px] font-medium bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg shrink-0 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your doubt here (e.g. How do I solve 2x + 5 = 0?)"
            disabled={disabled}
            className="w-full pl-4 pr-10 py-3.5 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>

        {/* Voice Input Button */}
        <button
          type="button"
          onClick={onToggleMic}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-md shrink-0 ${
            isMicActive
              ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={isMicActive ? 'Stop Voice Input' : 'Ask using Voice'}
        >
          {isMicActive ? (
            <>
              <MicOff className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Listening...</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Ask using voice</span>
            </>
          )}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || disabled}
          className="px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

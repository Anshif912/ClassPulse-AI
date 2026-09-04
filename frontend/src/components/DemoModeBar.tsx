import React from 'react';
import { DEMO_SCRIPT_STEPS, DemoStep } from '../services/demoScript';
import { PlayCircle, SkipForward, XCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface DemoModeBarProps {
  currentStepIndex: number;
  onSelectStep: (stepIndex: number) => void;
  onNextStep: () => void;
  onExitDemo: () => void;
}

export const DemoModeBar: React.FC<DemoModeBarProps> = ({
  currentStepIndex,
  onSelectStep,
  onNextStep,
  onExitDemo,
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-blue-800/60 p-3 px-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      {/* Title & Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
          <Sparkles className="w-3 h-3 text-blue-400" />
          STANDALONE DEMO MODE
        </span>
        <span className="text-slate-300 hidden md:inline font-medium">
          Zero external credentials • Offline Fallback for Live Judging
        </span>
      </div>

      {/* Steps Quick Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
        {DEMO_SCRIPT_STEPS.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;

          return (
            <button
              key={step.id}
              onClick={() => onSelectStep(idx)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                  : isPassed
                  ? 'bg-slate-800/90 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {isPassed && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
              <span>{idx + 1}. {step.userPrompt.substring(0, 16)}{step.userPrompt.length > 16 ? '...' : ''}</span>
            </button>
          );
        })}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onNextStep}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow transition-colors text-xs"
        >
          <span>Ask Next Doubt</span>
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onExitDemo}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors text-xs"
          title="Exit Demo Mode"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exit Demo</span>
        </button>
      </div>
    </div>
  );
};

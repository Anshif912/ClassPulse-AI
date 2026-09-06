import React from 'react';
import { ClassroomEvent } from '../types';
import { UserCheck, UserMinus, MonitorPlay, MonitorX, AlertTriangle, Info } from 'lucide-react';

interface ClassroomToastsProps {
  events: ClassroomEvent[];
  onDismiss: (id: string) => void;
}

export const ClassroomToasts: React.FC<ClassroomToastsProps> = ({ events, onDismiss }) => {
  if (!events || events.length === 0) return null;

  return (
    <div
      className="fixed bottom-24 left-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      aria-live="polite"
    >
      {events.map((evt) => {
        const icon = getEventIcon(evt.type);
        const bgStyle = getEventStyle(evt.type);

        return (
          <div
            key={evt.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${bgStyle}`}
          >
            <div className="shrink-0">{icon}</div>
            <p className="text-xs font-medium text-slate-100 leading-snug flex-1">
              {evt.message}
            </p>
            <button
              onClick={() => onDismiss(evt.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg text-xs"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

function getEventIcon(type: ClassroomEvent['type']) {
  switch (type) {
    case 'PARTICIPANT_JOINED':
      return <UserCheck className="w-4 h-4 text-emerald-400" />;
    case 'PARTICIPANT_LEFT':
      return <UserMinus className="w-4 h-4 text-amber-400" />;
    case 'SCREEN_SHARE_STARTED':
      return <MonitorPlay className="w-4 h-4 text-blue-400" />;
    case 'SCREEN_SHARE_STOPPED':
      return <MonitorX className="w-4 h-4 text-slate-400" />;
    default:
      return <Info className="w-4 h-4 text-slate-300" />;
  }
}

function getEventStyle(type: ClassroomEvent['type']) {
  switch (type) {
    case 'PARTICIPANT_JOINED':
      return 'bg-slate-900/90 border-emerald-500/30 text-emerald-300 shadow-emerald-950/20';
    case 'PARTICIPANT_LEFT':
      return 'bg-slate-900/90 border-amber-500/30 text-amber-300 shadow-amber-950/20';
    case 'SCREEN_SHARE_STARTED':
      return 'bg-slate-900/90 border-blue-500/30 text-blue-300 shadow-blue-950/20';
    case 'SCREEN_SHARE_STOPPED':
      return 'bg-slate-900/90 border-slate-700/60 text-slate-300';
    default:
      return 'bg-slate-900/90 border-slate-700/60 text-slate-200';
  }
}

import React from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { ConnectionState } from 'agora-rtc-sdk-ng';

// ──────────────────────────────────────────────────────────────────────────────
// ConnectionStatus
// Overlays connection state information on the classroom.
// Only visible during non-CONNECTED states.
// ──────────────────────────────────────────────────────────────────────────────

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  onRetry?: () => void;
}

export function ConnectionStatus({ connectionState, onRetry }: ConnectionStatusProps) {
  if (connectionState === 'CONNECTED') return null;

  const config: Record<
    string,
    { icon: React.ReactNode; label: string; subtext: string; color: string; showRetry?: boolean }
  > = {
    CONNECTING: {
      icon: <Loader2 className="w-5 h-5 animate-spin" />,
      label: 'Connecting to classroom...',
      subtext: 'Setting up your audio and video',
      color: 'text-blue-400',
    },
    RECONNECTING: {
      icon: <RefreshCw className="w-5 h-5 animate-spin" />,
      label: 'Reconnecting...',
      subtext: 'Your connection dropped. Reconnecting automatically.',
      color: 'text-amber-400',
    },
    DISCONNECTING: {
      icon: <WifiOff className="w-5 h-5" />,
      label: 'Leaving classroom...',
      subtext: 'Cleaning up your session',
      color: 'text-slate-400',
    },
    DISCONNECTED: {
      icon: <WifiOff className="w-5 h-5" />,
      label: 'Disconnected',
      subtext: 'You are not connected to the classroom.',
      color: 'text-slate-400',
      showRetry: true,
    },
    FAILED: {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: 'Connection failed',
      subtext: 'Could not connect to the classroom. Check your network.',
      color: 'text-red-400',
      showRetry: true,
    },
  };

  const info = config[connectionState];
  if (!info) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-xl">
      <div className="flex flex-col items-center gap-3 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xs text-center">
        <div className={info.color}>{info.icon}</div>
        <div>
          <p className={`text-sm font-bold ${info.color}`}>{info.label}</p>
          <p className="text-xs text-slate-400 mt-1">{info.subtext}</p>
        </div>
        {info.showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

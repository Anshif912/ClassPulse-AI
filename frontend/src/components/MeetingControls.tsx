import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  PhoneOff,
  Sparkles,
  MoreHorizontal,
  Bot,
} from 'lucide-react';
import { ConnectionState } from 'agora-rtc-sdk-ng';

interface MeetingControlsProps {
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isAIPanelOpen: boolean;
  isParticipantsPanelOpen: boolean;
  participantCount: number;
  connectionState: ConnectionState;
  networkQuality?: any;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleAIPanel: () => void;
  onToggleParticipantsPanel: () => void;
  onLeave: () => void;
  disabled?: boolean;
}

export function MeetingControls({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isAIPanelOpen,
  isParticipantsPanelOpen,
  participantCount,
  connectionState,
  networkQuality,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleAIPanel,
  onToggleParticipantsPanel,
  onLeave,
  disabled = false,
}: MeetingControlsProps) {
  return (
    <div
      className="pb-4 pt-2 flex items-center justify-center shrink-0 z-30"
      role="toolbar"
      aria-label="Meeting controls"
    >
      {/* ── Centered Floating Control Dock (Panel 3 Reference) ───────────────── */}
      <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-slate-950/90 border border-slate-800/90 backdrop-blur-2xl shadow-2xl relative z-30 pointer-events-auto">
        {/* 1. Classroom Mic */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-mic"
            onClick={onToggleMic}
            disabled={disabled}
            aria-label={isMicOn ? 'Mute room microphone' : 'Unmute room microphone'}
            title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
              isMicOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-950/70 border border-rose-700 text-rose-300 hover:bg-rose-900/70'
            }`}
          >
            {isMicOn ? <Mic className="w-5 h-5 text-slate-200" /> : <MicOff className="w-5 h-5 text-rose-400" />}
          </button>
          <span className="text-[10px] font-medium text-slate-400">{isMicOn ? 'Mic' : 'Muted'}</span>
        </div>

        {/* 2. Video Camera */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-camera"
            onClick={onToggleCamera}
            disabled={disabled}
            aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            title={isCameraOn ? 'Turn off Camera' : 'Turn on Camera'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
              isCameraOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-950/70 border border-rose-700 text-rose-300 hover:bg-rose-900/70'
            }`}
          >
            {isCameraOn ? <Video className="w-5 h-5 text-slate-200" /> : <VideoOff className="w-5 h-5 text-rose-400" />}
          </button>
          <span className="text-[10px] font-medium text-slate-400">Camera</span>
        </div>

        {/* 3. Screen Share */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-share"
            onClick={onToggleScreenShare}
            disabled={disabled}
            aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
              isScreenSharing
                ? 'bg-purple-600/30 border border-purple-500 text-purple-200 shadow-md shadow-purple-600/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5 text-purple-400" /> : <Monitor className="w-5 h-5 text-slate-300" />}
          </button>
          <span className="text-[10px] font-medium text-slate-400">{isScreenSharing ? 'Stop' : 'Share'}</span>
        </div>

        {/* 4. Participants */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-participants"
            onClick={onToggleParticipantsPanel}
            aria-label="Toggle participants"
            title="Participants list"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              isParticipantsPanelOpen
                ? 'bg-blue-600/30 border border-blue-500 text-blue-300 shadow-md shadow-blue-600/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Users className="w-5 h-5 text-slate-300" />
          </button>
          <span className="text-[10px] font-medium text-slate-400">Participants</span>
        </div>

        {/* 5. DEDICATED AI TUTOR BUTTON (Panel 3: Purple/Magenta Gradient Orb with Star Icon ✦) */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-ai"
            onClick={onToggleAIPanel}
            aria-label="Open AI Tutor Panel"
            title="ClassPulse AI Voice Tutor (Private)"
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xl ${
              isAIPanelOpen
                ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-purple-500/50 ring-2 ring-purple-400/50 animate-pulse'
                : 'bg-gradient-to-tr from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-purple-600/30'
            }`}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </button>
          <span className="text-[10px] font-bold text-purple-400">AI Tutor</span>
        </div>

        {/* 6. More Options */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => {}}
            aria-label="More options"
            title="More options"
            className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-medium text-slate-400">More</span>
        </div>
      </div>
    </div>
  );
}

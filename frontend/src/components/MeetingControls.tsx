import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  Sparkles,
  MoreHorizontal,
  Copy,
  Check,
  Info,
  Disc,
  Square,
  Lock,
  Loader2,
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
  isTeacher?: boolean;
  isRecording?: boolean;
  recordingDuration?: number;
  isRecordingLoading?: boolean;
  isMutedByModerator?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording?: () => void;
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
  isTeacher = false,
  isRecording = false,
  recordingDuration = 0,
  isRecordingLoading = false,
  isMutedByModerator = false,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording,
  onToggleAIPanel,
  onToggleParticipantsPanel,
  onLeave,
  disabled = false,
}: MeetingControlsProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Format seconds to mm:ss
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="pb-4 pt-2 flex items-center justify-center shrink-0 z-30"
      role="toolbar"
      aria-label="Meeting controls"
    >
      {/* ── Centered Floating Control Dock ─────────────────────────────────── */}
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-slate-950/90 border border-slate-800/90 backdrop-blur-2xl shadow-2xl relative z-30 pointer-events-auto">
        {/* 1. Classroom Mic */}
        <div className="flex flex-col items-center gap-1">
          <button
            data-testid="meeting-mic"
            onClick={onToggleMic}
            disabled={disabled || isMutedByModerator}
            aria-label={
              isMutedByModerator
                ? 'Muted by teacher'
                : isMicOn
                ? 'Mute room microphone'
                : 'Unmute room microphone'
            }
            title={
              isMutedByModerator
                ? 'Muted by teacher (Microphone locked)'
                : isMicOn
                ? 'Mute Mic'
                : 'Unmute Mic'
            }
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50 relative ${
              isMutedByModerator
                ? 'bg-amber-950/80 border border-amber-700 text-amber-300 cursor-not-allowed'
                : isMicOn
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                : 'bg-rose-950/70 border border-rose-700 text-rose-300 hover:bg-rose-900/70'
            }`}
          >
            {isMutedByModerator ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : isMicOn ? (
              <Mic className="w-5 h-5 text-slate-200" />
            ) : (
              <MicOff className="w-5 h-5 text-rose-400" />
            )}
          </button>
          <span className="text-[10px] font-medium text-slate-400">
            {isMutedByModerator ? 'Locked' : isMicOn ? 'Mic' : 'Muted'}
          </span>
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
            title={isScreenSharing ? 'Stop sharing' : 'Share screen with audio'}
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

        {/* 4. Agora Cloud Recording Button (Teacher: Start/Stop; Student: Indicator) */}
        {isTeacher && onToggleRecording && (
          <div className="flex flex-col items-center gap-1">
            <button
              data-testid="meeting-record"
              onClick={onToggleRecording}
              disabled={disabled || isRecordingLoading}
              aria-label={isRecording ? 'Stop Cloud Recording' : 'Start Cloud Recording'}
              title={isRecording ? 'Stop Cloud Recording' : 'Start Agora Cloud Recording'}
              className={`h-11 px-3.5 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isRecordingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : isRecording ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    {formatTimer(recordingDuration)}
                  </span>
                </>
              ) : (
                <Disc className="w-5 h-5 text-rose-400" />
              )}
            </button>
            <span className="text-[10px] font-medium text-slate-400">
              {isRecording ? 'Recording' : 'Record'}
            </span>
          </div>
        )}

        {/* Student Recording Indicator */}
        {!isTeacher && isRecording && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-600/50 rounded-full text-rose-300 text-xs font-bold shadow-md animate-pulse">
            <Disc className="w-3.5 h-3.5 text-rose-400" />
            <span>REC {formatTimer(recordingDuration)}</span>
          </div>
        )}

        {/* 5. Participants */}
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
          <span className="text-[10px] font-medium text-slate-400">Roster</span>
        </div>

        {/* 6. DEDICATED AI TUTOR BUTTON */}
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

        {/* 7. More Options with Popover Menu */}
        <div className="flex flex-col items-center gap-1 relative">
          <button
            data-testid="meeting-more"
            onClick={() => setIsMoreOpen((v) => !v)}
            aria-label="More options"
            title="More options"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              isMoreOpen
                ? 'bg-slate-700 text-white border border-slate-600 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-medium text-slate-400">More</span>

          {/* Popover Menu */}
          {isMoreOpen && (
            <div
              className="absolute bottom-full mb-3 right-0 w-56 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 space-y-1 text-xs"
              role="menu"
            >
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                  setIsMoreOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Classroom Link'}</span>
              </button>

              <button
                onClick={() => {
                  onToggleParticipantsPanel();
                  setIsMoreOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer text-left font-medium"
              >
                <Users className="w-4 h-4 text-blue-400" />
                <span>Roster ({participantCount})</span>
              </button>

              <div className="h-px bg-slate-800 my-1" />

              <div className="px-3 py-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3 h-3 text-slate-500" />
                <span>Agora RTC 4.x Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

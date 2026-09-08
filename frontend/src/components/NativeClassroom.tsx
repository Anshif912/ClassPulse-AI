import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Users,
  Bot,
  Clock,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  Maximize2,
  Grid,
  Settings,
  PhoneOff,
  BookOpen,
  VolumeX,
} from 'lucide-react';
import { Classroom } from '../types';
import { useAgoraRTC } from '../hooks/useAgoraRTC';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker';
import { ParticipantGrid } from './ParticipantGrid';
import { MeetingControls } from './MeetingControls';
import { AIClassroomPanel } from './AIClassroomPanel';
import { ParticipantsPanel } from './ParticipantsPanel';
import { ConnectionStatus } from './ConnectionStatus';
import { ClassroomToasts } from './ClassroomToasts';
import { MeetingSettingsModal } from './MeetingSettingsModal';
import { Logo } from './common/Logo';
import { api } from '../services/api';

interface NativeClassroomProps {
  classroom: Classroom;
  uid: number;
  participantName: string;
  role: 'teacher' | 'student';
  initialCameraOn: boolean;
  initialMicOn: boolean;
  onLeave: () => void;
}

function useSessionTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function NativeClassroom({
  classroom,
  uid,
  participantName,
  role,
  initialCameraOn,
  initialMicOn,
  onLeave,
}: NativeClassroomProps) {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [rtcError, setRtcError] = useState<string | null>(null);
  const sessionTimer = useSessionTimer();

  // ─── Agora Cloud Recording State ────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const recordingTimerRef = useRef<any>(null);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleLayout = useCallback(() => {
    setLayoutMode((prev) => (prev === 'grid' ? 'speaker' : 'grid'));
  }, []);

  // Agora RTC Hook
  const {
    localVideoTrack,
    localAudioTrack,
    screenTrack,
    remoteUsers,
    participants,
    localParticipant,
    events,
    dismissEvent,
    joined,
    connectionState,
    networkQuality,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    isJoining,
    isMutedByModerator,
    moderationReason,
    join,
    leave,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    setParticipantStreamQuality,
    muteParticipant,
    unmuteParticipant,
  } = useAgoraRTC({
    classId: classroom.classId,
    uid,
    localName: participantName,
    role,
    initialCameraOn,
    initialMicOn,
    onError: (err) => setRtcError(err),
  });

  const effectiveUid = localParticipant?.uid ?? uid;
  const { activeSpeakerUid } = useActiveSpeaker({
    remoteUsers,
    localUid: effectiveUid,
    isMicOn,
  });

  // Check active recording state periodically
  useEffect(() => {
    let active = true;
    const checkRecording = async () => {
      try {
        const res = await api.getActiveRecording(classroom.classId);
        if (!active) return;
        if (res?.isRecording && res.recording) {
          setIsRecording(true);
          const startMs = new Date(res.recording.startedAt).getTime();
          setRecordingDuration(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
        } else {
          setIsRecording(false);
        }
      } catch {}
    };

    checkRecording();
    const interval = setInterval(checkRecording, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [classroom.classId]);

  // Handle Recording Timer Tick
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecordingLoading) return;
    setIsRecordingLoading(true);
    try {
      if (isRecording) {
        await api.stopRecording(classroom.classId);
        setIsRecording(false);
      } else {
        await api.startRecording(classroom.classId);
        setIsRecording(true);
      }
    } catch (err: any) {
      console.error('[RECORDING_TOGGLE_ERROR]', err);
    } finally {
      setIsRecordingLoading(false);
    }
  }, [classroom.classId, isRecording, isRecordingLoading]);

  useEffect(() => {
    join();
    return () => { leave(); };
  }, [classroom.classId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') toggleMic();
      if (e.key === 'c' || e.key === 'C') toggleCamera();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleMic, toggleCamera]);

  const handleLeave = useCallback(async () => {
    if (isRecording && role === 'teacher') {
      try { await api.stopRecording(classroom.classId); } catch {}
    }
    await leave();
    onLeave();
  }, [leave, onLeave, isRecording, role, classroom.classId]);

  const handleToggleScreenShare = useCallback(() => {
    if (isScreenSharing) stopScreenShare();
    else startScreenShare();
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const totalParticipants = (localParticipant ? 1 : 0) + remoteUsers.length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#050816] text-slate-100 overflow-hidden select-none antialiased">
      {/* ── Top Classroom Header Bar ────────────────────────────────────────── */}
      <header className="h-16 px-6 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        {/* Left: Class Subject with Live Dot & Dropdown */}
        <div className="flex items-center gap-3">
          <Logo size="xs" showText={false} />

          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-white transition-all">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{classroom.name || classroom.subject}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Center: Live Timer Badge + Participant Count */}
        <div className="flex items-center gap-2">
          {/* Live Timer Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono font-bold text-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tabular-nums">{sessionTimer}</span>
          </div>

          {/* Participant Count Badge */}
          <button
            onClick={() => setIsParticipantsPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="tabular-nums">{totalParticipants}</span>
          </button>
        </div>

        {/* Right: Layout actions & Leave button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFullscreen}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isFullscreen
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleLayout}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              layoutMode === 'speaker'
                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title={layoutMode === 'speaker' ? 'Switch to Gallery Grid' : 'Switch to Active Speaker View'}
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Meeting Audio & Sound Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Red Leave Pill Button */}
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/25 active:scale-95 ml-2 cursor-pointer"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* ── Top Moderator Mute Banner (if muted) ─────────────────────────────── */}
      {isMutedByModerator && (
        <div className="bg-amber-950/90 border-b border-amber-600/50 px-4 py-2 flex items-center justify-center gap-2 text-amber-200 text-xs font-bold shadow-lg animate-in slide-in-from-top duration-200 z-20">
          <VolumeX className="w-4 h-4 text-amber-400" />
          <span>You have been muted by the teacher. Microphone is locked.</span>
        </div>
      )}

      {/* ── Main Fullscreen Video Stage ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative p-4 gap-4">
        {/* Dynamic Video Stage */}
        <div className="flex-1 h-full min-w-0 relative flex flex-col justify-center">
          <ConnectionStatus connectionState={connectionState} onRetry={join} />

          {joined ? (
            <ParticipantGrid
              remoteUsers={remoteUsers}
              participants={participants}
              localParticipant={localParticipant}
              localVideoTrack={isScreenSharing ? screenTrack : localVideoTrack}
              activeSpeakerUid={activeSpeakerUid}
              screenShareUid={isScreenSharing ? effectiveUid : undefined}
              screenTrack={screenTrack}
              layoutMode={layoutMode}
              canModerate={role === 'teacher'}
              onMuteParticipant={(targetUserId) => muteParticipant(targetUserId, 'Muted by teacher')}
              onStreamQualityChange={setParticipantStreamQuality}
              className="h-full w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
                <p className="text-slate-300 text-sm font-semibold">
                  {isJoining ? 'Connecting to Agora RTC...' : 'Preparing video stage...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Participants Panel (Right Drawer) */}
        {isParticipantsPanelOpen && (
          <div className="w-72 sm:w-80 shrink-0 h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/95 animate-in slide-in-from-right-4 duration-200">
            <ParticipantsPanel
              participants={participants}
              localParticipant={localParticipant}
              activeSpeakerUid={activeSpeakerUid}
              onClose={() => setIsParticipantsPanelOpen(false)}
            />
          </div>
        )}

        {/* AI Tutor Panel (Right Drawer) */}
        {isAIPanelOpen && (
          <div className="w-80 sm:w-96 shrink-0 h-full rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl bg-[#070B18] animate-in slide-in-from-right-4 duration-200">
            <AIClassroomPanel
              classId={classroom.classId}
              subject={classroom.subject}
              className="h-full w-full"
              onClose={() => setIsAIPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* ── Centered Floating Control Dock ─────────────────────────────────── */}
      <MeetingControls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isAIPanelOpen={isAIPanelOpen}
        isParticipantsPanelOpen={isParticipantsPanelOpen}
        participantCount={totalParticipants}
        connectionState={connectionState}
        networkQuality={networkQuality}
        isTeacher={role === 'teacher'}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        isRecordingLoading={isRecordingLoading}
        isMutedByModerator={isMutedByModerator}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onToggleAIPanel={() => setIsAIPanelOpen((v) => !v)}
        onToggleParticipantsPanel={() => setIsParticipantsPanelOpen((v) => !v)}
        onLeave={handleLeave}
        disabled={!joined}
      />

      {/* ── Classroom Event Notification Toasts ─────────────────────────────── */}
      <ClassroomToasts events={events} onDismiss={dismissEvent} />

      {/* ── Meeting Audio & Sound Design Settings Modal ──────────────────────── */}
      <MeetingSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

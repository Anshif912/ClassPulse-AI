import React, { useRef, useEffect, memo } from 'react';
import { IAgoraRTCRemoteUser, UID } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, VideoOff, GraduationCap, Sparkles } from 'lucide-react';
import { RtcParticipant } from '../types';

interface ParticipantTileProps {
  uid: UID;
  participant: RtcParticipant;
  remoteUser?: IAgoraRTCRemoteUser;
  isActiveSpeaker: boolean;
  isLocal: boolean;
  localVideoTrack?: any; // ICameraVideoTrack | ILocalVideoTrack
  isScreenShareTrack?: boolean;
  size?: 'fit' | 'large' | 'medium' | 'small';
  className?: string;
}

export const ParticipantTile = memo(function ParticipantTile({
  uid,
  participant,
  remoteUser,
  isActiveSpeaker,
  isLocal,
  localVideoTrack,
  isScreenShareTrack = false,
  size = 'fit',
  className = '',
}: ParticipantTileProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasVideo = participant.hasVideo;
  const hasAudio = participant.hasAudio;
  const name = participant.name || 'Joining...';
  const isTeacher = participant.role === 'teacher';

  // Play video into container
  const remoteVideoTrack = !isLocal && hasVideo ? remoteUser?.videoTrack : null;
  const activeTrack = isLocal ? (hasVideo ? localVideoTrack : null) : remoteVideoTrack;

  useEffect(() => {
    if (!videoContainerRef.current || !activeTrack) return;
    const container = videoContainerRef.current;

    try {
      activeTrack.play(container, { fit: isScreenShareTrack ? 'contain' : 'cover' });
    } catch {
      // Safe catch for rapid play aborts
    }

    return () => {
      try {
        activeTrack.stop();
      } catch {}
    };
  }, [activeTrack, isScreenShareTrack]);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CP';

  return (
    <div
      className={`relative bg-slate-900/90 rounded-2xl overflow-hidden shadow-xl border transition-all duration-200 flex items-center justify-center ${
        isActiveSpeaker
          ? 'border-blue-500 shadow-blue-500/20 ring-2 ring-blue-400/40 ring-offset-2 ring-offset-slate-950'
          : 'border-slate-800/80 hover:border-slate-700/80'
      } ${className}`}
      aria-label={`${name}${isTeacher ? ' (Teacher)' : ''}`}
    >
      {/* Video layer */}
      <div
        ref={videoContainerRef}
        className={`absolute inset-0 w-full h-full ${
          isLocal && !isScreenShareTrack ? 'scale-x-[-1]' : ''
        }`}
        style={{ display: hasVideo ? 'block' : 'none' }}
      />

      {/* Avatar fallback when camera is turned off */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-[#0B1020] select-none p-4">
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xl sm:text-2xl font-black text-white shadow-xl">
              {initials}
            </div>
            {isTeacher && (
              <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-full text-slate-950 shadow-md">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          <p className="mt-3 text-xs sm:text-sm font-bold text-slate-300 max-w-[180px] text-center truncate">
            {name} {isLocal && '(You)'}
          </p>
        </div>
      )}

      {/* Camera off badge */}
      {!hasVideo && (
        <div className="absolute top-3 right-3 p-1.5 bg-slate-950/70 border border-slate-800 rounded-xl backdrop-blur-md">
          <VideoOff className="w-3.5 h-3.5 text-slate-400" aria-label="Camera off" />
        </div>
      )}

      {/* Bottom participant bar */}
      <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0 bg-slate-950/70 backdrop-blur-md border border-slate-800/80 px-2.5 py-1 rounded-xl">
          {isTeacher && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
              <GraduationCap className="w-3 h-3" /> Teacher
            </span>
          )}
          <span className="text-xs font-bold text-white truncate max-w-[160px] sm:max-w-[200px]">
            {name}
            {isLocal && ' (You)'}
          </span>
        </div>

        {/* Mic state pill */}
        <div className="flex items-center gap-1 bg-slate-950/70 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-xl">
          {hasAudio ? (
            isActiveSpeaker ? (
              <div className="flex items-center gap-0.5 px-1">
                <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse delay-75" />
                <span className="w-1 h-2.5 bg-emerald-400 rounded-full animate-pulse delay-150" />
              </div>
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-400" aria-label="Microphone on" />
            )
          ) : (
            <MicOff className="w-3.5 h-3.5 text-rose-400" aria-label="Muted" />
          )}
        </div>
      </div>
    </div>
  );
});

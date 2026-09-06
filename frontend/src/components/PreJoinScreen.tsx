import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, MicOff, Video, VideoOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import AgoraRTC, { ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { Classroom, PreJoinConfig } from '../types';
import { useDevices } from '../hooks/useDevices';
import { useAuth } from '../hooks/useAuth';
import { SpecularButton } from './effects/SpecularButton';
import { soundManager } from '../services/soundManager';

// ──────────────────────────────────────────────────────────────────────────────
// PreJoinScreen
// Camera/mic preview before entering the classroom.
// Gracefully handles device errors — never blocks joining.
// ──────────────────────────────────────────────────────────────────────────────

interface PreJoinScreenProps {
  classroom: Classroom;
  onJoin: (config: PreJoinConfig) => void;
  defaultRole?: 'teacher' | 'student';
}

export function PreJoinScreen({ classroom, onJoin, defaultRole }: PreJoinScreenProps) {
  const { user } = useAuth();
  const effectiveRole = (user?.role?.toLowerCase() as 'teacher' | 'student') || defaultRole || 'student';
  const [name, setName] = useState(user?.name || '');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [previewTrack, setPreviewTrack] = useState<ICameraVideoTrack | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isStartingPreview, setIsStartingPreview] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const { cameras, microphones, permissionError } = useDevices();

  // Start camera preview
  useEffect(() => {
    let track: ICameraVideoTrack | null = null;
    setIsStartingPreview(true);

    AgoraRTC.createCameraVideoTrack({
      encoderConfig: { width: 320, height: 240, frameRate: 15 },
    })
      .then((t) => {
        track = t;
        setPreviewTrack(t);
        setPreviewError(null);
        setIsStartingPreview(false);
      })
      .catch((err) => {
        console.warn('[PREJOIN] Camera preview error:', err.message);
        setPreviewError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. You can still join without video.'
            : 'No camera found. You can join without video.'
        );
        setCameraEnabled(false);
        setIsStartingPreview(false);
      });

    return () => {
      if (track) {
        track.stop();
        track.close();
      }
    };
  }, []);

  // Play preview track into container
  useEffect(() => {
    if (previewTrack && videoContainerRef.current) {
      previewTrack.play(videoContainerRef.current);
    }
    return () => {
      if (previewTrack) {
        try { previewTrack.stop(); } catch {}
      }
    };
  }, [previewTrack]);

  const handleJoin = async () => {
    soundManager.unlock();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Please enter your name to join.');
      return;
    }
    setNameError(null);
    setIsJoining(true);

    // Stop preview track before main join (Agora creates fresh tracks inside)
    if (previewTrack) {
      previewTrack.stop();
      previewTrack.close();
      setPreviewTrack(null);
    }

    // Generate a stable UID for this participant (hash of name + timestamp)
    const uid = Math.floor(10000 + Math.random() * 89999);

    onJoin({
      name: trimmedName,
      cameraEnabled,
      micEnabled,
      role: effectiveRole,
      uid,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CLASS PULSE</p>
              <p className="text-xs text-slate-500">{classroom.subject}</p>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">{classroom.name}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Hosted by {classroom.teacherName}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Camera preview */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video isolate">
            {isStartingPreview && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
              </div>
            )}

            {!isStartingPreview && previewTrack && cameraEnabled && (
              <div ref={videoContainerRef} className="w-full h-full relative z-0" />
            )}

            {(!cameraEnabled || previewError) && !isStartingPreview && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-slate-950">
                <VideoOff className="w-10 h-10 text-slate-600" />
                <p className="text-xs text-slate-500 text-center px-4">
                  {previewError || 'Camera is off'}
                </p>
              </div>
            )}

            {/* Camera toggle overlay */}
            {!isStartingPreview && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-auto">
                <button
                  data-testid="prejoin-camera"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundManager.unlock();
                    setCameraEnabled((v) => {
                      const next = !v;
                      soundManager.play(next ? 'camera_on' : 'camera_off');
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    cameraEnabled
                      ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-700'
                      : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                  }`}
                  aria-label={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {cameraEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                  <span>{cameraEnabled ? 'Camera on' : 'Camera off'}</span>
                </button>

                <button
                  data-testid="prejoin-microphone"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundManager.unlock();
                    setMicEnabled((v) => {
                      const next = !v;
                      soundManager.play(next ? 'mic_on' : 'mic_off');
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    micEnabled
                      ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-700'
                      : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                  }`}
                  aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  <span>{micEnabled ? 'Mic on' : 'Mic off'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Device status */}
          <div className="grid grid-cols-2 gap-2 text-xs relative z-10">
            <DeviceStatusRow
              icon={<Video className="w-3.5 h-3.5" />}
              label="Camera"
              value={cameras[0]?.label || 'Default camera'}
              ok={cameras.length > 0 && !permissionError}
            />
            <DeviceStatusRow
              icon={<Mic className="w-3.5 h-3.5" />}
              label="Microphone"
              value={microphones[0]?.label || 'Default microphone'}
              ok={microphones.length > 0 && !permissionError}
            />
          </div>

          {/* Permission error */}
          {permissionError && (
            <div className="flex items-start gap-2 p-3 bg-amber-950/40 border border-amber-700/40 rounded-xl text-xs text-amber-300 relative z-10">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{permissionError}</span>
            </div>
          )}

          {/* Name input */}
          <div className="space-y-1.5 relative z-10">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Your Name
            </label>
            <input
              data-testid="prejoin-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name..."
              maxLength={50}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent relative z-10"
              aria-label="Your name"
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {nameError}
              </p>
            )}
          </div>

          {/* Join button */}
          <div className="relative z-10 w-full">
            <SpecularButton
              size="lg"
              radius={16}
              tint="#2563EB"
              tintOpacity={1}
              lineColor="#93C5FD"
              baseColor="#1D4ED8"
              intensity={1.3}
              data-testid="prejoin-join"
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full !py-3.5"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <span>Join Classroom →</span>
              )}
            </SpecularButton>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            You're joining as a {effectiveRole} · Class ID: {classroom.classId}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Device status row ───────────────────────────────────────────────────────

function DeviceStatusRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl">
      <span className={ok ? 'text-slate-400' : 'text-slate-600'}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 leading-none">{label}</p>
        <p className="text-slate-300 truncate text-[11px] mt-0.5">{ok ? value : 'Unavailable'}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-auto" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 text-slate-600 shrink-0 ml-auto" />
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { IAgoraRTCRemoteUser, UID } from 'agora-rtc-sdk-ng';

// ──────────────────────────────────────────────────────────────────────────────
// useActiveSpeaker
// Tracks which participant is currently speaking using Agora volume indication.
// Uses smoothing to prevent rapid switching.
// ──────────────────────────────────────────────────────────────────────────────

interface UseActiveSpeakerOptions {
  remoteUsers: IAgoraRTCRemoteUser[];
  localUid: number;
  isMicOn: boolean;
  intervalMs?: number;
  debounceMs?: number;
}

export function useActiveSpeaker({
  remoteUsers,
  localUid,
  isMicOn,
  intervalMs = 1000,
  debounceMs = 1500,
}: UseActiveSpeakerOptions) {
  const [activeSpeakerUid, setActiveSpeakerUid] = useState<UID | null>(null);
  const lastSwitchRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSpeakers = useCallback(() => {
    const now = Date.now();

    // Find highest-volume remote user
    let maxVolume = 0;
    let speakingUid: UID | null = null;

    for (const user of remoteUsers) {
      if (user.audioTrack) {
        const volume = user.audioTrack.getVolumeLevel?.() ?? 0;
        if (volume > maxVolume && volume > 0.05) {
          maxVolume = volume;
          speakingUid = user.uid;
        }
      }
    }

    // Debounce: only switch if enough time has elapsed since last switch
    if (now - lastSwitchRef.current >= debounceMs) {
      if (speakingUid !== activeSpeakerUid) {
        setActiveSpeakerUid(speakingUid);
        lastSwitchRef.current = now;
      }
    }
  }, [remoteUsers, activeSpeakerUid, debounceMs]);

  useEffect(() => {
    intervalRef.current = setInterval(checkSpeakers, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkSpeakers, intervalMs]);

  return { activeSpeakerUid };
}

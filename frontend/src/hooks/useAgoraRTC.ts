import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
  UID,
  ConnectionState,
  NetworkQuality,
} from 'agora-rtc-sdk-ng';
import { RtcParticipant, ClassroomEvent } from '../types';
import { api } from '../services/api';
import { soundManager } from '../services/soundManager';

AgoraRTC.setLogLevel(1); // 1=DEBUG
try {
  if (typeof (AgoraRTC as any).setParameter === 'function') {
    (AgoraRTC as any).setParameter('ENABLE_AUDIO_PTS_METADATA', true);
  }
} catch {}

export type RtcLifecycleState =
  | 'idle'
  | 'initializing'
  | 'joining'
  | 'joined'
  | 'leaving'
  | 'left'
  | 'error';

interface UseAgoraRTCOptions {
  classId: string;
  uid?: number;
  localName: string;
  role: 'teacher' | 'student';
  initialCameraOn: boolean;
  initialMicOn: boolean;
  onParticipantUpdate?: (participants: Map<UID, RtcParticipant>) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onError?: (error: string) => void;
}

interface UseAgoraRTCReturn {
  // Tracks
  localVideoTrack: ICameraVideoTrack | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
  screenTrack: ILocalVideoTrack | null;
  // Participants
  remoteUsers: IAgoraRTCRemoteUser[];
  participants: Map<UID, RtcParticipant>;
  localParticipant: RtcParticipant | null;
  // Events
  events: ClassroomEvent[];
  dismissEvent: (id: string) => void;
  // State
  joined: boolean;
  lifecycleState: RtcLifecycleState;
  connectionState: ConnectionState;
  networkQuality: NetworkQuality | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  isJoining: boolean;
  // Actions
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  playRemoteVideo: (uid: UID, container: HTMLElement) => void;
  playLocalVideo: (container: HTMLElement) => void;
}

export function classifyAgoraError(err: any): string {
  const msg = (err?.message || err?.code || err?.name || String(err)).toLowerCase();

  if (msg.includes('invalid_operation') || msg.includes('already in connecting') || msg.includes('already connected')) {
    return 'Agora RTC Error: Client was in an invalid connecting state. Re-initialization scheduled.';
  }
  if (
    msg.includes('can_not_get_gateway_server') ||
    msg.includes('invalid token') ||
    msg.includes('authorized failed') ||
    msg.includes('token expired') ||
    msg.includes('dynamic_key_expired')
  ) {
    return 'Agora Authorization Error: Invalid token or authorization failed. Verify Agora App ID and App Certificate on backend.';
  }
  if (msg.includes('notallowederror') || msg.includes('permission denied')) {
    return 'Media Permission Error: Camera or Microphone permission was denied in your browser.';
  }
  if (msg.includes('notreadableerror') || msg.includes('could not start video source') || msg.includes('devices are occupied')) {
    return 'Media Device Error: Camera or Microphone is already in use by another application.';
  }
  if (msg.includes('network_error') || msg.includes('err_name_not_resolved') || msg.includes('net::err')) {
    return 'Network Error: Unable to reach Agora RTC cloud gateway. Check your network or DNS configuration.';
  }
  return `Classroom Connection Error: ${err?.message || 'Failed to connect to Agora RTC classroom.'}`;
}

export function useAgoraRTC({
  classId,
  localName,
  role,
  initialCameraOn,
  initialMicOn,
  onError,
}: UseAgoraRTCOptions): UseAgoraRTCReturn {
  const classIdRef = useRef(classId);
  classIdRef.current = classId;
  const localNameRef = useRef(localName);
  localNameRef.current = localName;
  const roleRef = useRef(role);
  roleRef.current = role;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // ─── State ──────────────────────────────────────────────────────────────────
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [participants, setParticipants] = useState<Map<UID, RtcParticipant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<RtcParticipant | null>(null);
  const [events, setEvents] = useState<ClassroomEvent[]>([]);
  const [joined, setJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [lifecycleState, setLifecycleState] = useState<RtcLifecycleState>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // ─── Tracks & Refs ──────────────────────────────────────────────────────────
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);

  const initialCameraOnRef = useRef(initialCameraOn);
  initialCameraOnRef.current = initialCameraOn;
  const initialMicOnRef = useRef(initialMicOn);
  initialMicOnRef.current = initialMicOn;

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const wasCameraActiveBeforeScreenShareRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const isJoiningRef = useRef(false);
  const lifecycleStateRef = useRef<RtcLifecycleState>('idle');
  const rosterRef = useRef<Map<number, { name: string; role: 'teacher' | 'student'; avatarUrl?: string }>>(new Map());
  const recentEventsRef = useRef<Map<string, number>>(new Map());

  // ─── Classroom Event Dispatcher (with 4s auto-dismiss & deduplication) ───────
  const addEvent = useCallback((type: ClassroomEvent['type'], displayName: string, message: string, agoraUid?: number) => {
    const dedupeKey = `${type}_${displayName}_${agoraUid || 0}`;
    const now = Date.now();
    const lastTime = recentEventsRef.current.get(dedupeKey) || 0;

    if (now - lastTime < 4000) return; // Ignore duplicate within 4s
    recentEventsRef.current.set(dedupeKey, now);

    const eventId = `evt_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const newEvent: ClassroomEvent = {
      id: eventId,
      type,
      displayName,
      agoraUid,
      timestamp: new Date().toISOString(),
      message,
    };

    setEvents((prev) => [...prev.slice(-4), newEvent]); // Keep max 5 active toasts

    setTimeout(() => {
      if (isMountedRef.current) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      }
    }, 4500);
  }, []);

  const dismissEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Fetch Class Roster to map Agora UIDs -> Real User Display Names ────────
  const syncRoster = useCallback(async () => {
    try {
      const res = await api.getClassRoster(classIdRef.current);
      if (res?.roster) {
        const map = new Map<number, { name: string; role: 'teacher' | 'student'; avatarUrl?: string }>();
        for (const [uidStr, user] of Object.entries(res.roster)) {
          const numUid = parseInt(uidStr, 10);
          map.set(numUid, {
            name: user.displayName,
            role: user.role.toLowerCase() as 'teacher' | 'student',
            avatarUrl: user.avatarUrl,
          });
        }
        rosterRef.current = map;

        // Update existing participants with real names
        setParticipants((prev) => {
          const next = new Map(prev);
          let changed = false;
          next.forEach((p, pUid) => {
            const resolved = map.get(pUid as number);
            if (resolved && (p.name !== resolved.name || p.name === 'Joining...')) {
              next.set(pUid, {
                ...p,
                name: resolved.name,
                role: resolved.role,
                avatarUrl: resolved.avatarUrl,
              });
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    } catch {
      // Non-fatal roster fetch
    }
  }, []);

  // ─── Participant State Updaters ─────────────────────────────────────────────
  const updateParticipant = useCallback((pUid: UID, update: Partial<RtcParticipant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(pUid);
      const info = rosterRef.current.get(pUid as number);

      if (existing) {
        next.set(pUid, { ...existing, ...update });
      } else {
        next.set(pUid, {
          uid: pUid as number,
          name: info?.name || update.name || 'Joining...',
          role: info?.role || update.role || 'student',
          avatarUrl: info?.avatarUrl || update.avatarUrl,
          hasVideo: false,
          hasAudio: false,
          isSpeaking: false,
          isLocal: false,
          ...update,
        });
      }
      return next;
    });
  }, []);

  const removeParticipant = useCallback((pUid: UID) => {
    const existing = participants.get(pUid);
    const displayName = existing?.name || rosterRef.current.get(pUid as number)?.name || 'Participant';

    if (displayName && displayName !== 'Joining...') {
      addEvent('PARTICIPANT_LEFT', displayName, `${displayName} has left`, pUid as number);
    }

    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(pUid);
      return next;
    });
  }, [participants, addEvent]);

  // ─── Client Event Handlers ──────────────────────────────────────────────────
  const attachClientEvents = useCallback((client: IAgoraRTCClient) => {
    client.removeAllListeners();

    // Remote user publishes
    client.on('user-published', async (user, mediaType) => {
      try {
        if (!isMountedRef.current) return;
        if (mediaType === 'video') {
          // Subscribe to high-stream (0) for clear presentation & 1-4 users; low-stream (1) only when grid has 5+ users
          const streamType = remoteUsers.length <= 3 ? 0 : 1;
          await client.setRemoteVideoStreamType(user.uid, streamType);
        }

        await client.subscribe(user, mediaType);
        if (!isMountedRef.current) return;

        const info = rosterRef.current.get(user.uid as number);
        if (mediaType === 'video') {
          updateParticipant(user.uid, {
            hasVideo: true,
            ...(info ? { name: info.name, role: info.role, avatarUrl: info.avatarUrl } : {}),
          });
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
          updateParticipant(user.uid, {
            hasAudio: true,
            ...(info ? { name: info.name, role: info.role, avatarUrl: info.avatarUrl } : {}),
          });
        }

        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          return exists ? prev.map((u) => (u.uid === user.uid ? user : u)) : [...prev, user];
        });
      } catch (err: any) {
        console.warn('[AGORA RTC] Subscribe error:', err);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (!isMountedRef.current) return;
      if (mediaType === 'video') updateParticipant(user.uid, { hasVideo: false });
      if (mediaType === 'audio') updateParticipant(user.uid, { hasAudio: false });
      setRemoteUsers((prev) => prev.map((u) => (u.uid === user.uid ? user : u)));
    });

    client.on('user-joined', async (user) => {
      if (!isMountedRef.current) return;
      soundManager.play('participant_join', user.uid);
      await syncRoster();
      const info = rosterRef.current.get(user.uid as number);
      const displayName = info?.name || 'New participant';

      updateParticipant(user.uid, {
        uid: user.uid as number,
        name: info?.name || 'Joining...',
        role: info?.role || 'student',
        avatarUrl: info?.avatarUrl,
        hasVideo: !!user.videoTrack,
        hasAudio: !!user.audioTrack,
        isSpeaking: false,
        isLocal: false,
      });

      if (displayName && displayName !== 'Joining...' && displayName !== 'New participant') {
        addEvent('PARTICIPANT_JOINED', displayName, `${displayName} joined`, user.uid as number);
      }

      setRemoteUsers((prev) => {
        const exists = prev.find((u) => u.uid === user.uid);
        return exists ? prev : [...prev, user];
      });
    });

    client.on('user-left', (user) => {
      if (!isMountedRef.current) return;
      soundManager.play('participant_leave', user.uid);
      removeParticipant(user.uid);
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
    });

    client.on('connection-state-change', (curState, prevState) => {
      console.log(`[AGORA RTC] Connection: ${prevState} → ${curState}`);
      if (!isMountedRef.current) return;
      if (curState === 'CONNECTED' && prevState === 'RECONNECTING') {
        soundManager.play('meeting_reconnected');
      } else if (curState === 'CONNECTED' && (prevState === 'CONNECTING' || prevState === 'DISCONNECTED')) {
        soundManager.play('meeting_connected');
      } else if (curState === 'DISCONNECTED' && prevState === 'CONNECTED') {
        soundManager.play('meeting_error');
      }
      setConnectionState(curState);
    });

    client.on('network-quality', (quality) => {
      if (!isMountedRef.current) return;
      setNetworkQuality(quality);
    });
  }, [syncRoster, updateParticipant, removeParticipant, addEvent]);

  // ─── Join Classroom ─────────────────────────────────────────────────────────
  const join = useCallback(async () => {
    if (isJoiningRef.current || lifecycleStateRef.current === 'joined' || lifecycleStateRef.current === 'joining') {
      return;
    }
    soundManager.unlock();
    isJoiningRef.current = true;
    setIsJoining(true);
    lifecycleStateRef.current = 'joining';
    setLifecycleState('joining');

    try {
      // 1. Get authoritative Agora token & numeric UID from backend
      const tokenData = await api.getAgoraToken(classIdRef.current);
      if (!tokenData?.token || !tokenData?.appId) {
        throw new Error('Server returned empty Agora credentials.');
      }
      if (!isMountedRef.current) return;

      await syncRoster();
      if (!isMountedRef.current) return;

      // 2. Initialize Agora Client with dual stream
      let client = clientRef.current;
      if (!client) {
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;
      }
      attachClientEvents(client);
      await client.enableDualStream();
      if (!isMountedRef.current) return;

      // 3. Join channel
      await client.join(
        tokenData.appId,
        tokenData.channel,
        tokenData.token,
        tokenData.uid
      );
      if (!isMountedRef.current) return;

      // 4. Create & publish camera video track (720p HD Adaptive Profile)
      const tracksToPublish: (ICameraVideoTrack | IMicrophoneAudioTrack)[] = [];
      if (initialCameraOnRef.current) {
        try {
          const vTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: { width: 1280, height: 720, frameRate: 24, bitrateMin: 800, bitrateMax: 1500 },
          });
          if (isMountedRef.current) {
            localVideoTrackRef.current = vTrack;
            setLocalVideoTrack(vTrack);
            tracksToPublish.push(vTrack);
          } else {
            vTrack.close();
          }
        } catch (e) {
          console.warn('[AGORA RTC] Camera init failed:', e);
          setIsCameraOn(false);
        }
      }

      // 5. Create & publish microphone audio track
      if (initialMicOnRef.current) {
        try {
          const aTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
          });
          if (isMountedRef.current) {
            localAudioTrackRef.current = aTrack;
            setLocalAudioTrack(aTrack);
            tracksToPublish.push(aTrack);
          } else {
            aTrack.close();
          }
        } catch (e) {
          console.warn('[AGORA RTC] Mic init failed:', e);
          setIsMicOn(false);
        }
      }

      if (tracksToPublish.length > 0 && isMountedRef.current && clientRef.current) {
        await clientRef.current.publish(tracksToPublish);
      }

      if (!isMountedRef.current) return;

      // 6. Set local participant
      const localPart: RtcParticipant = {
        uid: tokenData.uid,
        name: tokenData.userName || localNameRef.current || 'You',
        role: (tokenData.role?.toLowerCase() as 'teacher' | 'student') || roleRef.current || 'student',
        avatarUrl: tokenData.userAvatar,
        hasVideo: initialCameraOnRef.current && !!localVideoTrackRef.current,
        hasAudio: initialMicOnRef.current && !!localAudioTrackRef.current,
        isSpeaking: false,
        isLocal: true,
      };

      setLocalParticipant(localPart);
      setJoined(true);
      lifecycleStateRef.current = 'joined';
      setLifecycleState('joined');
      setConnectionState('CONNECTED');
    } catch (err: any) {
      console.error('[AGORA RTC JOIN ERROR]', err);
      lifecycleStateRef.current = 'error';
      setLifecycleState('error');
      const classified = classifyAgoraError(err);
      onErrorRef.current?.(classified);
    } finally {
      isJoiningRef.current = false;
      setIsJoining(false);
    }
  }, [syncRoster, attachClientEvents]);

  // ─── Leave Classroom ────────────────────────────────────────────────────────
  const leave = useCallback(async () => {
    if (lifecycleStateRef.current === 'idle' || lifecycleStateRef.current === 'left' || lifecycleStateRef.current === 'leaving') {
      return;
    }
    soundManager.play('meeting_leave');
    lifecycleStateRef.current = 'leaving';
    setLifecycleState('leaving');
    try {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setScreenTrack(null);
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
        setLocalVideoTrack(null);
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
        setLocalAudioTrack(null);
      }
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
        clientRef.current = null;
      }
      try {
        await api.recordLeave(classIdRef.current);
      } catch {}
    } catch (err) {
      console.warn('[AGORA RTC LEAVE]', err);
    } finally {
      setJoined(false);
      setLocalParticipant(null);
      setParticipants(new Map());
      setRemoteUsers([]);
      lifecycleStateRef.current = 'left';
      setLifecycleState('left');
      setConnectionState('DISCONNECTED');
    }
  }, []);

  // ─── Camera Toggle ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    soundManager.unlock();
    if (isCameraOn) {
      soundManager.play('camera_off');
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.setEnabled(false);
      }
      setIsCameraOn(false);
      if (localParticipant) setLocalParticipant({ ...localParticipant, hasVideo: false });
    } else {
      soundManager.play('camera_on');
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.setEnabled(true);
      } else if (clientRef.current) {
        try {
          const vTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: { width: 1280, height: 720, frameRate: 24, bitrateMin: 800, bitrateMax: 1500 },
          });
          localVideoTrackRef.current = vTrack;
          setLocalVideoTrack(vTrack);
          // Only publish camera track if not currently screen sharing
          if (!isScreenSharing) {
            await clientRef.current.publish(vTrack);
          }
        } catch (e) {
          console.warn('[CAMERA TOGGLE]', e);
        }
      }
      setIsCameraOn(true);
      if (localParticipant) setLocalParticipant({ ...localParticipant, hasVideo: true });
    }
  }, [isCameraOn, isScreenSharing, localParticipant]);

  // ─── Meeting Microphone Toggle (Separated from AI Mic) ───────────────────────
  const toggleMic = useCallback(async () => {
    soundManager.unlock();
    if (isMicOn) {
      soundManager.play('mic_off');
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.setEnabled(false);
      }
      setIsMicOn(false);
      if (localParticipant) setLocalParticipant({ ...localParticipant, hasAudio: false });
    } else {
      soundManager.play('mic_on');
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.setEnabled(true);
      } else if (clientRef.current) {
        try {
          const aTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: 'speech_standard',
            AEC: true,
            ANS: true,
          });
          localAudioTrackRef.current = aTrack;
          setLocalAudioTrack(aTrack);
          await clientRef.current.publish(aTrack);
        } catch (e) {
          console.warn('[MIC TOGGLE]', e);
        }
      }
      setIsMicOn(true);
      if (localParticipant) setLocalParticipant({ ...localParticipant, hasAudio: true });
    }
  }, [isMicOn, localParticipant]);

  // ─── Screen Sharing (Preserves Camera & Text Detail Quality) ─────────────────
  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return;
    soundManager.play('screen_share_stop');
    try {
      if (screenTrackRef.current) {
        if (clientRef.current) {
          try { await clientRef.current.unpublish(screenTrackRef.current); } catch {}
        }
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
        setScreenTrack(null);
      }

      // Restore camera video track safely if camera was active prior to screen share
      if (wasCameraActiveBeforeScreenShareRef.current && clientRef.current && localVideoTrackRef.current) {
        try {
          await clientRef.current.publish(localVideoTrackRef.current);
          localVideoTrackRef.current.setEnabled(true);
          setIsCameraOn(true);
          if (localParticipant) setLocalParticipant({ ...localParticipant, hasVideo: true });
        } catch (err) {
          console.warn('[AGORA RTC] Failed to restore camera track after screen share:', err);
        }
      }
      wasCameraActiveBeforeScreenShareRef.current = false;

      const myName = localParticipant?.name || localNameRef.current || 'Presenter';
      addEvent('SCREEN_SHARE_STOPPED', myName, `${myName} stopped presenting`);
    } catch (err) {
      console.warn('[STOP SCREEN SHARE]', err);
    } finally {
      setIsScreenSharing(false);
    }
  }, [isScreenSharing, localParticipant, addEvent]);

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing || !clientRef.current) return;
    soundManager.unlock();
    try {
      // 1. Check if camera is currently active & published. If so, unpublish it first to prevent CAN_NOT_PUBLISH_MULTIPLE_VIDEO_TRACKS
      const wasCameraActive = isCameraOn && !!localVideoTrackRef.current;
      wasCameraActiveBeforeScreenShareRef.current = wasCameraActive;

      if (wasCameraActive && localVideoTrackRef.current && clientRef.current) {
        try {
          await clientRef.current.unpublish(localVideoTrackRef.current);
        } catch (e) {
          console.warn('[AGORA RTC] Camera unpublish before screen share:', e);
        }
      }

      // 2. Create dedicated screen track with presentation detail encoder (1080p Detail Mode)
      const sTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: {
            width: 1920,
            height: 1080,
            frameRate: 10,
            bitrateMin: 800,
            bitrateMax: 2500,
          },
          optimizationMode: 'detail',
        },
        'disable'
      );

      const screenVideo = Array.isArray(sTrack) ? sTrack[0] : sTrack;
      screenTrackRef.current = screenVideo;
      setScreenTrack(screenVideo);

      // Handle browser's native "Stop sharing" floating bar
      screenVideo.on('track-ended', () => {
        stopScreenShare();
      });

      await clientRef.current.publish(screenVideo);
      setIsScreenSharing(true);
      if (localParticipant) setLocalParticipant({ ...localParticipant, hasVideo: true });
      soundManager.play('screen_share_start');

      const myName = localParticipant?.name || localNameRef.current || 'Presenter';
      addEvent('SCREEN_SHARE_STARTED', myName, `${myName} started presenting`);
    } catch (err: any) {
      // If user cancelled browser picker, restore camera if it was active
      if (wasCameraActiveBeforeScreenShareRef.current && clientRef.current && localVideoTrackRef.current) {
        try {
          await clientRef.current.publish(localVideoTrackRef.current);
        } catch {}
      }
      wasCameraActiveBeforeScreenShareRef.current = false;

      if (err?.code !== 'PERMISSION_DENIED' && err?.name !== 'NotAllowedError') {
        console.error('[SCREEN SHARE ERROR]', err);
        onErrorRef.current?.(classifyAgoraError(err));
      }
    }
  }, [isScreenSharing, isCameraOn, stopScreenShare, localParticipant, addEvent]);

  const playRemoteVideo = useCallback((uid: UID, container: HTMLElement) => {
    const user = remoteUsers.find((u) => u.uid === uid);
    if (user?.videoTrack) {
      user.videoTrack.play(container);
    }
  }, [remoteUsers]);

  const playLocalVideo = useCallback((container: HTMLElement) => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.play(container);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (lifecycleStateRef.current === 'joined' || lifecycleStateRef.current === 'joining') {
        leave();
      }
    };
  }, [leave]);

  return {
    localVideoTrack,
    localAudioTrack,
    screenTrack,
    remoteUsers,
    participants,
    localParticipant,
    events,
    dismissEvent,
    joined,
    lifecycleState,
    connectionState,
    networkQuality,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    isJoining,
    join,
    leave,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
    playRemoteVideo,
    playLocalVideo,
  };
}

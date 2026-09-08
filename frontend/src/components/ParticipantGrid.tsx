import React, { useState, useMemo, useEffect } from 'react';
import { IAgoraRTCRemoteUser, UID } from 'agora-rtc-sdk-ng';
import { Monitor, Users, Maximize2, Minimize2 } from 'lucide-react';
import { RtcParticipant } from '../types';
import { ParticipantTile } from './ParticipantTile';

interface ParticipantGridProps {
  remoteUsers: IAgoraRTCRemoteUser[];
  participants: Map<UID, RtcParticipant>;
  localParticipant: RtcParticipant | null;
  localVideoTrack: any;
  activeSpeakerUid: UID | null;
  screenShareUid?: UID | null;
  screenTrack?: any;
  layoutMode?: 'grid' | 'speaker';
  className?: string;
  canModerate?: boolean;
  onMuteParticipant?: (userId: string) => void;
  onStreamQualityChange?: (uid: UID, quality: 'high' | 'low') => void;
}

const FILMSTRIP_MAX = 8;

export function ParticipantGrid({
  remoteUsers,
  participants,
  localParticipant,
  localVideoTrack,
  activeSpeakerUid,
  screenShareUid,
  screenTrack,
  layoutMode = 'grid',
  className = '',
  canModerate = false,
  onMuteParticipant,
  onStreamQualityChange,
}: ParticipantGridProps) {
  const [pinnedUid, setPinnedUid] = useState<UID | null>(null);

  // Ordered participant list: local first, then remote participants sorted by active speaker / teacher
  const allEntries = useMemo(() => {
    const entries: Array<{
      uid: UID;
      participant: RtcParticipant;
      remoteUser?: IAgoraRTCRemoteUser;
      isLocal: boolean;
    }> = [];
    const seenUids = new Set<UID>();

    if (localParticipant) {
      entries.push({ uid: localParticipant.uid, participant: localParticipant, isLocal: true });
      seenUids.add(localParticipant.uid);
    }

    // Add remote participants
    participants.forEach((participant, pUid) => {
      if (seenUids.has(pUid)) return;
      seenUids.add(pUid);
      const user = remoteUsers.find((u) => u.uid === pUid);
      entries.push({ uid: pUid, participant, remoteUser: user, isLocal: false });
    });

    // Also include any remoteUsers detected by Agora RTC
    for (const user of remoteUsers) {
      if (seenUids.has(user.uid)) continue;
      seenUids.add(user.uid);
      const participant = participants.get(user.uid) ?? {
        uid: user.uid as number,
        name: 'Student',
        role: 'student' as const,
        hasVideo: !!user.videoTrack,
        hasAudio: !!user.audioTrack,
        isSpeaking: false,
        isLocal: false,
      };
      entries.push({ uid: user.uid, participant, remoteUser: user, isLocal: false });
    }

    // Sort: active speaker first, then teacher, then others
    return entries.sort((a, b) => {
      if (a.uid === activeSpeakerUid) return -1;
      if (b.uid === activeSpeakerUid) return 1;
      if (a.participant.role === 'teacher') return -1;
      if (b.participant.role === 'teacher') return 1;
      return 0;
    });
  }, [localParticipant, remoteUsers, participants, activeSpeakerUid]);

  const totalCount = allEntries.length;

  // Toggle pin on tile click
  const handlePinToggle = (uid: UID) => {
    setPinnedUid((prev) => (prev === uid ? null : uid));
  };

  // Adjust stream quality when pinned UID changes
  useEffect(() => {
    if (!onStreamQualityChange) return;
    if (pinnedUid !== null) {
      onStreamQualityChange(pinnedUid, 'high');
      allEntries.forEach((e) => {
        if (e.uid !== pinnedUid && !e.isLocal) {
          onStreamQualityChange(e.uid, 'low');
        }
      });
    }
  }, [pinnedUid, allEntries, onStreamQualityChange]);

  // ── CASE 0: Screen Share Mode (Main Presentation + Bottom Thumbnail Strip) ───
  if (screenShareUid !== undefined && screenShareUid !== null) {
    const screenOwner = screenShareUid === localParticipant?.uid
      ? localParticipant
      : participants.get(screenShareUid);

    return (
      <div className={`flex flex-col h-full w-full gap-3 ${className}`}>
        {/* Main Presentation Screen */}
        <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden relative border border-purple-500/30 shadow-2xl min-h-0">
          <ParticipantTile
            uid={screenShareUid}
            participant={screenOwner ?? {
              uid: screenShareUid as number,
              name: 'Presenter Screen',
              role: 'teacher',
              hasVideo: true,
              hasAudio: false,
              isSpeaking: false,
              isLocal: false,
            }}
            remoteUser={remoteUsers.find((u) => u.uid === screenShareUid)}
            isActiveSpeaker={false}
            isLocal={screenShareUid === localParticipant?.uid}
            localVideoTrack={screenShareUid === localParticipant?.uid ? screenTrack : undefined}
            isScreenShareTrack
            className="w-full h-full"
          />
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md border border-purple-500/40 rounded-xl text-xs text-purple-300 font-bold flex items-center gap-2 shadow-lg z-20">
            <Monitor className="w-3.5 h-3.5 text-purple-400" />
            <span>Active Screen Share</span>
          </div>
        </div>

        {/* Participant Filmstrip */}
        <div className="h-32 shrink-0 flex gap-2.5 overflow-x-auto pb-1">
          {allEntries.slice(0, FILMSTRIP_MAX).map((entry) => (
            <ParticipantTile
              key={String(entry.uid)}
              uid={entry.uid}
              participant={entry.participant}
              remoteUser={entry.remoteUser}
              isActiveSpeaker={entry.uid === activeSpeakerUid}
              isLocal={entry.isLocal}
              localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
              className="w-44 h-full shrink-0"
              onPinToggle={handlePinToggle}
              canModerate={canModerate}
              onMuteParticipant={onMuteParticipant}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── CASE: Click-to-Expand Stage Mode ─────────────────────────────────────────
  if (pinnedUid !== null) {
    const pinnedEntry = allEntries.find((e) => e.uid === pinnedUid) || allEntries[0];
    const filmstripEntries = allEntries.filter((e) => e.uid !== pinnedEntry.uid).slice(0, FILMSTRIP_MAX);

    return (
      <div className={`flex flex-col h-full w-full gap-3 ${className}`}>
        {/* Promoted Main Stage */}
        <div className="flex-1 min-h-0 relative">
          <ParticipantTile
            key={String(pinnedEntry.uid)}
            uid={pinnedEntry.uid}
            participant={pinnedEntry.participant}
            remoteUser={pinnedEntry.remoteUser}
            isActiveSpeaker={pinnedEntry.uid === activeSpeakerUid}
            isLocal={pinnedEntry.isLocal}
            localVideoTrack={pinnedEntry.isLocal ? localVideoTrack : undefined}
            isPinned
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full"
          />
        </div>

        {/* Filmstrip Strip */}
        <div className="h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1">
          {filmstripEntries.map((entry) => (
            <ParticipantTile
              key={String(entry.uid)}
              uid={entry.uid}
              participant={entry.participant}
              remoteUser={entry.remoteUser}
              isActiveSpeaker={entry.uid === activeSpeakerUid}
              isLocal={entry.isLocal}
              localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
              onPinToggle={handlePinToggle}
              canModerate={canModerate}
              onMuteParticipant={onMuteParticipant}
              className="w-40 h-full shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── CASE 1: 1 Participant (100% of Available Stage) ─────────────────────────
  if (totalCount <= 1) {
    const entry = allEntries[0];
    if (!entry) {
      return (
        <div className={`flex items-center justify-center h-full w-full bg-slate-950/50 rounded-2xl border border-slate-800 ${className}`}>
          <div className="text-center space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-semibold">Ready in Classroom</p>
            <p className="text-slate-600 text-xs">Waiting for participants or teacher to connect...</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`h-full w-full flex items-center justify-center ${className}`}>
        <ParticipantTile
          uid={entry.uid}
          participant={entry.participant}
          remoteUser={entry.remoteUser}
          isActiveSpeaker={entry.uid === activeSpeakerUid}
          isLocal={entry.isLocal}
          localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
          onPinToggle={handlePinToggle}
          canModerate={canModerate}
          onMuteParticipant={onMuteParticipant}
          className="w-full h-full max-h-full"
        />
      </div>
    );
  }

  // ── CASE: Speaker Focus Mode Explicitly Selected ───────────────────────────
  if (layoutMode === 'speaker') {
    const mainEntry = allEntries.find((e) => e.uid === activeSpeakerUid) ?? allEntries[0];
    const filmstripEntries = allEntries.filter((e) => e.uid !== mainEntry.uid).slice(0, FILMSTRIP_MAX);

    return (
      <div className={`flex flex-col h-full w-full gap-3 ${className}`}>
        {/* Promoted Main Stage */}
        <div className="flex-1 min-h-0">
          <ParticipantTile
            key={String(mainEntry.uid)}
            uid={mainEntry.uid}
            participant={mainEntry.participant}
            remoteUser={mainEntry.remoteUser}
            isActiveSpeaker={mainEntry.uid === activeSpeakerUid}
            isLocal={mainEntry.isLocal}
            localVideoTrack={mainEntry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full"
          />
        </div>

        {/* Filmstrip Strip */}
        <div className="h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1">
          {filmstripEntries.map((entry) => (
            <ParticipantTile
              key={String(entry.uid)}
              uid={entry.uid}
              participant={entry.participant}
              remoteUser={entry.remoteUser}
              isActiveSpeaker={entry.uid === activeSpeakerUid}
              isLocal={entry.isLocal}
              localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
              onPinToggle={handlePinToggle}
              canModerate={canModerate}
              onMuteParticipant={onMuteParticipant}
              className="w-40 h-full shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── CASE 2: 2 Participants (50 / 50 Balanced Grid) ──────────────────────────
  if (totalCount === 2) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 h-full w-full ${className}`}>
        {allEntries.map((entry) => (
          <ParticipantTile
            key={String(entry.uid)}
            uid={entry.uid}
            participant={entry.participant}
            remoteUser={entry.remoteUser}
            isActiveSpeaker={entry.uid === activeSpeakerUid}
            isLocal={entry.isLocal}
            localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full"
          />
        ))}
      </div>
    );
  }

  // ── CASE 3: 3 Participants (Adaptive 2 Top + 1 Centered Bottom) ─────────────
  if (totalCount === 3) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 grid-rows-2 gap-3 h-full w-full ${className}`}>
        {allEntries.map((entry, idx) => (
          <div
            key={String(entry.uid)}
            className={`w-full h-full ${
              idx === 2 ? 'sm:col-span-2 sm:w-1/2 sm:mx-auto' : ''
            }`}
          >
            <ParticipantTile
              uid={entry.uid}
              participant={entry.participant}
              remoteUser={entry.remoteUser}
              isActiveSpeaker={entry.uid === activeSpeakerUid}
              isLocal={entry.isLocal}
              localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
              onPinToggle={handlePinToggle}
              canModerate={canModerate}
              onMuteParticipant={onMuteParticipant}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    );
  }

  // ── CASE 4: 4 Participants (2x2 Balanced Grid) ──────────────────────────────
  if (totalCount === 4) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-3 h-full w-full ${className}`}>
        {allEntries.map((entry) => (
          <ParticipantTile
            key={String(entry.uid)}
            uid={entry.uid}
            participant={entry.participant}
            remoteUser={entry.remoteUser}
            isActiveSpeaker={entry.uid === activeSpeakerUid}
            isLocal={entry.isLocal}
            localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full"
          />
        ))}
      </div>
    );
  }

  // ── CASE 5: 5–6 Participants (Responsive 3x2 Grid) ──────────────────────────
  if (totalCount <= 6) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 grid-rows-2 gap-3 h-full w-full ${className}`}>
        {allEntries.map((entry) => (
          <ParticipantTile
            key={String(entry.uid)}
            uid={entry.uid}
            participant={entry.participant}
            remoteUser={entry.remoteUser}
            isActiveSpeaker={entry.uid === activeSpeakerUid}
            isLocal={entry.isLocal}
            localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full"
          />
        ))}
      </div>
    );
  }

  // ── CASE 6: 7–9 Participants (3x3 Adaptive Grid) ────────────────────────────
  if (totalCount <= 9) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 grid-rows-3 gap-2.5 h-full w-full overflow-y-auto ${className}`}>
        {allEntries.map((entry) => (
          <ParticipantTile
            key={String(entry.uid)}
            uid={entry.uid}
            participant={entry.participant}
            remoteUser={entry.remoteUser}
            isActiveSpeaker={entry.uid === activeSpeakerUid}
            isLocal={entry.isLocal}
            localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-full h-full min-h-[140px]"
          />
        ))}
      </div>
    );
  }

  // ── CASE 7: 10+ Participants (Active Speaker Main Stage + Filmstrip) ────────
  const mainEntry = allEntries.find((e) => e.uid === activeSpeakerUid) ?? allEntries[0];
  const filmstripEntries = allEntries.filter((e) => e.uid !== mainEntry.uid).slice(0, FILMSTRIP_MAX);

  return (
    <div className={`flex flex-col h-full w-full gap-3 ${className}`}>
      {/* Promoted Main Stage */}
      <div className="flex-1 min-h-0">
        <ParticipantTile
          key={String(mainEntry.uid)}
          uid={mainEntry.uid}
          participant={mainEntry.participant}
          remoteUser={mainEntry.remoteUser}
          isActiveSpeaker={mainEntry.uid === activeSpeakerUid}
          isLocal={mainEntry.isLocal}
          localVideoTrack={mainEntry.isLocal ? localVideoTrack : undefined}
          onPinToggle={handlePinToggle}
          canModerate={canModerate}
          onMuteParticipant={onMuteParticipant}
          className="w-full h-full"
        />
      </div>

      {/* Filmstrip Strip */}
      <div className="h-28 shrink-0 flex gap-2.5 overflow-x-auto pb-1">
        {filmstripEntries.map((entry) => (
          <ParticipantTile
            key={String(entry.uid)}
            uid={entry.uid}
            participant={entry.participant}
            remoteUser={entry.remoteUser}
            isActiveSpeaker={entry.uid === activeSpeakerUid}
            isLocal={entry.isLocal}
            localVideoTrack={entry.isLocal ? localVideoTrack : undefined}
            onPinToggle={handlePinToggle}
            canModerate={canModerate}
            onMuteParticipant={onMuteParticipant}
            className="w-40 h-full shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

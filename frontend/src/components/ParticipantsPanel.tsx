import React from 'react';
import { UID } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, GraduationCap, Search, X } from 'lucide-react';
import { RtcParticipant } from '../types';
import { useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// ParticipantsPanel
// Shows the full participant list with search.
// For large rooms, renders efficiently without heavy DOM overhead.
// ──────────────────────────────────────────────────────────────────────────────

interface ParticipantsPanelProps {
  participants: Map<UID, RtcParticipant>;
  localParticipant: RtcParticipant | null;
  activeSpeakerUid: UID | null;
  onClose: () => void;
}

export function ParticipantsPanel({
  participants,
  localParticipant,
  activeSpeakerUid,
  onClose,
}: ParticipantsPanelProps) {
  const [search, setSearch] = useState('');

  // Build display list
  const allParticipants: RtcParticipant[] = [];
  if (localParticipant) allParticipants.push(localParticipant);
  for (const p of participants.values()) {
    if (p.uid !== localParticipant?.uid) allParticipants.push(p);
  }

  // Separate teacher and students
  const teachers = allParticipants.filter((p) => p.role === 'teacher');
  const students = allParticipants.filter((p) => p.role === 'student');

  const filterList = (list: RtcParticipant[]) =>
    search
      ? list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : list;

  const totalCount = allParticipants.length;

  return (
    <aside className="flex flex-col h-full bg-slate-900 border-l border-slate-800 w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">Participants</h2>
          <p className="text-xs text-slate-400">{totalCount} in call</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          aria-label="Close participants panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search participants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Search participants"
          />
        </div>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Teachers */}
        {filterList(teachers).length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Teachers ({filterList(teachers).length})
            </p>
            <div className="space-y-1">
              {filterList(teachers).map((p) => (
                <ParticipantRow
                  key={String(p.uid)}
                  participant={p}
                  isActiveSpeaker={p.uid === (activeSpeakerUid as number)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Students */}
        {filterList(students).length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Students ({filterList(students).length})
            </p>
            <div className="space-y-1">
              {filterList(students).map((p) => (
                <ParticipantRow
                  key={String(p.uid)}
                  participant={p}
                  isActiveSpeaker={p.uid === (activeSpeakerUid as number)}
                />
              ))}
            </div>
          </section>
        )}

        {allParticipants.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-8">No participants yet.</p>
        )}
      </div>
    </aside>
  );
}

// ─── Individual row ──────────────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isActiveSpeaker,
}: {
  participant: RtcParticipant;
  isActiveSpeaker: boolean;
}) {
  const initials = participant.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${
        isActiveSpeaker ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-slate-800'
      }`}
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0 relative">
        {initials}
        {/* Online dot */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {participant.role === 'teacher' && (
            <GraduationCap className="w-3 h-3 text-amber-400 shrink-0" aria-label="Teacher" />
          )}
          <span className="text-xs font-medium text-white truncate">
            {participant.name}
            {participant.isLocal && ' (You)'}
          </span>
        </div>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1 shrink-0">
        {participant.hasVideo ? (
          <Video className="w-3.5 h-3.5 text-slate-400" aria-label="Camera on" />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-slate-600" aria-label="Camera off" />
        )}
        {participant.hasAudio ? (
          <Mic
            className={`w-3.5 h-3.5 ${isActiveSpeaker ? 'text-blue-400' : 'text-slate-400'}`}
            aria-label="Mic on"
          />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-400" aria-label="Muted" />
        )}
      </div>
    </div>
  );
}

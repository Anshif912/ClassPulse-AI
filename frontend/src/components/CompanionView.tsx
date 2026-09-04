import React, { useState } from 'react';
import { Session, ChatMessage, VoiceState, SessionSummary } from '../types';
import { AIAvatar } from './AIAvatar';
import { ClassroomHub } from './ClassroomHub';
import { ChatWindow } from './ChatWindow';
import { VoiceController } from './VoiceController';
import { SessionSummaryModal } from './SessionSummaryModal';
import { ExternalLink, LogOut, FileText, Plus, X, Sparkles, BookOpen } from 'lucide-react';
import { api } from '../services/api';

interface CompanionViewProps {
  session: Session;
  messages: ChatMessage[];
  voiceState: VoiceState;
  isMicActive: boolean;
  transcript: string;
  voiceMode: 'agora' | 'browser_fallback';
  proactiveSuggestion?: string;
  isProcessing: boolean;
  onSendMessage: (text: string, source: 'text' | 'voice') => void;
  onToggleMic: () => void;
  onEndSession: () => Promise<SessionSummary>;
  onExitToHome: () => void;
  onUploadNote?: (note: string) => Promise<void>;
}

export const CompanionView: React.FC<CompanionViewProps> = ({
  session,
  messages,
  voiceState,
  isMicActive,
  transcript,
  voiceMode,
  proactiveSuggestion,
  isProcessing,
  onSendMessage,
  onToggleMic,
  onEndSession,
  onExitToHome,
  onUploadNote,
}) => {
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [notesList, setNotesList] = useState<string[]>(session.notes || []);
  const [isMeetOpen, setIsMeetOpen] = useState(true);

  const handleEndSessionClick = async () => {
    setIsEnding(true);
    try {
      const summary = await onEndSession();
      setSummaryData(summary);
    } catch (err: any) {
      console.error('Failed to end session gracefully:', err);
    } finally {
      setIsEnding(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;

    const note = noteInput.trim();
    setNotesList((prev) => [...prev, note]);
    setNoteInput('');

    if (onUploadNote) {
      await onUploadNote(note);
    }
  };

  // Open the exact preserved Google Meet URL in new tab / window
  const openMeetTab = () => {
    const targetUrl = session.meetingUrl || session.normalizedMeetingUrl || 'https://meet.google.com';
    console.log('[ClassPulse] Opening / Focusing Google Meet with preserved URL:', targetUrl);
    window.open(targetUrl, '_blank');
    setIsMeetOpen(true);
  };

  return (
    <div className="h-screen bg-[#0B0F19] text-white flex flex-col justify-between overflow-hidden">
      {/* Top Header Bar */}
      <header className="p-3.5 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800/90 backdrop-blur flex items-center justify-between gap-3 shrink-0">
        {/* Left: AI Avatar & Live Status */}
        <AIAvatar voiceState={voiceState} voiceMode={voiceMode} />

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Notes Toggle */}
          <button
            onClick={() => setShowNotesDrawer(!showNotesDrawer)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Class Notes & Materials"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Notes ({notesList.length})</span>
          </button>

          {/* End Session Button */}
          <button
            onClick={handleEndSessionClick}
            disabled={isEnding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 transition-colors shadow-sm disabled:opacity-50"
          >
            {isEnding ? (
              <div className="w-3.5 h-3.5 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>End Session</span>
          </button>
        </div>
      </header>

      {/* Classroom Hub Banner (Status, Switch Tab & Optional Video Preview) */}
      <ClassroomHub
        meetingUrl={session.meetingUrl || session.normalizedMeetingUrl || 'https://meet.google.com'}
        isMeetOpen={isMeetOpen}
        onOpenMeetTab={openMeetTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Feed */}
        <ChatWindow
          messages={messages}
          proactiveSuggestion={proactiveSuggestion}
          onSuggestionClick={(q) => onSendMessage(q, 'text')}
          isProcessing={isProcessing}
        />

        {/* Side Notes Drawer (if open) */}
        {showNotesDrawer && (
          <aside className="w-72 sm:w-80 bg-slate-900/95 border-l border-slate-800 p-4 flex flex-col justify-between shadow-2xl animate-fadeIn z-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Live Class Notes</span>
                </div>
                <button
                  onClick={() => setShowNotesDrawer(false)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notes List */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {notesList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No notes uploaded for this class yet.</p>
                ) : (
                  notesList.map((n, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300">
                      {n}
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add quick class note..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!noteInput.trim()}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Session Context</span>
                </button>
              </form>
            </div>

            <div className="text-[10px] text-slate-500 text-center">
              Notes enhance ClassPulse AI's session context.
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Voice & Text Controller */}
      <VoiceController
        onSendMessage={onSendMessage}
        voiceState={voiceState}
        isMicActive={isMicActive}
        transcript={transcript}
        onToggleMic={onToggleMic}
        disabled={isProcessing}
      />

      {/* Session Summary Modal */}
      {summaryData && (
        <SessionSummaryModal
          summary={summaryData}
          onClose={() => {
            setSummaryData(null);
            onExitToHome();
          }}
        />
      )}
    </div>
  );
};

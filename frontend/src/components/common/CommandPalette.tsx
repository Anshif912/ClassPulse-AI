import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Plus,
  LogIn,
  Settings,
  Bot,
  LogOut,
  Sparkles,
  Command,
  ArrowRight,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import { Classroom } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateModal?: () => void;
  onOpenJoinModal?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenCreateModal,
  onOpenJoinModal,
}) => {
  const [query, setQuery] = useState('');
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      api.getMyClasses()
        .then((res) => setMyClasses(res.classrooms || []))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter actions
  const defaultActions = [
    {
      id: 'dash',
      title: 'Go to Dashboard',
      subtitle: 'Home workspace & classes overview',
      icon: <GraduationCap className="w-4 h-4 text-blue-400" />,
      action: () => { navigate('/dashboard'); onClose(); },
    },
    ...(user?.role === 'TEACHER' ? [{
      id: 'create-class',
      title: 'Create New Classroom',
      subtitle: 'Set up room & upload PDF course notes',
      icon: <Plus className="w-4 h-4 text-emerald-400" />,
      action: () => { if (onOpenCreateModal) onOpenCreateModal(); else navigate('/dashboard'); onClose(); },
    }] : [{
      id: 'join-class',
      title: 'Join Classroom via Code',
      subtitle: 'Enter teacher invitation code',
      icon: <LogIn className="w-4 h-4 text-emerald-400" />,
      action: () => { if (onOpenJoinModal) onOpenJoinModal(); else navigate('/dashboard'); onClose(); },
    }]),
    {
      id: 'settings',
      title: 'Settings & Devices',
      subtitle: 'Camera, mic, AI preferences & profile',
      icon: <Settings className="w-4 h-4 text-violet-400" />,
      action: () => { navigate('/settings'); onClose(); },
    },
    {
      id: 'logout',
      title: 'Sign Out',
      subtitle: `Logged in as ${user?.email || 'User'}`,
      icon: <LogOut className="w-4 h-4 text-rose-400" />,
      action: () => { logout(); onClose(); },
    },
  ];

  const filteredClasses = myClasses.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.subject.toLowerCase().includes(query.toLowerCase()) ||
    c.classId.toLowerCase().includes(query.toLowerCase())
  );

  const allItems = [
    ...defaultActions.filter((a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase())
    ),
    ...filteredClasses.map((c) => ({
      id: `class-${c.classId}`,
      title: `${c.name} (${c.subject})`,
      subtitle: `Class ID: ${c.classId} • Teacher: ${c.teacherName}`,
      icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
      action: () => { navigate(`/class/${c.classId}`); onClose(); },
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3 bg-slate-950/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Type a command, search classrooms, or navigate..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Action list */}
        <div className="overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No matching commands or classrooms found.
            </div>
          ) : (
            allItems.map((item, idx) => (
              <button
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors ${
                  selectedIndex === idx
                    ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-2" />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>ClassPulse Workspace Quick Search</span>
          </div>
          <span>↑↓ to navigate • ↵ to select</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  Loader2,
  Hash,
  Video,
  Search,
  FileText,
  Clock,
  CheckCircle2,
  Play,
  Flame,
  Radio,
  Send,
  LogOut,
  ChevronRight,
  Users,
  X,
  Download,
  FileCheck,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Classroom } from '../types';
import { Logo } from './common/Logo';
import { PixelSnow } from './effects/PixelSnow';
import { AIClassroomPanel } from './AIClassroomPanel';
import { SpecularButton } from './effects/SpecularButton';

// Subject artwork thumbnails matching Panel 6 of Reference Image
const SUBJECT_THUMBNAILS: Record<string, string> = {
  cs: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
  comp: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
  physic: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=600&auto=format&fit=crop&q=80',
  math: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
};

const getThumbnailForSubject = (name: string, subject: string): string => {
  const combined = `${name} ${subject}`.toLowerCase();
  if (combined.includes('physic')) return SUBJECT_THUMBNAILS.physic;
  if (combined.includes('math')) return SUBJECT_THUMBNAILS.math;
  if (combined.includes('computer science') || combined.includes('evolution') || combined.includes('ai')) return SUBJECT_THUMBNAILS.cs;
  if (combined.includes('cs') || combined.includes('code') || combined.includes('program')) return SUBJECT_THUMBNAILS.comp;
  return SUBJECT_THUMBNAILS.default;
};

export function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickDoubt, setQuickDoubt] = useState('');

  // Explicit Independent Interactive Drawers & Modals (Prevents unintended video redirects)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);

  useEffect(() => {
    api.getMyClasses()
      .then((res: { classrooms: Classroom[] }) => {
        const classes = res.classrooms || [];
        setClassrooms(classes);
      })
      .catch(() => setClassrooms([]))
      .finally(() => setIsLoadingClasses(false));
  }, []);

  // Development Click-Target Debug Logger
  useEffect(() => {
    const handleDebugClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        console.debug('[HIT-TEST DEBUG]', {
          tagName: target.tagName,
          testid: target.getAttribute('data-testid') || target.closest('[data-testid]')?.getAttribute('data-testid'),
          className: target.className,
          text: target.textContent?.slice(0, 30),
        });
      }
    };
    window.addEventListener('click', handleDebugClick, true);
    return () => window.removeEventListener('click', handleDebugClick, true);
  }, []);

  const handleJoinClass = async () => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      await api.joinClass(code);
      navigate(`/class/${code}`);
    } catch (err: any) {
      setJoinError(err.message || 'Class not found. Please verify the 8-character class code.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleQuickDoubtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDoubt.trim()) return;
    setIsAITutorOpen(true);
  };

  const filteredClasses = classrooms.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.classId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLiveClass = classrooms.length > 0 ? classrooms[0] : null;
  const currentClassId = activeLiveClass ? activeLiveClass.classId : 'GENERAL-AI';
  const currentSubject = activeLiveClass ? activeLiveClass.subject : 'General Computer Science';

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col selection:bg-blue-600/40 selection:text-blue-200 antialiased relative overflow-x-hidden">
      {/* ── Retro PixelSnow Three.js Background (Strictly Behind in -z-10) ───── */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <PixelSnow
          color="#ffffff"
          flakeSize={0.006}
          minFlakeSize={1.0}
          pixelResolution={240}
          speed={0.9}
          density={0.2}
          direction={125}
          brightness={0.9}
        />
      </div>

      {/* ── Top Dark Navigation Bar ────────────────────────────────────────── */}
      <header className="h-16 px-6 sm:px-12 bg-[#080D1D]/95 border-b border-[#141B33] backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-6 shadow-md">
        {/* Left: ClassPulse Logo */}
        <div onClick={() => navigate('/dashboard')} className="cursor-pointer">
          <Logo size="sm" showTagline={false} />
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xl hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classes, materials, topics..."
              className="w-full pl-11 pr-4 py-2 bg-[#0E152E] border border-[#1E294B] rounded-full text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] focus:bg-[#121B3B] transition-all"
            />
          </div>
        </div>

        {/* Right: Student Profile Pill & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0E152E] border border-[#1E294B] shadow-sm">
            <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center text-[11px] font-black text-white shadow-xs">
              {user?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="text-left text-xs leading-none">
              <span className="font-bold text-slate-100">{user?.name || 'Student'}</span>
              <span className="text-[10px] text-[#64748B] block font-medium mt-0.5">Student</span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-[#0E152E] border border-transparent hover:border-[#1E294B] transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Student Learning Workspace (Full-Featured 7-Layer Layout) ─── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-12 py-8 space-y-8 relative z-10">
        
        {/* ── 1. Welcome & Context Header ─────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-2.5">
              Welcome back, {user?.name?.split(' ')[0] || 'Student'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 font-medium">
              Pick up where you left off or join your next live class.
            </p>
          </div>

          {/* Quick Streak / Stats Pill */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#0B1124] border border-[#16203D] text-xs font-semibold text-amber-300">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>4 Day Streak</span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#0B1124] border border-[#16203D] text-xs font-semibold text-blue-300">
              <Users className="w-4 h-4 text-blue-400" />
              <span>{classrooms.length} Active Classes</span>
            </div>
          </div>
        </div>

        {/* ── 2. Four Bento Quick Action Cards ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Join Class */}
          <button
            data-testid="dashboard-join-class"
            onClick={() => setIsJoinModalOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-[#3B82F6]/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-[#3B82F6] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">Join Class</p>
              <p className="text-xs text-[#64748B] mt-0.5">Enter 8-char code</p>
            </div>
          </button>

          {/* Card 2: Ask AI Tutor (Opens AI Panel without navigating to video!) */}
          <button
            data-testid="dashboard-ai-tutor"
            onClick={() => setIsAITutorOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-[#D946EF]/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-[#D946EF] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Ask AI Tutor</p>
              <p className="text-xs text-[#64748B] mt-0.5">Tamil, English, Hindi</p>
            </div>
          </button>

          {/* Card 3: My Notes (Opens Notes Drawer on Dashboard) */}
          <button
            data-testid="dashboard-notes"
            onClick={() => setIsNotesOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-[#818CF8]/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-[#818CF8] shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">My Notes</p>
              <p className="text-xs text-[#64748B] mt-0.5">Classroom summaries</p>
            </div>
          </button>

          {/* Card 4: Browse Materials (Opens Materials Drawer on Dashboard) */}
          <button
            data-testid="dashboard-materials"
            onClick={() => setIsMaterialsOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-amber-500/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-600/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">Browse Materials</p>
              <p className="text-xs text-[#64748B] mt-0.5">Course PDFs & slides</p>
            </div>
          </button>
        </div>

        {/* ── 3. Dominant LIVE NOW Surface (If active class exists) ─────────── */}
        {activeLiveClass && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0D1530] via-[#0B1228] to-[#121B3B] border border-[#2563EB]/40 p-6 sm:p-8 shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-2 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE NOW
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    🏷️ {activeLiveClass.classId}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {activeLiveClass.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#94A3B8] font-medium mt-1">
                    Teacher: <strong className="text-slate-200">{activeLiveClass.teacherName || 'James (Teacher)'}</strong> • Unit 1: Generations & Architecture
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    Live video & private AI companion active
                  </span>
                  <span>•</span>
                  <span>{activeLiveClass.materialCount || 1} course materials available</span>
                </div>
              </div>

              {/* 1-Click Join Button */}
              <div className="shrink-0">
                <SpecularButton
                  size="lg"
                  radius={18}
                  tint="#2563EB"
                  tintOpacity={1}
                  lineColor="#60A5FA"
                  baseColor="#1D4ED8"
                  intensity={1.3}
                  data-testid="dashboard-live-join"
                  onClick={() => navigate(`/class/${activeLiveClass.classId}`)}
                >
                  <Video className="w-5 h-5" />
                  <span>Join Live Classroom</span>
                  <ArrowRight className="w-4 h-4" />
                </SpecularButton>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. Continue Learning Progress Card ────────────────────────────── */}
        <div className="p-6 rounded-3xl bg-[#0B1124] border border-[#16203D] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Play className="w-4 h-4 fill-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Continue Learning</h3>
                <p className="text-xs text-[#64748B]">Resume your structured course pathway</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400">62% Completed</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#141B33] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-1000"
              style={{ width: '62%' }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Current Unit: <strong>Evolution of Computers (Vacuum Tubes to Microprocessors)</strong></span>
            </div>
            <button
              onClick={() => setIsResumeOpen(true)}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>View lesson curriculum</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── 5. My Classrooms Header & 2-Column Grid ──────────────────────── */}
        <div className="space-y-5 pt-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#141B33]">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">My Classrooms</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0E152E] text-[#64748B] border border-[#1E294B]">
                {classrooms.length} enrolled
              </span>
            </div>
            <span
              onClick={() => setIsJoinModalOpen(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
            >
              + Join another class
            </span>
          </div>

          {/* 2-Column Classroom Grid */}
          {isLoadingClasses ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 bg-[#0B1124] rounded-3xl border border-[#16203D] animate-pulse" />
              ))}
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-16 text-center bg-[#0B1124] rounded-3xl border border-[#16203D] space-y-4">
              <BookOpen className="w-12 h-12 text-[#64748B] mx-auto" />
              <p className="text-base font-bold text-white">No Classrooms Enrolled</p>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
                Click "Join Class" above to enter your teacher's 8-character class code.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredClasses.map((cls, idx) => {
                const thumbnailUrl = getThumbnailForSubject(cls.name, cls.subject);
                const isLive = idx === 0;

                return (
                  <div
                    key={cls.classId}
                    className="p-6 rounded-3xl bg-[#0B1124] border border-[#16203D] hover:border-[#2563EB]/50 hover:bg-[#0E162E] transition-all shadow-xl flex items-center justify-between gap-6 group relative overflow-hidden"
                  >
                    {/* Left Column: Title, Live Tag, Teacher, Meta Info, Join Button */}
                    <div className="flex-1 flex flex-col justify-between space-y-4 min-w-0">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-bold text-base sm:text-lg text-white group-hover:text-blue-300 transition-colors truncate">
                            {cls.name}
                          </h4>
                          {isLive && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 flex items-center gap-1.5 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                              Live
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#8E9BB5] font-medium">
                          {cls.teacherName || 'James'}
                        </p>

                        <div className="space-y-1 text-xs text-[#64748B] pt-1">
                          <p className="font-mono flex items-center gap-1.5">
                            <span className="text-[#3B82F6]">🏷️</span> {cls.classId}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span className="text-amber-400">📖</span> {cls.materialCount || 0} materials
                          </p>
                        </div>
                      </div>

                      {/* Join Pill Button */}
                      <div>
                        <button
                          data-testid="dashboard-classroom-join"
                          onClick={() => navigate(`/class/${cls.classId}`)}
                          className="px-6 py-2.5 rounded-full font-bold text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                          <span>Join</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Visual Photo Preview Thumbnail */}
                    <div className="w-40 sm:w-52 h-32 sm:h-36 shrink-0 rounded-2xl overflow-hidden relative border border-[#1E2C52]/80 bg-[#060914] shadow-inner self-center">
                      <img
                        src={thumbnailUrl}
                        alt={cls.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1124]/80 via-transparent to-black/20 pointer-events-none" />

                      <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/90 shadow-md">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 6. Recent Learning Timeline / Activity Feed ──────────────────── */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider pb-1 border-b border-[#141B33]">
            Recent Learning Activity
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setIsAITutorOpen(true)}
              className="p-4 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-purple-500/40 space-y-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> AI Doubt Solved
                </span>
                <span>Yesterday</span>
              </div>
              <p className="text-xs font-bold text-white">முதல் தலைமுறை கணினிகள் (Vacuum Tubes)</p>
              <p className="text-[11px] text-slate-400">Answered in Tamil voice & text</p>
            </div>

            <div
              onClick={() => setIsMaterialsOpen(true)}
              className="p-4 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-amber-500/40 space-y-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <BookOpen className="w-3.5 h-3.5" /> Material Read
                </span>
                <span>2 days ago</span>
              </div>
              <p className="text-xs font-bold text-white">Generations of Computers Notes.pdf</p>
              <p className="text-[11px] text-slate-400">Course grounded notes</p>
            </div>

            <div
              onClick={() => setIsNotesOpen(true)}
              className="p-4 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-indigo-500/40 space-y-2 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <FileText className="w-3.5 h-3.5" /> Lecture Notes
                </span>
                <span>Today</span>
              </div>
              <p className="text-xs font-bold text-white">Unit 1 Summary & Revision</p>
              <p className="text-[11px] text-slate-400">Saved in My Notes</p>
            </div>
          </div>
        </div>

        {/* ── 7. ClassPulse AI Doubt Surface (Direct In-Dashboard Assistant) ─── */}
        <div className="rounded-3xl bg-gradient-to-r from-purple-950/40 via-[#0B1124] to-indigo-950/40 border border-purple-500/30 p-6 sm:p-8 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Got a doubt before your next class?</h3>
              <p className="text-xs text-slate-400">Ask ClassPulse AI in தமிழ், English, Tanglish, or Hindi</p>
            </div>
          </div>

          <form onSubmit={handleQuickDoubtSubmit} className="flex items-center gap-2 bg-[#060914] border border-[#1E2A52] rounded-2xl p-2 focus-within:border-purple-500 transition-colors shadow-inner">
            <input
              data-testid="dashboard-doubt-input"
              type="text"
              value={quickDoubt}
              onChange={(e) => setQuickDoubt(e.target.value)}
              placeholder="e.g. முதல் தலைமுறை கணினிகள் பற்றி விளக்குங்கள்..."
              className="flex-1 bg-transparent px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              data-testid="dashboard-doubt-submit"
              type="submit"
              disabled={!quickDoubt.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Ask AI</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* ── DRAWER: AI Tutor (Direct In-Dashboard Interaction) ─────────────── */}
        {isAITutorOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md h-full bg-[#070B18] border-l border-purple-500/30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <AIClassroomPanel
                classId={currentClassId}
                subject={currentSubject}
                className="h-full w-full"
                onClose={() => setIsAITutorOpen(false)}
              />
            </div>
          </div>
        )}

        {/* ── MODAL: My Notes ──────────────────────────────────────────────── */}
        {isNotesOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">My Classroom Notes</h3>
                    <p className="text-xs text-slate-400">Lecture summaries & AI study guides</p>
                  </div>
                </div>
                <button onClick={() => setIsNotesOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">Computer Science • Unit 1</span>
                    <span className="text-[10px] text-slate-500">Auto-generated</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Evolution of Computers (1940–Present)</h4>
                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    <li>1st Gen: Vacuum tubes, ENIAC, UNIVAC, very large & power consuming.</li>
                    <li>2nd Gen: Transistors, smaller size, improved speed and reliability.</li>
                    <li>3rd Gen: Integrated Circuits (ICs), semiconductor memory.</li>
                    <li>4th Gen: Microprocessors (VLSI), Personal Computers.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400">AI Voice Doubt Transcript</span>
                    <span className="text-[10px] text-slate-500">Yesterday</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">முதல் தலைமுறை கணினிகளின் முக்கிய குறைபாடுகள்</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Vacuum tubes அதிக வெப்பத்தை வெளிப்படுத்தின, அடிக்கடி பழுதானதால் பராமரிப்பு செலவு அதிகமாக இருந்தது.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182344]">
                <button
                  onClick={() => setIsNotesOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Close Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Browse Materials ──────────────────────────────────────── */}
        {isMaterialsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Course Materials & Slide Decks</h3>
                    <p className="text-xs text-slate-400">Teacher uploaded PDFs and reading documents</p>
                  </div>
                </div>
                <button onClick={() => setIsMaterialsOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      Generations of Computers - Lecture Notes.pdf
                    </p>
                    <p className="text-xs text-slate-400">Uploaded by James • Indexed by ClassPulse AI (12 Chunks)</p>
                  </div>
                  <button
                    onClick={() => setIsAITutorOpen(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold shrink-0"
                  >
                    Ask AI about PDF
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      Computer Architecture Reference Guide.pdf
                    </p>
                    <p className="text-xs text-slate-400">Unit 1 Supplementary Reading • 24 pages</p>
                  </div>
                  <button
                    onClick={() => setIsAITutorOpen(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold shrink-0"
                  >
                    Ask AI about PDF
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182344]">
                <button
                  onClick={() => setIsMaterialsOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Lesson Curriculum / Resume Details ─────────────────────── */}
        {isResumeOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Play className="w-5 h-5 fill-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Unit 1 Curriculum Pathway</h3>
                    <p className="text-xs text-slate-400">Computer Science Fundamentals</p>
                  </div>
                </div>
                <button onClick={() => setIsResumeOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#060914] border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">Lesson 1: First Generation (Vacuum Tubes)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Completed</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#060914] border border-purple-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full border-2 border-purple-400 flex items-center justify-center text-[9px] font-bold text-purple-400">2</span>
                    <span className="text-xs font-bold text-white">Lesson 2: Second Generation (Transistors)</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400 uppercase">In Progress</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#060914] border border-[#1E2A52] flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full border border-slate-600 text-slate-500 flex items-center justify-center text-[9px]">3</span>
                    <span className="text-xs text-slate-400">Lesson 3: Integrated Circuits & VLSI</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase">Locked</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#182344]">
                <button
                  onClick={() => {
                    setIsResumeOpen(false);
                    setIsAITutorOpen(true);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Ask AI Tutor to Explain Lesson 2 →
                </button>

                <button
                  onClick={() => setIsResumeOpen(false)}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Join Class Code Input ─────────────────────────────────── */}
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in relative z-50">
              <div className="flex items-center justify-between border-b border-[#182344] pb-3">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#3B82F6]" />
                  Join a Classroom
                </h3>
                <button onClick={() => setIsJoinModalOpen(false)} className="text-[#64748B] hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#94A3B8]">Classroom Code (From Teacher)</label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
                    placeholder="e.g. COM-EJ4Y8"
                    maxLength={12}
                    autoFocus
                    className="w-full px-4 py-3 bg-[#060914] border border-[#1E2A52] rounded-2xl text-base font-mono text-center text-white placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {joinError && <p className="text-xs text-rose-400">{joinError}</p>}

                <button
                  onClick={handleJoinClass}
                  disabled={isJoining || !classCode.trim()}
                  className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Join Classroom</span>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

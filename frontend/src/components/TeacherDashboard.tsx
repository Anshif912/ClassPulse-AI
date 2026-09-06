import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  Upload,
  GraduationCap,
  FileText,
  FileUp,
  Video,
  Users,
  Clock,
  ArrowRight,
  Search,
  Bell,
  Sparkles,
  ShieldCheck,
  FolderOpen,
  Layers,
  ChevronRight,
  Play,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import { CreateClassResponse, Classroom } from '../types';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './common/Logo';
import { PixelSnow } from './effects/PixelSnow';

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdClass, setCreatedClass] = useState<CreateClassResponse | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // My existing classrooms
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  // Material upload state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialSuccess, setMaterialSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getMyClasses()
      .then((res) => {
        const classes = res.classrooms || [];
        setMyClasses(classes);
        if (classes.length > 0) setSelectedClassId(classes[0].classId);
      })
      .catch(() => setMyClasses([]))
      .finally(() => setIsLoadingClasses(false));
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await api.createClass({
        name: className.trim(),
        subject,
      });
      setCreatedClass(result);
      const newCls: Classroom = {
        classId: result.classId,
        name: result.name,
        subject: result.subject,
        teacherName: result.teacherName,
        agoraChannel: result.agoraChannel,
        status: 'active',
        createdAt: result.createdAt,
        materialCount: 0,
      };
      setMyClasses((prev) => [newCls, ...prev]);
      setSelectedClassId(result.classId);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create classroom.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPdfFile || !selectedClassId) return;
    setIsUploadingMaterial(true);
    setMaterialError(null);
    setMaterialSuccess(null);

    try {
      const result = await api.uploadClassroomPdf(
        selectedClassId,
        selectedPdfFile,
        pdfTitle.trim() || selectedPdfFile.name
      );
      setSelectedPdfFile(null);
      setPdfTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMaterialSuccess(
        `"${result.title}" uploaded and indexed (${result.pageCount} pages, ${result.chunkCount} chunks) ready for AI Tutor!`
      );
      setTimeout(() => setMaterialSuccess(null), 6000);
    } catch (err: any) {
      setMaterialError(err.message || 'Failed to process PDF.');
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  const filteredClasses = myClasses.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.classId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLiveClass = myClasses.length > 0 ? myClasses[0] : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col antialiased selection:bg-blue-600 selection:text-white relative overflow-x-hidden">
      {/* ── Top Light Workspace Header ───────────────────────────────────────── */}
      <header className="h-16 px-6 sm:px-12 bg-white border-b border-[#E2E8F0] sticky top-0 z-30 flex items-center justify-between gap-6 shadow-xs">
        {/* Left: Brand */}
        <div onClick={() => navigate('/dashboard')} className="cursor-pointer">
          <Logo size="sm" lightMode={true} showTagline={false} />
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classes, materials, students..."
              className="w-full pl-10 pr-4 py-2 bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:bg-white focus:border-[#2563EB] transition-all"
            />
          </div>
        </div>

        {/* Right: Notifications + Profile + Primary Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {}}
            className="p-2 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
          </button>

          {/* Teacher Avatar Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
            <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center text-[11px] font-black text-white">
              {user?.name?.[0]?.toUpperCase() || 'J'}
            </div>
            <div className="hidden md:block text-left text-xs leading-none">
              <span className="font-bold text-[#0F172A]">{user?.name || 'James'}</span>
              <span className="text-[10px] text-[#64748B] block font-medium">Teacher</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Classroom</span>
          </button>
        </div>
      </header>

      {/* ── Main Teacher Workspace Content ──────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-12 py-8 space-y-8 relative z-10">
        {/* 1. Clean Light Hero Greeting */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              Good morning, {user?.name?.split(' ')[0] || 'James'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Your teaching workspace at a glance.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Classroom</span>
          </button>
        </div>

        {/* 2. Four Quick Action Cards (Teacher Hierarchy: Create=Blue, Upload=Cyan, Manage=Indigo, AI=Purple) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#2563EB]/50 hover:shadow-md transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] mb-3 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Create Classroom</p>
            <p className="text-[11px] text-[#64748B]">Set up Agora channel</p>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#06B6D4]/50 hover:shadow-md transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#06B6D4] mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Upload Material</p>
            <p className="text-[11px] text-[#64748B]">Attach course PDFs for RAG</p>
          </button>

          <button
            onClick={() => {}}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#8B5CF6]/50 hover:shadow-md transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#6366F1] mb-3 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Manage Classes</p>
            <p className="text-[11px] text-[#64748B]">Students & attendance</p>
          </button>

          <button
            onClick={() => {
              if (myClasses.length > 0) navigate(`/class/${myClasses[0].classId}`);
            }}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#8B5CF6]/50 hover:shadow-md transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[#8B5CF6] mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">AI Insights</p>
            <p className="text-[11px] text-[#64748B]">Verify tutor citations</p>
          </button>
        </div>

        {/* 3. Today's Teaching (Dominant Featured Card) */}
        {activeLiveClass && (
          <div className="p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#16A34A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                  LIVE NOW
                </span>
                <span className="text-xs text-[#64748B] font-semibold">• Today's Teaching</span>
              </div>
              <h3 className="text-lg font-black text-[#0F172A]">{activeLiveClass.name}</h3>
              <p className="text-xs text-[#64748B]">
                {activeLiveClass.subject} • 12 students connected • {activeLiveClass.materialCount || 3} notes indexed
              </p>
            </div>

            <button
              onClick={() => navigate(`/class/${activeLiveClass.classId}`)}
              className="px-6 py-3 rounded-xl font-bold text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all flex items-center gap-2 active:scale-95 shrink-0"
            >
              <Video className="w-4 h-4" />
              <span>Enter Classroom →</span>
            </button>
          </div>
        )}

        {/* 4. Your Classrooms (Clean Grid with High Information Density) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Your Classrooms</h3>
            <span className="text-xs font-semibold text-[#64748B]">{myClasses.length} active</span>
          </div>

          {isLoadingClasses ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-200/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E2E8F0] text-xs text-[#64748B]">
              No classrooms created yet. Click "Create Classroom" to start teaching.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {filteredClasses.map((cls, idx) => (
                <div
                  key={cls.classId}
                  className="p-5 bg-white rounded-2xl border border-[#E2E8F0] hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-100">
                        {cls.subject}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {cls.classId}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#0F172A] leading-snug">{cls.name}</h4>

                    <p className="text-[11px] text-[#64748B]">
                      {cls.materialCount || 3} materials indexed for AI Tutor
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(`/class/${cls.classId}`)}
                    className="w-full py-2 bg-[#F8FAFC] hover:bg-[#2563EB] text-[#0F172A] hover:text-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Course Materials & AI Readiness */}
        <div className="p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2563EB]" />
                Course Materials & AI Readiness
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Uploaded PDFs are parsed and embedded for classroom AI Tutor retrieval.
              </p>
            </div>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-bold text-[#2563EB] flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { name: 'Evolution_of_Computers_From_1st_Generation.pdf', pages: 12, chunks: 48, status: 'AI Ready' },
              { name: 'Data_Structures_Lecture_Notes_Unit1.pdf', pages: 18, chunks: 64, status: 'AI Ready' },
              { name: 'Computer_Networks_Protocols_Overview.pdf', pages: 24, chunks: 82, status: 'AI Ready' },
            ].map((mat, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-[#0F172A] truncate">{mat.name}</p>
                  <p className="text-[11px] text-[#64748B]">{mat.pages} pages • {mat.chunks} chunks</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-[#16A34A] shrink-0">
                  {mat.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Recent Activity Timeline */}
        <div className="p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { icon: <FileText className="w-3.5 h-3.5 text-[#16A34A]" />, bg: 'bg-emerald-50', text: 'Physics Unit 2 indexed successfully', time: '2 hours ago' },
              { icon: <Users className="w-3.5 h-3.5 text-[#2563EB]" />, bg: 'bg-blue-50', text: '12 students joined CS classroom', time: '3 hours ago' },
              { icon: <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />, bg: 'bg-purple-50', text: 'New material "Data Structures.pdf" ready for AI Tutor', time: '5 hours ago' },
              { icon: <Clock className="w-3.5 h-3.5 text-[#64748B]" />, bg: 'bg-slate-100', text: 'Class session ended (48 min)', time: '1 day ago' },
            ].map((act, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${act.bg} shrink-0`}>{act.icon}</div>
                  <span className="font-medium text-[#0F172A]">{act.text}</span>
                </div>
                <span className="text-[#94A3B8] text-[11px]">{act.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Create Classroom Modal ─────────────────────────────────────────── */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border border-[#E2E8F0] animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="font-black text-base text-[#0F172A]">Create New Classroom</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">Classroom Title *</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. CS101 — Evolution of Computers"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">Subject Discipline *</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                </div>

                {createError && <p className="text-xs text-red-600">{createError}</p>}

                <button
                  type="submit"
                  disabled={isCreating || !className.trim()}
                  className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isCreating ? 'Creating Room...' : 'Create Classroom'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Upload Material Modal ─────────────────────────────────────────── */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border border-[#E2E8F0] animate-in fade-in">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="font-black text-base text-[#0F172A]">Upload Course Material</h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">✕</button>
              </div>

              <form onSubmit={handleUploadPdf} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">Select Target Classroom</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    {myClasses.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.name} ({c.classId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">PDF File *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setSelectedPdfFile(f);
                    }}
                    required
                    className="w-full text-xs text-[#64748B] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#2563EB] file:text-white"
                  />
                </div>

                {materialSuccess && <p className="text-xs text-[#16A34A]">{materialSuccess}</p>}
                {materialError && <p className="text-xs text-red-600">{materialError}</p>}

                <button
                  type="submit"
                  disabled={isUploadingMaterial || !selectedPdfFile}
                  className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isUploadingMaterial ? 'Uploading & Chunking...' : 'Upload & Ingest into AI'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

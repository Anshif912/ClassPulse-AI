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
  Trash2,
  AlertCircle,
  X,
  Check,
  Disc,
  Brain,
} from 'lucide-react';
import { CreateClassResponse, Classroom, RecordingSession } from '../types';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './common/Logo';
import { PixelSnow } from './effects/PixelSnow';
import { TeacherAnalyticsModal } from './TeacherAnalyticsModal';

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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isManageClassesOpen, setIsManageClassesOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<Classroom | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Insights & Past Meets state
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [isPersonalizationAnalyticsOpen, setIsPersonalizationAnalyticsOpen] = useState(false);
  const [insightsClassId, setInsightsClassId] = useState('');
  const [insightsData, setInsightsData] = useState<any | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Agora Cloud Recordings state
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false);
  const [allRecordings, setAllRecordings] = useState<RecordingSession[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const loadAllRecordings = async () => {
    setIsLoadingRecordings(true);
    setRecordingsError(null);
    try {
      const res = await api.getAllRecordings();
      setAllRecordings(res?.recordings || []);
    } catch (err: any) {
      setRecordingsError(err.message || 'Failed to load cloud recordings.');
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  const loadClassInsights = async (targetClassId?: string) => {
    const classToFetch = targetClassId || insightsClassId || (myClasses.length > 0 ? myClasses[0].classId : '');
    if (!classToFetch) return;
    setIsLoadingInsights(true);
    setInsightsError(null);
    try {
      const data = await api.getClassInsights(classToFetch);
      setInsightsData(data);
      setInsightsClassId(classToFetch);
    } catch (err: any) {
      setInsightsError(err.message || 'Failed to load meeting insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // My existing classrooms
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  // Material upload & dynamic list state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialSuccess, setMaterialSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteClass = async (classId: string) => {
    setDeletingClassId(classId);
    setDeleteError(null);
    try {
      await api.deleteClass(classId);
      setMyClasses((prev) => prev.filter((c) => c.classId !== classId));
      if (selectedClassId === classId) {
        const remaining = myClasses.filter((c) => c.classId !== classId);
        setSelectedClassId(remaining.length > 0 ? remaining[0].classId : '');
      }
      setClassToDelete(null);
      setDeleteSuccess(`Classroom "${classId}" was permanently deleted.`);
      setTimeout(() => setDeleteSuccess(null), 5000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete classroom.');
    } finally {
      setDeletingClassId(null);
    }
  };

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

  useEffect(() => {
    if (!selectedClassId) return;
    api.getClassMaterials(selectedClassId)
      .then((res: any) => {
        setClassMaterials(res.materials || []);
      })
      .catch(() => setClassMaterials([]));
  }, [selectedClassId, materialSuccess]);

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
    setUploadStatusText('Uploading PDF document...');
    setMaterialError(null);
    setMaterialSuccess(null);

    const timer1 = setTimeout(() => setUploadStatusText('Extracting text & Chunking...'), 300);
    const timer2 = setTimeout(() => setUploadStatusText('Indexing into Fast Lexical Knowledge Base...'), 800);

    try {
      const result = await api.uploadClassroomPdf(
        selectedClassId,
        selectedPdfFile,
        pdfTitle.trim() || selectedPdfFile.name
      );
      clearTimeout(timer1);
      clearTimeout(timer2);
      setSelectedPdfFile(null);
      setPdfTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMaterialSuccess(
        `Material ready for AI Tutor! ("${result.title}" indexed: ${result.pageCount} pages, ${result.chunkCount} chunks)`
      );
      setTimeout(() => setMaterialSuccess(null), 8000);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setMaterialError(err.message || 'Failed to process PDF.');
    } finally {
      setIsUploadingMaterial(false);
      setUploadStatusText('');
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
            onClick={() => setIsNotificationsOpen(true)}
            className="p-2 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] relative transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
          </button>

          {/* Teacher Avatar Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0]">
            <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center text-[11px] font-black text-white">
              {user?.name?.[0]?.toUpperCase() || 'T'}
            </div>
            <div className="hidden md:block text-left text-xs leading-none">
              <span className="font-bold text-[#0F172A]">{user?.name || 'Teacher'}</span>
              <span className="text-[10px] text-[#64748B] block font-medium">Teacher</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Classroom</span>
          </button>
        </div>
      </header>

      {/* ── Main Teacher Workspace Content ──────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-12 py-8 space-y-8 relative z-10">
        {deleteSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccess}</span>
          </div>
        )}

        {/* 1. Clean Light Hero Greeting */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              Good morning, {user?.name?.split(' ')[0] || 'Teacher'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Your teaching workspace at a glance.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Classroom</span>
          </button>
        </div>

        {deleteSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deleteSuccess}</span>
            </div>
            <button onClick={() => setDeleteSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
          </div>
        )}

        {/* 2. Five Quick Action Cards (Create=Blue, Upload=Cyan, Manage=Indigo, AI=Purple, Recordings=Rose) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#2563EB]/50 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] mb-3 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Create Classroom</p>
            <p className="text-[11px] text-[#64748B]">Set up Agora channel</p>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#06B6D4]/50 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#06B6D4] mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Upload Material</p>
            <p className="text-[11px] text-[#64748B]">Attach course PDFs for RAG</p>
          </button>

          <button
            onClick={() => setIsManageClassesOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#8B5CF6]/50 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#6366F1] mb-3 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Manage Classes</p>
            <p className="text-[11px] text-[#64748B]">Delete & student rosters</p>
          </button>

          <button
            onClick={() => {
              setIsInsightsModalOpen(true);
              const target = selectedClassId || (myClasses.length > 0 ? myClasses[0].classId : '');
              loadClassInsights(target);
            }}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#8B5CF6]/50 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[#8B5CF6] mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">AI Insights</p>
            <p className="text-[11px] text-[#64748B]">Previous meets & learning gaps</p>
          </button>

          <button
            onClick={() => setIsPersonalizationAnalyticsOpen(true)}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-indigo-500/50 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-105 transition-transform">
              <Brain className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Adaptive Frontier</p>
            <p className="text-[11px] text-[#64748B]">1-to-1 Mastery & Gaps</p>
          </button>

          <button
            onClick={() => {
              setIsRecordingsModalOpen(true);
              loadAllRecordings();
            }}
            className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-rose-500/50 hover:shadow-md transition-all text-left group cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-3 group-hover:scale-105 transition-transform">
              <Disc className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#0F172A]">Past Recordings</p>
            <p className="text-[11px] text-[#64748B]">Agora Cloud Recordings</p>
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
                {activeLiveClass.subject} • {activeLiveClass.materialCount || 0} materials indexed
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
                      {cls.materialCount || 0} materials indexed for AI Tutor
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/class/${cls.classId}`)}
                      className="flex-1 py-2 bg-[#F8FAFC] hover:bg-[#2563EB] text-[#0F172A] hover:text-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Launch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setClassToDelete(cls);
                      }}
                      className="p-2 bg-[#F8FAFC] hover:bg-red-50 text-slate-400 hover:text-red-600 border border-[#E2E8F0] hover:border-red-200 rounded-xl transition-all cursor-pointer"
                      title="Delete Classroom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

          {classMaterials.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <p className="text-xs text-[#64748B]">No PDF documents uploaded yet for this class.</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">Upload lecture notes or textbooks above to ground the AI Tutor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {classMaterials.map((mat: any, i: number) => (
                <div key={mat.materialId || i} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-[#0F172A] truncate">{mat.title || mat.filename || mat.name}</p>
                    <p className="text-[11px] text-[#64748B]">{mat.pageCount || mat.pages || 1} pages • {mat.chunkCount || mat.chunks || 4} chunks</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-[#16A34A] shrink-0">
                    AI Ready
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Recent Activity Timeline */}
        <div className="p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Recent Activity</h3>
          {myClasses.length === 0 ? (
            <p className="text-xs text-[#64748B] py-2">No activity yet. Create a classroom to begin.</p>
          ) : (
            <div className="space-y-3">
              {myClasses.slice(0, 4).map((cls, i) => (
                <div key={cls.classId || i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB] shrink-0">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-[#0F172A]">Classroom "{cls.name}" active</span>
                  </div>
                  <span className="text-[#94A3B8] text-[11px] font-mono">{cls.classId}</span>
                </div>
              ))}
            </div>
          )}
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
                  className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {isUploadingMaterial ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatusText || 'Indexing Material into AI...'}</span>
                    </>
                  ) : (
                    'Upload & Ingest into AI'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Manage Classes Modal ─────────────────────────────────────────── */}
        {isManageClassesOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border border-[#E2E8F0] animate-in fade-in max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-[#6366F1]" />
                  <h3 className="font-black text-base text-[#0F172A]">Manage Classrooms</h3>
                </div>
                <button onClick={() => setIsManageClassesOpen(false)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {myClasses.length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-6">No classrooms created yet.</p>
                ) : (
                  myClasses.map((cls) => (
                    <div
                      key={cls.classId}
                      className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-[#0F172A] truncate">{cls.name}</h4>
                          <span className="font-mono text-[10px] font-bold text-[#64748B] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded">
                            {cls.classId}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          {cls.subject} • {cls.materialCount || 0} materials indexed
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setIsManageClassesOpen(false);
                            navigate(`/class/${cls.classId}`);
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#2563EB] border border-[#E2E8F0] hover:border-blue-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Enter
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteError(null);
                            setClassToDelete(cls);
                          }}
                          disabled={deletingClassId === cls.classId}
                          className="p-2 bg-white hover:bg-red-50 text-red-600 border border-[#E2E8F0] hover:border-red-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title="Delete Classroom"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Class Deletion Confirmation Dialog ────────────────────────────── */}
        {classToDelete && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-red-100 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#0F172A]">Delete Classroom?</h3>
                  <p className="text-[11px] text-[#64748B]">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-[#64748B] leading-relaxed">
                Permanently delete <strong className="text-[#0F172A]">"{classToDelete.name}" ({classToDelete.classId})</strong> including all students, sessions, uploaded PDFs, and RAG search indices?
              </p>

              {deleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setClassToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={Boolean(deletingClassId)}
                  className="px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteClass(classToDelete.classId)}
                  disabled={Boolean(deletingClassId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingClassId ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications Slide-over Drawer ───────────────────────────────── */}
        {isNotificationsOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] shrink-0">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="font-black text-sm text-[#0F172A]">Notifications</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {myClasses.length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-6">No new notifications.</p>
                ) : (
                  myClasses.map((cls) => (
                    <div key={cls.classId} className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
                            <Video className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="font-bold text-xs text-[#0F172A]">{cls.name}</h4>
                        </div>
                        <span className="text-[10px] text-[#94A3B8] font-mono">{cls.classId}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] pl-8">
                        {cls.materialCount || 0} materials indexed • Status: {cls.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Insights & Previous Meets Modal ────────────────────────────── */}
        {isInsightsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-4xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 border border-[#E2E8F0] animate-in fade-in max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[#8B5CF6]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-[#0F172A]">Classroom AI Insights & Previous Meets</h3>
                    <p className="text-xs text-[#64748B]">Analytics, student doubt trends, and historical meeting records</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={insightsClassId}
                    onChange={(e) => {
                      setInsightsClassId(e.target.value);
                      loadClassInsights(e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#0F172A] bg-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
                  >
                    {myClasses.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.name} ({c.classId})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setIsInsightsModalOpen(false)}
                    className="text-[#64748B] hover:text-[#0F172A] cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {isLoadingInsights ? (
                  <div className="p-12 text-center text-xs text-[#64748B] flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing past meeting sessions and student questions...</span>
                  </div>
                ) : insightsError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{insightsError}</span>
                  </div>
                ) : insightsData ? (
                  <div className="space-y-6">
                    {/* 1. Four Key Metrics Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold">
                          <Video className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>Total Meets</span>
                        </div>
                        <p className="text-xl font-black text-[#0F172A]">{insightsData.totalMeetings}</p>
                        <p className="text-[10px] text-[#94A3B8]">Recorded sessions</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Teaching Time</span>
                        </div>
                        <p className="text-xl font-black text-[#0F172A]">{insightsData.totalTeachingDurationFormatted}</p>
                        <p className="text-[10px] text-[#94A3B8]">Across all meets</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold">
                          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Doubts Solved</span>
                        </div>
                        <p className="text-xl font-black text-[#0F172A]">{insightsData.totalDoubtsAsked}</p>
                        <p className="text-[10px] text-emerald-600 font-bold">{insightsData.aiResolutionRatePercent}% AI Grounded</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Avg Attendance</span>
                        </div>
                        <p className="text-xl font-black text-[#0F172A]">{insightsData.avgAttendancePerMeeting}</p>
                        <p className="text-[10px] text-[#94A3B8]">Students per meet</p>
                      </div>
                    </div>

                    {/* 2. Previous Meets Timeline & History */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#2563EB]" />
                          <span>Previous Meets & Attendance History</span>
                        </h4>
                        <span className="text-[11px] text-[#64748B] font-semibold">
                          {insightsData.pastMeetings.length} recorded meet{insightsData.pastMeetings.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {insightsData.pastMeetings.length === 0 ? (
                        <div className="p-6 text-center rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                          <p className="text-xs text-[#64748B]">No previous meetings found for this classroom yet.</p>
                          <p className="text-[11px] text-[#94A3B8] mt-1">Start a live meeting from the dashboard to record attendance and AI Tutor metrics.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {insightsData.pastMeetings.map((meet: any, idx: number) => (
                            <div
                              key={meet.sessionId || idx}
                              className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 transition-all space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] shrink-0 font-bold text-xs">
                                    #{insightsData.pastMeetings.length - idx}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="text-xs font-bold text-[#0F172A]">
                                        {new Date(meet.startedAt).toLocaleDateString(undefined, {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </h5>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        meet.status === 'LIVE'
                                          ? 'bg-emerald-100 text-[#16A34A]'
                                          : 'bg-slate-200 text-[#64748B]'
                                      }`}>
                                        {meet.status === 'LIVE' ? 'LIVE NOW' : 'COMPLETED'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#64748B]">
                                      Started {new Date(meet.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Duration: <span className="font-bold text-[#0F172A]">{meet.durationFormatted}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className="flex items-center gap-1 font-semibold text-[#64748B]">
                                    <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                                    <span>{meet.attendeeCount} attendee{meet.attendeeCount === 1 ? '' : 's'}</span>
                                  </span>
                                  <span className="flex items-center gap-1 font-semibold text-[#64748B]">
                                    <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                                    <span>{meet.doubtsCount} doubt{meet.doubtsCount === 1 ? '' : 's'}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Topics & Attendee chips */}
                              {meet.attendees && meet.attendees.length > 0 && (
                                <div className="pt-2 border-t border-[#E2E8F0]/70 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mr-1">Attendees:</span>
                                  {meet.attendees.map((att: any, aIdx: number) => (
                                    <span
                                      key={aIdx}
                                      className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[10px] text-[#0F172A] font-medium"
                                      title={att.email}
                                    >
                                      {att.name} ({att.durationFormatted})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. Pedagogical Recommendations from Previous Meets */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                        <span>AI Pedagogical Recommendations & Concept Gaps</span>
                      </h4>

                      <div className="space-y-2.5">
                        {insightsData.pedagogicalRecommendations.map((rec: any, rIdx: number) => (
                          <div
                            key={rec.id || rIdx}
                            className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#8B5CF6] border border-purple-200">
                                Focus: {rec.topic}
                              </span>
                              <span className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">
                                Recommendation
                              </span>
                            </div>
                            <p className="text-xs text-[#0F172A] font-semibold">{rec.observation}</p>
                            <p className="text-[11px] text-[#64748B] leading-relaxed">{rec.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Top Question Topics Breakdown */}
                    {insightsData.topTopics && insightsData.topTopics.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#2563EB]" />
                          <span>Most Frequent Doubt Topics in Meets</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {insightsData.topTopics.map((t: any, tIdx: number) => (
                            <div
                              key={tIdx}
                              className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between"
                            >
                              <span className="text-xs font-bold text-[#0F172A] truncate pr-2">{t.topic}</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-[#2563EB] shrink-0">
                                {t.count} question{t.count === 1 ? '' : 's'} ({t.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ── Past Recordings Modal ─────────────────────────────────────────── */}
        {isRecordingsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden animate-in fade-in">
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <Disc className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-[#0F172A]">Agora Cloud Recordings</h3>
                    <p className="text-xs text-[#64748B]">All recorded classroom lecture sessions</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsRecordingsModalOpen(false);
                    setPlayingVideoUrl(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] flex items-center justify-center transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Active Video Player Overlay if playing */}
                {playingVideoUrl && (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between text-xs text-white">
                      <span className="font-bold flex items-center gap-2">
                        <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                        Lecture Recording Playback
                      </span>
                      <button
                        onClick={() => setPlayingVideoUrl(null)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        Close Player ✕
                      </button>
                    </div>
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                      <video
                        src={playingVideoUrl}
                        controls
                        autoPlay
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {isLoadingRecordings ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-[#64748B] font-semibold">Loading cloud recordings...</p>
                  </div>
                ) : recordingsError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold">
                    {recordingsError}
                  </div>
                ) : allRecordings.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Disc className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-[#0F172A]">No recordings yet</p>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                      Click the "Record" button during live classroom sessions to capture video, audio, and screen shares to Agora Cloud.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allRecordings.map((rec) => {
                      const durMin = rec.durationSeconds ? Math.floor(rec.durationSeconds / 60) : 0;
                      const durSec = rec.durationSeconds ? rec.durationSeconds % 60 : 0;
                      const fileUrl = rec.fileList?.[0]?.url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

                      return (
                        <div
                          key={rec.id}
                          className="p-4 rounded-2xl border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white transition-all flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 border border-rose-100 text-rose-600">
                                {rec.classId}
                              </span>
                              <span className="text-[10px] font-bold text-[#64748B]">
                                {new Date(rec.startedAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[#0F172A] truncate">
                              Channel: {rec.agoraChannel}
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              Duration: {durMin}m {durSec}s • Status: {rec.status}
                            </p>
                          </div>

                          <button
                            onClick={() => setPlayingVideoUrl(fileUrl)}
                            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Play</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Adaptive 1-to-1 Learning Intelligence Modal */}
        <TeacherAnalyticsModal
          classId={selectedClassId || (myClasses.length > 0 ? myClasses[0].classId : '')}
          isOpen={isPersonalizationAnalyticsOpen}
          onClose={() => setIsPersonalizationAnalyticsOpen(false)}
        />
      </main>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
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
  FileCheck,
  Compass,
  Zap,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Info,
  Check,
  Target,
  RefreshCw,
  Brain,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { Classroom, ClassroomMaterialSummary } from '../types';
import { Logo } from './common/Logo';
import { PixelSnow } from './effects/PixelSnow';
import { AIClassroomPanel } from './AIClassroomPanel';
import { SpecularButton } from './effects/SpecularButton';
import { StudentLearningDrawer } from './StudentLearningDrawer';
import { PersonalLearningProfileModal } from './PersonalLearningProfileModal';

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

const SUPPORT_LEVEL_CONFIG: Record<string, { label: string; badgeColor: string; textColor: string }> = {
  STRONG_MASTERY: { label: 'Strong Mastery', badgeColor: 'bg-emerald-500/20 border-emerald-500/40', textColor: 'text-emerald-300' },
  READY_FOR_CHALLENGE: { label: 'Ready for Challenge', badgeColor: 'bg-cyan-500/20 border-cyan-500/40', textColor: 'text-cyan-300' },
  COMFORTABLE: { label: 'Comfortable Pace', badgeColor: 'bg-blue-500/20 border-blue-500/40', textColor: 'text-blue-300' },
  GUIDED_PRACTICE: { label: 'Guided Practice', badgeColor: 'bg-amber-500/20 border-amber-500/40', textColor: 'text-amber-300' },
  NEEDS_REINFORCEMENT: { label: 'Needs Reinforcement', badgeColor: 'bg-orange-500/20 border-orange-500/40', textColor: 'text-orange-300' },
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

  // Modals & Drawers
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [isPersonalPathOpen, setIsPersonalPathOpen] = useState(false);
  const [showTransparencyInfo, setShowTransparencyInfo] = useState(false);

  // Diagnostic Calibration State
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [diagnosticSession, setDiagnosticSession] = useState<any>(null);
  const [currentDiagnosticIdx, setCurrentDiagnosticIdx] = useState(0);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({});
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [isSubmittingDiagnostic, setIsSubmittingDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [diagnosticStartTime, setDiagnosticStartTime] = useState<number>(Date.now());

  // Phase 4 Study Assistant & Canonical State
  const [canonicalState, setCanonicalState] = useState<any>(null);
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [studyPlan, setStudyPlan] = useState<any>(null);
  const [retentionQueue, setRetentionQueue] = useState<any[]>([]);
  const [isStudySessionModalOpen, setIsStudySessionModalOpen] = useState(false);
  const [activeStudySession, setActiveStudySession] = useState<any>(null);
  const [studySessionPrompt, setStudySessionPrompt] = useState<string>('');
  const [studySessionExpectedInput, setStudySessionExpectedInput] = useState<string>('TEXT');
  const [studySessionInput, setStudySessionInput] = useState<string>('');
  const [studySessionFeedback, setStudySessionFeedback] = useState<string>('');
  const [isStudySessionLoading, setIsStudySessionLoading] = useState<boolean>(false);
  const [isStudySessionCompleted, setIsStudySessionCompleted] = useState<boolean>(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false);
  const [newGoalType, setNewGoalType] = useState<string>('DEEP_MASTERY');
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalDate, setNewGoalDate] = useState<string>('');
  const [showWhyThisNowModal, setShowWhyThisNowModal] = useState<boolean>(false);

  // Phase 5 Personal Learning Profile (Layer 1) State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [personalProfile, setPersonalProfile] = useState<any>(null);

  // Real Authenticated Learning Data
  const [learningProfile, setLearningProfile] = useState<any>(null);
  const [topicMasteries, setTopicMasteries] = useState<any[]>([]);
  const [conceptGraph, setConceptGraph] = useState<any>(null);
  const [currentLiveTopicId, setCurrentLiveTopicId] = useState<string>('');
  const [bridge, setBridge] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [classMaterials, setClassMaterials] = useState<ClassroomMaterialSummary[]>([]);
  const [aiChatHistory, setAiChatHistory] = useState<any[]>([]);
  const [isLoadingLearningData, setIsLoadingLearningData] = useState(false);

  // Load classrooms & authenticated learning state
  const loadDashboardData = useCallback(async () => {
    setIsLoadingClasses(true);
    try {
      const res = await api.getMyClasses();
      const classes = res.classrooms || [];
      setClassrooms(classes);

      // Load Layer 1 Personal Learning Profile
      try {
        const pRes = await api.personalization.getPersonalLearningProfile();
        if (pRes && pRes.profile) {
          setPersonalProfile(pRes.profile);
        }
      } catch (pErr) {
        console.warn('Could not load personal learning profile:', pErr);
      }

      if (classes.length > 0) {
        const targetClass = classes.find((c) => c.status === 'active') || classes[0];
        setIsLoadingLearningData(true);

        const [profileRes, bridgeRes, materialsRes, chatRes, stateRes, planRes, retRes] = await Promise.allSettled([
          api.getLearnerProfile(targetClass.classId),
          api.getLearningBridge(targetClass.classId),
          api.getClassMaterials(targetClass.classId),
          api.getClassConversationHistory(targetClass.classId),
          api.getStudentLearningState(targetClass.classId),
          api.getStudyPlan(targetClass.classId),
          api.getRetentionQueue(targetClass.classId),
        ]);

        if (profileRes.status === 'fulfilled') {
          const data = profileRes.value as any;
          setLearningProfile(data.profile);
          setTopicMasteries(data.topicMasteries || data.masteries || []);
          setConceptGraph(data.conceptGraph);
          setCurrentLiveTopicId(data.currentLiveTopic || data.profile?.currentTopic || '');
          setRecentEvents(data.recentEvents || []);
        }

        if (bridgeRes.status === 'fulfilled') {
          setBridge(bridgeRes.value.bridge);
        }

        if (materialsRes.status === 'fulfilled') {
          setClassMaterials(materialsRes.value.materials || []);
        }

        if (chatRes.status === 'fulfilled') {
          setAiChatHistory(chatRes.value.messages || []);
        }

        if (stateRes.status === 'fulfilled') {
          setCanonicalState(stateRes.value.state);
        }

        if (planRes.status === 'fulfilled') {
          setActiveGoal(planRes.value.goal);
          setStudyPlan(planRes.value.plan);
        }

        if (retRes.status === 'fulfilled') {
          setRetentionQueue(retRes.value.retentionQueue || []);
        }
      }
    } catch (err) {
      console.error('Failed to load student dashboard data:', err);
    } finally {
      setIsLoadingClasses(false);
      setIsLoadingLearningData(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleStartDiagnostic = async () => {
    if (!currentClassId) return;
    setIsDiagnosticOpen(true);
    setDiagnosticLoading(true);
    setDiagnosticResult(null);
    setCurrentDiagnosticIdx(0);
    setDiagnosticStartTime(Date.now());
    try {
      const res = await api.getDiagnosticSuite(currentClassId);
      setDiagnosticSession(res.session);
      if (res.session?.answers) {
        const existingAns: Record<string, string> = {};
        for (const [qId, aData] of Object.entries(res.session.answers as Record<string, any>)) {
          existingAns[qId] = aData.answer;
        }
        setDiagnosticAnswers(existingAns);
      }
    } catch (err) {
      console.error('Failed to load diagnostic suite:', err);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleDiagnosticAnswerChange = async (questionId: string, answer: string) => {
    setDiagnosticAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (diagnosticSession?.sessionId && currentClassId) {
      try {
        await api.saveDiagnosticAnswer(currentClassId, diagnosticSession.sessionId, {
          questionId,
          answer,
          timeToAnswerMs: Date.now() - diagnosticStartTime,
          hintsUsed: revealedHints[questionId] ? 1 : 0,
        });
      } catch (err) {
        console.error('Failed to save partial diagnostic answer:', err);
      }
    }
  };

  const handleSubmitDiagnostic = async () => {
    if (!diagnosticSession || !currentClassId) return;
    setIsSubmittingDiagnostic(true);
    try {
      const submissions = diagnosticSession.questions.map((q: any) => ({
        questionId: q.id,
        answer: diagnosticAnswers[q.id] || '',
        timeToAnswerMs: Date.now() - diagnosticStartTime,
        hintsUsed: revealedHints[q.id] ? 1 : 0,
      }));

      const res = await api.submitDiagnosticSuite(currentClassId, diagnosticSession.sessionId, submissions);
      setDiagnosticResult(res.summary);
      setLearningProfile(res.profile);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to submit diagnostic:', err);
    } finally {
      setIsSubmittingDiagnostic(false);
    }
  };

  const handleRecalibrate = async () => {
    if (!currentClassId) return;
    setDiagnosticLoading(true);
    setIsDiagnosticOpen(true);
    setDiagnosticResult(null);
    setDiagnosticAnswers({});
    setCurrentDiagnosticIdx(0);
    setDiagnosticStartTime(Date.now());
    try {
      const res = await api.requestRecalibration(currentClassId);
      setDiagnosticSession(res.session);
      setLearningProfile(res.profile);
    } catch (err) {
      console.error('Failed to request recalibration:', err);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleStartStudySession = async (topicId?: string, mode: string = 'STUDY') => {
    if (!currentClassId) return;
    setIsStudySessionLoading(true);
    setIsStudySessionModalOpen(true);
    setIsStudySessionCompleted(false);
    setStudySessionInput('');
    setStudySessionFeedback('');
    try {
      const res = await api.startStudySession(currentClassId, topicId, mode);
      setActiveStudySession(res.session);
      setStudySessionPrompt(res.prompt);
      setStudySessionExpectedInput(res.expectedInputType || 'TEXT');
    } catch (err) {
      console.error('Failed to start study session:', err);
    } finally {
      setIsStudySessionLoading(false);
    }
  };

  const handleStepStudySession = async () => {
    if (!currentClassId || !activeStudySession) return;
    setIsStudySessionLoading(true);
    try {
      const res = await api.stepStudySession(
        currentClassId,
        activeStudySession.sessionId,
        studySessionInput.trim() || 'Done'
      );
      setActiveStudySession(res.session);
      setStudySessionFeedback(res.feedback);
      setStudySessionInput('');
      if (res.isCompleted) {
        setIsStudySessionCompleted(true);
        await loadDashboardData();
      } else if (res.nextPrompt) {
        setStudySessionPrompt(res.nextPrompt);
        setStudySessionExpectedInput(res.expectedInputType || 'TEXT');
      }
    } catch (err) {
      console.error('Failed to advance study session:', err);
    } finally {
      setIsStudySessionLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!currentClassId || !newGoalType) return;
    try {
      const res = await api.saveStudyGoal(currentClassId, {
        goalType: newGoalType,
        title: newGoalTitle.trim() || (newGoalType === 'EXAM_PREP' ? 'Exam Preparation' : 'Deep Mastery'),
        targetDate: newGoalDate || undefined,
      });
      setActiveGoal(res.goal);
      setStudyPlan(res.plan);
      setIsGoalModalOpen(false);
      setNewGoalTitle('');
      setNewGoalDate('');
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to save study goal:', err);
    }
  };

  const handleJoinClass = async () => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      await api.joinClass(code);
      setIsJoinModalOpen(false);
      setClassCode('');
      await loadDashboardData();
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
  const currentClassId = activeLiveClass ? activeLiveClass.classId : '';
  const currentSubject = activeLiveClass ? activeLiveClass.subject : 'Classroom Session';

  // Derived real topic name
  const currentConceptNode = conceptGraph?.concepts?.[currentLiveTopicId];
  const liveTopicDisplayName = currentConceptNode?.name ||
    (currentLiveTopicId ? currentLiveTopicId.replace(/_/g, ' ') : (activeLiveClass ? activeLiveClass.name : ''));

  // Derived student frontier
  const studentFrontierTopicId = learningProfile?.currentTopic || currentLiveTopicId;
  const studentConceptNode = conceptGraph?.concepts?.[studentFrontierTopicId];
  const studentFrontierDisplayName = studentConceptNode?.name ||
    (studentFrontierTopicId ? studentFrontierTopicId.replace(/_/g, ' ') : '');

  // Masteries breakdown
  const strongConcepts = topicMasteries.filter((tm) => tm.masteryScore >= 0.70);
  const reinforcementConcepts = topicMasteries.filter((tm) => tm.masteryScore < 0.65);
  const allConceptNodes = conceptGraph?.concepts ? Object.values(conceptGraph.concepts) as any[] : [];

  // Curriculum Completion vs Topic Mastery (Separated!)
  const totalSyllabusTopicsCount = allConceptNodes.length;
  const completedTopicsCount = strongConcepts.length;
  const curriculumProgressPercent = totalSyllabusTopicsCount > 0
    ? Math.round((completedTopicsCount / totalSyllabusTopicsCount) * 100)
    : null;

  // Next Best Action mapping from authentic learner state
  let nextActionType: string = 'CONTINUE_CLASS';
  let nextActionTitle = 'Continue Learning';
  let nextActionSubtitle = 'Follow live classroom flow and participate';
  let nextActionClick: () => void = () => setIsPersonalPathOpen(true);
  let nextActionRationale = 'Following the standard syllabus sequence with your cohort.';

  const isUninitialized = !learningProfile || learningProfile.profileStatus === 'UNINITIALIZED';
  const isCalibrating = learningProfile?.profileStatus === 'CALIBRATING';

  if (canonicalState?.nextBestAction) {
    const nba = canonicalState.nextBestAction;
    nextActionType = nba.actionType;
    nextActionTitle = nba.title;
    nextActionSubtitle = nba.description;
    nextActionRationale = nba.rationale;
    if (nba.actionType === 'CALIBRATE_DIAGNOSTIC') {
      nextActionClick = () => handleStartDiagnostic();
    } else if (nba.actionType === 'START_STUDY_SESSION' || nba.actionType === 'PRACTICE' || nba.actionType === 'REVISE') {
      nextActionClick = () => handleStartStudySession(nba.topicId, nba.actionType === 'REVISE' ? 'RECALL' : 'STUDY');
    } else if (nba.actionType === 'TRY_CHALLENGE') {
      nextActionClick = () => handleStartStudySession(nba.topicId, 'PRACTICE');
    } else {
      nextActionClick = () => setIsPersonalPathOpen(true);
    }
  } else if (isUninitialized) {
    nextActionType = 'DIAGNOSTIC';
    nextActionTitle = 'Start Calibration Diagnostic';
    nextActionSubtitle = 'Answer 5 quick questions (~2 mins) so ClassPulse can understand your starting point';
    nextActionRationale = 'Diagnostic evidence is required before personalizing pacing and depth.';
    nextActionClick = () => handleStartDiagnostic();
  } else if (isCalibrating) {
    nextActionType = 'DIAGNOSTIC';
    nextActionTitle = 'Continue Diagnostic';
    nextActionSubtitle = 'Resume your calibration check to finalize your personalized learning path';
    nextActionRationale = 'Finalize your diagnostic questions to build your initial knowledge frontier.';
    nextActionClick = () => handleStartDiagnostic();
  } else if (bridge && !bridge.isQuickCatchup && bridge.learningDebtGaps?.length > 0) {
    nextActionType = 'START_CATCH_UP';
    nextActionTitle = 'Start Quick Catch-Up';
    nextActionSubtitle = `~${bridge.estimatedDurationSec || 60}s bridge on ${bridge.learningDebtGaps[0]?.prerequisiteTopicName || 'prerequisites'}`;
    nextActionRationale = 'Clear prerequisite blocker before following live classroom topic.';
    nextActionClick = () => setIsPersonalPathOpen(true);
  } else if (learningProfile?.supportLevel === 'READY_FOR_CHALLENGE' || learningProfile?.supportLevel === 'STRONG_MASTERY') {
    nextActionType = 'TRY_CHALLENGE';
    nextActionTitle = 'Try Challenge Check';
    nextActionSubtitle = 'Solidify deep mastery with an advanced synthesis question';
    nextActionRationale = 'High topic mastery verified. Synthesis challenges deepen cognitive retention.';
    nextActionClick = () => setIsPersonalPathOpen(true);
  } else if (reinforcementConcepts.length > 0 || learningProfile?.supportLevel === 'NEEDS_REINFORCEMENT') {
    nextActionType = 'GUIDED_CHECK';
    nextActionTitle = 'Take 2-min Guided Check';
    nextActionSubtitle = `Reinforce ${reinforcementConcepts[0]?.topicName || 'core concepts'}`;
    nextActionRationale = 'Recent assessment evidence detected partial comprehension gaps.';
    nextActionClick = () => setIsPersonalPathOpen(true);
  }

  // Dynamic "Personalized for you" rationale from real state
  const getPersonalizationMessage = (): string => {
    if (isUninitialized) {
      return "Your personalized learning profile is not calibrated yet. Complete the 2-minute diagnostic check to tune lesson pace, explanation depth, and support.";
    }
    if (bridge && !bridge.isQuickCatchup && bridge.learningDebtGaps?.length > 0) {
      return `You have a foundational gap in ${bridge.learningDebtGaps[0].prerequisiteTopicName}. A targeted bridge is recommended before advancing to the live topic.`;
    }
    if (learningProfile.supportLevel === 'READY_FOR_CHALLENGE' || learningProfile.supportLevel === 'STRONG_MASTERY') {
      return `You've demonstrated solid comprehension of ${liveTopicDisplayName || 'core concepts'}. Accelerated pace and higher-difficulty synthesis checks are recommended.`;
    }
    if (learningProfile.supportLevel === 'NEEDS_REINFORCEMENT' || reinforcementConcepts.length > 0) {
      return `Recent checks indicate reinforcement is beneficial for ${reinforcementConcepts[0]?.topicName || liveTopicDisplayName}. Guided analogies and practice checks will help lock in understanding.`;
    }
    return `Your learning path is tuned to a ${learningProfile.preferredPace?.toLowerCase() || 'comfortable'} pace using ${learningProfile.preferredExplanationStyle?.replace(/_/g, ' ').toLowerCase() || 'analogy & example'} explanations for ${liveTopicDisplayName}.`;
  };

  const supportConfig = learningProfile?.supportLevel
    ? (SUPPORT_LEVEL_CONFIG[learningProfile.supportLevel] || SUPPORT_LEVEL_CONFIG.COMFORTABLE)
    : { label: 'Building Profile', badgeColor: 'bg-indigo-500/20 border-indigo-500/40', textColor: 'text-indigo-300' };

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col selection:bg-blue-600/40 selection:text-blue-200 antialiased relative overflow-x-hidden">
      {/* ── Retro PixelSnow Background ──────────────────────────────────────── */}
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

      {/* ── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="h-16 px-6 sm:px-12 bg-[#080D1D]/95 border-b border-[#141B33] backdrop-blur-md sticky top-0 z-50 flex items-center justify-between gap-6 shadow-md">
        <div onClick={() => navigate('/dashboard')} className="cursor-pointer">
          <Logo size="sm" showTagline={false} />
        </div>

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

      {/* ── Main Workspace ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-12 py-8 space-y-8 relative z-10">
        
        {/* 1. Welcome & Status Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-2.5">
              Welcome back, {user?.name?.split(' ')[0] || 'Student'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 font-medium">
              Your 1-to-1 personalized learning companion and live classroom hub.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#0B1124] border border-[#16203D] text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{learningProfile ? supportConfig.label : 'Active Learner'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#0B1124] border border-[#16203D] text-xs font-semibold text-blue-300">
              <Users className="w-4 h-4 text-blue-400" />
              <span>{classrooms.length} Enrolled {classrooms.length === 1 ? 'Class' : 'Classes'}</span>
            </div>
          </div>
        </div>

        {/* 2. Five Bento Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

          <button
            data-testid="dashboard-frontier"
            onClick={() => setIsPersonalPathOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-cyan-500/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">My Frontier</p>
              <p className="text-xs text-[#64748B] mt-0.5">1-to-1 Path & Checks</p>
            </div>
          </button>

          <button
            data-testid="dashboard-learning-profile"
            onClick={() => setIsProfileModalOpen(true)}
            className="p-5 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-emerald-500/60 hover:bg-[#0E162E] transition-all text-left group shadow-xl flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Learning Profile</p>
                {personalProfile?.status === 'CALIBRATED' ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {personalProfile.readingSpeedWpm} WPM
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Calibrate
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">Cross-course pace & style</p>
            </div>
          </button>

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
              <p className="text-xs text-[#64748B] mt-0.5">Summaries & transcripts</p>
            </div>
          </button>

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

        {/* ── 3. DOMINANT "YOUR LEARNING RIGHT NOW" ONE-TO-ONE CONTROL SURFACE ── */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0B1228] via-[#0E1736] to-[#080D1F] border border-indigo-500/30 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          {/* Section Header with Dynamic Personalization Pill & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">My Learning Today</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Command Center</span>
                </div>
                <p className="text-xs text-[#94A3B8]">Personal AI study companion aligned with your live classroom & active goals</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => setIsGoalModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-all cursor-pointer"
                title="Set or customize your active study goal"
              >
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span>{activeGoal?.goalType ? `Goal: ${activeGoal.goalType.replace(/_/g, ' ')}` : 'Set Goal'}</span>
              </button>
              <button
                onClick={() => handleStartStudySession()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
                title="Launch guided adaptive study session"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                <span>Study With Me</span>
              </button>
              {!isUninitialized && (
                <button
                  onClick={handleRecalibrate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all cursor-pointer"
                  title="Update your calibration profile"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Recalibrate</span>
                </button>
              )}
              <button
                onClick={() => setShowWhyThisNowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all cursor-pointer"
                title="Deterministic rationale behind this learning recommendation"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Why this now?</span>
              </button>
            </div>
          </div>

          {/* Expanded Pedagogical Transparency Box */}
          {showTransparencyInfo && (
            <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-200 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between font-bold text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Pedagogical Rationale
                </span>
                <button onClick={() => setShowTransparencyInfo(false)} className="text-indigo-400 hover:text-white">✕</button>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {learningProfile?.evidenceCount > 0
                  ? `Your tutoring profile is calibrated with ${learningProfile.evidenceCount} verified evidence points. Your current support state is ${supportConfig.label} (${Math.round(learningProfile.overallMastery * 100)}% mastery). Explanations are delivered at a ${learningProfile.preferredPace?.toLowerCase() || 'comfortable'} pace using ${learningProfile.preferredExplanationStyle?.replace(/_/g, ' ').toLowerCase() || 'analogy'} scaffolding.`
                  : "Your tutoring profile is currently in baseline calibration. As you answer micro-checks or ask doubts, ClassPulse continuously tunes explanation depth, pace, and difficulty without fake fallbacks."}
              </p>
            </div>
          )}

          {isUninitialized ? (
            <div className="p-6 rounded-2xl bg-[#060A18]/90 border border-indigo-500/40 space-y-4 relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      Not Calibrated Yet
                    </span>
                    <span className="text-xs text-slate-400 font-medium">~2 minutes</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Let's calibrate your learning path.</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                    Answer 5 quick course-grounded questions so ClassPulse can understand your starting point and personalize explanation depth, pace, and difficulty for you.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={handleStartDiagnostic}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Start Calibration Diagnostic</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 4-Pillar Grid: LIVE TOPIC vs YOU vs GAP vs NEXT */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {/* Pillar 1: LIVE TOPIC */}
              <div className="p-5 rounded-2xl bg-[#060A18]/80 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Live Classroom Topic</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white leading-snug truncate">
                    {liveTopicDisplayName || (classrooms.length > 0 ? 'Synchronizing topic...' : 'No active class')}
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {currentConceptNode?.unit || (activeLiveClass ? `${activeLiveClass.name}` : 'Join a classroom')}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  Teacher: <strong className="text-slate-200">{activeLiveClass?.teacherName || 'Instructor'}</strong>
                </div>
              </div>

              {/* Pillar 2: YOU (Where you are) */}
              <div className="p-5 rounded-2xl bg-[#060A18]/80 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Your Frontier</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${supportConfig.badgeColor} ${supportConfig.textColor}`}>
                    {supportConfig.label}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-base font-bold text-white truncate">
                      {studentFrontierDisplayName || liveTopicDisplayName || 'Calibrating'}
                    </h4>
                    {learningProfile ? (
                      <span className="text-sm font-bold text-indigo-400">
                        {Math.round(learningProfile.overallMastery * 100)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Building...</span>
                    )}
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${learningProfile ? Math.round(learningProfile.overallMastery * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
                  Pace: <strong className="text-slate-200 capitalize">{learningProfile?.preferredPace?.toLowerCase() || 'Comfortable'}</strong>
                </div>
              </div>

              {/* Pillar 3: GAP (What is preventing you from following) */}
              <div className="p-5 rounded-2xl bg-[#060A18]/80 border border-white/5 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Prerequisite Gap</span>
                  {bridge?.learningDebtGaps?.length > 0 ? (
                    <span className="text-amber-400 text-xs font-bold">⚡ Gap Detected</span>
                  ) : (
                    <span className="text-emerald-400 text-xs font-bold">✓ Clear</span>
                  )}
                </div>
                <div>
                  {bridge?.learningDebtGaps && bridge.learningDebtGaps.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-300 truncate">
                        {bridge.learningDebtGaps[0].prerequisiteTopicName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Prereq Mastery: <strong className="text-amber-400">{Math.round(bridge.learningDebtGaps[0].currentMastery * 100)}%</strong>
                      </p>
                    </div>
                  ) : bridge?.missedClassDurationMinutes && bridge.missedClassDurationMinutes > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-300">
                        {bridge.missedClassDurationMinutes}m Missed Time
                      </p>
                      <p className="text-[11px] text-slate-400">Quick catch-up available</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-300">No Prerequisite Gaps</p>
                      <p className="text-[11px] text-slate-400">You're caught up with live foundations</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400 truncate">
                  {bridge?.learningDebtGaps?.length > 0
                    ? `Est. ~${bridge.estimatedDurationSec || 60}s bridge`
                    : 'Ready for live interaction'}
                </div>
              </div>

              {/* Pillar 4: NEXT (What ClassPulse recommends) */}
              <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" /> Next Best Action
                  </span>
                  <span className="text-[10px] text-indigo-400 font-medium">Tutor Decision</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{nextActionTitle}</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{nextActionSubtitle}</p>
                </div>
                <button
                  onClick={nextActionClick}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{nextActionTitle}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Personalized For You Banner */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-300 block mb-0.5">✨ Personalized for you</span>
                <p className="text-slate-300 leading-relaxed">{getPersonalizationMessage()}</p>
              </div>
            </div>
            <button
              onClick={() => setIsPersonalPathOpen(true)}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold shrink-0 transition-colors"
            >
              Open 1-to-1 Learning Drawer →
            </button>
          </div>
        </section>

        {/* ── 4. Dominant LIVE NOW Class Banner ──────────────────────────────── */}
        {activeLiveClass && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0D1530] via-[#0B1228] to-[#121B3B] border border-[#2563EB]/40 p-6 sm:p-8 shadow-2xl">
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
                    Teacher: <strong className="text-slate-200">{activeLiveClass.teacherName || 'Instructor'}</strong> • {activeLiveClass.subject}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    Live video & private AI companion active
                  </span>
                  <span>•</span>
                  <span>{activeLiveClass.materialCount || classMaterials.length} course materials indexed</span>
                </div>
              </div>

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

        {/* ── 5. REAL LEARNING JOURNEY (Derived from Concept Graph & Masteries) ─── */}
        <div className="p-6 rounded-3xl bg-[#0B1124] border border-[#16203D] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Your Learning Journey</h3>
                <p className="text-xs text-[#64748B]">Syllabus concept masteries calibrated to your profile</p>
              </div>
            </div>
            {curriculumProgressPercent !== null ? (
              <span className="text-xs font-mono font-bold text-indigo-400">{curriculumProgressPercent}% Completed</span>
            ) : (
              <span className="text-xs text-slate-500 font-medium">Progress building</span>
            )}
          </div>

          {/* Concepts Grid from Concept Graph */}
          {allConceptNodes.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#060A18] border border-white/5 space-y-1">
              <p className="text-xs font-bold text-slate-300">Learning journey calibrating</p>
              <p className="text-[11px] text-slate-500">
                Join a live class or upload lecture materials to populate the course concept syllabus.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {allConceptNodes.map((concept: any) => {
                const masteryRecord = topicMasteries.find((tm) => tm.topicId === concept.id);
                const score = masteryRecord ? masteryRecord.masteryScore : null;
                const isLive = currentLiveTopicId === concept.id;

                let statusBadge = <span className="text-[10px] text-slate-500 font-medium">○ Upcoming</span>;
                let borderStyle = 'border-white/5 bg-[#060A18]';

                if (score !== null && score >= 0.70) {
                  statusBadge = <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Strong ({Math.round(score * 100)}%)</span>;
                  borderStyle = 'border-emerald-500/30 bg-emerald-950/20';
                } else if (score !== null && score >= 0.50) {
                  statusBadge = <span className="text-[10px] text-cyan-400 font-bold">◐ Learning ({Math.round(score * 100)}%)</span>;
                  borderStyle = 'border-cyan-500/30 bg-cyan-950/20';
                } else if (score !== null) {
                  statusBadge = <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Reinforce ({Math.round(score * 100)}%)</span>;
                  borderStyle = 'border-amber-500/30 bg-amber-950/20';
                }

                return (
                  <div
                    key={concept.id}
                    onClick={() => setIsPersonalPathOpen(true)}
                    className={`p-3.5 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer space-y-1.5 ${borderStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase truncate pr-1">
                        {concept.unit || 'Topic'}
                      </span>
                      {isLive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 shrink-0">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-white truncate">{concept.name}</p>
                    <div className="pt-1 border-t border-white/5">{statusBadge}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsCurriculumOpen(true)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>View full curriculum pathway</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── 6. My Classrooms Section ──────────────────────────────────────── */}
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

          {isLoadingClasses ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
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
                          {cls.teacherName || 'Instructor'}
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

        {/* ── 7. Recent Learning Timeline (Real Events Only) ────────────────── */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider pb-1 border-b border-[#141B33]">
            Recent Learning Activity
          </h3>

          {recentEvents.length === 0 ? (
            <div className="p-8 text-center bg-[#0B1124] rounded-2xl border border-[#16203D] text-xs text-[#64748B]">
              No recent learning activity yet. Complete a micro-check or ask a doubt to build your journey.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentEvents.slice(0, 3).map((ev: any, idx: number) => {
                const isSuccess = ev.metrics?.isCorrect === true || (ev.metrics?.score && ev.metrics.score >= 0.7);
                return (
                  <div
                    key={idx}
                    onClick={() => setIsPersonalPathOpen(true)}
                    className="p-4 rounded-2xl bg-[#0B1124] border border-[#16203D] hover:border-indigo-500/40 space-y-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span className="flex items-center gap-1.5 text-indigo-400 font-semibold truncate">
                        {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5" />}
                        <span className="capitalize">{ev.category.replace(/_/g, ' ').toLowerCase()}</span>
                      </span>
                      <span className="text-[10px]">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">
                      {ev.contextSummary || ev.topicId.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Topic: <strong className="text-slate-300">{ev.topicId.replace(/_/g, ' ')}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 8. AI Doubt Surface (Direct In-Dashboard Assistant) ───────────── */}
        <div className="rounded-3xl bg-gradient-to-r from-purple-950/40 via-[#0B1124] to-indigo-950/40 border border-purple-500/30 p-6 sm:p-8 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Got a doubt before or during class?</h3>
              <p className="text-xs text-slate-400">Ask ClassPulse AI Tutor in தமிழ், English, Tanglish, or Hindi</p>
            </div>
          </div>

          <form onSubmit={handleQuickDoubtSubmit} className="flex items-center gap-2 bg-[#060914] border border-[#1E2A52] rounded-2xl p-2 focus-within:border-purple-500 transition-colors shadow-inner">
            <input
              data-testid="dashboard-doubt-input"
              type="text"
              value={quickDoubt}
              onChange={(e) => setQuickDoubt(e.target.value)}
              placeholder="Ask any question grounded in your course materials..."
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

        {/* ── MODAL: AI Tutor ──────────────────────────────────────────────── */}
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

        {/* ── MODAL: My Notes & Stored Transcripts ──────────────────────────── */}
        {isNotesOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">My Classroom Notes & Transcripts</h3>
                    <p className="text-xs text-slate-400">Class notes and your authenticated AI interactions</p>
                  </div>
                </div>
                <button onClick={() => setIsNotesOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {classMaterials.length === 0 && aiChatHistory.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-white">No classroom notes or AI transcripts yet.</p>
                    <p className="text-[11px] text-slate-500">Ask the AI Tutor or join a classroom with uploaded materials to populate your notes.</p>
                  </div>
                ) : (
                  <>
                    {classMaterials.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Course Materials & Summaries</h4>
                        {classMaterials.map((mat) => (
                          <div key={mat.id} className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> {mat.title}
                              </span>
                              <span className="text-[10px] text-slate-500 uppercase">{mat.fileType}</span>
                            </div>
                            <p className="text-[11px] text-slate-400">Uploaded {new Date(mat.uploadedAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {aiChatHistory.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Your AI Tutor Dialogue History</h4>
                        {aiChatHistory.map((msg) => (
                          <div key={msg.id} className="p-3.5 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className={`font-semibold ${msg.role === 'student' ? 'text-blue-400' : 'text-purple-400'}`}>
                                {msg.role === 'student' ? 'You' : 'AI Companion'}
                              </span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182344] shrink-0">
                <button
                  onClick={() => setIsNotesOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Browse Materials ──────────────────────────────────────── */}
        {isMaterialsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Course Materials</h3>
                    <p className="text-xs text-slate-400">Teacher uploaded PDFs and reading documents</p>
                  </div>
                </div>
                <button onClick={() => setIsMaterialsOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {classMaterials.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-white">No classroom materials uploaded yet.</p>
                    <p className="text-[11px] text-slate-500">Materials uploaded by the teacher will appear here for study.</p>
                  </div>
                ) : (
                  classMaterials.map((mat) => (
                    <div key={mat.id} className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          {mat.title}
                        </p>
                        <p className="text-xs text-slate-400">Type: {mat.fileType.toUpperCase()} • Indexed for AI Tutor RAG</p>
                      </div>
                      <button
                        onClick={() => {
                          setIsMaterialsOpen(false);
                          setIsAITutorOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        Ask AI Tutor
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182344] shrink-0">
                <button
                  onClick={() => setIsMaterialsOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Curriculum Pathway ────────────────────────────────────── */}
        {isCurriculumOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-[#0B1124] border border-[#1E2A52] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#182344] pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Play className="w-5 h-5 fill-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Curriculum Pathway</h3>
                    <p className="text-xs text-slate-400">{activeLiveClass?.name || 'Classroom Syllabus'}</p>
                  </div>
                </div>
                <button onClick={() => setIsCurriculumOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {allConceptNodes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No syllabus concepts mapped yet.</p>
                ) : (
                  allConceptNodes.map((concept: any, idx: number) => {
                    const masteryRecord = topicMasteries.find((tm) => tm.topicId === concept.id);
                    const score = masteryRecord ? masteryRecord.masteryScore : null;
                    const isLive = currentLiveTopicId === concept.id;

                    return (
                      <div
                        key={concept.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          score !== null && score >= 0.70
                            ? 'bg-[#060914] border-emerald-500/30'
                            : isLive
                            ? 'bg-[#060914] border-purple-500/40'
                            : 'bg-[#060914] border-[#1E2A52]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <span className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-400 font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-white truncate">{concept.name}</p>
                            <p className="text-[10px] text-slate-500">{concept.unit || 'Topic'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold shrink-0">
                          {score !== null ? `${Math.round(score * 100)}%` : isLive ? 'In Progress' : 'Upcoming'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#182344] shrink-0">
                <button
                  onClick={() => setIsCurriculumOpen(false)}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Join Class Code ───────────────────────────────────────── */}
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

        {/* ── MODAL: Calibration Diagnostic Flow ─────────────────────────── */}
        {isDiagnosticOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0B1124] border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in relative max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#182344] pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Calibration Diagnostic</h3>
                    <p className="text-xs text-slate-400">
                      {diagnosticSession?.classId || currentSubject} • {diagnosticResult ? 'Profile Calibrated' : `Question ${currentDiagnosticIdx + 1} of ${diagnosticSession?.questions?.length || 5}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDiagnosticOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {diagnosticLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-white">Generating Course-Grounded Diagnostic Suite...</p>
                  <p className="text-xs text-slate-400">Analyzing classroom syllabus and prerequisite concepts</p>
                </div>
              ) : diagnosticResult ? (
                /* Diagnostic Completion Result View */
                <div className="space-y-6 py-2 flex-1 overflow-y-auto pr-1">
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">Calibration Complete!</h4>
                      <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                        Your baseline learning profile has been initialized from observable evidence. AI tutoring will automatically tailor depth, pace, and support.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Foundation</span>
                      <p className="text-sm font-bold text-indigo-300">
                        {diagnosticResult.foundationScore >= 0.75 ? 'Strong Foundation' : diagnosticResult.foundationScore >= 0.5 ? 'Developing' : 'Needs Support'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Initial Pace</span>
                      <p className="text-sm font-bold text-cyan-300 capitalize">
                        {diagnosticResult.calculatedPace?.toLowerCase() || 'Comfortable'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Teaching Strategy</span>
                      <p className="text-sm font-bold text-purple-300 capitalize">
                        {diagnosticResult.calculatedStrategy?.replace(/_/g, ' ').toLowerCase() || 'Analogy & Examples'}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-[#182344]">
                    <button
                      onClick={() => setIsDiagnosticOpen(false)}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Done • Continue Learning
                    </button>
                  </div>
                </div>
              ) : diagnosticSession?.questions && diagnosticSession.questions.length > 0 ? (
                /* Question View */
                (() => {
                  const q = diagnosticSession.questions[currentDiagnosticIdx];
                  const qAns = diagnosticAnswers[q.id] || '';
                  const totalQ = diagnosticSession.questions.length;
                  const isLast = currentDiagnosticIdx === totalQ - 1;

                  return (
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                                {q.questionType}
                              </span>
                              <span>{q.topicName}</span>
                            </span>
                            <span>{currentDiagnosticIdx + 1} / {totalQ}</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                              style={{ width: `${((currentDiagnosticIdx + 1) / totalQ) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Question Text */}
                        <div className="p-4 rounded-2xl bg-[#060914] border border-[#1E2A52] space-y-2">
                          <h4 className="text-sm sm:text-base font-bold text-white leading-relaxed">
                            {q.questionText}
                          </h4>
                        </div>

                        {/* Multiple Choice Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              Select an Answer:
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {q.options.map((opt: string) => {
                                const isSelected = qAns.toLowerCase() === opt.toLowerCase();
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => handleDiagnosticAnswerChange(q.id, opt)}
                                    className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                                        : 'bg-[#080D1D] border-[#1E2A52] text-slate-300 hover:border-slate-600 hover:bg-[#0E152E]'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Text Explanation Input */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Or Type Your Answer / Reasoning:
                          </label>
                          <textarea
                            value={qAns}
                            onChange={(e) => handleDiagnosticAnswerChange(q.id, e.target.value)}
                            placeholder="Write your explanation in your own words..."
                            rows={3}
                            className="w-full px-4 py-3 bg-[#060914] border border-[#1E2A52] rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                          />
                        </div>

                        {/* Hint Accordion */}
                        {q.hints && q.hints.length > 0 && (
                          <div className="pt-1">
                            {!revealedHints[q.id] ? (
                              <button
                                onClick={() => setRevealedHints((prev) => ({ ...prev, [q.id]: true }))}
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Need a hint?</span>
                              </button>
                            ) : (
                              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                <span>{q.hints[0]}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Navigation Controls */}
                      <div className="flex items-center justify-between pt-4 border-t border-[#182344]">
                        <button
                          onClick={() => setCurrentDiagnosticIdx((prev) => Math.max(0, prev - 1))}
                          disabled={currentDiagnosticIdx === 0}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Previous
                        </button>

                        {isLast ? (
                          <button
                            onClick={handleSubmitDiagnostic}
                            disabled={isSubmittingDiagnostic || !qAns.trim()}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                          >
                            {isSubmittingDiagnostic ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Calibrating...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Complete Calibration</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => setCurrentDiagnosticIdx((prev) => Math.min(totalQ - 1, prev + 1))}
                            disabled={!qAns.trim()}
                            className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Next Question</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  <p>No questions generated for this classroom yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PHASE 4 MODALS ── */}

        {/* 1. "Why Should I Study This Now?" Modal */}
        {showWhyThisNowModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-[#080D1D] border border-indigo-500/30 p-6 shadow-2xl space-y-5 text-white">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Why Should I Study This Now?</h3>
                    <p className="text-xs text-slate-400">Deterministic Next Best Action rationale</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhyThisNowModal(false)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                    Recommended Action: {nextActionTitle}
                  </div>
                  <p className="text-sm font-semibold text-white">{nextActionSubtitle}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">System Evidence Rationale</h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-[#060914] p-4 rounded-2xl border border-white/5">
                    {canonicalState?.nextBestAction?.rationale || nextActionRationale}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#060914] border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Action Type</span>
                    <p className="font-semibold text-indigo-300">{nextActionType.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#060914] border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Priority Score</span>
                    <p className="font-semibold text-emerald-300">{canonicalState?.nextBestAction?.priorityScore || 90} / 100</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-indigo-500/20">
                <button
                  onClick={() => setShowWhyThisNowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowWhyThisNowModal(false);
                    nextActionClick();
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>Start Action</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. "Set Learning Goal" Modal */}
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl bg-[#080D1D] border border-blue-500/30 p-6 shadow-2xl space-y-5 text-white">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Set Study Goal</h3>
                    <p className="text-xs text-slate-400">ClassPulse adapts pacing and practice depth to your goal</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGoalModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Goal Mode</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'DEEP_MASTERY', label: 'Deep Mastery', desc: 'Solid conceptual depth and challenge' },
                      { id: 'EXAM_PREP', label: 'Exam Prep', desc: 'High-frequency practice & key recall' },
                      { id: 'COURSE_COMPLETION', label: 'Course Progress', desc: 'Steady pacing through syllabus' },
                      { id: 'CUSTOM', label: 'Custom Focus', desc: 'Targeted weakness remediation' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setNewGoalType(m.id)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${
                          newGoalType === m.id
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                            : 'bg-[#060914] border-white/5 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <p className="text-xs font-bold">{m.label}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Goal Title / Note (Optional)</label>
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="e.g. Ace Midterm Exam, Master Recursion"
                    className="w-full px-4 py-2.5 bg-[#060914] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={newGoalDate}
                    onChange={(e) => setNewGoalDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#060914] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-500/20">
                <button
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGoal}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Goal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. "Study With Me" Interactive Adaptive Session Modal */}
        {isStudySessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl rounded-3xl bg-[#080D1D] border border-purple-500/40 p-6 sm:p-8 shadow-2xl space-y-6 text-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold">Study With Me</h3>
                      {activeStudySession && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                          {activeStudySession.currentPhase?.replace(/_/g, ' ') || 'ACTIVE'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Step-by-step adaptive tutoring session • Phase skipping & scaffolding enabled
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStudySessionModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isStudySessionLoading && !studySessionPrompt ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-xs text-slate-400">Initializing adaptive study session...</p>
                </div>
              ) : isStudySessionCompleted ? (
                <div className="p-6 rounded-2xl bg-[#060914] border border-emerald-500/30 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">Study Session Completed! 🎉</h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      Great work! Your evidence has been recorded into the canonical learner profile. Your next best action and frontier have been updated.
                    </p>
                  </div>
                  {studySessionFeedback && (
                    <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/20 text-xs text-purple-200 text-left">
                      <strong className="block text-purple-300 mb-1">Tutor Feedback:</strong>
                      {studySessionFeedback}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setIsStudySessionModalOpen(false);
                      loadDashboardData();
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Tutor Prompt Box */}
                  <div className="p-5 rounded-2xl bg-[#060914] border border-purple-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>ClassPulse Adaptive Tutor</span>
                    </div>
                    <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                      {studySessionPrompt || "Let's review the core concept."}
                    </p>
                  </div>

                  {/* Feedback Box if available */}
                  {studySessionFeedback && (
                    <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
                      <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Previous Step Feedback</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{studySessionFeedback}</p>
                    </div>
                  )}

                  {/* Input Form */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Your Response / Reasoning:
                    </label>
                    <textarea
                      value={studySessionInput}
                      onChange={(e) => setStudySessionInput(e.target.value)}
                      placeholder="Type your explanation or solution here..."
                      rows={4}
                      className="w-full px-4 py-3 bg-[#060914] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-purple-500/20">
                    <button
                      onClick={() => setIsStudySessionModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                    >
                      Exit Session
                    </button>
                    <button
                      onClick={handleStepStudySession}
                      disabled={isStudySessionLoading || !studySessionInput.trim()}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      {isStudySessionLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit & Continue</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1-to-1 Adaptive Learning Frontier Drawer */}
        <StudentLearningDrawer
          classId={currentClassId}
          isOpen={isPersonalPathOpen}
          onClose={() => {
            setIsPersonalPathOpen(false);
            loadDashboardData();
          }}
        />

        {/* Phase 5 Personal Learning Profile (Layer 1) Modal */}
        <PersonalLearningProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            loadDashboardData();
          }}
          onProfileUpdated={(updated) => {
            setPersonalProfile(updated);
            loadDashboardData();
          }}
        />
      </main>
    </div>
  );
}

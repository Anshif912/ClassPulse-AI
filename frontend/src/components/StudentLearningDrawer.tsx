import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Award,
  Clock,
  Send,
  Loader2,
  RefreshCw,
  TrendingUp,
  Flame,
  Check,
  Zap,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import { api } from '../services/api';

interface StudentLearningDrawerProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onAskDoubt?: (question: string) => void;
}

const SUPPORT_LEVEL_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  STRONG_MASTERY: { label: 'Strong Mastery', bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300' },
  READY_FOR_CHALLENGE: { label: 'Ready for Challenge', bg: 'bg-cyan-500/20 border-cyan-500/40', text: 'text-cyan-300' },
  COMFORTABLE: { label: 'Comfortable Pace', bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-300' },
  GUIDED_PRACTICE: { label: 'Guided Practice', bg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-300' },
  NEEDS_REINFORCEMENT: { label: 'Needs Reinforcement', bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-300' },
};

const COGNITIVE_TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FOUNDATION: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  CONCEPT: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  APPLICATION: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  REASONING: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  TRANSFER: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
};

export function StudentLearningDrawer({
  classId,
  isOpen,
  onClose,
  onAskDoubt,
}: StudentLearningDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [topicMasteries, setTopicMasteries] = useState<any[]>([]);
  const [conceptGraph, setConceptGraph] = useState<any>(null);
  const [currentLiveTopicId, setCurrentLiveTopicId] = useState<string>('');
  const [bridge, setBridge] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // Micro-Assessment (Quick Concept Check) State for ACTIVE students
  const [practiceQuestion, setPracticeQuestion] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [dismissedBridge, setDismissedBridge] = useState(false);

  // Diagnostic Calibration State for UNINITIALIZED students
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false);
  const [diagSession, setDiagSession] = useState<any>(null);
  const [diagCurrentIdx, setDiagCurrentIdx] = useState(0);
  const [diagAnswers, setDiagAnswers] = useState<Record<string, string>>({});
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagSubmitting, setDiagSubmitting] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagStartTime, setDiagStartTime] = useState<number>(Date.now());
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && classId) {
      loadPersonalizationData();
    }
  }, [isOpen, classId]);

  const loadPersonalizationData = async () => {
    setLoading(true);
    try {
      const [profileRes, bridgeRes] = await Promise.allSettled([
        api.getLearnerProfile(classId),
        api.getLearningBridge(classId),
      ]);

      if (profileRes.status === 'fulfilled') {
        const data = profileRes.value as any;
        setProfile(data.profile);
        setTopicMasteries(data.topicMasteries || data.masteries || []);
        setConceptGraph(data.conceptGraph);
        setCurrentLiveTopicId(data.currentLiveTopic || data.profile?.currentTopic || '');
        setRecentEvents(data.recentEvents || []);
      }
      if (bridgeRes.status === 'fulfilled') {
        setBridge(bridgeRes.value.bridge);
      }
    } catch (err) {
      console.error('Failed to load learner profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const practiceSectionRef = useRef<HTMLDivElement>(null);

  // ─── MICRO-ASSESSMENT (QUICK CONCEPT CHECK) ──────────────────────────────
  const handleGeneratePractice = async (topicId?: string) => {
    setPracticeLoading(true);
    setEvalResult(null);
    setSelectedOption(null);
    setCustomAnswer('');
    try {
      const targetTopic = topicId || (bridge?.learningDebtGaps?.[0]?.prerequisiteTopicId) || currentLiveTopicId || profile?.currentTopic;
      const res = await api.generateMicroAssessment(classId, targetTopic);
      const q = (res as any)?.question || res;
      setPracticeQuestion(q);
      setTimeout(() => {
        practiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err) {
      console.error('Failed to generate practice:', err);
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleSubmitPractice = async () => {
    if (!practiceQuestion || evaluating) return;
    const answer = selectedOption || customAnswer;
    if (!answer.trim()) return;

    setEvaluating(true);
    try {
      const res = await api.evaluateMicroAssessment(classId, practiceQuestion, answer.trim());
      setEvalResult(res.evaluation);

      // Real-time local state refresh from backend
      const pRes = await api.getLearnerProfile(classId) as any;
      setProfile(pRes.profile);
      setTopicMasteries(pRes.topicMasteries || pRes.masteries || []);
      setRecentEvents(pRes.recentEvents || []);

      // Also refresh bridge
      const bRes = await api.getLearningBridge(classId);
      setBridge(bRes.bridge);
    } catch (err) {
      console.error('Failed to evaluate practice:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // ─── DIAGNOSTIC CALIBRATION (NEW STUDENTS) ────────────────────────────────
  const handleStartDiagnostic = async () => {
    setIsDiagnosticMode(true);
    setDiagLoading(true);
    setDiagResult(null);
    setDiagCurrentIdx(0);
    setDiagStartTime(Date.now());
    try {
      const res = await api.getDiagnosticSuite(classId);
      setDiagSession(res.session);
      if (res.session?.answers) {
        const existingAns: Record<string, string> = {};
        for (const [qId, aData] of Object.entries(res.session.answers as Record<string, any>)) {
          existingAns[qId] = aData.answer;
        }
        setDiagAnswers(existingAns);
      }
      setTimeout(() => {
        practiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err) {
      console.error('Failed to load diagnostic calibration:', err);
    } finally {
      setDiagLoading(false);
    }
  };

  const handleSelectDiagnosticOption = async (questionId: string, answer: string) => {
    setDiagAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (diagSession?.sessionId) {
      try {
        await api.saveDiagnosticAnswer(classId, diagSession.sessionId, {
          questionId,
          answer,
          timeToAnswerMs: Date.now() - diagStartTime,
          hintsUsed: revealedHints[questionId] ? 1 : 0,
        });
      } catch (err) {
        console.error('Failed to save partial answer:', err);
      }
    }
  };

  const handleSubmitDiagnostic = async () => {
    if (!diagSession || diagSubmitting) return;
    setDiagSubmitting(true);
    try {
      const submissions = diagSession.questions.map((q: any) => ({
        questionId: q.id,
        answer: diagAnswers[q.id] || '',
        timeToAnswerMs: Date.now() - diagStartTime,
        hintsUsed: revealedHints[q.id] ? 1 : 0,
      }));

      const res = await api.submitDiagnosticSuite(classId, diagSession.sessionId, submissions);
      setDiagResult(res.summary);
      setProfile(res.profile);
      await loadPersonalizationData();
    } catch (err) {
      console.error('Failed to submit diagnostic calibration:', err);
    } finally {
      setDiagSubmitting(false);
    }
  };

  const handleDismissBridge = async () => {
    setDismissedBridge(true);
    try {
      await api.recordLearningEvent({
        classId,
        topicId: bridge?.learningDebtGaps?.[0]?.prerequisiteTopicId || currentLiveTopicId || 'general',
        category: 'CONFIDENCE_UPDATE',
        metrics: { confidenceScore: 0.85 },
        contextSummary: 'Student marked prerequisite as already known',
      });
    } catch (err) {
      console.error('Failed to record confidence update:', err);
    }
  };

  if (!isOpen) return null;

  const isUninitialized = profile?.profileStatus === 'UNINITIALIZED';
  const support = profile?.supportLevel
    ? (SUPPORT_LEVEL_LABELS[profile.supportLevel] || SUPPORT_LEVEL_LABELS.COMFORTABLE)
    : { label: 'Building Profile', bg: 'bg-indigo-500/20 border-indigo-500/40', text: 'text-indigo-300' };
  const masteryPct = profile ? Math.round(profile.overallMastery * 100) : 0;

  // Identify current topic name
  const currentConcept = conceptGraph?.concepts?.[currentLiveTopicId] ||
    (currentLiveTopicId ? { id: currentLiveTopicId, name: currentLiveTopicId.replace(/_/g, ' '), unit: 'Live Classroom' } : null) ||
    Object.values(conceptGraph?.concepts || {})[0] as any;
  const currentTopicName = currentConcept?.name || (currentLiveTopicId ? currentLiveTopicId.replace(/_/g, ' ') : 'Live Classroom Session');

  // Breakdown of strong vs needs reinforcement
  const strongConcepts = topicMasteries.filter((tm) => tm.masteryScore >= 0.70);
  const reinforcementConcepts = topicMasteries.filter((tm) => tm.masteryScore < 0.65);

  // Compute Next Best Action recommendation
  let nextActionLabel = 'Continue Learning';
  let nextActionHint = 'Follow the live classroom flow';
  let nextActionType: 'practice' | 'bridge' | 'challenge' | 'calibrate' | 'continue' = 'continue';

  if (isUninitialized) {
    nextActionLabel = 'Start Learning Calibration';
    nextActionHint = '5 questions (~2 mins) to establish your baseline cognitive profile';
    nextActionType = 'calibrate';
  } else if (bridge && !bridge.isQuickCatchup && !dismissedBridge && bridge.learningDebtGaps?.length > 0) {
    nextActionLabel = 'Start Quick Catch-Up';
    nextActionHint = `~${bridge.estimatedDurationSec || 60}s bridge on ${bridge.learningDebtGaps[0]?.prerequisiteTopicName || 'prerequisites'}`;
    nextActionType = 'bridge';
  } else if (profile?.supportLevel === 'READY_FOR_CHALLENGE' || profile?.supportLevel === 'STRONG_MASTERY') {
    nextActionLabel = 'Try Challenge Check';
    nextActionHint = 'Solidify deep mastery with an advanced synthesis question';
    nextActionType = 'challenge';
  } else if (reinforcementConcepts.length > 0 || profile?.supportLevel === 'NEEDS_REINFORCEMENT') {
    nextActionLabel = 'Take Quick Concept Check';
    nextActionHint = `Reinforce ${reinforcementConcepts[0]?.topicName || 'core concepts'}`;
    nextActionType = 'practice';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Semi-transparent Backdrop for click-outside close */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      />

      {/* Centered Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0A0F24]/98 border border-white/15 rounded-3xl shadow-2xl flex flex-col text-white overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#070B1B]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-500/30 to-purple-500/30 border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Your Learning</h2>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${support.bg} ${support.text}`}>
                  {isUninitialized ? 'Calibration Required' : support.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Adaptive 1-to-1 Personal Companion & Real-Time Frontier</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close learning modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400">Loading your real-time learning state...</p>
            </div>
          ) : (
            <>
              {/* Top Grid: 2 Columns for Topic Overview & Next Best Action */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. CURRENT TOPIC & PROGRESS OVERVIEW */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 shadow-lg space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Current Live Topic</span>
                      <span className="text-indigo-400">{currentConcept?.unit || 'Course Syllabus'}</span>
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight">{currentTopicName}</h3>
                  </div>

                  {/* Progress Bar & Dimensions */}
                  {!isUninitialized ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-400 font-medium">Topic Mastery</span>
                          <span className="font-bold text-white">{masteryPct}%</span>
                        </div>
                        <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${masteryPct}%` }}
                          />
                        </div>
                      </div>

                      {/* 5 Cognitive Dimensions Grid */}
                      {profile?.foundationMastery !== undefined && (
                        <div className="grid grid-cols-5 gap-1.5 pt-1">
                          {[
                            { label: 'Found.', val: profile.foundationMastery },
                            { label: 'Concept', val: profile.conceptMastery },
                            { label: 'App.', val: profile.applicationMastery },
                            { label: 'Reason.', val: profile.reasoningMastery },
                            { label: 'Transfer', val: profile.transferMastery },
                          ].map((dim, idx) => (
                            <div key={idx} className="text-center p-2 rounded-xl bg-slate-950/60 border border-white/5">
                              <span className="text-[9px] text-slate-400 block truncate">{dim.label}</span>
                              <span className="text-xs font-bold text-indigo-300">
                                {dim.val !== undefined ? `${Math.round(dim.val * 100)}%` : '--'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Strong vs Reinforce summary pills */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 space-y-1">
                          <div className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Strong
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {strongConcepts.length > 0
                              ? strongConcepts.map((c) => c.topicName).join(', ')
                              : 'Building foundations'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5 space-y-1">
                          <div className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Reinforce
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {reinforcementConcepts.length > 0
                              ? reinforcementConcepts.map((c) => c.topicName).join(', ')
                              : 'None! Caught up'}
                          </div>
                        </div>
                      </div>

                      {/* Learning Pace & Strategy */}
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-300 border-t border-white/5">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Learning Pace</span>
                          <span className="font-semibold text-white capitalize">{profile?.preferredPace?.toLowerCase() || 'Comfortable'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">Strategy Style</span>
                          <span className="font-semibold text-white capitalize">
                            {profile?.preferredExplanationStyle?.replace(/_/g, ' ').toLowerCase() || 'Analogy & Example'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-2">
                      <span className="font-bold block text-indigo-300">Calibration Required</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Complete 5 quick questions (~2 mins) spanning 5 cognitive tiers (Foundation, Concept, Application, Reasoning, Transfer) to unlock personalized tutoring.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. NEXT BEST ACTION & MINIMUM LEARNING BRIDGE */}
                <div className="space-y-4 flex flex-col justify-between">
                  {/* Next Best Action Card */}
                  <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" /> Next Best Action
                      </span>
                      <span className="text-[10px] text-indigo-400 font-medium">Auto-Targeted</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-white">{nextActionLabel}</div>
                      <div className="text-xs text-slate-300">{nextActionHint}</div>
                    </div>

                    <button
                      onClick={() => isUninitialized ? handleStartDiagnostic() : handleGeneratePractice()}
                      disabled={practiceLoading || diagLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {practiceLoading || diagLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>{nextActionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Minimum Learning Bridge Card (if active) */}
                  {bridge && !dismissedBridge && !isUninitialized && (
                    <div className={`p-4 rounded-2xl border shadow-lg space-y-2.5 ${
                      bridge.isQuickCatchup
                        ? 'bg-emerald-950/20 border-emerald-500/20'
                        : 'bg-amber-950/20 border-amber-500/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          <span>Live Class Learning Bridge</span>
                        </div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3 text-slate-400" />
                          ~{bridge.estimatedDurationSec || 30}s
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {bridge.bridgeSummary}
                      </p>

                      <div className="pt-1 flex items-center justify-between border-t border-white/5">
                        <span className="text-[10px] text-slate-400">Comfortable with this context?</span>
                        <button
                          onClick={handleDismissBridge}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                        >
                          I already know this
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Section: INTERACTIVE ASSESSMENT CARD (CALIBRATION vs MICRO-CHECK) */}
              <div ref={practiceSectionRef} className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/40 border border-indigo-500/20 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-white">
                      {isUninitialized ? 'Personal Learning Calibration' : 'Quick Concept Check'}
                    </span>
                  </div>
                  
                  {!isUninitialized && !practiceQuestion && (
                    <button
                      onClick={() => handleGeneratePractice()}
                      disabled={practiceLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                    >
                      {practiceLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Start Check</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* A. UNINITIALIZED / DIAGNOSTIC MODE */}
                {isUninitialized || isDiagnosticMode ? (
                  <div className="space-y-4 pt-1">
                    {diagResult ? (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-3 animate-in fade-in">
                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>Calibration Complete! Learner Model Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-white/5 text-slate-300">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Overall Baseline</span>
                            <span className="font-bold text-white text-sm">{Math.round(diagResult.overallScore * 100)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Support Level</span>
                            <span className="font-bold text-emerald-300 text-sm">{diagResult.calculatedSupportLevel}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setIsDiagnosticMode(false);
                            setDiagResult(null);
                            handleGeneratePractice();
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Start First Concept Check</span>
                        </button>
                      </div>
                    ) : diagSession && diagSession.questions ? (
                      <div className="space-y-4">
                        {/* Step Header */}
                        {(() => {
                          const currentQ = diagSession.questions[diagCurrentIdx];
                          const tierColor = COGNITIVE_TIER_COLORS[currentQ?.questionType] || COGNITIVE_TIER_COLORS.FOUNDATION;
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${tierColor.bg} ${tierColor.text} ${tierColor.border}`}>
                                  Tier: {currentQ?.questionType}
                                </span>
                                <span className="text-slate-400 text-xs font-medium">
                                  Question {diagCurrentIdx + 1} of {diagSession.questions.length}
                                </span>
                              </div>

                              <div className="text-sm text-white font-medium bg-slate-950/70 p-4 rounded-2xl border border-white/10 leading-relaxed">
                                {currentQ?.questionText}
                              </div>

                              {/* Options */}
                              {currentQ?.options && currentQ.options.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {currentQ.options.map((opt: string, idx: number) => {
                                    const isSelected = diagAnswers[currentQ.id] === opt;
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => handleSelectDiagnosticOption(currentQ.id, opt)}
                                        disabled={diagSubmitting}
                                        className={`w-full text-left p-3 rounded-xl text-xs transition-all border cursor-pointer ${
                                          isSelected
                                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium shadow-md'
                                            : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-slate-950/80 hover:border-white/10'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <textarea
                                  value={diagAnswers[currentQ?.id] || ''}
                                  onChange={(e) => handleSelectDiagnosticOption(currentQ.id, e.target.value)}
                                  placeholder="Explain your answer in your own words..."
                                  disabled={diagSubmitting}
                                  className="w-full h-24 p-3 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                              )}

                              {/* Nav Buttons */}
                              <div className="flex items-center justify-between pt-2 gap-3">
                                <button
                                  onClick={() => setDiagCurrentIdx((prev) => Math.max(0, prev - 1))}
                                  disabled={diagCurrentIdx === 0 || diagSubmitting}
                                  className="px-4 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors cursor-pointer"
                                >
                                  Previous
                                </button>

                                {diagCurrentIdx < diagSession.questions.length - 1 ? (
                                  <button
                                    onClick={() => setDiagCurrentIdx((prev) => Math.min(diagSession.questions.length - 1, prev + 1))}
                                    disabled={!diagAnswers[currentQ?.id] || diagSubmitting}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Next</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={handleSubmitDiagnostic}
                                    disabled={diagSubmitting || Object.keys(diagAnswers).length === 0}
                                    className="px-6 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {diagSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    <span>Submit Calibration</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 space-y-3 text-center">
                        <p className="text-slate-300 leading-relaxed max-w-lg mx-auto">
                          Personal Learning Calibration establishes your baseline mastery across 5 cognitive tiers (Foundation, Concept, Application, Reasoning, Transfer).
                        </p>
                        <button
                          onClick={handleStartDiagnostic}
                          disabled={diagLoading}
                          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {diagLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          <span>Start Calibration (~2 mins)</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* B. ACTIVE STUDENT: QUICK CONCEPT CHECK */
                  practiceQuestion ? (
                    <div className="space-y-4 pt-1">
                      <div className="text-sm text-white font-medium bg-slate-950/70 p-4 rounded-2xl border border-white/10 leading-relaxed">
                        {practiceQuestion.questionText}
                      </div>

                      {practiceQuestion.options && practiceQuestion.options.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {practiceQuestion.options.map((opt: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedOption(opt)}
                              disabled={evaluating || evalResult !== null}
                              className={`w-full text-left p-3 rounded-xl text-xs transition-all border cursor-pointer ${
                                selectedOption === opt
                                  ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium shadow-md'
                                  : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-slate-950/80 hover:border-white/10'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={customAnswer}
                          onChange={(e) => setCustomAnswer(e.target.value)}
                          placeholder="Type your explanation in your own words..."
                          disabled={evaluating || evalResult !== null}
                          className="w-full h-24 p-3 rounded-xl bg-slate-950/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      )}

                      {!evalResult ? (
                        <button
                          onClick={handleSubmitPractice}
                          disabled={evaluating || (!selectedOption && !customAnswer.trim())}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all shadow-lg cursor-pointer"
                        >
                          {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{evaluating ? 'Evaluating Answer...' : 'Submit Answer'}</span>
                        </button>
                      ) : (
                        <div className={`p-4 rounded-xl border space-y-2.5 ${
                          evalResult.isCorrect
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                            : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        }`}>
                          <div className="flex items-center gap-2 text-xs font-bold">
                            {evalResult.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <HelpCircle className="w-4 h-4 text-amber-400" />}
                            <span>{evalResult.isCorrect ? 'Correct! Mastery Promoted' : 'Good Attempt! Review Insight'}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-300">{evalResult.feedback}</p>
                          <button
                            onClick={() => handleGeneratePractice()}
                            disabled={practiceLoading}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors pt-1 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${practiceLoading ? 'animate-spin' : ''}`} />
                            <span>Try Next Adaptive Question</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center space-y-2">
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Concept checks adapt dynamically to your progress, testing causal mechanisms and updating your tutoring style.
                      </p>
                      <button
                        onClick={() => handleGeneratePractice()}
                        disabled={practiceLoading}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {practiceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Generate Check Question</span>
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Bottom Section: LEARNING JOURNEY (Recent Milestones) */}
              {recentEvents && recentEvents.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-950/50 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <TrendingUp className="w-4 h-4" /> Learning Journey
                    </span>
                    <span>Recent Milestones</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {recentEvents.slice(0, 6).map((ev: any, idx: number) => {
                      const isSuccess = ev.metrics?.isCorrect === true || (ev.metrics?.score && ev.metrics.score >= 0.7);
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                          <div className="flex items-center gap-2 truncate">
                            {isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            )}
                            <span className="text-slate-200 capitalize truncate text-[11px]">
                              {ev.contextSummary || `${ev.category.replace(/_/g, ' ').toLowerCase()}: ${ev.topicId.replace(/_/g, ' ')}`}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

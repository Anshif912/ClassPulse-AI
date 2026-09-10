import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Clock,
  Brain,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Award,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import {
  PersonalLearningProfile,
  ProfileCalibrationSession,
  EstimatedStudyTimeResult,
} from '../types';

interface PersonalLearningProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: PersonalLearningProfile) => void;
}

export const PersonalLearningProfileModal: React.FC<PersonalLearningProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<PersonalLearningProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calibration Session State
  const [activeSession, setActiveSession] = useState<ProfileCalibrationSession | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [readingTimer, setReadingTimer] = useState<number>(0);
  const [isReadingActive, setIsReadingActive] = useState<boolean>(false);
  const [isSubmittingStep, setIsSubmittingStep] = useState<boolean>(false);

  // Interactive Estimator Widget State
  const [estimatorWordCount, setEstimatorWordCount] = useState<number>(2500);
  const [estimatorComplexity, setEstimatorComplexity] = useState<'INTRODUCTORY' | 'MODERATE' | 'ADVANCED'>('MODERATE');
  const [estimatorConcepts, setEstimatorConcepts] = useState<number>(5);
  const [liveEstimate, setLiveEstimate] = useState<EstimatedStudyTimeResult | null>(null);
  const [isCalculatingEstimate, setIsCalculatingEstimate] = useState(false);

  // Active view: 'PROFILE' | 'CALIBRATION'
  const [viewMode, setViewMode] = useState<'PROFILE' | 'CALIBRATION'>('PROFILE');

  // Load profile and check for any active in-progress calibration session on open
  useEffect(() => {
    if (!isOpen) return;
    loadProfileAndActiveSession();
  }, [isOpen]);

  const loadProfileAndActiveSession = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [profRes, activeCalRes] = await Promise.allSettled([
        api.personalization.getPersonalLearningProfile(),
        api.personalization.getActivePersonalCalibration(),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value?.profile) {
        setProfile(profRes.value.profile);
      }

      // Check if there was an in-progress session to resume
      if (activeCalRes.status === 'fulfilled' && activeCalRes.value?.session) {
        const session = activeCalRes.value.session;
        if (session.status === 'IN_PROGRESS') {
          setActiveSession(session);
          const resumeIdx = session.currentTaskIndex || 0;
          setCurrentStepIdx(resumeIdx);
          
          // Restore prior answer if present
          const existingSub = session.submissions?.find((s: any) => s.taskId === session.tasks[resumeIdx]?.taskId);
          if (existingSub?.selectedOptionId) {
            setSelectedOption(existingSub.selectedOptionId);
          } else {
            setSelectedOption('');
          }

          if (session.tasks[resumeIdx]?.taskType === 'READING_SPEED') {
            setReadingTimer(0);
            setIsReadingActive(true);
          } else {
            setIsReadingActive(false);
          }
          setViewMode('CALIBRATION');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load personal learning profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic estimate calculation
  useEffect(() => {
    if (!profile) return;

    let isMounted = true;
    const computeEstimate = async () => {
      try {
        setIsCalculatingEstimate(true);
        const res = await api.personalization.estimateStudyTime({
          wordCount: estimatorWordCount,
          conceptCount: estimatorConcepts,
          contentComplexity: estimatorComplexity,
        });
        if (isMounted && res && res.estimate) {
          setLiveEstimate(res.estimate);
        }
      } catch (err) {
        console.warn('Estimate error:', err);
      } finally {
        if (isMounted) setIsCalculatingEstimate(false);
      }
    };

    const timer = setTimeout(computeEstimate, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [profile, estimatorWordCount, estimatorComplexity, estimatorConcepts]);

  // Reading task timer
  useEffect(() => {
    let interval: any = null;
    if (isReadingActive) {
      interval = setInterval(() => {
        setReadingTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isReadingActive]);

  // Start Calibration
  const handleStartCalibration = async () => {
    try {
      setIsLoading(true);
      const res = await api.personalization.startPersonalCalibration();
      if (res && res.session) {
        setActiveSession(res.session);
        const startIdx = res.session.currentTaskIndex || 0;
        setCurrentStepIdx(startIdx);
        setSelectedOption('');
        setReadingTimer(0);
        if (res.session.tasks[startIdx]?.taskType === 'READING_SPEED') {
          setIsReadingActive(true);
        }
        setViewMode('CALIBRATION');
      }
    } catch (err: any) {
      setError(err.message || 'Could not start calibration');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Step
  const handleSubmitStep = async () => {
    if (!activeSession) return;
    const task = activeSession.tasks[currentStepIdx];
    if (!task) return;

    const timeSpent = task.taskType === 'READING_SPEED' ? Math.max(10, readingTimer) : 15;

    try {
      setIsSubmittingStep(true);
      setIsReadingActive(false);

      const submission = {
        taskId: task.taskId,
        selectedOptionId: selectedOption || undefined,
        timeSpentSeconds: timeSpent,
        submittedAt: new Date().toISOString(),
      };

      const stepRes = await api.personalization.submitPersonalCalibrationStep(activeSession.sessionId, submission);
      if (stepRes?.session) {
        setActiveSession(stepRes.session);
      }

      if (currentStepIdx < activeSession.tasks.length - 1) {
        const nextIdx = currentStepIdx + 1;
        setCurrentStepIdx(nextIdx);
        setSelectedOption('');
        if (activeSession.tasks[nextIdx]?.taskType === 'READING_SPEED') {
          setReadingTimer(0);
          setIsReadingActive(true);
        }
      } else {
        // Complete session
        const compRes = await api.personalization.completePersonalCalibration(activeSession.sessionId);
        if (compRes && compRes.profile) {
          setProfile(compRes.profile);
          setViewMode('PROFILE');
          if (onProfileUpdated) {
            onProfileUpdated(compRes.profile);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit step');
    } finally {
      setIsSubmittingStep(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">My Personal Learning Profile</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                  Layer 1 • Cross-Course
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Course-independent baseline signals used to tailor study pacing and explanation strategies across all your classes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-900/30 border border-red-500/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Loading learning profile calibration...</p>
            </div>
          ) : viewMode === 'CALIBRATION' && activeSession ? (
            
            /* ─── CALIBRATION 5-STEP FLOW ─── */
            <div className="space-y-6">
              {/* Step indicator */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  {activeSession.tasks.map((t, idx) => (
                    <div
                      key={t.taskId}
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        idx === currentStepIdx
                          ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 scale-105'
                          : idx < currentStepIdx
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {idx < currentStepIdx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {currentStepIdx > 0 && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      ● Resumed in-progress
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-400">
                    Step {currentStepIdx + 1} of {activeSession.tasks.length}: {activeSession.tasks[currentStepIdx]?.title}
                  </span>
                </div>
              </div>

              {/* Active Task Card */}
              {(() => {
                const task = activeSession.tasks[currentStepIdx];
                if (!task) return null;

                return (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-6 space-y-5">
                    <div>
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{task.instructions}</p>
                    </div>

                    {/* Task Content: Reading passage vs Question */}
                    {task.taskType === 'READING_SPEED' ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/60 text-slate-200 text-sm leading-relaxed max-h-60 overflow-y-auto font-serif">
                          {task.content}
                        </div>
                        <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span>Reading timer: <strong>{readingTimer}s</strong></span>
                          </div>
                          <span>Passage word count: <strong>142 words</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-200 text-sm font-medium">
                          {task.content}
                        </div>

                        {task.options && (
                          <div className="grid grid-cols-1 gap-2.5">
                            {task.options.map((opt) => (
                              <button
                                key={opt.optionId}
                                onClick={() => setSelectedOption(opt.optionId)}
                                className={`text-left p-3.5 rounded-xl border text-sm transition-all flex items-start gap-3 ${
                                  selectedOption === opt.optionId
                                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100 shadow-md shadow-cyan-500/10'
                                    : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                                  selectedOption === opt.optionId
                                    ? 'border-cyan-400 bg-cyan-500 text-slate-950 font-bold'
                                    : 'border-slate-600 text-slate-400'
                                }`}>
                                  {selectedOption === opt.optionId ? '✓' : ''}
                                </span>
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step Action Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSubmitStep}
                        disabled={
                          isSubmittingStep ||
                          (task.taskType !== 'READING_SPEED' && !selectedOption)
                        }
                        className="px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                      >
                        {isSubmittingStep ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {task.taskType === 'READING_SPEED' ? 'I finished reading' : 'Confirm & Continue'}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : profile ? (
            
            /* ─── PROFILE DASHBOARD VIEW ─── */
            <div className="space-y-6">
              
              {/* Banner: Calibrated vs Uncalibrated */}
              {profile.status === 'UNCALIBRATED' ? (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                      <Sparkles className="w-4 h-4" />
                      Ready for 2-Minute Personal Calibration
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                      Take our 5-question baseline check to calibrate your reading pace and explanation preferences. This tailors study times and AI explanations across all your classes.
                    </p>
                  </div>
                  <button
                    onClick={handleStartCalibration}
                    className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-md shadow-cyan-500/20 transition-all shrink-0 flex items-center gap-2"
                  >
                    Start 5-Task Calibration
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <div className="text-xs font-semibold text-emerald-400">Calibrated Profile Active</div>
                      <div className="text-[11px] text-slate-400">
                        Calibrated: {profile.calibratedAt ? new Date(profile.calibratedAt).toLocaleDateString() : 'Active'} • Cognitive Checks: {profile.behavioralEvidenceCount || 0} • Study Telemetry: {profile.studyDurationObservationCount || 0}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleStartCalibration}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Recalibrate Profile
                  </button>
                </div>
              )}

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Reading Pace */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      Reading Pace
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      profile.status === 'CALIBRATED'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {profile.status === 'CALIBRATED' ? profile.readingPaceLevel : 'Not calibrated'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {profile.status === 'CALIBRATED' && profile.readingSpeedWpm ? (
                      <>
                        {profile.readingSpeedWpm} <span className="text-xs font-normal text-slate-400">WPM</span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-slate-400">Not calibrated yet</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {profile.status === 'CALIBRATED'
                      ? profile.rationales?.readingPaceRationale
                      : 'Take the 2-minute reading check to measure your natural reading pace.'}
                  </p>
                </div>

                {/* 2. Assistance Requirement */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      Support Needs
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      profile.status === 'CALIBRATED'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {profile.status === 'CALIBRATED' ? profile.assistanceLevel.replace('_', ' ') : 'Standard'}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {profile.status === 'CALIBRATED'
                      ? profile.assistanceLevel === 'EXTENSIVE_SUPPORT'
                        ? 'Guided Scaffolding'
                        : profile.assistanceLevel === 'INDEPENDENT_CHALLENGE'
                        ? 'Self-Directed Challenge'
                        : 'Balanced Guidance'
                      : 'Standard Scaffolding Baseline'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {profile.status === 'CALIBRATED'
                      ? profile.rationales?.assistanceLevelRationale
                      : 'Initial scaffolding applied; dynamically adapts as you answer questions in live class.'}
                  </p>
                </div>

                {/* 3. Preferred Teaching Style */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Initial Preference
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {profile.preferredInitialStyle.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-200">
                    {profile.preferredInitialStyle === 'ANALOGY_HEAVY'
                      ? 'Analogy-First Explanations'
                      : profile.preferredInitialStyle === 'PRACTICE_FIRST'
                      ? 'Practice & Active Challenges'
                      : profile.preferredInitialStyle === 'EXAMPLE_FIRST'
                      ? 'Worked Examples'
                      : 'Step-by-Step Concepts'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {profile.status === 'CALIBRATED'
                      ? profile.rationales?.preferredStyleRationale
                      : 'Initial preference; AI tutor adapts whenever direct explanations or practice prove more effective.'}
                  </p>
                </div>

              </div>

              {/* Dynamic Study Time Estimator Tool */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-semibold text-white">Dynamic Lesson Study Time Estimator</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {profile.status === 'CALIBRATED' && profile.readingSpeedWpm
                      ? `Adaptive formula powered by your reading pace (${profile.readingSpeedWpm} WPM)`
                      : 'Early baseline estimate pending reading pace calibration'}
                  </span>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  
                  {/* Word count slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Lesson Length:</span>
                      <span className="font-semibold text-cyan-300">{estimatorWordCount} words (~{Math.round(estimatorWordCount / 250)} pages)</span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={6000}
                      step={250}
                      value={estimatorWordCount}
                      onChange={(e) => setEstimatorWordCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Complexity selector */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Complexity:</span>
                      <span className="font-semibold text-cyan-300">{estimatorComplexity}</span>
                    </div>
                    <select
                      value={estimatorComplexity}
                      onChange={(e) => setEstimatorComplexity(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="INTRODUCTORY">Introductory (Foundational)</option>
                      <option value="MODERATE">Moderate (Standard Syllabus)</option>
                      <option value="ADVANCED">Advanced (Deep Technical)</option>
                    </select>
                  </div>

                  {/* Concepts count */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Key Concepts:</span>
                      <span className="font-semibold text-cyan-300">{estimatorConcepts} concepts</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={estimatorConcepts}
                      onChange={(e) => setEstimatorConcepts(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                </div>

                {/* Estimate Result Display */}
                {liveEstimate && (
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/20 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-xs text-slate-400">Predicted Study & Mastery Duration:</div>
                      <div className="text-2xl font-extrabold text-cyan-300 flex items-center gap-1.5">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        ~{liveEstimate.estimatedMinutes} minutes
                      </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div>
                        <div className="text-slate-500">Base Reading</div>
                        <div className="font-semibold text-slate-300">{liveEstimate.breakdown.baseReadingMinutes} min</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Comprehension Depth</div>
                        <div className="font-semibold text-slate-300">+{liveEstimate.breakdown.comprehensionProcessingMinutes} min</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Concept Integration</div>
                        <div className="font-semibold text-slate-300">+{liveEstimate.breakdown.conceptIntegrationMinutes} min</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Review & Mastery</div>
                        <div className="font-semibold text-slate-300">+{liveEstimate.breakdown.masteryGapReviewMinutes} min</div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      {liveEstimate.rationale}
                    </p>
                  </div>
                )}

              </div>

              {/* Privacy & Transparency Safeguards */}
              <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-800/80 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-slate-400">
                  <div className="font-semibold text-slate-300">Privacy & Continuous Adaptation Guarantee</div>
                  <p>
                    Your reading pace and individual calibration answers are strictly private to you. Teachers only view anonymous cohort-level aggregates. Your study estimates continuously refine as you finish real study sessions.
                  </p>
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>ClassPulse AI Personalization Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

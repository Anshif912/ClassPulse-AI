import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Users,
  Compass,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Brain,
  Layers,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';

interface TeacherAnalyticsModalProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TeacherAnalyticsModal({
  classId,
  isOpen,
  onClose,
}: TeacherAnalyticsModalProps) {
  const [loading, setLoading] = useState(true);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [conceptGraph, setConceptGraph] = useState<any>(null);
  const [updatingFrontier, setUpdatingFrontier] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  useEffect(() => {
    if (isOpen && classId) {
      loadTeacherIntelligence();
    }
  }, [isOpen, classId]);

  const loadTeacherIntelligence = async () => {
    setLoading(true);
    try {
      const res = await api.getTeacherInsights(classId);
      setIntelligence(res.intelligence);
      setState(res.state);
      setConceptGraph(res.conceptGraph);
      setSelectedTopic(res.state?.currentLiveTopic || '');
    } catch (err) {
      console.error('Failed to load teacher analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLiveTopic = async (topicId: string) => {
    setUpdatingFrontier(true);
    try {
      const res = await api.updateClassroomFrontier(classId, topicId);
      setState(res.state);
      setSelectedTopic(topicId);
      // Reload insights
      const iRes = await api.getTeacherInsights(classId);
      setIntelligence(iRes.intelligence);
    } catch (err) {
      console.error('Failed to update live topic:', err);
    } finally {
      setUpdatingFrontier(false);
    }
  };

  if (!isOpen) return null;

  const supportDist = intelligence?.supportDistribution || {};
  const totalStudents = intelligence?.totalActiveStudents || 0;
  const concepts = conceptGraph?.concepts ? Object.values(conceptGraph.concepts) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-500/30 to-purple-500/30 border border-indigo-500/30">
              <Brain className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Classroom Learning Intelligence</h2>
              <p className="text-xs text-slate-400">Real-time aggregated concept mastery & cohort support needs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs text-slate-400">Compiling live classroom analytics...</p>
            </div>
          ) : (
            <>
              {/* Cohort Support Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-300">Strong Mastery</div>
                  <div className="text-2xl font-bold text-white mt-1">{supportDist.STRONG_MASTERY || 0}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Students thriving</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
                  <div className="text-[11px] font-medium text-cyan-300">Ready for Challenge</div>
                  <div className="text-2xl font-bold text-white mt-1">{supportDist.READY_FOR_CHALLENGE || 0}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Need extensions</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/20">
                  <div className="text-[11px] font-medium text-blue-300">Comfortable Pace</div>
                  <div className="text-2xl font-bold text-white mt-1">{supportDist.COMFORTABLE || 0}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">On track</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/20">
                  <div className="text-[11px] font-medium text-amber-300">Guided / Reinforce</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {(supportDist.GUIDED_PRACTICE || 0) + (supportDist.NEEDS_REINFORCEMENT || 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Receiving auto-bridges</div>
                </div>
              </div>

              {/* Live Topic Controller */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Live Classroom Topic Frontier</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Current: <span className="text-amber-300 font-semibold">{state?.currentLiveTopic || 'Not set'}</span></span>
                </div>

                <p className="text-xs text-slate-300">
                  Select which syllabus concept you are actively discussing in class. ClassPulse automatically adapts late-joining student bridges and micro-assessments to this topic.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {concepts.map((c: any) => {
                    const isCurrent = state?.currentLiveTopic === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleUpdateLiveTopic(c.id)}
                        disabled={updatingFrontier || isCurrent}
                        className={`p-2.5 rounded-xl text-left text-xs transition-all border flex items-center justify-between ${
                          isCurrent
                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-950/40 border-white/5 text-slate-300 hover:bg-slate-950/70'
                        }`}
                      >
                        <span className="truncate pr-2">{c.name}</span>
                        {isCurrent && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Identified Prerequisite Gaps Across Class */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold text-white">Cohort Prerequisite Bottlenecks</span>
                </div>

                {intelligence?.topPrerequisiteGaps && intelligence.topPrerequisiteGaps.length > 0 ? (
                  <div className="space-y-2">
                    {intelligence.topPrerequisiteGaps.map((gap: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-200 font-medium">{gap.topicName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{gap.affectedStudentsCount} students affected</span>
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-bold text-[10px]">
                            {gap.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No severe prerequisite bottlenecks detected across current active students.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

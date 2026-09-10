import { dbService } from '../db.service';
import { conceptGraphService } from './conceptGraphService';
import { learnerModelService } from './learnerModelService';
import { studentLearningStateService } from './studentLearningStateService';
import { teachingStrategyEngine } from './teachingStrategyEngine';
import { personalLearningProfileService } from './personalLearningProfileService';
import { answerEvaluatorService, AnswerEvaluationResult } from './answerEvaluatorService';
import {
  StudyMode,
  StudyGoal,
  StudyGoalType,
  StudyPlan,
  StudyPlanSequenceStep,
  StudySessionState,
  StudySessionPhase,
  LearningEventRecord,
  StudentLearningState,
} from './types';

export class StudyAssistantService {
  /**
   * Starts an adaptive "Study With Me" session.
   * Dynamically plans phase sequence based on student's current learning state (e.g. skips phases for advanced learners).
   */
  public startStudySession(
    classId: string,
    studentId: string,
    topicId?: string,
    mode: StudyMode = 'STUDY'
  ): { session: StudySessionState; prompt: string; expectedInputType: 'TEXT' | 'MCQ' | 'CHOICE' } {
    const upperClassId = classId.toUpperCase();
    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);

    const liveConcept = liveState?.currentLiveTopic ? graph.concepts[liveState.currentLiveTopic] : null;
    const maxAllowedOrder = liveConcept ? liveConcept.order : 999;

    let targetTopicId = topicId || state.nextBestAction.topicId || state.personalFrontier;
    let concept = graph.concepts[targetTopicId] || conceptGraphService.matchTopicFromQuery(targetTopicId, upperClassId);

    // Server-side enforcement: Clamp any future topic request to active learning frontier
    if (concept && concept.order > maxAllowedOrder) {
      targetTopicId = liveConcept?.id || state.currentLiveTopic;
      concept = liveConcept || graph.concepts[targetTopicId] || Object.values(graph.concepts)[0];
    }

    const targetTopicName = concept?.name || targetTopicId;
    const topicMastery = state.topicMasteries[targetTopicId]?.masteryScore ?? state.overallMastery;
    const hasDebt = state.learningDebt.length > 0;

    // Dynamically compose planned phases
    let plannedPhases: StudySessionPhase[] = [];
    if (topicMastery >= 0.75) {
      // Advanced: Skip basic explanation & guided practice directly to challenge
      plannedPhases = ['RECALL', 'CHALLENGE', 'MASTERY_CHECK', 'NEXT_ACTION'];
    } else if (hasDebt || topicMastery < 0.50) {
      // Developing: Prerequisite repair + layered explanation + guided practice
      plannedPhases = ['RECALL', 'PREREQUISITE_REPAIR', 'EXPLANATION', 'GUIDED_PRACTICE', 'MASTERY_CHECK', 'NEXT_ACTION'];
    } else {
      // Standard progression
      plannedPhases = ['RECALL', 'EXPLANATION', 'GUIDED_PRACTICE', 'MASTERY_CHECK', 'NEXT_ACTION'];
    }

    // Close any previous active/unfinished study session for this student in this class
    const uncompleted = Object.values((dbService as any).data.studySessions).filter(
      (s: any) => s.classId.toUpperCase() === upperClassId && s.studentId === studentId && !s.completedAt
    );
    uncompleted.forEach((s: any) => {
      s.completedAt = new Date().toISOString();
      dbService.saveStudySession(s);
    });

    const sessionId = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: StudySessionState = {
      sessionId,
      studentId,
      classId: upperClassId,
      topicId: targetTopicId,
      topicName: targetTopicName,
      goalId: state.learningGoal?.id,
      mode,
      plannedPhases,
      currentPhaseIndex: 0,
      currentPhase: plannedPhases[0],
      completedPhases: [],
      phaseArtifacts: {},
      score: 0,
      startedAt: new Date().toISOString(),
    };

    const initialPrompt = this.generatePhasePrompt(session, state, concept);
    session.phaseArtifacts[plannedPhases[0]] = {
      prompt: initialPrompt.prompt,
      expectedInputType: initialPrompt.expectedInputType,
      generatedAt: new Date().toISOString(),
    };

    dbService.saveStudySession(session);
    return { session, prompt: initialPrompt.prompt, expectedInputType: initialPrompt.expectedInputType };
  }

  /**
   * Steps the study session forward with the student's answer or confirmation.
   * Semantic LLM evaluation is performed, learning evidence is fused, and the next pedagogical prompt adapts dynamically.
   */
  public async stepStudySession(
    classId: string,
    studentId: string,
    sessionId: string,
    studentResponse: string,
    timeToAnswerMs?: number
  ): Promise<{ session: StudySessionState; feedback: string; evaluation?: AnswerEvaluationResult; nextPrompt?: string; expectedInputType?: 'TEXT' | 'MCQ' | 'CHOICE'; isCompleted: boolean }> {
    const upperClassId = classId.toUpperCase();
    let session = dbService.getStudySession(sessionId);
    if (!session) {
      throw new Error(`Study session ${sessionId} not found`);
    }

    // Guard against duplicate submissions on already completed sessions
    if (session.completedAt || session.currentPhaseIndex >= session.plannedPhases.length) {
      return {
        session,
        feedback: `Session already completed on ${session.topicName}.`,
        nextPrompt: undefined,
        isCompleted: true,
      };
    }

    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const concepts = graph?.concepts || {};
    const concept = concepts[session.topicId] || Object.values(concepts)[0];
    const currentPhase = session.currentPhase;
    const currentArtifact = session.phaseArtifacts[currentPhase] || {};

    // ─── 1. Determine Question Type for Evaluator ──────────────────────────────
    let questionType: any = 'OPEN_ENDED';
    if (currentArtifact.expectedInputType === 'CHOICE' || currentPhase === 'PREREQUISITE_REPAIR' || currentPhase === 'NEXT_ACTION') {
      questionType = 'CHOICE';
    } else if (currentPhase === 'CHALLENGE') {
      questionType = 'TRANSFER';
    } else if (currentPhase === 'GUIDED_PRACTICE') {
      questionType = 'APPLICATION';
    } else if (currentPhase === 'RECALL' || currentPhase === 'MASTERY_CHECK') {
      questionType = 'SHORT_ANSWER';
    }

    // ─── 2. Evaluate Student Response via AnswerEvaluationService ─────────────
    const expectedPoints = (concept?.keyTerms && concept.keyTerms.length > 0)
      ? concept.keyTerms
      : [session.topicName, concept?.summary || ''];
    const evalResult: AnswerEvaluationResult = await answerEvaluatorService.evaluate({
      classId: upperClassId,
      studentId,
      question: currentArtifact.prompt || `Explain key concepts of ${session.topicName}`,
      questionType,
      expectedAnswer: expectedPoints,
      studentAnswer: studentResponse,
      currentTopic: session.topicId,
      topicName: session.topicName,
      timeToAnswerMs,
    });

    const isCorrect = evalResult.correctness >= 0.70;
    const phaseScore = evalResult.correctness;

    session.score += phaseScore;
    session.completedPhases.push(currentPhase);
    session.phaseArtifacts[currentPhase] = {
      ...currentArtifact,
      studentResponse,
      score: phaseScore,
      evaluation: evalResult,
      evaluatedAt: new Date().toISOString(),
    };

    // ─── 3. Log Authentic Multi-Dimensional LearningEvent ─────────────────────
    const event: LearningEventRecord = {
      id: `le_study_${session.sessionId}_${currentPhase}_${Date.now()}`,
      studentId,
      classId: upperClassId,
      topicId: session.topicId,
      category: 'STUDY_SESSION',
      metrics: {
        isCorrect,
        score: phaseScore,
        conceptUnderstanding: evalResult.conceptUnderstanding,
        reasoningQuality: evalResult.reasoningQuality,
        application: evalResult.application,
        transfer: evalResult.transfer,
        timeToAnswerMs: timeToAnswerMs || 10000,
        attemptsCount: 1,
      },
      contextSummary: `Study Session (${session.mode}) Phase: ${currentPhase} on ${session.topicName} — ${evalResult.evidenceSummary}`,
      timestamp: new Date().toISOString(),
    };
    dbService.recordLearningEvent(event);
    learnerModelService.processLearningEvent(event);

    // ─── 4. Misconception Lifecycle Management ────────────────────────────────
    if (evalResult.misconceptionDetected && evalResult.misconception) {
      dbService.recordMisconceptionOccurrence(
        upperClassId,
        studentId,
        session.topicId,
        session.topicName,
        'concept_misconception',
        evalResult.misconception
      );
    } else if (isCorrect && (currentPhase === 'MASTERY_CHECK' || currentPhase === 'GUIDED_PRACTICE' || currentPhase === 'CHALLENGE')) {
      // Resolve active misconception upon demonstrated mastery
      dbService.resolveMisconception(upperClassId, studentId, session.topicId);
    }

    // Invalidate canonical state so downstream consumers get fresh computed state
    studentLearningStateService.invalidateState(upperClassId, studentId);

    // ─── 5. Dynamic Phase Adaptation ──────────────────────────────────────────
    // If a clear misconception was detected during RECALL/EXPLANATION and PREREQUISITE_REPAIR isn't next, insert it
    if (evalResult.recommendedPedagogicalAction === 'REPAIR' && !session.plannedPhases.includes('PREREQUISITE_REPAIR') && session.currentPhaseIndex < session.plannedPhases.length - 1) {
      session.plannedPhases.splice(session.currentPhaseIndex + 1, 0, 'PREREQUISITE_REPAIR');
    }

    // Advance to next phase
    session.currentPhaseIndex += 1;
    if (session.currentPhaseIndex >= session.plannedPhases.length) {
      session.completedAt = new Date().toISOString();
      dbService.saveStudySession(session);

      // Layer 1 model feedback: update dynamic duration prediction model from actual telemetry
      try {
        const actualMinutes = Math.max(
          1,
          Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
        );
        const predictedEst = personalLearningProfileService.estimateStudyDuration(studentId);
        personalLearningProfileService.recordActualStudyDuration(
          studentId,
          predictedEst.estimatedMinutes ?? predictedEst.estimatedMinutesMin ?? 15,
          actualMinutes
        );
      } catch (err) {
        console.warn('[STUDY_ASSISTANT] Could not record actual study duration feedback:', err);
      }

      return {
        session,
        feedback: evalResult.feedback || `Great work! You completed your ${session.mode} session on ${session.topicName}.`,
        evaluation: evalResult,
        nextPrompt: undefined,
        isCompleted: true,
      };
    }

    const nextPhase = session.plannedPhases[session.currentPhaseIndex];
    session.currentPhase = nextPhase;
    const nextPhaseData = this.generateAdaptivePhasePrompt(session, state, concept, evalResult);
    session.phaseArtifacts[nextPhase] = {
      prompt: nextPhaseData.prompt,
      expectedInputType: nextPhaseData.expectedInputType,
      generatedAt: new Date().toISOString(),
    };

    dbService.saveStudySession(session);

    return {
      session,
      feedback: evalResult.feedback,
      evaluation: evalResult,
      nextPrompt: nextPhaseData.prompt,
      expectedInputType: nextPhaseData.expectedInputType,
      isCompleted: false,
    };
  }

  /**
   * Generates phase-specific prompts adaptive to previous answer evaluation and pedagogical action.
   */
  private generateAdaptivePhasePrompt(
    session: StudySessionState,
    state: StudentLearningState,
    concept: any,
    previousEvaluation?: AnswerEvaluationResult
  ): { prompt: string; expectedInputType: 'TEXT' | 'MCQ' | 'CHOICE' } {
    const name = concept?.name || session.topicName;
    const action = previousEvaluation?.recommendedPedagogicalAction;

    // Targeted Pedagogical Action Overrides
    if (action === 'REPAIR' && previousEvaluation?.misconception) {
      return {
        prompt: `Targeted Concept Repair: We noticed a slight confusion regarding "${previousEvaluation.misconception}". Let's clarify: in ${name}, how does the core mechanism actually operate?`,
        expectedInputType: 'TEXT',
      };
    }

    if (action === 'CHALLENGE' && session.currentPhase === 'CHALLENGE') {
      return {
        prompt: `Mastery Challenge: Excellent grasp! Let's extend: If operating parameters for ${name} double under extreme load, how does the system sustain equilibrium?`,
        expectedInputType: 'TEXT',
      };
    }

    if (action === 'SCAFFOLD') {
      return {
        prompt: `Step-by-Step Scaffolding: You have the right intuition! Let's break down ${name} step-by-step. First, what is the primary driving variable?`,
        expectedInputType: 'TEXT',
      };
    }

    return this.generatePhasePrompt(session, state, concept);
  }

  /**
   * Generates default phase prompts grounded in course concept nodes.
   */
  private generatePhasePrompt(
    session: StudySessionState,
    state: StudentLearningState,
    concept: any
  ): { prompt: string; expectedInputType: 'TEXT' | 'MCQ' | 'CHOICE' } {
    const name = concept?.name || session.topicName;

    switch (session.currentPhase) {
      case 'RECALL':
        return {
          prompt: `Quick Warmup: In your own words, what is the core idea behind ${name}? (Give a 1-sentence summary)`,
          expectedInputType: 'TEXT',
        };
      case 'PREREQUISITE_REPAIR':
        return {
          prompt: `Prerequisite Bridge: Notice how ${name} builds directly upon foundational principles. Think of how changing primary variables affects equilibrium. Ready to proceed?`,
          expectedInputType: 'CHOICE',
        };
      case 'EXPLANATION':
        return {
          prompt: `Conceptual Deep-Dive: Let's break down ${name}. The key relationship governs how inputs cause corresponding outputs. How does this apply in practice?`,
          expectedInputType: 'TEXT',
        };
      case 'GUIDED_PRACTICE':
        return {
          prompt: `Guided Practice: A standard system operating on ${name} receives an input change. Explain the resulting output and state what happens if the load doubles.`,
          expectedInputType: 'TEXT',
        };
      case 'CHALLENGE':
        return {
          prompt: `Challenge Problem: Consider two interconnected systems governed by ${name}. Explain how internal constraints balance external forces.`,
          expectedInputType: 'TEXT',
        };
      case 'MASTERY_CHECK':
        return {
          prompt: `Mastery Check: State the fundamental principle or equation for ${name} and identify its key governing conditions.`,
          expectedInputType: 'TEXT',
        };
      case 'NEXT_ACTION':
      default:
        return {
          prompt: `Session Complete! Your mastery on ${name} has been updated. Would you like to practice another topic or return to live class?`,
          expectedInputType: 'CHOICE',
        };
    }
  }

  /**
   * Generates a goal-aware study plan grounded in actual syllabus concepts.
   */
  public generateStudyPlan(
    classId: string,
    studentId: string,
    goalOrType: StudyGoal | StudyGoalType,
    targetDate?: string,
    customTitle?: string
  ): StudyPlan {
    const upperClassId = classId.toUpperCase();
    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const concepts = Object.values(graph.concepts);

    let goal: StudyGoal;
    if (typeof goalOrType === 'object' && (goalOrType as any).id) {
      goal = goalOrType as StudyGoal;
    } else {
      const goalType = goalOrType as StudyGoalType;
      const goalTitle = customTitle || (
        goalType === 'EXAM_PREP' ? 'Exam Preparation & Mastery' :
        goalType === 'DEEP_MASTERY' ? 'Deep Conceptual Mastery' :
        'Course Completion'
      );
      const targetMastery = goalType === 'EXAM_PREP' ? 0.85 : goalType === 'DEEP_MASTERY' ? 0.90 : 0.75;

      goal = {
        id: `goal_${upperClassId}_${Date.now()}`,
        studentId,
        classId: upperClassId,
        title: goalTitle,
        goalType,
        targetDate: targetDate || undefined,
        targetMastery,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dbService.saveStudyGoal(goal);
    }

    const targetMastery = goal.targetMastery || 0.75;
    const goalType = goal.goalType;

    const liveState = dbService.getClassroomLearningState(upperClassId);
    const liveConcept = liveState?.currentLiveTopic ? graph.concepts[liveState.currentLiveTopic] : null;
    const maxAllowedOrder = liveConcept ? liveConcept.order : 999;

    // Build Sequence Steps strictly within active teacher learning frontier
    const eligibleConcepts = concepts.filter((c) => c.order <= maxAllowedOrder);
    const recommendedSequence: StudyPlanSequenceStep[] = eligibleConcepts.map((c) => {
      const tm = state.topicMasteries[c.id];
      const mScore = tm ? tm.masteryScore : 0.25;
      const status = mScore >= targetMastery ? 'MASTERED' : mScore >= 0.50 ? 'IN_PROGRESS' : 'UPCOMING';

      let recommendedPrimitives: any[] = ['EXPLAIN', 'EXAMPLE'];
      if (goalType === 'EXAM_PREP') {
        recommendedPrimitives = ['RECALL', 'PRACTICE', 'EXAMPLE'];
      } else if (goalType === 'DEEP_MASTERY') {
        recommendedPrimitives = ['EXPLAIN', 'COMPARE', 'CHALLENGE'];
      }

      return {
        topicId: c.id,
        topicName: c.name,
        status,
        currentMastery: mScore,
        targetMastery,
        estimatedMinutes: status === 'MASTERED' ? 2 : 5,
        recommendedPrimitives,
      };
    });

    const totalMinutes = recommendedSequence.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    const plan: StudyPlan = {
      id: `plan_${goal.id}`,
      goalId: goal.id,
      classId: upperClassId,
      studentId,
      startingPoint: state.personalFrontier,
      priorityGaps: [],
      recommendedSequence,
      nextAction: state.nextBestAction,
      estimatedSessionDuration: Math.min(30, totalMinutes),
      successCriteria: `Achieve ≥ ${(targetMastery * 100).toFixed(0)}% mastery across syllabus concept nodes.`,
      updatedAt: new Date().toISOString(),
    };

    dbService.saveStudyPlan(plan);
    studentLearningStateService.invalidateState(upperClassId, studentId);

    return plan;
  }

  public buildCompactLearningMemory(stateOrClassId: StudentLearningState | string, studentId?: string): string {
    if (typeof stateOrClassId === 'string') {
      return this.buildCompactLearningMemoryContext(stateOrClassId, studentId || '');
    }
    const state = stateOrClassId;
    return this.buildCompactLearningMemoryContext(state.classId, state.studentId);
  }

  /**
   * Generates a compact Learning Memory context for local Qwen LLM prompts.
   * Separates conversation memory from educational learning state.
   */
  public buildCompactLearningMemoryContext(classId: string, studentId: string): string {
    const state = studentLearningStateService.getStudentLearningState(classId, studentId);
    const weakTopics = Object.values(state.topicMasteries)
      .filter((t) => t.masteryScore < 0.65)
      .map((t) => `${t.topicName} (${Math.round(t.masteryScore * 100)}%)`);

    const strongTopics = Object.values(state.topicMasteries)
      .filter((t) => t.masteryScore >= 0.75)
      .map((t) => t.topicName);

    const activeGoalStr = state.learningGoal ? `Active Goal: ${state.learningGoal.title} (${state.learningGoal.goalType})` : 'No explicit goal set';
    const debtStr = state.learningDebt.length > 0 ? `Learning Debt Prereqs: ${state.learningDebt.join(', ')}` : 'None';
    const miscStr = state.activeMisconceptions.length > 0 ? `Active Misconceptions: ${state.activeMisconceptions.map((m) => m.description).join('; ')}` : 'None';

    return `[COMPACT LEARNER MEMORY]
- Student Support State: ${state.supportLevel} (Mastery: ${Math.round(state.overallMastery * 100)}%)
- Personal Frontier: ${state.personalFrontier} | Live Teacher Topic: ${state.currentLiveTopic}
- ${activeGoalStr}
- Strong Topics: ${strongTopics.length > 0 ? strongTopics.join(', ') : 'Calibrating'}
- Weak / In-Progress Topics: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None'}
- ${debtStr}
- ${miscStr}
- Evidence Count: ${state.recentEvidenceCount} signals
- Next Best Action: ${state.nextBestAction.action} on ${state.nextBestAction.topicName}`;
  }
}

export const studyAssistantService = new StudyAssistantService();

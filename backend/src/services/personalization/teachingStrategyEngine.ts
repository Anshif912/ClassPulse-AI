import {
  PedagogicalPrimitive,
  TeachingStrategy,
  TeachingDepthLevel,
  StudentLearningState,
  StrategyEffectiveness,
} from './types';

export interface StrategyPlan {
  primitives: PedagogicalPrimitive[];
  strategies: TeachingStrategy[];
  primaryStrategy: TeachingStrategy;
  depthLevel: TeachingDepthLevel;
  pace: 'FAST' | 'COMFORTABLE' | 'SLOW';
  difficulty: 'FOUNDATION' | 'EASY' | 'MEDIUM' | 'HARD' | 'ADVANCED';
  practiceAfter: boolean;
  rationale: string;
}

export class TeachingStrategyEngine {
  // Session-level temporary overrides: keyed by `${classId}__${studentId}`
  private sessionOverrides: Map<string, { strategy?: TeachingStrategy; depth?: TeachingDepthLevel; promptStyle?: string }> = new Map();

  /**
   * Sets a temporary session-level teaching style override (does NOT overwrite global profile).
   */
  public setSessionOverride(
    classId: string,
    studentId: string,
    override: { strategy?: TeachingStrategy; depth?: TeachingDepthLevel; promptStyle?: string }
  ): void {
    const key = `${classId.toUpperCase()}__${studentId}`;
    this.sessionOverrides.set(key, override);
  }

  /**
   * Clears session-level override.
   */
  public clearSessionOverride(classId: string, studentId: string): void {
    const key = `${classId.toUpperCase()}__${studentId}`;
    this.sessionOverrides.delete(key);
  }

  /**
   * Evaluates task intent from user query or explicit mode.
   */
  public detectTaskIntent(query: string): 'DIRECT_INQUIRY' | 'CONFUSION_NEED_SIMPLIFICATION' | 'WORKED_PROBLEM_REQUEST' | 'RETRIEVAL_TEST_REQUEST' | 'CHALLENGE_REQUEST' | 'SOCRATIC_REQUEST' | 'MISCONCEPTION_REPAIR_REQUEST' | 'GENERAL' {
    const q = (query || '').toLowerCase().trim();

    if (q.includes('socratic') || q.includes("don't give me the answer") || q.includes('guide me with questions')) {
      return 'SOCRATIC_REQUEST';
    }
    if (q.includes('test me') || q.includes('quiz me') || q.includes('check my understanding') || q.includes('practice question')) {
      return 'RETRIEVAL_TEST_REQUEST';
    }
    if (q.includes('challenge') || q.includes('harder problem') || q.includes('advanced question') || q.includes('stretch')) {
      return 'CHALLENGE_REQUEST';
    }
    if (q.includes('solve') || q.includes('worked example') || q.includes('step by step') || q.includes('how to solve') || q.includes('show me how')) {
      return 'WORKED_PROBLEM_REQUEST';
    }
    if (q.includes("don't understand") || q.includes('still confused') || q.includes('simpler') || q.includes('like a 5 year old') || q.includes('explain simpler')) {
      return 'CONFUSION_NEED_SIMPLIFICATION';
    }
    if (q.includes('mistake') || q.includes('keep getting wrong') || q.includes('why is it wrong')) {
      return 'MISCONCEPTION_REPAIR_REQUEST';
    }
    if (q.startsWith('what is') || q.startsWith('define') || q.startsWith('who is') || q.startsWith('state')) {
      return 'DIRECT_INQUIRY';
    }
    return 'GENERAL';
  }

  /**
   * Composes pedagogical primitives into a cohesive teaching strategy plan based on evidence & intent.
   */
  public selectStrategyPlan(
    state: StudentLearningState,
    query: string,
    targetTopicId?: string
  ): StrategyPlan {
    const upperClassId = state.classId.toUpperCase();
    const overrideKey = `${upperClassId}__${state.studentId}`;
    const override = this.sessionOverrides.get(overrideKey);

    const intent = this.detectTaskIntent(query);
    const activeTopicId = targetTopicId || state.personalFrontier;
    const topicMastery = state.topicMasteries[activeTopicId]?.masteryScore ?? state.overallMastery;
    const hasActiveMisconception = state.activeMisconceptions.some((m) => m.topicId === activeTopicId && !m.resolved);
    const hasPrereqGap = state.learningDebt.length > 0;

    let primitives: PedagogicalPrimitive[] = ['EXPLAIN', 'EXAMPLE'];
    let strategies: TeachingStrategy[] = ['DIRECT'];
    let depthLevel: TeachingDepthLevel = 'LEVEL_2_SHORT_EXAMPLE';
    let pace: StrategyPlan['pace'] = 'COMFORTABLE';
    let difficulty: StrategyPlan['difficulty'] = 'MEDIUM';
    let practiceAfter = true;
    let rationale = '';

    // 1. Check temporary session override first
    if (override?.strategy) {
      strategies = [override.strategy];
      if (override.strategy === 'SOCRATIC') {
        primitives = ['SCAFFOLD', 'PRACTICE'];
        depthLevel = 'LEVEL_3_STEP_BY_STEP';
        rationale = 'Session override: Socratic guidance mode active upon student request.';
      } else if (override.strategy === 'ANALOGY') {
        primitives = ['SIMPLIFY', 'EXAMPLE', 'SCAFFOLD'];
        depthLevel = 'LEVEL_2_SHORT_EXAMPLE';
        rationale = 'Session override: Intuitive analogy mode active upon student request.';
      } else if (override.strategy === 'WORKED_EXAMPLE') {
        primitives = ['EXAMPLE', 'PRACTICE'];
        depthLevel = 'LEVEL_4_WORKED_APPLICATION';
        rationale = 'Session override: Worked example mode active upon student request.';
      }
      return {
        primitives,
        strategies,
        primaryStrategy: strategies[0],
        depthLevel: override.depth || depthLevel,
        pace,
        difficulty,
        practiceAfter,
        rationale,
      };
    }

    // 2. Intent & Evidence-Driven Primitive Composition
    if (intent === 'SOCRATIC_REQUEST') {
      primitives = ['SCAFFOLD', 'PRACTICE'];
      strategies = ['SOCRATIC', 'QUESTION_LED'];
      depthLevel = 'LEVEL_3_STEP_BY_STEP';
      difficulty = topicMastery >= 0.75 ? 'HARD' : 'MEDIUM';
      rationale = 'Guiding student with targeted conceptual questions rather than direct answers.';
    } else if (intent === 'RETRIEVAL_TEST_REQUEST') {
      primitives = ['RECALL', 'PRACTICE'];
      strategies = ['RETRIEVAL_PRACTICE'];
      depthLevel = 'LEVEL_3_STEP_BY_STEP';
      difficulty = topicMastery >= 0.75 ? 'HARD' : topicMastery < 0.50 ? 'EASY' : 'MEDIUM';
      rationale = 'Executing retrieval practice to test memory recall and application.';
    } else if (intent === 'CHALLENGE_REQUEST') {
      primitives = ['CHALLENGE', 'SUMMARIZE'];
      strategies = ['CHALLENGE', 'DIRECT'];
      depthLevel = 'LEVEL_5_TRANSFER_CHALLENGE';
      pace = 'FAST';
      difficulty = 'HARD';
      practiceAfter = false;
      rationale = `Demonstrated strong mastery (${Math.round(topicMastery * 100)}%). Providing advanced challenge problem.`;
    } else if (topicMastery >= 0.75 && state.supportLevel === 'READY_FOR_CHALLENGE') {
      primitives = ['EXPLAIN', 'SUMMARIZE'];
      strategies = ['DIRECT'];
      depthLevel = 'LEVEL_1_CORE_SENTENCE';
      pace = 'FAST';
      difficulty = 'HARD';
      practiceAfter = false;
      rationale = `Demonstrated strong mastery (${Math.round(topicMastery * 100)}%). Providing concise direct explanation.`;
    } else if (intent === 'WORKED_PROBLEM_REQUEST') {
      primitives = ['EXAMPLE', 'PRACTICE'];
      strategies = ['WORKED_EXAMPLE', 'STEP_BY_STEP'];
      depthLevel = 'LEVEL_4_WORKED_APPLICATION';
      difficulty = topicMastery >= 0.70 ? 'MEDIUM' : 'EASY';
      rationale = 'Providing step-by-step worked application problem followed by guided practice.';
    } else if (intent === 'MISCONCEPTION_REPAIR_REQUEST' || hasActiveMisconception) {
      primitives = ['REPAIR', 'COMPARE', 'PRACTICE'];
      strategies = ['MISCONCEPTION_REPAIR', 'COMPARISON'];
      depthLevel = 'LEVEL_3_STEP_BY_STEP';
      pace = 'SLOW';
      difficulty = 'EASY';
      rationale = 'Targeting identified misconception with contrasting counter-example.';
    } else if (intent === 'DIRECT_INQUIRY') {
      primitives = ['EXPLAIN', 'SUMMARIZE'];
      strategies = ['DIRECT'];
      depthLevel = 'LEVEL_1_CORE_SENTENCE';
      pace = 'FAST';
      difficulty = 'MEDIUM';
      practiceAfter = false;
      rationale = 'Concise, direct definition matching inquiry intent.';
    } else if (intent === 'CONFUSION_NEED_SIMPLIFICATION' || topicMastery < 0.50 || hasPrereqGap) {
      primitives = ['SIMPLIFY', 'SCAFFOLD', 'EXAMPLE'];
      strategies = ['ANALOGY', 'STEP_BY_STEP'];
      depthLevel = 'LEVEL_2_SHORT_EXAMPLE';
      pace = 'SLOW';
      difficulty = 'EASY';
      rationale = `Scaffolding explanation with real-world analogy and step-by-step breakdown (Mastery: ${Math.round(topicMastery * 100)}%).`;
    } else {
      // Dimensional Cognitive Evidence & Goal-Aware Tuning
      if (state.foundationMastery !== undefined && state.foundationMastery < 0.50) {
        primitives = ['SCAFFOLD', 'SIMPLIFY', 'EXAMPLE'];
        strategies = ['ANALOGY', 'STEP_BY_STEP'];
        depthLevel = 'LEVEL_2_SHORT_EXAMPLE';
        pace = 'SLOW';
        difficulty = 'EASY';
        rationale = 'Low foundation mastery detected: scaffolding foundational prerequisites with intuitive analogies.';
      } else if (state.transferMastery !== undefined && state.transferMastery < 0.50 && (state.conceptMastery ?? 0) >= 0.65) {
        primitives = ['EXAMPLE', 'PRACTICE', 'CHALLENGE'];
        strategies = ['REAL_WORLD_EXAMPLE', 'WORKED_EXAMPLE'];
        depthLevel = 'LEVEL_4_WORKED_APPLICATION';
        difficulty = 'MEDIUM';
        rationale = 'Solid conceptual grasp with developing transfer ability: reinforcing real-world bridge applications.';
      } else if (state.reasoningMastery !== undefined && state.reasoningMastery < 0.50 && (state.conceptMastery ?? 0) >= 0.65) {
        primitives = ['SCAFFOLD', 'PRACTICE'];
        strategies = ['SOCRATIC', 'QUESTION_LED'];
        depthLevel = 'LEVEL_3_STEP_BY_STEP';
        difficulty = 'MEDIUM';
        rationale = 'Good conceptual knowledge: using guided questions to strengthen causal reasoning chains.';
      } else if (state.learningGoal?.goalType === 'EXAM_PREP') {
        primitives = ['RECALL', 'EXAMPLE', 'PRACTICE'];
        strategies = ['EXAM_COACH', 'WORKED_EXAMPLE'];
        depthLevel = 'LEVEL_4_WORKED_APPLICATION';
        difficulty = 'MEDIUM';
        rationale = `Exam Prep goal active: focused on high-yield exam patterns and practice on ${state.learningGoal.title}.`;
      } else if (state.learningGoal?.goalType === 'DEEP_MASTERY') {
        primitives = ['EXPLAIN', 'COMPARE', 'CHALLENGE'];
        strategies = ['FEYNMAN_SIMPLIFIED', 'COMPARISON'];
        depthLevel = 'LEVEL_3_STEP_BY_STEP';
        difficulty = 'HARD';
        rationale = 'Deep Mastery goal active: highlighting underlying mechanisms, comparisons, and transfer.';
      } else {
        primitives = ['EXPLAIN', 'EXAMPLE', 'PRACTICE'];
        strategies = ['VISUAL_STRUCTURED', 'REAL_WORLD_EXAMPLE'];
        depthLevel = 'LEVEL_2_SHORT_EXAMPLE';
        rationale = 'Balanced structured explanation with real-world example and quick concept check.';
      }
    }

    return {
      primitives,
      strategies,
      primaryStrategy: strategies[0],
      depthLevel,
      pace,
      difficulty,
      practiceAfter,
      rationale,
    };
  }

  /**
   * Determines adaptive depth based on topic mastery and support level.
   */
  public determineDepth(topicMastery: number, supportLevel: string): TeachingDepthLevel {
    if (topicMastery >= 0.85 || supportLevel === 'READY_FOR_CHALLENGE' || supportLevel === 'STRONG_MASTERY') {
      return 'LEVEL_5_TRANSFER_CHALLENGE';
    } else if (topicMastery >= 0.70) {
      return 'LEVEL_4_WORKED_APPLICATION';
    } else if (topicMastery >= 0.50 || supportLevel === 'COMFORTABLE') {
      return 'LEVEL_3_STEP_BY_STEP';
    } else if (topicMastery >= 0.35) {
      return 'LEVEL_2_SHORT_EXAMPLE';
    } else {
      return 'LEVEL_1_CORE_SENTENCE';
    }
  }

  /**
   * Updates strategy effectiveness evidence gradually over multiple observations.

   * Prevents instantaneous single-event spikes (e.g. 1 success does not set weight to 1.0).
   */
  public updateStrategyOutcome(
    currentEffectiveness: Record<string, StrategyEffectiveness>,
    strategy: TeachingStrategy,
    isCorrect: boolean,
    timeToAnswerMs?: number,
    hintsUsed?: number
  ): Record<string, StrategyEffectiveness> {
    const updated = { ...currentEffectiveness };
    const stratKey = strategy as string;
    const existing = updated[stratKey] || { attempts: 0, successes: 0, avgConfidence: 0.5, score: 0.5 };

    const newAttempts = existing.attempts + 1;
    const newSuccesses = existing.successes + (isCorrect ? 1 : 0);

    // Fast response without hints gives a confidence bonus
    const speedBonus = timeToAnswerMs && timeToAnswerMs < 15000 ? 0.1 : 0.0;
    const hintPenalty = hintsUsed && hintsUsed > 0 ? hintsUsed * 0.05 : 0.0;

    const rawRate = newSuccesses / newAttempts;
    // Damped moving average requiring repeated observations (effective weight)
    const confidenceWeight = Math.min(1.0, newAttempts / 4.0); // Full confidence after 4 observations
    const dampedScore = Math.max(0.1, Math.min(0.98, rawRate * confidenceWeight + 0.5 * (1 - confidenceWeight) + speedBonus - hintPenalty));

    updated[stratKey] = {
      attempts: newAttempts,
      successes: newSuccesses,
      avgConfidence: Math.round(dampedScore * 100) / 100,
      score: Math.round(dampedScore * 100) / 100,
    };

    return updated;
  }
}

export const teachingStrategyEngine = new TeachingStrategyEngine();

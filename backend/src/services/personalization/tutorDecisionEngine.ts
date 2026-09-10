import { conceptGraphService } from './conceptGraphService';
import { studentLearningStateService } from './studentLearningStateService';
import { teachingStrategyEngine } from './teachingStrategyEngine';
import { dbService } from '../db.service';
import {
  TutorDecision,
  PrerequisiteGap,
  PreferredExplanationStyle,
  DifficultyLevel,
} from './types';

export class TutorDecisionEngine {
  /**
   * Generates a personalized tutoring decision using the single canonical StudentLearningState.
   */
  public decide(
    classId: string,
    studentId: string,
    query: string,
    explicitTopicId?: string
  ): TutorDecision {
    const upperClassId = classId.toUpperCase();
    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);
    const liveConcept = liveState?.currentLiveTopic ? graph.concepts[liveState.currentLiveTopic] : null;
    const maxAllowedOrder = liveConcept ? liveConcept.order : 999;

    // 1. Identify Topic
    let topicNode = explicitTopicId ? graph.concepts[explicitTopicId] : null;
    if (!topicNode) {
      topicNode = conceptGraphService.matchTopicFromQuery(query, upperClassId);
    }
    // Server-side enforcement: Clamp future topic to active teacher frontier
    if (topicNode && topicNode.order > maxAllowedOrder && liveConcept) {
      topicNode = liveConcept;
    }
    const topicId = topicNode.id;
    const topicName = topicNode.name;

    // 2. Select strategy plan from Composable Teaching Strategy Engine
    const strategyPlan = teachingStrategyEngine.selectStrategyPlan(state, query, topicId);

    // 3. Evaluate Target Topic Mastery & Prerequisite Gaps
    const currentTopicMastery = state.topicMasteries[topicId]?.masteryScore ?? state.overallMastery;
    const gaps: PrerequisiteGap[] = [];

    for (const prereqId of topicNode.prerequisiteIds) {
      const prereqConcept = graph.concepts[prereqId];
      if (prereqConcept) {
        const pMastery = state.topicMasteries[prereqId]?.masteryScore ?? 0.25;
        if (pMastery < 0.60) {
          gaps.push({
            prerequisiteTopicId: prereqId,
            prerequisiteTopicName: prereqConcept.name,
            currentMastery: pMastery,
            requiredMastery: 0.65,
            gapSeverity: pMastery < 0.40 ? 'SEVERE' : 'MODERATE',
          });
        }
      }
    }

    // Map depthLevel to short/medium/layered
    let depth: 'SHORT' | 'MEDIUM' | 'LAYERED' = 'MEDIUM';
    if (
      strategyPlan.depthLevel === 'LEVEL_1_CORE_SENTENCE' ||
      (state.supportLevel === 'READY_FOR_CHALLENGE' && strategyPlan.primaryStrategy === 'DIRECT')
    ) {
      depth = 'SHORT';
    } else if (
      strategyPlan.depthLevel === 'LEVEL_4_WORKED_APPLICATION' ||
      strategyPlan.depthLevel === 'LEVEL_5_TRANSFER_CHALLENGE' ||
      state.supportLevel === 'NEEDS_REINFORCEMENT'
    ) {
      depth = 'LAYERED';
    }

    // Map strategy to backward-compat PreferredExplanationStyle
    let strategy: PreferredExplanationStyle = 'DIRECT';
    if (strategyPlan.primaryStrategy === 'ANALOGY' || strategyPlan.primaryStrategy === 'REAL_WORLD_EXAMPLE') {
      strategy = 'ANALOGY_EXAMPLE';
    } else if (strategyPlan.primaryStrategy === 'STEP_BY_STEP' || strategyPlan.primaryStrategy === 'WORKED_EXAMPLE') {
      strategy = 'STEP_BY_STEP';
    } else if (strategyPlan.primaryStrategy === 'QUESTION_LED' || strategyPlan.primaryStrategy === 'SOCRATIC') {
      strategy = 'QUESTION_LED';
    } else if (strategyPlan.primaryStrategy === 'VISUAL_STRUCTURED' || strategyPlan.primaryStrategy === 'COMPARISON') {
      strategy = 'VISUAL_STRUCTURED';
    }

    let action: TutorDecision['action'] = 'GUIDED_EXPLANATION';
    if (gaps.length > 0) {
      action = 'PREREQUISITE_BRIDGE';
    } else if (strategyPlan.primaryStrategy === 'CHALLENGE') {
      action = 'CHALLENGE_EXTENSION';
    } else if (strategyPlan.primaryStrategy === 'DIRECT') {
      action = 'CONCISE_EXPLANATION';
    } else if (strategyPlan.primaryStrategy === 'RETRIEVAL_PRACTICE' || strategyPlan.primaryStrategy === 'EXAM_COACH') {
      action = 'STEP_BY_STEP_PRACTICE';
    }

    return {
      action,
      topicId,
      topicName,
      depth,
      pace: strategyPlan.pace,
      strategy,
      difficulty: strategyPlan.difficulty,
      needsPractice: strategyPlan.practiceAfter,
      rationale: strategyPlan.rationale,
      prerequisiteBridgeRequired: gaps.length > 0
        ? {
            gaps,
            estimatedBridgeTimeSec: gaps[0].gapSeverity === 'SEVERE' ? 45 : 20,
          }
        : undefined,
    };
  }
}

export const tutorDecisionEngine = new TutorDecisionEngine();

import { dbService } from '../db.service';
import { conceptGraphService } from './conceptGraphService';
import { learnerModelService } from './learnerModelService';
import { bridgeGeneratorService } from './bridgeGeneratorService';
import {
  StudentLearningState,
  NextBestAction,
  NextBestActionType,
  PedagogicalPrimitive,
  TopicMasteryRecord,
  RetentionItem,
  MisconceptionRecord,
  StudyGoal,
} from './types';

export class StudentLearningStateService {
  private cache: Map<string, StudentLearningState> = new Map();

  private getCacheKey(classId: string, studentId: string): string {
    return `${classId.toUpperCase()}__${studentId}`;
  }

  /**
   * Invalidates cached snapshot upon new learning event, practice outcome, or goal change.
   */
  public invalidateState(classId: string, studentId: string): void {
    const key = this.getCacheKey(classId, studentId);
    this.cache.delete(key);
  }

  /**
   * Invalidates all cached student states for an entire class (e.g. when teacher updates live frontier).
   */
  public invalidateClass(classId: string): void {
    const prefix = `${classId.toUpperCase()}__`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Retrieves or builds the single canonical StudentLearningState snapshot.
   */
  public getStudentLearningState(classId: string, studentId: string): StudentLearningState {
    const upperClassId = classId.toUpperCase();
    const key = this.getCacheKey(upperClassId, studentId);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 1. Authoritative Learner Profile
    const profile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);
    const firstTopicId = Object.values(graph.concepts)[0]?.id || 'intro_motion_force';
    const currentLiveTopic = liveState?.currentLiveTopic && graph.concepts[liveState.currentLiveTopic]
      ? liveState.currentLiveTopic
      : (profile.currentTopic && graph.concepts[profile.currentTopic] ? profile.currentTopic : firstTopicId);
    
    const liveConcept = graph.concepts[currentLiveTopic];
    const maxAllowedOrder = liveConcept?.order ?? 999;

    let personalFrontier = profile.personalLearningFrontier && graph.concepts[profile.personalLearningFrontier]
      ? profile.personalLearningFrontier
      : (profile.currentTopic && graph.concepts[profile.currentTopic] ? profile.currentTopic : firstTopicId);

    // Enforce teacher frontier ceiling on personal frontier
    const frontierNode = graph.concepts[personalFrontier];
    if (frontierNode && frontierNode.order > maxAllowedOrder) {
      personalFrontier = currentLiveTopic;
    }

    // 2. Authoritative Topic Masteries Record
    const rawMasteries = dbService.getAllTopicMasteries(upperClassId, studentId);
    const topicMasteries: Record<string, TopicMasteryRecord> = {};
    for (const m of rawMasteries) {
      topicMasteries[m.topicId] = m;
    }

    // 3. Minimum Learning Bridge & Learning Debt
    const bridge = bridgeGeneratorService.generateBridge(upperClassId, studentId);
    const learningDebt = bridge.learningDebt || [];

    // 4. Misconceptions
    const activeMisconceptions = dbService.getStudentMisconceptions(upperClassId, studentId);

    // 5. Spaced Retention Queue
    const retentionDue = this.evaluateRetentionQueue(upperClassId, studentId, topicMasteries);

    // 6. Active Learning Goal
    const learningGoal = dbService.getActiveStudyGoal(upperClassId, studentId);

    // 7. Multi-Factor Next Best Action & Rationale
    const { nextBestAction, whyThisActionRationale } = this.evaluateNextBestAction(
      profile.profileStatus,
      currentLiveTopic,
      personalFrontier,
      graph,
      topicMasteries,
      learningDebt,
      retentionDue,
      activeMisconceptions,
      learningGoal,
      profile.overallMastery,
      profile.supportLevel
    );

    const snapshot: StudentLearningState = {
      studentId,
      classId: upperClassId,
      profileStatus: profile.profileStatus,
      currentLiveTopic,
      personalFrontier,
      overallMastery: profile.overallMastery,
      foundationMastery: profile.foundationMastery,
      conceptMastery: profile.conceptMastery,
      applicationMastery: profile.applicationMastery,
      reasoningMastery: profile.reasoningMastery,
      transferMastery: profile.transferMastery,
      topicMasteries,
      learningDebt,
      retentionDue,
      activeMisconceptions,
      learningGoal,
      strategyEffectiveness: profile.strategyEffectiveness as any,
      recentEvidenceCount: profile.evidenceCount,
      supportLevel: profile.supportLevel,
      nextBestAction,
      whyThisActionRationale,
      lastUpdated: new Date().toISOString(),
    };

    this.cache.set(key, snapshot);
    return snapshot;
  }

  /**
   * Deterministic Next Best Action Priority Policy:
   * 1. Immediate live-class blocker
   * 2. Critical prerequisite gap
   * 3. Stable misconception repair
   * 4. Retention due (spaced recall)
   * 5. Goal-critical weakness
   * 6. Practice opportunity
   * 7. Challenge extension
   * 8. Continue learning
   */
  private evaluateNextBestAction(
    profileStatus: string,
    currentLiveTopic: string,
    personalFrontier: string,
    graph: any,
    topicMasteries: Record<string, TopicMasteryRecord>,
    learningDebt: string[],
    retentionDue: RetentionItem[],
    activeMisconceptions: MisconceptionRecord[],
    learningGoal: StudyGoal | undefined,
    overallMastery: number,
    supportLevel: string
  ): { nextBestAction: NextBestAction; whyThisActionRationale: string } {
    const frontierConcept = graph.concepts[personalFrontier] || Object.values(graph.concepts)[0];
    const liveConcept = graph.concepts[currentLiveTopic] || frontierConcept;
    const frontierMastery = topicMasteries[personalFrontier]?.masteryScore ?? overallMastery;

    if (profileStatus === 'UNINITIALIZED') {
      return {
        nextBestAction: {
          action: 'CALIBRATE_DIAGNOSTIC',
          topicId: frontierConcept?.id || 'baseline',
          topicName: frontierConcept?.name || 'Diagnostic Calibration',
          urgency: 'HIGH',
          estimatedMinutes: 2,
          rationale: 'Calibrate your baseline learning profile to personalize explanation pace, depth, and difficulty.',
          primitives: ['RECALL', 'PRACTICE'],
        },
        whyThisActionRationale: 'Your profile has not been calibrated yet. Answering 5 quick questions will adapt your AI companion to your starting level.',
      };
    }

    // Priority 1: Immediate live-class blocker
    if (learningDebt.length > 0 && currentLiveTopic !== personalFrontier) {
      const debtTopic = learningDebt[0];
      return {
        nextBestAction: {
          action: 'CATCH_UP',
          topicId: personalFrontier,
          topicName: debtTopic,
          urgency: 'HIGH',
          estimatedMinutes: 2,
          rationale: `The class is currently on ${liveConcept?.name || currentLiveTopic}. A quick 60-second prerequisite bridge on ${debtTopic} will help you follow live.`,
          primitives: ['REPAIR', 'SIMPLIFY', 'EXAMPLE'],
        },
        whyThisActionRationale: `Your teacher is teaching ${liveConcept?.name || currentLiveTopic}, but you are missing prerequisite fundamentals in ${debtTopic}. Bridging this now prevents compounding learning debt.`,
      };
    }

    // Priority 2: Stable Misconception Repair
    const stableMisconception = activeMisconceptions.find((m) => m.isStable && !m.resolved);
    if (stableMisconception) {
      return {
        nextBestAction: {
          action: 'REINFORCE',
          topicId: stableMisconception.topicId,
          topicName: stableMisconception.topicName,
          urgency: 'HIGH',
          estimatedMinutes: 3,
          rationale: `Repeated error pattern detected in ${stableMisconception.topicName}: "${stableMisconception.description}". Let's clear this up with a contrast example.`,
          primitives: ['REPAIR', 'COMPARE', 'PRACTICE'],
        },
        whyThisActionRationale: `You've encountered difficulty twice on ${stableMisconception.topicName}. A targeted contrast repair will ensure your mental model is accurate before advancing.`,
      };
    }

    // Priority 3: Spaced Retention Due
    if (retentionDue.length > 0) {
      const item = retentionDue[0];
      return {
        nextBestAction: {
          action: 'REVISE',
          topicId: item.topicId,
          topicName: item.topicName,
          urgency: 'MEDIUM',
          estimatedMinutes: 3,
          rationale: `It's time for a quick recall check on ${item.topicName} to strengthen memory retention.`,
          primitives: ['RECALL', 'PRACTICE'],
        },
        whyThisActionRationale: `Spaced reinforcement schedule indicates ${item.topicName} is due for a quick memory check to prevent forgetting.`,
      };
    }

    // Priority 4: Goal-Critical Weakness
    if (learningGoal && learningGoal.status === 'ACTIVE') {
      if (learningGoal.goalType === 'EXAM_PREP') {
        const weakTopic = Object.values(topicMasteries).find((t) => t.masteryScore < learningGoal.targetMastery) || topicMasteries[personalFrontier];
        const tName = weakTopic?.topicName || frontierConcept?.name || personalFrontier;
        return {
          nextBestAction: {
            action: 'PRACTICE',
            topicId: weakTopic?.topicId || personalFrontier,
            topicName: tName,
            urgency: 'HIGH',
            estimatedMinutes: 5,
            rationale: `Active goal: Exam Prep (${learningGoal.title}). Focus on high-yield exam practice on ${tName}.`,
            primitives: ['RECALL', 'PRACTICE', 'EXAMPLE'],
          },
          whyThisActionRationale: `Your active goal is "${learningGoal.title}". Targeted practice on ${tName} will bring your mastery toward the ${(learningGoal.targetMastery * 100).toFixed(0)}% target score.`,
        };
      } else if (learningGoal.goalType === 'DEEP_MASTERY') {
        return {
          nextBestAction: {
            action: 'START_STUDY_SESSION',
            topicId: personalFrontier,
            topicName: frontierConcept?.name || personalFrontier,
            urgency: 'MEDIUM',
            estimatedMinutes: 6,
            rationale: `Active goal: Deep Mastery (${learningGoal.title}). Explore conceptual mechanisms and transfer problems.`,
            primitives: ['EXPLAIN', 'SCAFFOLD', 'CHALLENGE'],
          },
          whyThisActionRationale: `Your active goal focuses on deep conceptual understanding. A structured inquiry session on ${frontierConcept?.name} is ready.`,
        };
      }
    }

    // Priority 5: Practice Opportunity (Developing Mastery)
    if (frontierMastery < 0.70) {
      return {
        nextBestAction: {
          action: 'PRACTICE',
          topicId: personalFrontier,
          topicName: frontierConcept?.name || personalFrontier,
          urgency: 'MEDIUM',
          estimatedMinutes: 4,
          rationale: `Topic mastery on ${frontierConcept?.name || personalFrontier} is ${Math.round(frontierMastery * 100)}%. Solve a 2-step guided problem to level up.`,
          primitives: ['EXAMPLE', 'PRACTICE'],
        },
        whyThisActionRationale: `Your understanding of ${frontierConcept?.name} is growing (${Math.round(frontierMastery * 100)}%). A short guided practice will push you over the 70% mastery threshold.`,
      };
    }

    // Priority 6: Challenge Extension (High Mastery)
    if (frontierMastery >= 0.75 || supportLevel === 'READY_FOR_CHALLENGE' || supportLevel === 'STRONG_MASTERY') {
      return {
        nextBestAction: {
          action: 'TRY_CHALLENGE',
          topicId: personalFrontier,
          topicName: frontierConcept?.name || personalFrontier,
          urgency: 'LOW',
          estimatedMinutes: 4,
          rationale: `You've demonstrated strong mastery (${Math.round(frontierMastery * 100)}%) on ${frontierConcept?.name || personalFrontier}. Ready for an advanced application problem!`,
          primitives: ['CHALLENGE', 'SUMMARIZE'],
        },
        whyThisActionRationale: `You have mastered the foundations of ${frontierConcept?.name}. Solving a challenge problem will cement your deep conceptual fluency.`,
      };
    }

    // Priority 7: Continue Learning (Default)
    return {
      nextBestAction: {
        action: 'CONTINUE_LEARNING',
        topicId: personalFrontier,
        topicName: frontierConcept?.name || personalFrontier,
        urgency: 'LOW',
        estimatedMinutes: 5,
        rationale: `Continue your personalized learning path with ${frontierConcept?.name || personalFrontier}.`,
        primitives: ['EXPLAIN', 'EXAMPLE'],
      },
      whyThisActionRationale: `You're in a great flow on ${frontierConcept?.name}. Let's advance along your syllabus pathway.`,
    };
  }

  /**
   * Spaced Retention Evaluation: checks topic masteries for decay or review triggers.
   */
  private evaluateRetentionQueue(
    classId: string,
    studentId: string,
    topicMasteries: Record<string, TopicMasteryRecord>
  ): RetentionItem[] {
    const savedQueue = dbService.getRetentionQueue(classId, studentId) || [];
    const now = new Date().getTime();
    const updatedQueue: RetentionItem[] = [...savedQueue.filter((q: any) => q.dueForReview || q.isDue)];

    for (const [topicId, tm] of Object.entries(topicMasteries)) {
      if (tm.masteryScore >= 0.65) {
        const lastAssessedTime = new Date(tm.lastAssessedAt).getTime();
        const hoursSince = (now - lastAssessedTime) / (1000 * 60 * 60);

        // Retention check triggered if assessed > 12 hours ago or has low retention check score
        const existingItem = savedQueue.find((q: any) => q.topicId === topicId);
        const retentionScore = existingItem ? existingItem.retentionScore : tm.masteryScore;
        const dueForReview = hoursSince >= 12 || retentionScore < 0.60;

        if (dueForReview && !updatedQueue.some((q) => q.topicId === topicId)) {
          updatedQueue.push({
            topicId,
            topicName: tm.topicName,
            lastLearnedAt: tm.lastAssessedAt,
            retentionScore,
            dueForReview: true,
            intervalDays: Math.max(1, Math.round(hoursSince / 24)),
          });
        }
      }
    }

    dbService.saveRetentionQueue(classId, studentId, updatedQueue);
    return updatedQueue;
  }
}

export const studentLearningStateService = new StudentLearningStateService();

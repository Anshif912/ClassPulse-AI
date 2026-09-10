import { dbService } from '../db.service';
import { conceptGraphService } from './conceptGraphService';
import {
  StudentLearnerProfile,
  TopicMasteryRecord,
  LearningEventRecord,
  LearningEventMetrics,
  PreferredExplanationStyle,
  StrategyEffectiveness,
  SupportLevel,
  ComprehensionSpeed,
  PracticeRequirement,
  PrerequisiteDependency,
  TransferAbility,
  ConfidenceAccuracyGap,
  PreferredPace,
  DifficultyLevel,
  DiagnosticSession,
  DiagnosticSummary,
} from './types';

export class LearnerModelService {
  /**
   * Retrieves or initializes a persistent student learner profile.
   * If not yet existing, initializes an evidence-based prior from academic marks.
   */
  public getOrInitializeProfile(
    classId: string,
    studentId: string,
    initialPriorMarks?: number
  ): StudentLearnerProfile {
    const upperClassId = classId.toUpperCase();
    const existing = dbService.getLearnerProfile(upperClassId, studentId);
    if (existing) {
      return existing;
    }

    const isFreshUninitialized = initialPriorMarks === undefined;
    const marks = initialPriorMarks ?? 50;
    const normalizedPrior = Math.max(0.0, Math.min(1.0, marks / 100));

    // Determine initial supportive starting levels
    let initialSupportLevel: SupportLevel = isFreshUninitialized ? 'NEEDS_REINFORCEMENT' : 'COMFORTABLE';
    let initialDifficulty: DifficultyLevel = isFreshUninitialized ? 'FOUNDATION' : 'MEDIUM';
    let initialPace: PreferredPace = isFreshUninitialized ? 'GENTLE' : 'COMFORTABLE';
    let initialSpeed: ComprehensionSpeed = isFreshUninitialized ? 'DELIBERATE' : 'NORMAL';
    let initialPractice: PracticeRequirement = 'MEDIUM';
    let initialStyle: PreferredExplanationStyle = marks >= 85 ? 'DIRECT' : 'ANALOGY_EXAMPLE';

    // Layer 1 integration: If the student completed pre-course Learning Profile calibration, inherit their baseline
    const personalProfile = dbService.getPersonalLearningProfile(studentId);
    if (personalProfile && personalProfile.status === 'CALIBRATED') {
      if (personalProfile.readingPaceLevel === 'SLOW') initialSpeed = 'DELIBERATE';
      else if (personalProfile.readingPaceLevel === 'FAST') initialSpeed = 'FAST';
      else initialSpeed = 'NORMAL';

      if (personalProfile.estimatedStudyPace === 'INTENSIVE') initialPace = 'GENTLE';
      else if (personalProfile.estimatedStudyPace === 'EXPEDITED') initialPace = 'ACCELERATED';
      else initialPace = 'COMFORTABLE';

      if (personalProfile.assistanceLevel === 'EXTENSIVE_SUPPORT') initialSupportLevel = 'NEEDS_REINFORCEMENT';
      else if (personalProfile.assistanceLevel === 'INDEPENDENT_CHALLENGE') initialSupportLevel = 'READY_FOR_CHALLENGE';

      if (personalProfile.preferredInitialStyle === 'ANALOGY_HEAVY') initialStyle = 'ANALOGY_EXAMPLE';
      else if (personalProfile.preferredInitialStyle === 'CONCEPT_FIRST') initialStyle = 'STEP_BY_STEP';
      else if (personalProfile.preferredInitialStyle === 'PRACTICE_FIRST') initialStyle = 'QUESTION_LED';
      else if (personalProfile.preferredInitialStyle === 'EXAMPLE_FIRST') initialStyle = 'ANALOGY_EXAMPLE';
    }

    if (!isFreshUninitialized) {
      if (marks >= 85) {
        initialSupportLevel = 'READY_FOR_CHALLENGE';
        initialDifficulty = 'HARD';
        initialPace = 'ACCELERATED';
        initialSpeed = 'FAST';
        initialPractice = 'LOW';
      } else if (marks < 60) {
        initialSupportLevel = 'NEEDS_REINFORCEMENT';
        initialDifficulty = 'EASY';
        initialPace = 'GENTLE';
        initialSpeed = 'DELIBERATE';
        initialPractice = 'HIGH';
      }
    }

    const defaultStrategyEffectiveness: Record<PreferredExplanationStyle, StrategyEffectiveness> = {
      DIRECT: { attempts: 1, successes: marks >= 75 ? 1 : 0, avgConfidence: 0.7, score: marks >= 75 ? 0.8 : 0.4 },
      ANALOGY_EXAMPLE: { attempts: 1, successes: 1, avgConfidence: 0.8, score: 0.85 },
      STEP_BY_STEP: { attempts: 1, successes: marks < 70 ? 1 : 0, avgConfidence: 0.75, score: 0.7 },
      QUESTION_LED: { attempts: 1, successes: marks >= 80 ? 1 : 0, avgConfidence: 0.65, score: 0.6 },
      VISUAL_STRUCTURED: { attempts: 1, successes: 1, avgConfidence: 0.8, score: 0.8 },
    };

    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const firstTopic = Object.values(graph.concepts)[0]?.id || 'first_generation';

    const profile: StudentLearnerProfile = {
      id: `lrn_${upperClassId}_${studentId}`,
      studentId,
      classId: upperClassId,
      profileStatus: isFreshUninitialized ? 'UNINITIALIZED' : 'ACTIVE',
      priorAcademicPerformance: {
        priorSubjectScore: initialPriorMarks,
        initialPriorScore: isFreshUninitialized ? 0 : normalizedPrior,
        confidenceLevel: isFreshUninitialized ? 0 : 0.5,
      },
      overallMastery: isFreshUninitialized ? 0 : normalizedPrior,
      foundationMastery: isFreshUninitialized ? 0 : normalizedPrior,
      conceptMastery: isFreshUninitialized ? 0 : normalizedPrior,
      applicationMastery: isFreshUninitialized ? 0 : Math.max(0.1, Math.round((normalizedPrior - 0.05) * 100) / 100),
      reasoningMastery: isFreshUninitialized ? 0 : Math.max(0.1, Math.round((normalizedPrior - 0.1) * 100) / 100),
      transferMastery: isFreshUninitialized ? 0 : Math.max(0.1, Math.round((normalizedPrior - 0.15) * 100) / 100),
      currentTopic: firstTopic,
      personalLearningFrontier: firstTopic,
      comprehensionSpeed: initialSpeed,
      retentionScore: isFreshUninitialized ? 0 : normalizedPrior,
      practiceRequirement: initialPractice,
      prerequisiteDependency: marks < 65 ? 'HIGH' : 'LOW',
      transferAbility: marks >= 80 ? 'HIGH' : 'MEDIUM',
      confidenceAccuracyGap: 'BALANCED',
      preferredExplanationStyle: initialStyle,
      strategyEffectiveness: defaultStrategyEffectiveness,
      preferredPace: initialPace,
      difficultyLevel: initialDifficulty,
      supportLevel: initialSupportLevel,
      evidenceCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    dbService.saveLearnerProfile(profile);
    return profile;
  }

  /**
   * Retrieves or initializes topic-level mastery.
   */
  public getOrInitializeTopicMastery(
    classId: string,
    studentId: string,
    topicId: string,
    topicName?: string
  ): TopicMasteryRecord {
    const upperClassId = classId.toUpperCase();
    const existing = dbService.getTopicMastery(upperClassId, studentId, topicId);
    if (existing) {
      return existing;
    }

    const profile = this.getOrInitializeProfile(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const concepts = graph?.concepts || {};
    const concept = concepts[topicId];
    const name = topicName || concept?.name || topicId;

    const record: TopicMasteryRecord = {
      id: `tm_${upperClassId}_${studentId}_${topicId}`,
      studentId,
      classId: upperClassId,
      topicId,
      topicName: name,
      parentUnit: concept?.unit || 'General',
      masteryScore: profile.overallMastery, // Start with general prior
      evidenceCount: 0,
      lastAssessedAt: new Date().toISOString(),
      misconceptions: [],
      retentionChecks: [],
    };

    dbService.saveTopicMastery(record);
    return record;
  }

  /**
   * Updates topic mastery and learner profile based on an observed LearningEvent.
   * Uses evidence-damped transparent weighted updates.
   */
  public processLearningEvent(event: LearningEventRecord): {
    updatedProfile: StudentLearnerProfile;
    updatedTopicMastery: TopicMasteryRecord;
  } {
    const { classId, studentId, topicId, metrics } = event;
    const upperClassId = classId.toUpperCase();

    // 1. Record event persistently
    dbService.recordLearningEvent(event);

    const profile = this.getOrInitializeProfile(upperClassId, studentId);
    const topicMastery = this.getOrInitializeTopicMastery(upperClassId, studentId, topicId);

    // 2. Update Topic Mastery with weighted evidence
    let delta = 0;
    if (metrics.isCorrect === true) {
      // Base positive delta
      delta = 0.18;
      // Bonus for fast response without hints
      if (metrics.timeToAnswerMs && metrics.timeToAnswerMs < 20000 && (!metrics.hintsUsed || metrics.hintsUsed === 0)) {
        delta += 0.05;
      }
      // Slightly reduced if multiple attempts were required
      if (metrics.attemptsCount && metrics.attemptsCount > 1) {
        delta -= (metrics.attemptsCount - 1) * 0.04;
      }
    } else if (metrics.isCorrect === false) {
      // Negative delta
      delta = -0.16;
      if (metrics.attemptsCount && metrics.attemptsCount >= 2) {
        delta -= 0.04;
      }
    } else if (metrics.score !== undefined) {
      delta = (metrics.score - topicMastery.masteryScore) * 0.25;
    }

    // Dampen updates as evidence count grows (transparent moving average)
    const weight = 1.0 / Math.sqrt(1 + topicMastery.evidenceCount);
    topicMastery.masteryScore = Math.max(0.05, Math.min(0.98, topicMastery.masteryScore + delta * weight));
    topicMastery.evidenceCount += 1;
    topicMastery.lastAssessedAt = new Date().toISOString();

    // Record retention check if category is REVISION or MASTERY_CHECK
    if (event.category === 'REVISION' || event.category === 'MASTERY_CHECK') {
      topicMastery.retentionChecks.push({
        timestamp: new Date().toISOString(),
        score: topicMastery.masteryScore,
        intervalMinutes: 5,
      });
    }

    dbService.saveTopicMastery(topicMastery);

    // 3. Update Strategy Effectiveness
    if (metrics.strategyUsed && profile.strategyEffectiveness && profile.strategyEffectiveness[metrics.strategyUsed]) {
      const strat = profile.strategyEffectiveness[metrics.strategyUsed];
      strat.attempts += 1;
      if (metrics.isCorrect === true) {
        strat.successes += 1;
      }
      strat.score = strat.attempts > 0 ? (strat.successes / strat.attempts) : 0.5;
    }

    // 4. Update Global Learner Profile Characteristics (requires evidence threshold >= 2)
    profile.evidenceCount += 1;
    profile.currentTopic = topicId;
    profile.lastUpdated = new Date().toISOString();

    // Recompute overall mastery across all topics
    const allTopics = dbService.getAllTopicMasteries(upperClassId, studentId);
    if (allTopics.length > 0) {
      const sum = allTopics.reduce((acc, t) => acc + t.masteryScore, 0);
      profile.overallMastery = Math.round((sum / allTopics.length) * 100) / 100;
    }

    // Dynamic updates for dimensional cognitive masteries
    if (metrics.conceptUnderstanding !== undefined) {
      const prior = profile.conceptMastery ?? profile.overallMastery;
      profile.conceptMastery = Math.round((0.7 * prior + 0.3 * metrics.conceptUnderstanding) * 100) / 100;
    }
    if (metrics.reasoningQuality !== undefined) {
      const prior = profile.reasoningMastery ?? profile.overallMastery;
      profile.reasoningMastery = Math.round((0.7 * prior + 0.3 * metrics.reasoningQuality) * 100) / 100;
    }
    if (metrics.application !== undefined) {
      const prior = profile.applicationMastery ?? profile.overallMastery;
      profile.applicationMastery = Math.round((0.7 * prior + 0.3 * metrics.application) * 100) / 100;
    }
    if (metrics.transfer !== undefined) {
      const prior = profile.transferMastery ?? profile.overallMastery;
      profile.transferMastery = Math.round((0.7 * prior + 0.3 * metrics.transfer) * 100) / 100;
    }

    // Dynamic Preferred Strategy (evidence-based)
    let bestStrat: PreferredExplanationStyle = profile.preferredExplanationStyle;
    let maxStratScore = -1;
    const stratEntries = Object.entries(profile.strategyEffectiveness || {});
    for (const [sName, sData] of stratEntries) {
      if (sData.attempts >= 1 && sData.score > maxStratScore) {
        maxStratScore = sData.score;
        bestStrat = sName as PreferredExplanationStyle;
      }
    }
    profile.preferredExplanationStyle = bestStrat;

    // Comprehension Speed & Pace
    if (metrics.timeToAnswerMs) {
      if (metrics.timeToAnswerMs < 15000 && metrics.isCorrect) {
        profile.comprehensionSpeed = 'FAST';
        if (profile.evidenceCount >= 2 && profile.overallMastery >= 0.75) {
          profile.preferredPace = 'ACCELERATED';
        }
      } else if (metrics.timeToAnswerMs > 45000 || metrics.attemptsCount && metrics.attemptsCount > 2) {
        profile.comprehensionSpeed = 'DELIBERATE';
        profile.preferredPace = 'GENTLE';
      } else {
        profile.comprehensionSpeed = 'NORMAL';
        profile.preferredPace = 'COMFORTABLE';
      }
    }

    // Adaptive Difficulty & Support Level
    if (profile.overallMastery >= 0.85) {
      profile.difficultyLevel = 'HARD';
      profile.supportLevel = profile.overallMastery >= 0.92 ? 'STRONG_MASTERY' : 'READY_FOR_CHALLENGE';
      profile.practiceRequirement = 'LOW';
    } else if (profile.overallMastery >= 0.65) {
      profile.difficultyLevel = 'MEDIUM';
      profile.supportLevel = 'COMFORTABLE';
      profile.practiceRequirement = 'MEDIUM';
    } else if (profile.overallMastery >= 0.45) {
      profile.difficultyLevel = 'EASY';
      profile.supportLevel = 'GUIDED_PRACTICE';
      profile.practiceRequirement = 'HIGH';
    } else {
      profile.difficultyLevel = 'FOUNDATION';
      profile.supportLevel = 'NEEDS_REINFORCEMENT';
      profile.practiceRequirement = 'HIGH';
    }

    // Advance Personal Frontier if topic mastery is strong (>= 0.70)
    if (topicMastery.masteryScore >= 0.70) {
      profile.personalLearningFrontier = topicId;
    }

    dbService.saveLearnerProfile(profile);

    return {
      updatedProfile: profile,
      updatedTopicMastery: topicMastery,
    };
  }

  /**
   * Applies completed diagnostic session results to calculate the student's initial active profile.
   * Academic prior marks act as prior only (weight = 0.35); diagnostic evidence is 0.65.
   * If no marks exist, diagnostic evidence is 1.0.
   */
  public applyDiagnosticResults(
    classId: string,
    studentId: string,
    session: DiagnosticSession,
    summary: DiagnosticSummary
  ): StudentLearnerProfile {
    const upperClassId = classId.toUpperCase();
    const profile = this.getOrInitializeProfile(upperClassId, studentId);

    // Compute blended overall mastery
    let finalMastery = summary.overallScore;
    if (profile.priorAcademicPerformance.priorSubjectScore !== undefined) {
      const priorNorm = profile.priorAcademicPerformance.initialPriorScore;
      finalMastery = Math.round((0.35 * priorNorm + 0.65 * summary.overallScore) * 100) / 100;
    } else {
      finalMastery = Math.round(summary.overallScore * 100) / 100;
    }

    profile.profileStatus = 'ACTIVE';
    profile.activeDiagnosticSessionId = session.sessionId;
    profile.diagnosticCompletedAt = session.completedAt || new Date().toISOString();
    profile.diagnosticSummary = summary;
    profile.overallMastery = Math.max(0.10, Math.min(0.98, finalMastery));
    profile.foundationMastery = summary.foundationScore;
    profile.conceptMastery = summary.conceptScore;
    profile.applicationMastery = summary.applicationScore;
    profile.reasoningMastery = summary.reasoningScore;
    profile.transferMastery = summary.transferScore;
    profile.supportLevel = summary.calculatedSupportLevel;
    profile.preferredPace = summary.calculatedPace;
    profile.preferredExplanationStyle = summary.calculatedStrategy;
    profile.evidenceCount += session.questions.length;
    profile.lastUpdated = new Date().toISOString();

    // Set difficulty level based on diagnostic overall
    if (summary.overallScore >= 0.80) {
      profile.difficultyLevel = 'HARD';
      profile.comprehensionSpeed = 'FAST';
      profile.practiceRequirement = 'LOW';
      profile.prerequisiteDependency = 'LOW';
      profile.transferAbility = 'HIGH';
    } else if (summary.overallScore >= 0.55) {
      profile.difficultyLevel = 'MEDIUM';
      profile.comprehensionSpeed = 'NORMAL';
      profile.practiceRequirement = 'MEDIUM';
      profile.prerequisiteDependency = 'MEDIUM';
      profile.transferAbility = 'MEDIUM';
    } else {
      profile.difficultyLevel = 'EASY';
      profile.comprehensionSpeed = 'DELIBERATE';
      profile.practiceRequirement = 'HIGH';
      profile.prerequisiteDependency = 'HIGH';
      profile.transferAbility = 'LOW';
    }

    // Update topic masteries from individual question results
    for (const q of session.questions) {
      const ans = session.answers[q.id];
      if (!ans) continue;
      const tm = this.getOrInitializeTopicMastery(upperClassId, studentId, q.topicId, q.topicName);
      const qScore = ans.score !== undefined ? ans.score : (ans.isCorrect ? 1.0 : 0.25);
      tm.masteryScore = Math.max(0.10, Math.min(0.98, Math.round(qScore * 100) / 100));
      tm.evidenceCount += 1;
      tm.lastAssessedAt = new Date().toISOString();
      dbService.saveTopicMastery(tm);

      // Record individual learning event
      const event: LearningEventRecord = {
        id: `le_diag_${session.sessionId}_${q.id}`,
        studentId,
        classId: upperClassId,
        topicId: q.topicId,
        category: 'ASSESSMENT',
        metrics: {
          isCorrect: ans.isCorrect,
          score: qScore,
          timeToAnswerMs: ans.timeToAnswerMs,
          hintsUsed: ans.hintsUsed,
          difficulty: q.difficulty,
        },
        contextSummary: `Diagnostic Calibration: ${q.questionType} (${q.topicName})`,
        timestamp: ans.submittedAt || new Date().toISOString(),
      };
      dbService.recordLearningEvent(event);
    }

    dbService.saveLearnerProfile(profile);
    return profile;
  }

  /**
   * Triggers a recalibration session without wiping historical learner evidence.
   */
  public recalibrateProfile(classId: string, studentId: string): StudentLearnerProfile {
    const upperClassId = classId.toUpperCase();
    const profile = this.getOrInitializeProfile(upperClassId, studentId);
    // Does NOT wipe history. Keeps existing events and masteries intact.
    profile.lastUpdated = new Date().toISOString();
    dbService.saveLearnerProfile(profile);
    return profile;
  }
}

export const learnerModelService = new LearnerModelService();

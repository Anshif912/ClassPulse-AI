import { dbService } from '../db.service';
import {
  PersonalLearningProfile,
  ProfileCalibrationSession,
  ProfileCalibrationTask,
  ProfileCalibrationAnswerSubmission,
  EstimatedStudyTimeResult,
  ReadingPaceLevel,
  PerformanceLevel,
  EstimatedStudyPace,
  ProfileConfidenceLevel,
  PreferredInitialTeachingStyle,
  AssistanceLevelRequirement,
} from './types';

// ─── Default 5 Calibration Tasks (Course-Independent General Learning Baseline) ──
const CALIBRATION_PASSAGE = `In modern computing architectures, cache memory serves as an ultra-fast temporary holding area situated directly adjacent to the central processing unit (CPU). Because reading data directly from main system memory (RAM) requires hundreds of processor clock cycles, the CPU constantly anticipates which instructions and variables will be needed next. It copies these critical items into multi-tiered cache levels (L1, L2, and L3). L1 is the smallest and quickest cache, operating at the processor's core clock speed, while L3 is larger and shared across processor cores. When the processor successfully finds requested data in the cache, this is termed a "cache hit", allowing execution to proceed without memory bus latency. Conversely, a "cache miss" forces the system to pause and fetch the missing data from slower RAM. Effective caching algorithms maximize cache hit ratios, significantly accelerating overall throughput.`;

const CALIBRATION_PASSAGE_WORD_COUNT = 142;

export const DEFAULT_CALIBRATION_TASKS: ProfileCalibrationTask[] = [
  {
    taskId: 'cal_task_1_reading',
    taskType: 'READING_SPEED',
    title: 'Reading Pace Calibration',
    instructions: 'Read the short passage below at your natural, comfortable pace. When you have finished reading and understanding the text, click "I finished reading".',
    content: CALIBRATION_PASSAGE,
    estimatedSeconds: 45,
  },
  {
    taskId: 'cal_task_2_comprehension',
    taskType: 'COMPREHENSION',
    title: 'Core Comprehension Check',
    instructions: 'Based on the passage you just read, answer the question below.',
    content: 'What is the primary operational consequence when a "cache miss" occurs during processor execution?',
    options: [
      { optionId: 'opt_a', label: 'The CPU switches permanently to auxiliary storage' },
      { optionId: 'opt_b', label: 'The processor must pause and fetch data from slower main RAM', isCorrect: true },
      { optionId: 'opt_c', label: 'The L1 cache is instantly cleared and disabled' },
      { optionId: 'opt_d', label: 'The system clock frequency is permanently lowered' },
    ],
    estimatedSeconds: 30,
  },
  {
    taskId: 'cal_task_3_recall',
    taskType: 'RECALL',
    title: 'Information Retention & Recall',
    instructions: 'Without referring back to the text, select the correct statement regarding cache hierarchy levels.',
    content: 'Which statement accurately reflects the characteristics of L1 versus L3 cache as described in the passage?',
    options: [
      { optionId: 'opt_a', label: 'L1 is the largest cache, shared across all cores' },
      { optionId: 'opt_b', label: 'L3 operates at core clock speed and is smaller than L1' },
      { optionId: 'opt_c', label: 'L1 is the smallest and quickest cache, while L3 is larger and shared', isCorrect: true },
      { optionId: 'opt_d', label: 'Both L1 and L3 caches run at identical speeds to main RAM' },
    ],
    estimatedSeconds: 30,
  },
  {
    taskId: 'cal_task_4_application',
    taskType: 'APPLICATION',
    title: 'Application & Concept Transfer',
    instructions: 'Apply the caching principle to a real-world software performance scenario.',
    content: 'An engineer notices their web server frequently stalls when querying a database for customer addresses. If the engineer applies the caching architecture principle from the passage, what is the best strategy?',
    options: [
      { optionId: 'opt_a', label: 'Store frequently requested customer addresses in fast local in-memory storage (cache) to avoid repeated database lookups', isCorrect: true },
      { optionId: 'opt_b', label: 'Delete older customer records from the database whenever a query occurs' },
      { optionId: 'opt_c', label: 'Increase database query timeout limits to allow longer delays' },
      { optionId: 'opt_d', label: 'Require customers to re-enter their address on every web page' },
    ],
    estimatedSeconds: 40,
  },
  {
    taskId: 'cal_task_5_style',
    taskType: 'TEACHING_STYLE_PREFERENCE',
    title: 'Learning Style Preference',
    instructions: 'How do you learn new or challenging concepts most comfortably and effectively?',
    content: 'When beginning a complex new topic, what type of explanation helps you understand fastest?',
    options: [
      { optionId: 'style_step_by_step', label: 'Step-by-step logical breakdown starting from core definitions (Concept First)' },
      { optionId: 'style_analogies', label: 'Intuitive real-world analogies and visual metaphors (Analogy First)' },
      { optionId: 'style_examples', label: 'Concrete worked examples and practical code/problem walkthroughs (Example First)' },
      { optionId: 'style_interactive', label: 'Hands-on practice exercises and immediate self-testing (Practice First)' },
    ],
    estimatedSeconds: 25,
  },
];

export class PersonalLearningProfileService {
  /**
   * Retrieves an existing Layer 1 personal profile for the student,
   * or initializes an uncalibrated profile baseline.
   * NOTE: For fresh students, observed metrics are null / UNCALIBRATED.
   * Internal prior values are strictly preserved in the background studyTimeModel.
   */
  public getOrInitializePersonalProfile(studentId: string): PersonalLearningProfile {
    const existing = dbService.getPersonalLearningProfile(studentId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const defaultProfile: PersonalLearningProfile = {
      studentId,
      status: 'UNCALIBRATED',
      calibratedAt: null,
      readingSpeedWpm: null, // null until observed through calibration
      readingPaceLevel: 'UNCALIBRATED',
      comprehensionScore: null,
      comprehensionLevel: 'UNCALIBRATED',
      recallScore: null,
      recallLevel: 'UNCALIBRATED',
      applicationScore: null,
      applicationLevel: 'UNCALIBRATED',
      assistanceLevel: 'STANDARD',
      preferredInitialStyle: 'CONCEPT_FIRST',
      estimatedStudyPace: 'MODERATE',
      profileConfidence: 'BUILDING',
      calibrationSessionCount: 0,
      behavioralEvidenceCount: 0,
      studyDurationObservationCount: 0,
      studyTimeModel: {
        baseReadingSpeedWpm: 160, // Internal prior for initial calculations
        complexityAdjustmentFactor: 1.0,
        conceptDensityMultiplier: 1.1,
        historicalActualVsPredictedRatio: 1.0,
        calibrationSessionCount: 0,
        behavioralEvidenceCount: 0,
        studyDurationObservationCount: 0,
      },
      rationales: {
        readingPaceRationale: 'Not calibrated yet. 2-minute calibration recommended.',
        assistanceLevelRationale: 'Standard scaffolding baseline pending calibration check.',
        studyPaceRationale: 'Standard moderate pace estimate initialized.',
        preferredStyleRationale: 'Concept-first default starting preference.',
      },
      calibrationHistory: [],
      updatedAt: now,
    };

    dbService.savePersonalLearningProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Retrieves active in-progress calibration session if one exists for student.
   * Enables seamless reload recovery without resetting answers.
   */
  public getActiveCalibrationSession(studentId: string): ProfileCalibrationSession | null {
    const allSessions = Object.values((dbService as any).data.profileCalibrationSessions || {}) as ProfileCalibrationSession[];
    const active = allSessions.find(
      (s) => s.studentId === studentId && s.status === 'IN_PROGRESS'
    );
    return active || null;
  }

  /**
   * Starts a new 5-task calibration session.
   */
  public startCalibrationSession(studentId: string): ProfileCalibrationSession {
    const existingActive = this.getActiveCalibrationSession(studentId);
    if (existingActive) {
      return existingActive;
    }

    const sessionId = `cal_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const session: ProfileCalibrationSession = {
      sessionId,
      studentId,
      startedAt: now,
      tasks: DEFAULT_CALIBRATION_TASKS,
      submissions: [],
      currentTaskIndex: 0,
      status: 'IN_PROGRESS',
    };

    dbService.saveProfileCalibrationSession(session);
    return session;
  }

  /**
   * Submits an answer or timing measurement for a specific calibration task.
   */
  public submitCalibrationStep(
    sessionId: string,
    studentId: string,
    submission: ProfileCalibrationAnswerSubmission
  ): ProfileCalibrationSession {
    const session = dbService.getProfileCalibrationSession(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }
    if (session.studentId !== studentId) {
      throw new Error('Unauthorized calibration session access');
    }

    session.submissions = Array.isArray(session.submissions) ? session.submissions : [];
    // Upsert or push submission
    const existingIndex = session.submissions.findIndex((s: any) => s.taskId === submission.taskId);
    if (existingIndex >= 0) {
      session.submissions[existingIndex] = submission;
    } else {
      session.submissions.push(submission);
    }

    // Advance index
    session.currentTaskIndex = session.currentTaskIndex ?? 0;
    if (session.currentTaskIndex < session.tasks.length - 1) {
      session.currentTaskIndex += 1;
    }

    dbService.saveProfileCalibrationSession(session);
    return session;
  }

  /**
   * Completes calibration session, synthesizes Layer 1 metrics, updates Personal Learning Profile.
   */
  public completeCalibrationSession(sessionId: string, studentId: string): PersonalLearningProfile {
    const session = dbService.getProfileCalibrationSession(sessionId);
    if (!session) {
      throw new Error(`Calibration session ${sessionId} not found`);
    }
    if (session.studentId !== studentId) {
      throw new Error('Unauthorized calibration session access');
    }

    const now = new Date().toISOString();
    session.completedAt = now;
    session.status = 'COMPLETED';

    const subs = Array.isArray(session.submissions) ? session.submissions : [];

    // 1. Compute Reading Speed (Task 1)
    const task1Sub = subs.find((s: any) => s.taskId === 'cal_task_1_reading');
    const readingSeconds = Math.max(10, task1Sub?.timeSpentSeconds || 45);
    const readingSpeedWpm = Math.round((CALIBRATION_PASSAGE_WORD_COUNT / readingSeconds) * 60);

    let readingPaceLevel: ReadingPaceLevel = 'AVERAGE';
    let readingRationale = `Read ${CALIBRATION_PASSAGE_WORD_COUNT} words in ${readingSeconds}s (~${readingSpeedWpm} WPM). Standard reading pace.`;
    if (readingSpeedWpm < 130) {
      readingPaceLevel = 'SLOW';
      readingRationale = `Read ${CALIBRATION_PASSAGE_WORD_COUNT} words in ${readingSeconds}s (~${readingSpeedWpm} WPM). Deliberate, thorough reader who benefits from concise phrasing and structured pacing.`;
    } else if (readingSpeedWpm > 220) {
      readingPaceLevel = 'FAST';
      readingRationale = `Read ${CALIBRATION_PASSAGE_WORD_COUNT} words in ${readingSeconds}s (~${readingSpeedWpm} WPM). Rapid skimmer who quickly absorbs textual context.`;
    }

    // 2. Compute Comprehension (Task 2)
    const task2Sub = subs.find((s: any) => s.taskId === 'cal_task_2_comprehension');
    const compCorrect = task2Sub?.selectedOptionId === 'opt_b';
    const comprehensionScore = compCorrect ? 0.9 : 0.25;
    const comprehensionLevel: PerformanceLevel = compCorrect ? 'PROFICIENT' : 'FOUNDATIONAL';

    // 3. Compute Recall (Task 3)
    const task3Sub = subs.find((s: any) => s.taskId === 'cal_task_3_recall');
    const recallCorrect = task3Sub?.selectedOptionId === 'opt_c';
    const recallScore = recallCorrect ? 0.9 : 0.25;
    const recallLevel: PerformanceLevel = recallCorrect ? 'PROFICIENT' : 'FOUNDATIONAL';

    // 4. Compute Application (Task 4)
    const task4Sub = subs.find((s: any) => s.taskId === 'cal_task_4_application');
    const appCorrect = task4Sub?.selectedOptionId === 'opt_a';
    const applicationScore = appCorrect ? 0.9 : 0.25;
    const applicationLevel: PerformanceLevel = appCorrect ? 'PROFICIENT' : 'FOUNDATIONAL';

    // 5. Compute Preferred Style (Task 5)
    const task5Sub = subs.find((s: any) => s.taskId === 'cal_task_5_style');
    let preferredInitialStyle: PreferredInitialTeachingStyle = 'CONCEPT_FIRST';
    let preferredStyleRationale = 'Prefers systematic, step-by-step logical foundational concepts.';

    if (task5Sub?.selectedOptionId === 'style_analogies') {
      preferredInitialStyle = 'ANALOGY_HEAVY';
      preferredStyleRationale = 'Prefers intuitive real-world metaphors and relatable analogies.';
    } else if (task5Sub?.selectedOptionId === 'style_examples') {
      preferredInitialStyle = 'EXAMPLE_FIRST';
      preferredStyleRationale = 'Prefers concrete worked examples and practical demonstrations before theory.';
    } else if (task5Sub?.selectedOptionId === 'style_interactive') {
      preferredInitialStyle = 'PRACTICE_FIRST';
      preferredStyleRationale = 'Prefers hands-on exercises, practice challenges, and active learning.';
    }

    // Synthesize Assistance Level
    const totalScore = (comprehensionScore + recallScore + applicationScore) / 3;
    let assistanceLevel: AssistanceLevelRequirement = 'STANDARD';
    let assistanceRationale = 'Demonstrates balanced comprehension; standard scaffolding and guided checks recommended.';

    if (totalScore < 0.45) {
      assistanceLevel = 'EXTENSIVE_SUPPORT';
      assistanceRationale = 'Benefits from simplified language, granular micro-steps, and proactive checkpoint hints.';
    } else if (totalScore > 0.8) {
      assistanceLevel = 'INDEPENDENT_CHALLENGE';
      assistanceRationale = 'Demonstrates strong analytical transfer; benefits from high-level summaries and stretch challenges.';
    }

    // Synthesize Estimated Study Pace
    let estimatedStudyPace: EstimatedStudyPace = 'MODERATE';
    let studyPaceRationale = 'Balanced reading and comprehension pace (~35-45 minutes per standard 10-page unit).';

    if (readingPaceLevel === 'SLOW' || totalScore < 0.45) {
      estimatedStudyPace = 'INTENSIVE';
      studyPaceRationale = 'Allocates additional processing time (~45-60 minutes per standard unit) to ensure complete mastery without rushing.';
    } else if (readingPaceLevel === 'FAST' && totalScore >= 0.8) {
      estimatedStudyPace = 'EXPEDITED';
      studyPaceRationale = 'Fast absorption and rapid transfer (~25-35 minutes per standard unit).';
    }

    const profile: PersonalLearningProfile = {
      studentId,
      status: 'CALIBRATED',
      calibratedAt: now,
      readingSpeedWpm,
      readingPaceLevel,
      comprehensionScore,
      comprehensionLevel,
      recallScore,
      recallLevel,
      applicationScore,
      applicationLevel,
      assistanceLevel,
      preferredInitialStyle,
      estimatedStudyPace,
      profileConfidence: 'CALIBRATED_BASELINE',
      calibrationSessionCount: 1,
      behavioralEvidenceCount: 4, // 4 objective cognitive tasks evaluated
      studyDurationObservationCount: 0,
      studyTimeModel: {
        baseReadingSpeedWpm: readingSpeedWpm,
        complexityAdjustmentFactor: 1.0,
        conceptDensityMultiplier: 1.1,
        historicalActualVsPredictedRatio: 1.0,
        calibrationSessionCount: 1,
        behavioralEvidenceCount: 4,
        studyDurationObservationCount: 0,
      },
      rationales: {
        readingPaceRationale: readingRationale,
        assistanceLevelRationale: assistanceRationale,
        studyPaceRationale: studyPaceRationale,
        preferredStyleRationale: preferredStyleRationale,
      },
      calibrationHistory: [
        {
          calibratedAt: now,
          readingSpeedWpm,
          readingPaceLevel,
          comprehensionScore,
          recallScore,
          applicationScore,
          assistanceLevel,
          preferredStyle: preferredInitialStyle,
          estimatedPace: estimatedStudyPace,
          source: 'INITIAL_5_STEP_CALIBRATION',
        },
      ],
      updatedAt: now,
    };

    dbService.saveProfileCalibrationSession(session);
    dbService.savePersonalLearningProfile(profile);

    return profile;
  }

  /**
   * Predicts study time for a lesson/material using the student's dynamic Layer 1 calibration profile
   * combined with content parameters.
   */
  public estimateStudyDuration(
    studentId: string,
    options?: {
      wordCount?: number;
      conceptCount?: number;
      contentComplexity?: 'INTRODUCTORY' | 'MODERATE' | 'ADVANCED';
      currentMastery?: number;
    }
  ): EstimatedStudyTimeResult {
    const profile = this.getOrInitializePersonalProfile(studentId);

    const wordCount = options?.wordCount ?? 2500; // ~10 page lesson standard
    const conceptCount = options?.conceptCount ?? 5;
    const contentComplexity = options?.contentComplexity ?? 'MODERATE';
    const currentMastery = options?.currentMastery ?? 0.5;

    // Use observed reading speed if calibrated, otherwise default to model prior
    const wpm = Math.max(80, Math.min(450, profile.readingSpeedWpm || profile.studyTimeModel?.baseReadingSpeedWpm || 160));
    const baseReadingMinutes = wordCount / wpm;

    // 1. Deep Comprehension & Mental Processing (0.6x base + friction based on calibration)
    const compScore = (profile.comprehensionScore !== null && profile.comprehensionScore !== undefined) ? profile.comprehensionScore : 0.5;
    const compProcessingFactor = 0.6 + (1.0 - compScore) * 0.4;
    const comprehensionProcessingMinutes = baseReadingMinutes * compProcessingFactor;

    // 2. Concept Integration & Schema Linking (0.3x base + density factor per key concept)
    const conceptIntegrationFactor = 0.3 + Math.min(10, conceptCount) * 0.05;
    const conceptIntegrationMinutes = baseReadingMinutes * conceptIntegrationFactor;

    // 3. Mastery Review & Retrieval Practice (0.3x base + gap review factor)
    const masteryReviewFactor = 0.3 + (1.0 - currentMastery) * 0.35;
    const masteryGapReviewMinutes = baseReadingMinutes * masteryReviewFactor;

    // 4. Content Complexity multiplier
    const complexityMultiplier =
      contentComplexity === 'ADVANCED' ? 1.25 : contentComplexity === 'INTRODUCTORY' ? 0.85 : 1.0;

    // 5. Historical model adjustment factor
    const adjustmentFactor = profile.studyTimeModel?.complexityAdjustmentFactor ?? 1.0;

    const rawTotalMinutes =
      (baseReadingMinutes +
        comprehensionProcessingMinutes +
        conceptIntegrationMinutes +
        masteryGapReviewMinutes) *
      complexityMultiplier *
      adjustmentFactor;

    const estimatedMinutes = Math.max(5, Math.round(rawTotalMinutes));

    const breakdown = {
      baseReadingMinutes: Math.round(baseReadingMinutes * 10) / 10,
      comprehensionProcessingMinutes: Math.round(comprehensionProcessingMinutes * 10) / 10,
      conceptIntegrationMinutes: Math.round(conceptIntegrationMinutes * 10) / 10,
      masteryGapReviewMinutes: Math.round(masteryGapReviewMinutes * 10) / 10,
      complexityFactor: complexityMultiplier,
      adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
    };

    const evidenceLabel = profile.status === 'CALIBRATED'
      ? `calibrated reading pace (${wpm} WPM)`
      : `baseline prior pace (~${wpm} WPM pending calibration)`;

    const rationale = `Calculated dynamically from ${evidenceLabel}, ${contentComplexity.toLowerCase()} complexity, ${conceptCount} key concepts, and historical study feedback (${profile.studyDurationObservationCount || 0} study sessions recorded).`;

    return {
      estimatedMinutes,
      confidence: profile.profileConfidence,
      breakdown,
      rationale,
    };
  }

  /**
   * Refines the student's study time prediction model using actual study duration telemetry.
   */
  public recordActualStudyDuration(
    studentId: string,
    predictedMinutes: number,
    actualMinutes: number
  ): PersonalLearningProfile {
    const profile = this.getOrInitializePersonalProfile(studentId);

    if (predictedMinutes > 0 && actualMinutes > 0) {
      const rawRatio = actualMinutes / predictedMinutes;
      // Clamped ratio between 0.5 and 2.0 to prevent volatile shifts
      const ratio = Math.max(0.5, Math.min(2.0, rawRatio));

      const oldRatio = profile.studyTimeModel.historicalActualVsPredictedRatio || 1.0;
      const updatedRatio = oldRatio * 0.7 + ratio * 0.3;

      const oldFactor = profile.studyTimeModel.complexityAdjustmentFactor || 1.0;
      const updatedFactor = Math.max(0.6, Math.min(1.8, oldFactor * (0.8 + 0.2 * ratio)));

      const newStudyCount = (profile.studyDurationObservationCount || 0) + 1;
      const newEvidenceCount = (profile.behavioralEvidenceCount || 0) + 1;

      // Promote confidence level with ongoing evidence
      let newConfidence: ProfileConfidenceLevel = profile.profileConfidence;
      if (newStudyCount >= 4) {
        newConfidence = 'DYNAMIC_REFINED';
      } else if (newStudyCount >= 1 && profile.status === 'CALIBRATED') {
        newConfidence = 'MODERATE';
      }

      profile.studyDurationObservationCount = newStudyCount;
      profile.behavioralEvidenceCount = newEvidenceCount;
      profile.studyTimeModel = {
        baseReadingSpeedWpm: profile.readingSpeedWpm || profile.studyTimeModel?.baseReadingSpeedWpm || 160,
        complexityAdjustmentFactor: Math.round(updatedFactor * 1000) / 1000,
        conceptDensityMultiplier: profile.studyTimeModel.conceptDensityMultiplier || 1.1,
        historicalActualVsPredictedRatio: Math.round(updatedRatio * 1000) / 1000,
        calibrationSessionCount: profile.calibrationSessionCount || 1,
        behavioralEvidenceCount: newEvidenceCount,
        studyDurationObservationCount: newStudyCount,
      };

      profile.profileConfidence = newConfidence;
      profile.updatedAt = new Date().toISOString();

      dbService.savePersonalLearningProfile(profile);
    }

    return profile;
  }

  /**
   * Resets / recalibrates the personal profile to allow student re-taking the 5-step test.
   */
  public recalibrateProfile(studentId: string): ProfileCalibrationSession {
    return this.startCalibrationSession(studentId);
  }

  /**
   * Teacher cohort aggregate: returns privacy-safe class aggregate metrics.
   * STRICT PRIVACY: Zero raw reading speeds or individual student records are exposed.
   */
  public getTeacherCohortProfileAggregate(classId: string): {
    classId: string;
    totalCalibratedStudents: number;
    paceDistribution: Record<EstimatedStudyPace, number>;
    assistanceLevelDistribution: Record<AssistanceLevelRequirement, number>;
    styleDistribution: Record<PreferredInitialTeachingStyle, number>;
    averageEstimatedLessonMinutes: number;
  } {
    const memberships = dbService.getMembershipsByClass(classId);
    const studentMembers = memberships.filter((m: any) => m.role === 'STUDENT' || m.role === 'student');

    const paceDist: Record<EstimatedStudyPace, number> = {
      ACCELERATED: 0,
      COMFORTABLE: 0,
      GUIDED: 0,
      EXPEDITED: 0,
      MODERATE: 0,
      INTENSIVE: 0,
    };

    const assistDist: Record<AssistanceLevelRequirement, number> = {
      INDEPENDENT_CHALLENGE: 0,
      STANDARD: 0,
      EXTENSIVE_SUPPORT: 0,
    };

    const styleDist: Record<string, number> = {
      CONCEPT_FIRST: 0,
      ANALOGY_HEAVY: 0,
      EXAMPLE_FIRST: 0,
      PRACTICE_FIRST: 0,
      DIRECT: 0,
      ANALOGY_EXAMPLE: 0,
      STEP_BY_STEP: 0,
      QUESTION_LED: 0,
      VISUAL_STRUCTURED: 0,
    };

    let calibratedCount = 0;
    let totalEstimatedMinutes = 0;

    for (const member of studentMembers) {
      const profile = dbService.getPersonalLearningProfile(member.userId);
      if (profile && profile.status === 'CALIBRATED') {
        calibratedCount += 1;
        const pPace = profile.estimatedStudyPace as EstimatedStudyPace;
        if (pPace && paceDist[pPace] !== undefined) {
          paceDist[pPace] = (paceDist[pPace] || 0) + 1;
        }
        const pAssist = profile.assistanceLevel as AssistanceLevelRequirement;
        if (pAssist && assistDist[pAssist] !== undefined) {
          assistDist[pAssist] = (assistDist[pAssist] || 0) + 1;
        }
        const pStyle = profile.preferredInitialStyle as string;
        if (pStyle && styleDist[pStyle] !== undefined) {
          styleDist[pStyle] = (styleDist[pStyle] || 0) + 1;
        }

        const est = this.estimateStudyDuration(member.userId);
        totalEstimatedMinutes += est.estimatedMinutes ?? est.estimatedMinutesMin ?? 40;
      }
    }

    const avgMinutes = calibratedCount > 0 ? Math.round(totalEstimatedMinutes / calibratedCount) : 40;

    return {
      classId,
      totalCalibratedStudents: calibratedCount,
      paceDistribution: paceDist,
      assistanceLevelDistribution: assistDist,
      styleDistribution: styleDist,
      averageEstimatedLessonMinutes: avgMinutes,
    };
  }
}

export const personalLearningProfileService = new PersonalLearningProfileService();

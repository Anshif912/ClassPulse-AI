import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { teachingStrategyEngine } from '../services/personalization/teachingStrategyEngine';
import { studyAssistantService } from '../services/personalization/studyAssistantService';
import { personalLearningProfileService } from '../services/personalization/personalLearningProfileService';
import { requireAuth, requireMembership, requireTeacher, rateLimit } from '../middleware/auth.middleware';
import { TeacherClassroomIntelligence, LearningEventRecord } from '../services/personalization/types';

const router = Router();

// ─── GET /api/personalization/me/:classId ────────────────────────────────────
// Returns authenticated student's private learner profile & topic masteries
router.get('/me/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const membership = dbService.getMembership(upperClassId, studentId);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    const profile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);
    const masteries = dbService.getAllTopicMasteries(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);
    const events = dbService.getLearningEvents(upperClassId, studentId, 10);
    const activeSession = dbService.getActiveDiagnosticSession(upperClassId, studentId);

    // Compute dynamic decision & next best action
    const currentTopic = liveState?.currentLiveTopic || profile.currentTopic || Object.values(graph.concepts)[0]?.id || 'second_generation';
    const decision = tutorDecisionEngine.decide(upperClassId, studentId, '', currentTopic);

    let nextBestAction = {
      action: 'CONTINUE_LEARNING',
      label: `Continue: ${decision.topicName}`,
      topicId: decision.topicId,
      reason: decision.rationale,
    };

    if (profile.profileStatus === 'UNINITIALIZED') {
      nextBestAction = {
        action: 'START_DIAGNOSTIC',
        label: 'Start Calibration Diagnostic',
        topicId: currentTopic,
        reason: 'Answer 5 quick questions (~2 mins) so ClassPulse can understand your starting point and personalize the lesson for you.',
      };
    } else if (profile.profileStatus === 'CALIBRATING' || activeSession) {
      nextBestAction = {
        action: 'CONTINUE_DIAGNOSTIC',
        label: 'Continue Diagnostic',
        topicId: currentTopic,
        reason: 'Complete your diagnostic check to finalize your personalized learning path.',
      };
    } else if (decision.action === 'PREREQUISITE_BRIDGE') {
      nextBestAction = {
        action: 'LEARN_PREREQUISITE',
        label: `Learn Prerequisite: ${decision.topicName}`,
        topicId: decision.topicId,
        reason: decision.rationale,
      };
    } else if (decision.needsPractice) {
      nextBestAction = {
        action: 'PRACTICE_TOPIC',
        label: `Practice: ${decision.topicName}`,
        topicId: decision.topicId,
        reason: decision.rationale,
      };
    } else if (decision.action === 'CHALLENGE_EXTENSION') {
      nextBestAction = {
        action: 'TRY_CHALLENGE',
        label: `Try Challenge: ${decision.topicName}`,
        topicId: decision.topicId,
        reason: decision.rationale,
      };
    }

    res.json({
      profile,
      topicMasteries: masteries,
      masteries,
      conceptGraph: graph,
      concepts: Object.values(graph.concepts),
      currentLiveTopic: liveState?.currentLiveTopic || profile.currentTopic,
      recentEvents: events,
      tutorDecision: decision,
      nextBestAction,
      activeDiagnosticSession: activeSession,
    });
  }
);

// ─── POST /api/personalization/event ──────────────────────────────────────────
// Records interactive learning events (doubts, attempts, practice, hints)
router.post('/event',
  requireAuth,
  rateLimit(60, 60_000),
  (req: Request, res: Response): void => {
    const { classId, topicId, category, metrics, contextSummary } = req.body;
    if (!classId || !topicId || !category) {
      res.status(400).json({ error: 'classId, topicId, and category are required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    const event: LearningEventRecord = {
      id: `le_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId,
      classId: upperClassId,
      topicId,
      category,
      metrics: metrics || {},
      contextSummary,
      timestamp: new Date().toISOString(),
    };

    const result = learnerModelService.processLearningEvent(event);
    res.json(result);
  }
);

// ─── GET /api/personalization/bridge/:classId ─────────────────────────────────
// Generates the Minimum Personalized Learning Bridge for late join or gap repair
router.get('/bridge/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const bridge = bridgeGeneratorService.generateBridge(upperClassId, studentId);
    res.json({
      bridge,
      ...bridge,
    });
  }
);

// ─── POST /api/personalization/assessment/generate ────────────────────────────
// Generates an adaptive micro-assessment check question
router.post('/assessment/generate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId, topicId } = req.body;
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    try {
      const question = await microAssessmentService.generateQuestion(upperClassId, studentId, topicId);
      res.json({ question, ...question });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate assessment check: ' + err.message });
    }
  }
);

// ─── POST /api/personalization/assessment/evaluate ────────────────────────────
// Evaluates student answer & updates learner profile
router.post('/assessment/evaluate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId, question, studentAnswer, timeToAnswerMs } = req.body;
    if (!classId || !question || !studentAnswer) {
      res.status(400).json({ error: 'classId, question, and studentAnswer are required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    try {
      const result = await microAssessmentService.evaluateAnswer(
        upperClassId,
        studentId,
        question,
        studentAnswer,
        timeToAnswerMs
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to evaluate answer: ' + err.message });
    }
  }
);

// ─── GET /api/personalization/teacher/insights/:classId ───────────────────────
// Teacher-only: Aggregated Classroom Learning Intelligence & Mastery Breakdown
router.get('/teacher/insights/:classId',
  requireAuth,
  requireTeacher,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: 'Classroom not found.' });
      return;
    }

    const profiles = dbService.getClassLearnerProfiles(upperClassId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);
    const totalStudents = Math.max(1, profiles.length);

    // Compute distribution
    const distribution = {
      comfortable: profiles.filter((p) => p.supportLevel === 'COMFORTABLE').length,
      needsReinforcement: profiles.filter((p) => p.supportLevel === 'NEEDS_REINFORCEMENT').length,
      guidedPractice: profiles.filter((p) => p.supportLevel === 'GUIDED_PRACTICE').length,
      readyForChallenge: profiles.filter((p) => p.supportLevel === 'READY_FOR_CHALLENGE').length,
      strongMastery: profiles.filter((p) => p.supportLevel === 'STRONG_MASTERY').length,
    };

    const avgMastery = Math.round(
      (profiles.reduce((acc, p) => acc + p.overallMastery, 0) / totalStudents) * 100
    );

    // Difficult concepts & gaps
    const conceptMasteryMap: Record<string, { total: number; count: number; needingHelp: number }> = {};
    for (const concept of Object.values(graph.concepts)) {
      conceptMasteryMap[concept.id] = { total: 0, count: 0, needingHelp: 0 };
    }

    for (const profile of profiles) {
      const masteries = dbService.getAllTopicMasteries(upperClassId, profile.studentId);
      for (const m of masteries) {
        if (!conceptMasteryMap[m.topicId]) {
          conceptMasteryMap[m.topicId] = { total: 0, count: 0, needingHelp: 0 };
        }
        conceptMasteryMap[m.topicId].total += m.masteryScore;
        conceptMasteryMap[m.topicId].count += 1;
        if (m.masteryScore < 0.60) {
          conceptMasteryMap[m.topicId].needingHelp += 1;
        }
      }
    }

    const difficultConcepts = Object.entries(conceptMasteryMap).map(([tid, data]) => {
      const cnode = graph.concepts[tid];
      const avg = data.count > 0 ? data.total / data.count : 0.70;
      return {
        topicId: tid,
        topicName: cnode ? cnode.name : tid,
        averageMastery: Math.round(avg * 100) / 100,
        studentsNeedingHelpCount: data.needingHelp,
      };
    }).sort((a, b) => a.averageMastery - b.averageMastery);

    const intelligence: TeacherClassroomIntelligence = {
      classId: upperClassId,
      className: classroom.name,
      currentLiveTopic: liveState?.currentLiveTopic || 'second_generation',
      totalStudents: profiles.length,
      averageMasteryPercent: avgMastery || 75,
      distribution,
      difficultConcepts,
      commonMisconceptions: [
        {
          topicId: 'transistors',
          topicName: 'Transistor Advantages',
          misconception: 'Confusing transistor semiconductor mechanics with vacuum tube filaments',
          frequencyCount: distribution.needsReinforcement,
        }
      ],
      activeAIInterventionsCount: profiles.reduce((acc, p) => acc + p.evidenceCount, 0),
      lateJoinCatchupCount: profiles.filter((p) => p.overallMastery < 0.60).length,
    };

    res.json({
      intelligence,
      state: liveState,
      conceptGraph: graph,
      ...intelligence,
    });
  }
);

// ─── POST /api/personalization/teacher/frontier/:classId ──────────────────────
// Teacher updates the live classroom topic frontier
router.post('/teacher/frontier/:classId',
  requireAuth,
  requireTeacher,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const { topicId, topicName } = req.body;
    if (!topicId) {
      res.status(400).json({ error: 'topicId is required.' });
      return;
    }

    const existing = dbService.getClassroomLearningState(upperClassId);
    const updated = {
      classId: upperClassId,
      currentLiveTopic: topicId,
      timeline: existing?.timeline || [
        {
          topicId,
          topicName: topicName || topicId,
          startedAt: new Date().toISOString(),
          prerequisiteIds: [],
        }
      ],
      updatedAt: new Date().toISOString(),
    };

    dbService.saveClassroomLearningState(updated);
    studentLearningStateService.invalidateClass(upperClassId);

    res.json({
      success: true,
      state: updated,
      ...updated,
    });
  }
);

// ─── GET /api/personalization/diagnostic/:classId ─────────────────────────────
// Generates or fetches active diagnostic calibration session
router.get('/diagnostic/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const membership = dbService.getMembership(upperClassId, studentId);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    const session = microAssessmentService.generateDiagnosticSuite(upperClassId, studentId);
    res.json({ session });
  }
);

// ─── POST /api/personalization/diagnostic/:classId/answer ─────────────────────
// Saves partial answer progress for a diagnostic question
router.post('/diagnostic/:classId/answer',
  requireAuth,
  (req: Request, res: Response): void => {
    const { sessionId, submission } = req.body;
    if (!sessionId || !submission || !submission.questionId) {
      res.status(400).json({ error: 'sessionId and submission with questionId are required.' });
      return;
    }

    const updated = microAssessmentService.saveQuestionAnswer(sessionId, submission);
    res.json({ success: true, session: updated });
  }
);

// ─── POST /api/personalization/diagnostic/:classId/submit ─────────────────────
// Evaluates all diagnostic answers, calculates profile & activates ACTIVE state
router.post('/diagnostic/:classId/submit',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;
    const { sessionId, submissions } = req.body;

    const result = microAssessmentService.evaluateDiagnosticSuite(upperClassId, studentId, sessionId, submissions || []);
    const updatedProfile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);

    res.json({
      success: true,
      summary: result.summary,
      session: result.session,
      profile: updatedProfile,
    });
  }
);

// ─── POST /api/personalization/recalibrate/:classId ───────────────────────────
// Triggers recalibration suite without wiping previous learner history
router.post('/recalibrate/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const profile = learnerModelService.recalibrateProfile(upperClassId, studentId);
    const session = microAssessmentService.generateDiagnosticSuite(upperClassId, studentId);

    res.json({
      success: true,
      profile,
      session,
    });
  }
);

// ─── GET /api/personalization/state/:classId ──────────────────────────────────
// Returns the single canonical StudentLearningState snapshot & "Why this now?"
router.get('/state/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const membership = dbService.getMembership(upperClassId, studentId);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    res.json({ state });
  }
);

// ─── POST /api/personalization/study-session/start ────────────────────────────
// Starts an adaptive "Study With Me" session with dynamically planned phases
router.post('/study-session/start',
  requireAuth,
  (req: Request, res: Response): void => {
    const { classId, topicId, mode } = req.body;
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    const result = studyAssistantService.startStudySession(upperClassId, studentId, topicId, mode);
    res.json(result);
  }
);

// ─── POST /api/personalization/study-session/step ─────────────────────────────
// Evaluates study session phase response and advances to next adapted phase
router.post('/study-session/step',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId, sessionId, studentResponse, timeToAnswerMs } = req.body;
    if (!classId || !sessionId) {
      res.status(400).json({ error: 'classId and sessionId are required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    try {
      const result = await studyAssistantService.stepStudySession(
        upperClassId,
        studentId,
        sessionId,
        studentResponse || '',
        timeToAnswerMs
      );
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }
);

// ─── GET /api/personalization/study-session/active/:classId ───────────────────
// Retrieves ongoing study session if any
router.get('/study-session/active/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const session = dbService.getActiveStudySession(upperClassId, studentId);
    res.json({ session: session || null });
  }
);

// ─── GET /api/personalization/study-plan/:classId ─────────────────────────────
// Retrieves goal-aware study plan
router.get('/study-plan/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const activeGoal = dbService.getActiveStudyGoal(upperClassId, studentId);
    let plan = activeGoal ? dbService.getStudyPlanForGoal(activeGoal.id) : undefined;

    if (!plan && activeGoal) {
      plan = studyAssistantService.generateStudyPlan(upperClassId, studentId, activeGoal.goalType, activeGoal.targetDate, activeGoal.title);
    }

    res.json({ goal: activeGoal || null, plan: plan || null });
  }
);

// ─── POST /api/personalization/study-plan/:classId/goal ───────────────────────
// Creates or updates learning goal and recalculates study plan
router.post('/study-plan/:classId/goal',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;
    const { goalType, targetDate, title } = req.body;

    if (!goalType) {
      res.status(400).json({ error: 'goalType is required (EXAM_PREP | DEEP_MASTERY | COURSE_COMPLETION | CUSTOM).' });
      return;
    }

    const plan = studyAssistantService.generateStudyPlan(upperClassId, studentId, goalType, targetDate, title);
    const goal = dbService.getStudyGoal(plan.goalId);

    res.json({
      success: true,
      goal,
      plan,
    });
  }
);

// ─── POST /api/personalization/strategy-override ──────────────────────────────
// Applies session-level temporary teaching style override
router.post('/strategy-override',
  requireAuth,
  (req: Request, res: Response): void => {
    const { classId, strategy, depth, promptStyle } = req.body;
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const studentId = req.user!.id;

    if (strategy || depth || promptStyle) {
      teachingStrategyEngine.setSessionOverride(upperClassId, studentId, { strategy, depth, promptStyle });
    } else {
      teachingStrategyEngine.clearSessionOverride(upperClassId, studentId);
    }

    res.json({ success: true, message: 'Session strategy override updated.' });
  }
);

// ─── GET /api/personalization/retention-queue/:classId ────────────────────────
// Retrieves spaced retention / reinforcement queue
router.get('/retention-queue/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const studentId = req.user!.id;

    const queue = dbService.getRetentionQueue(upperClassId, studentId);
    res.json({ retentionQueue: queue });
  }
);

// ─── Phase 5: Personal Learning Profile (Layer 1) Endpoints ───────────────────

// GET /api/personalization/profile
// Retrieves authenticated student's cross-course Layer 1 Personal Learning Profile
router.get('/profile',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const profile = personalLearningProfileService.getOrInitializePersonalProfile(studentId);
    res.json({ profile });
  }
);

// GET /api/personalization/calibration/active
// Retrieves active in-progress calibration session if any exists
router.get('/calibration/active',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const session = personalLearningProfileService.getActiveCalibrationSession(studentId);
    res.json({ session });
  }
);

// POST /api/personalization/calibration/start
// Starts a new 5-step personal learning calibration session
router.post('/calibration/start',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const session = personalLearningProfileService.startCalibrationSession(studentId);
    res.json({ session });
  }
);

// POST /api/personalization/calibration/step
// Submits an answer/measurement for a single calibration step
router.post('/calibration/step',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const { sessionId, submission } = req.body;

    if (!sessionId || !submission || !submission.taskId) {
      res.status(400).json({ error: 'sessionId and valid submission object are required.' });
      return;
    }

    try {
      const session = personalLearningProfileService.submitCalibrationStep(sessionId, studentId, submission);
      res.json({ session });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to submit calibration step' });
    }
  }
);

// POST /api/personalization/calibration/complete
// Finalizes calibration session, computes Layer 1 metrics, updates profile
router.post('/calibration/complete',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required.' });
      return;
    }

    try {
      const profile = personalLearningProfileService.completeCalibrationSession(sessionId, studentId);
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to complete calibration' });
    }
  }
);

// POST /api/personalization/recalibrate
// Resets / starts a fresh calibration session
router.post('/recalibrate',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const session = personalLearningProfileService.recalibrateProfile(studentId);
    res.json({ session });
  }
);

// POST /api/personalization/study-session/record
// Records actual study session duration feedback to refine study time model
router.post('/study-session/record',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const { predictedMinutes, actualMinutes } = req.body;

    if (predictedMinutes === undefined || actualMinutes === undefined) {
      res.status(400).json({ error: 'predictedMinutes and actualMinutes are required.' });
      return;
    }

    const updatedProfile = personalLearningProfileService.recordActualStudyDuration(
      studentId,
      Number(predictedMinutes),
      Number(actualMinutes)
    );

    res.json({ success: true, profile: updatedProfile });
  }
);

// GET /api/personalization/estimate-study-time
// Computes dynamic study time estimate for given content parameters
router.get('/estimate-study-time',
  requireAuth,
  (req: Request, res: Response): void => {
    const studentId = req.user!.id;
    const wordCount = req.query.wordCount ? Number(req.query.wordCount) : 2500;
    const conceptCount = req.query.conceptCount ? Number(req.query.conceptCount) : 5;
    const contentComplexity = (req.query.contentComplexity as any) || 'MODERATE';
    const currentMastery = req.query.currentMastery ? Number(req.query.currentMastery) : 0.5;

    const estimate = personalLearningProfileService.estimateStudyDuration(studentId, {
      wordCount,
      conceptCount,
      contentComplexity,
      currentMastery,
    });

    res.json({ estimate });
  }
);

// GET /api/personalization/cohort-profile-aggregate/:classId
// Teacher view: Returns aggregate privacy-safe student pace & style distributions
router.get('/cohort-profile-aggregate/:classId',
  requireTeacher,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const aggregate = personalLearningProfileService.getTeacherCohortProfileAggregate(upperClassId);
    res.json({ aggregate });
  }
);

export default router;

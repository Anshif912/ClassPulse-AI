import os

code_rag_adapter = """import { ragPipeline } from '../rag/ragPipeline';
import { RAGQueryResult, LanguageCode } from '../rag/types';
import { tutorDecisionEngine } from './tutorDecisionEngine';
import { learnerModelService } from './learnerModelService';
import { RAGProviderFactory } from '../rag/providers/providerFactory';
import { TutorDecision, LearningEventRecord } from './types';

export interface PersonalizedRAGResult extends RAGQueryResult {
  tutorDecision: TutorDecision;
  personalizedExplanation: string;
  suggestedFollowUpPractice?: string;
}

export class PersonalizedRAGAdapter {
  /**
   * Executes personalized RAG synthesis:
   * 1. Evaluates student learner profile & generates TutorDecision
   * 2. Retrieves course-grounded chunks via existing class-scoped RAG pipeline
   * 3. Adapts Qwen3 4B prompt synthesis with strategy, depth, and scaffolding
   * 4. Records learning interaction event
   */
  public async queryPersonalized(
    rawQuery: string,
    classId: string,
    studentId: string,
    recentQuestions: string[] = []
  ): Promise<PersonalizedRAGResult> {
    const upperClassId = classId.toUpperCase();

    // 1. Generate Tutor Decision based on student learner profile
    const decision = tutorDecisionEngine.decide(upperClassId, studentId, rawQuery);

    // 2. Query Authoritative Course Evidence via Existing RAG Pipeline
    const ragResult = await ragPipeline.query(rawQuery, upperClassId, recentQuestions);

    // 3. Craft Personalized Tutor Instructions for Qwen3 4B
    const strategyPrompts: Record<string, string> = {
      DIRECT: 'Provide a concise, direct, and rigorous technical explanation. Avoid filler.',
      ANALOGY_EXAMPLE: 'Use a clear, intuitive real-world analogy and concrete example to explain the concept simply before providing the technical definition.',
      STEP_BY_STEP: 'Break down the concept into 2-3 logical, step-by-step numbered points.',
      QUESTION_LED: 'Explain the core insight and conclude with an insightful guiding question to check understanding.',
      VISUAL_STRUCTURED: 'Format the explanation with clear bullet points, bold key terms, and structured comparison.',
    };

    const depthPrompts: Record<string, string> = {
      SHORT: 'Keep explanation to 2 crisp, high-density sentences.',
      MEDIUM: 'Provide 3-4 structured sentences with clear concept grounding.',
      LAYERED: 'Provide a layered explanation: First explain the foundational bridge/prerequisite, then explain the main concept with an example.',
    };

    const lang = ragResult.detectedLanguage || 'en';
    const langPrompt =
      lang === 'ta'
        ? 'Respond fluently in Tamil (தமிழ்).'
        : lang === 'hi'
        ? 'Respond fluently in Hindi (हिंदी).'
        : lang === 'tanglish'
        ? 'Respond in friendly, natural Tanglish / Tamil-English style.'
        : 'Respond in clear English.';

    const bridgeInfo = decision.prerequisiteBridgeRequired
      ? `Student has a gap in ${decision.prerequisiteBridgeRequired.gaps.map((g) => g.prerequisiteTopicName).join(', ')}. Mention this context gently.`
      : 'Student is comfortable with prerequisites.';

    const systemPrompt = `You are ClassPulse AI Personal Tutor for a student in class ${upperClassId}.
Personalization Directives:
- Strategy: ${strategyPrompts[decision.strategy] || strategyPrompts.ANALOGY_EXAMPLE}
- Depth: ${depthPrompts[decision.depth] || depthPrompts.MEDIUM}
- Language: ${langPrompt}
- Grounding: Use the provided classroom reference notes strictly.
- Prerequisite Scaffold: ${bridgeInfo}`;

    const llmProvider = RAGProviderFactory.getLLMProvider();
    let personalizedExplanation = ragResult.answerText;

    try {
      const llmRes = await llmProvider.generateAnswer(
        rawQuery,
        ragResult.sources.map((s) => s.citationText).join('\\n') + '\\n\\n' + ragResult.answerText,
        {
          systemPrompt,
          language: lang,
          temperature: decision.strategy === 'ANALOGY_EXAMPLE' ? 0.3 : 0.1,
          maxTokens: decision.depth === 'SHORT' ? 180 : 350,
        }
      );
      if (llmRes && llmRes.text && llmRes.text.length > 15) {
        personalizedExplanation = llmRes.text;
      }
    } catch (err) {
      console.warn('[PERSONALIZED_RAG] LLM custom synthesis error, falling back to grounded text:', err);
    }

    // 4. Generate Follow-up Practice Suggestion
    let suggestedPractice: string | undefined = undefined;
    if (decision.needsPractice) {
      suggestedPractice = decision.difficulty === 'HARD' || decision.difficulty === 'ADVANCED'
        ? 'Challenge Check: How would this concept behave under non-standard operating conditions?'
        : 'Quick Check: Try explaining the main advantage in your own words!';
    }

    // 5. Record Learning Event
    const event: LearningEventRecord = {
      id: `le_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId,
      classId: upperClassId,
      topicId: decision.topicId,
      category: 'DOUBT',
      metrics: {
        strategyUsed: decision.strategy,
        difficulty: decision.difficulty,
        timeToAnswerMs: 5000,
      },
      contextSummary: `Student asked doubt on ${decision.topicName}: "${rawQuery.slice(0, 80)}"`,
      timestamp: new Date().toISOString(),
    };
    learnerModelService.processLearningEvent(event);

    return {
      ...ragResult,
      answerText: personalizedExplanation,
      spokenText: personalizedExplanation,
      tutorDecision: decision,
      personalizedExplanation,
      suggestedFollowUpPractice: suggestedPractice,
    };
  }
}

export const personalizedRAGAdapter = new PersonalizedRAGAdapter();
"""

code_routes = """import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
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

    res.json({
      profile,
      masteries,
      concepts: Object.values(graph.concepts),
      currentLiveTopic: liveState?.currentLiveTopic || profile.currentTopic,
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
    res.json(bridge);
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
      res.json(question);
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

    res.json(intelligence);
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
    res.json(updated);
  }
);

export default router;
"""

with open('backend/src/services/personalization/personalizedRAGAdapter.ts', 'w', encoding='utf-8') as f:
    f.write(code_rag_adapter)
print('Wrote personalizedRAGAdapter.ts')

with open('backend/src/routes/personalization.routes.ts', 'w', encoding='utf-8') as f:
    f.write(code_routes)
print('Wrote personalization.routes.ts')


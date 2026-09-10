import { ragPipeline } from '../rag/ragPipeline';
import { RAGQueryResult, LanguageCode } from '../rag/types';
import { tutorDecisionEngine } from './tutorDecisionEngine';
import { learnerModelService } from './learnerModelService';
import { studyAssistantService } from './studyAssistantService';
import { RAGProviderFactory } from '../rag/providers/providerFactory';
import { TutorDecision, LearningEventRecord } from './types';

export interface PersonalizedRAGResult extends RAGQueryResult {
  tutorDecision: TutorDecision;
  personalizedExplanation: string;
  suggestedFollowUpPractice?: string;
  transparencyRationale?: string;
  personalizationLatency?: {
    decisionMs: number;
    ragMs: number;
    generationMs: number;
    totalMs: number;
  };
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
    const t0 = Date.now();
    const upperClassId = classId.toUpperCase();

    // ─── T1: Learner Profile Lookup ───────────────────────────────────────────
    const t1Start = Date.now();
    const profile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);
    const t1_profileMs = Date.now() - t1Start;

    // ─── T2 & T3 & T4: Topic, Prerequisite & Tutor Decision ───────────────────
    const t4Start = Date.now();
    const decision = tutorDecisionEngine.decide(upperClassId, studentId, rawQuery);
    const t4_decisionMs = Date.now() - t4Start;

    // ─── T8: Personalized System Prompt Construction ──────────────────────────
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

    const bridgeInfo = decision.prerequisiteBridgeRequired
      ? `Student has a prerequisite gap in ${decision.prerequisiteBridgeRequired.gaps.map((g) => g.prerequisiteTopicName).join(', ')}. Mention this context gently.`
      : 'Student is comfortable with prerequisites.';

    const compactMemory = studyAssistantService.buildCompactLearningMemoryContext(upperClassId, studentId);

    const systemPrompt = `You are ClassPulse AI Personal Tutor for a student in class ${upperClassId}.
Personalization Directives:
- Strategy: ${strategyPrompts[decision.strategy] || strategyPrompts.ANALOGY_EXAMPLE}
- Depth: ${depthPrompts[decision.depth] || depthPrompts.MEDIUM}
- Grounding: Use the provided classroom reference notes strictly.
- Prerequisite Scaffold: ${bridgeInfo}

${compactMemory}`;

    // ─── T5 - T10: Single-Pass RAG Retrieval & LLM Generation ────────────────
    const tRagStart = Date.now();
    const ragResult = await ragPipeline.query(rawQuery, upperClassId, recentQuestions, systemPrompt);
    const ragMs = Date.now() - tRagStart;

    // ─── Practice & Learning Event Recording ──────────────────────────────────
    let suggestedPractice: string | undefined = undefined;
    if (decision.needsPractice) {
      suggestedPractice = decision.difficulty === 'HARD' || decision.difficulty === 'ADVANCED'
        ? 'Challenge Check: How would this concept behave under non-standard operating conditions?'
        : 'Quick Check: Try explaining the main advantage in your own words!';
    }

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

    const totalMs = Date.now() - t0;
    const personalizationOverheadMs = t1_profileMs + t4_decisionMs;

    // Granular Debug Trace & Timing Breakdown
    console.log('[PERSONALIZATION_DEBUG_TRACE]', {
      studentId,
      classId: upperClassId,
      topic: decision.topicId,
      priorScore: profile.priorAcademicPerformance?.priorSubjectScore,
      overallMastery: profile.overallMastery,
      decision: decision.action,
      strategy: decision.strategy,
      depth: decision.depth,
      pace: decision.pace,
      difficulty: decision.difficulty,
      rationale: decision.rationale,
      diagnostics: {
        candidatesBeforeRerank: ragResult.diagnostics?.mmrSelectedChunks?.length || 8,
        candidatesAfterRerank: ragResult.diagnostics?.finalSelectedChunks?.length || 4,
        promptLengthChars: systemPrompt.length,
      },
      latencies: {
        t1_profileMs,
        t4_decisionMs,
        t5_embeddingMs: ragResult.diagnostics?.latency?.embeddingMs || 0,
        t6_retrievalMs: (ragResult.diagnostics?.latency?.vectorSearchMs || 0) + (ragResult.diagnostics?.latency?.lexicalSearchMs || 0),
        t7_rerankMs: ragResult.diagnostics?.latency?.rerankMs || 0,
        t10_llmTotalMs: ragResult.diagnostics?.latency?.llmGenerationMs || 0,
        personalizationOverheadMs,
        ragPipelineTotalMs: ragMs,
        totalEndToEndMs: totalMs,
      },
    });

    return {
      ...ragResult,
      tutorDecision: decision,
      personalizedExplanation: ragResult.answerText,
      suggestedFollowUpPractice: suggestedPractice,
      transparencyRationale: decision.rationale,
      personalizationLatency: {
        decisionMs: t4_decisionMs,
        ragMs,
        generationMs: ragResult.diagnostics?.latency?.llmGenerationMs || 0,
        totalMs,
      },
    };
  }
}

export const personalizedRAGAdapter = new PersonalizedRAGAdapter();

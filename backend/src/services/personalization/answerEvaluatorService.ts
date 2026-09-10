import { ragPipeline } from '../rag/ragPipeline';
import { RAGProviderFactory } from '../rag/providers/providerFactory';
import { dbService } from '../db.service';
import { conceptGraphService } from './conceptGraphService';
import { studentLearningStateService } from './studentLearningStateService';
import {
  StudentLearningState,
  MisconceptionRecord,
} from './types';

export type QuestionType =
  | 'MCQ'
  | 'CHOICE'
  | 'NUMERICAL'
  | 'SHORT_ANSWER'
  | 'OPEN_ENDED'
  | 'REASONING'
  | 'APPLICATION'
  | 'TRANSFER';

export interface AnswerEvaluationRequest {
  courseId?: string;
  classId: string;
  studentId: string;
  question: string;
  questionType?: QuestionType;
  expectedAnswer?: string | string[];
  options?: string[];
  studentAnswer: string;
  currentTopic?: string;
  topicName?: string;
  timeToAnswerMs?: number;
}

export interface AnswerEvaluationResult {
  correctness: number;              // 0.0 - 1.0
  conceptUnderstanding: number;     // 0.0 - 1.0
  reasoningQuality: number;         // 0.0 - 1.0
  application: number;              // 0.0 - 1.0
  transfer: number;                 // 0.0 - 1.0
  isPartiallyCorrect: boolean;
  misconceptionDetected: boolean;
  misconception: string | null;
  missingConcepts: string[];
  strengths: string[];
  weaknesses: string[];
  confidence: number;               // 0.0 - 1.0 (evaluator confidence)
  recommendedPedagogicalAction: 'CHALLENGE' | 'SCAFFOLD' | 'REPAIR' | 'EXPLAIN' | 'PRACTICE' | 'CLARIFICATION' | 'ADVANCE';
  feedback: string;                 // Student-facing supportive, constructive feedback
  evidenceSummary: string;          // Concise summary for learning event
  evaluationMode: 'DETERMINISTIC' | 'LLM_SEMANTIC';
}

export class AnswerEvaluationService {
  /**
   * Main evaluation entry point: routes to deterministic or LLM semantic evaluation.
   */
  public async evaluate(request: AnswerEvaluationRequest): Promise<AnswerEvaluationResult> {
    const {
      classId,
      studentId,
      question,
      questionType = 'SHORT_ANSWER',
      expectedAnswer,
      options,
      studentAnswer,
      currentTopic,
      topicName,
    } = request;

    const upperClassId = classId.toUpperCase();
    const state = studentLearningStateService.getStudentLearningState(upperClassId, studentId);
    const activeTopic = currentTopic || state.personalFrontier || 'second_generation';
    const activeTopicName = topicName || state.topicMasteries[activeTopic]?.topicName || activeTopic;

    // ─── 1. DETERMINISTIC EVALUATION (MCQ / CHOICE / PURE SELECTION) ───────────
    if (questionType === 'MCQ' || questionType === 'CHOICE') {
      return this.evaluateDeterministicChoice(request, activeTopicName);
    }

    // ─── 2. DETERMINISTIC EVALUATION FOR PURE NUMERICAL (WITHOUT REASONING) ───
    if (questionType === 'NUMERICAL') {
      const isPureNumber = /^-?\d+(\.\d+)?(\s*[a-zA-Z/%^]*)?$/.test((studentAnswer || '').trim());
      if (isPureNumber && expectedAnswer) {
        return this.evaluateDeterministicNumerical(request, activeTopicName);
      }
    }

    // ─── 3. LLM SEMANTIC EVALUATION (SHORT ANSWER / OPEN ENDED / REASONING) ───
    return this.evaluateSemanticLLM(request, state, activeTopic, activeTopicName);
  }

  /**
   * Deterministic evaluation for multiple choice or options.
   */
  private evaluateDeterministicChoice(
    request: AnswerEvaluationRequest,
    topicName: string
  ): AnswerEvaluationResult {
    const { question, options, expectedAnswer, studentAnswer } = request;
    const ans = (studentAnswer || '').trim().toLowerCase();
    
    let isCorrect = false;
    let expectedText = '';

    if (Array.isArray(expectedAnswer)) {
      expectedText = expectedAnswer[0] || '';
      isCorrect = expectedAnswer.some((exp) => ans === exp.toLowerCase().trim() || ans.includes(exp.toLowerCase().trim()));
    } else if (typeof expectedAnswer === 'string' && expectedAnswer.trim()) {
      expectedText = expectedAnswer;
      isCorrect = ans === expectedAnswer.toLowerCase().trim() || ans.includes(expectedAnswer.toLowerCase().trim());
    } else if (options && options.length > 0) {
      // Default first option as key if not specified
      expectedText = options[0];
      isCorrect = ans === options[0].toLowerCase().trim() || ans === '0' || ans === 'a';
    }

    const score = isCorrect ? 1.0 : 0.0;
    const recommendedAction = isCorrect ? 'ADVANCE' : 'EXPLAIN';
    const feedback = isCorrect
      ? `Correct! You accurately identified the key principle of ${topicName}.`
      : `Good try! The correct choice is "${expectedText}". Let's explore why this is the case.`;

    return {
      correctness: score,
      conceptUnderstanding: isCorrect ? 0.90 : 0.25,
      reasoningQuality: isCorrect ? 0.85 : 0.20,
      application: isCorrect ? 0.80 : 0.20,
      transfer: isCorrect ? 0.75 : 0.15,
      isPartiallyCorrect: false,
      misconceptionDetected: !isCorrect,
      misconception: isCorrect ? null : `Confusion regarding ${topicName} choice options`,
      missingConcepts: isCorrect ? [] : [topicName],
      strengths: isCorrect ? ['Accurate selection'] : [],
      weaknesses: isCorrect ? [] : ['Option discrimination'],
      confidence: 1.0,
      recommendedPedagogicalAction: recommendedAction,
      feedback,
      evidenceSummary: `MCQ check on ${topicName}: Student selected "${studentAnswer}" (${isCorrect ? 'Correct' : 'Incorrect'})`,
      evaluationMode: 'DETERMINISTIC',
    };
  }

  /**
   * Deterministic numerical validation.
   */
  private evaluateDeterministicNumerical(
    request: AnswerEvaluationRequest,
    topicName: string
  ): AnswerEvaluationResult {
    const { expectedAnswer, studentAnswer } = request;
    const studentNum = parseFloat(studentAnswer.replace(/[^0-9.-]/g, ''));
    const expStr = Array.isArray(expectedAnswer) ? expectedAnswer[0] : (expectedAnswer || '');
    const expectedNum = parseFloat(expStr.replace(/[^0-9.-]/g, ''));

    const isMatch = !isNaN(studentNum) && !isNaN(expectedNum) && Math.abs(studentNum - expectedNum) < 0.01;
    const feedback = isMatch
      ? `Spot on! The numerical result (${studentAnswer}) is exact.`
      : `Not quite. The calculated value is ${expStr}, whereas you submitted ${studentAnswer}.`;

    return {
      correctness: isMatch ? 1.0 : 0.0,
      conceptUnderstanding: isMatch ? 0.90 : 0.30,
      reasoningQuality: isMatch ? 0.85 : 0.25,
      application: isMatch ? 0.90 : 0.30,
      transfer: isMatch ? 0.70 : 0.20,
      isPartiallyCorrect: false,
      misconceptionDetected: !isMatch,
      misconception: isMatch ? null : `Numerical calculation error on ${topicName}`,
      missingConcepts: isMatch ? [] : [topicName],
      strengths: isMatch ? ['Accurate numerical calculation'] : [],
      weaknesses: isMatch ? [] : ['Calculation precision'],
      confidence: 1.0,
      recommendedPedagogicalAction: isMatch ? 'CHALLENGE' : 'SCAFFOLD',
      feedback,
      evidenceSummary: `Numerical validation on ${topicName}: Submitted ${studentAnswer}, Expected ${expStr}`,
      evaluationMode: 'DETERMINISTIC',
    };
  }

  /**
   * Semantic LLM Answer Evaluator grounded in retrieved course material chunks.
   */
  private async evaluateSemanticLLM(
    request: AnswerEvaluationRequest,
    state: StudentLearningState,
    activeTopic: string,
    activeTopicName: string
  ): Promise<AnswerEvaluationResult> {
    const { classId, question, expectedAnswer, studentAnswer } = request;
    const upperClassId = classId.toUpperCase();

    // ─── T1: Retrieve Grounding Context from Course RAG ────────────────────────
    let courseContext = '';
    try {
      const ragResults = await ragPipeline.query(
        `${activeTopicName} ${question} ${Array.isArray(expectedAnswer) ? expectedAnswer.join(' ') : (expectedAnswer || '')}`,
        upperClassId
      );
      if (ragResults?.diagnostics?.finalSelectedChunks && ragResults.diagnostics.finalSelectedChunks.length > 0) {
        courseContext = ragResults.diagnostics.finalSelectedChunks
          .map((c: any) => `[Source: ${c.title || 'Course Material'}]\n${c.text || c.snippet}`)
          .join('\n\n');
      }
    } catch (err) {
      console.warn('[EVALUATOR_RAG] RAG retrieval fallback:', err);
    }

    // Previous active misconceptions on this topic
    const existingMisconceptions = state.activeMisconceptions
      .filter((m) => m.topicId === activeTopic && !m.resolved)
      .map((m) => m.description);

    const expectedRubric = Array.isArray(expectedAnswer)
      ? expectedAnswer.join(', ')
      : (expectedAnswer || 'Core conceptual principles of the topic');

    // ─── T2: Build Structured Evaluation Prompt ───────────────────────────────
    const prompt = `You are the ClassPulse AI Pedagogical Answer Evaluator.
Your goal is to evaluate a student's answer to a study question with strict pedagogical rigor, grounded in the provided course material.

--- COURSE CONTEXT ---
${courseContext || 'Standard course syllabus definitions for ' + activeTopicName}

--- EVALUATION PARAMETERS ---
Topic: ${activeTopicName}
Question: "${question}"
Expected Key Points / Rubric: "${expectedRubric}"
Active Student Misconceptions on this topic: ${existingMisconceptions.length > 0 ? existingMisconceptions.join('; ') : 'None'}
Student's Submitted Answer: "${studentAnswer}"

--- EVALUATION INSTRUCTIONS ---
1. Evaluate semantic understanding, NOT superficial keyword matching. Accept valid synonyms and different natural phrasings.
2. If the student demonstrates correct understanding with minor phrasing flaws, mark as high correctness (e.g. 0.85 - 1.0).
3. If the student has partial understanding (e.g. identifies relationship but errs on direction or causality), mark isPartiallyCorrect = true (0.50 - 0.75).
4. If the student has a fundamental conceptual confusion (e.g. confuses velocity with acceleration, or vacuum tubes with transistors), mark misconceptionDetected = true and specify the misconception concisely.
5. Provide constructive, natural, supportive student feedback (what they got right, what to refine). Never say just "Incorrect".
6. Select the single best recommended pedagogical action from:
   - CHALLENGE (Strong mastery & sound reasoning)
   - SCAFFOLD (Correct conclusion but incomplete reasoning)
   - REPAIR (Clear conceptual misconception detected)
   - EXPLAIN (Partial understanding needing step-by-step foundation)
   - PRACTICE (Developing understanding needing another practice problem)
   - CLARIFICATION (Student answer is ambiguous or too sparse to judge)

Output strictly valid JSON conforming exactly to this structure with NO additional markdown commentary:
{
  "correctness": <float 0.0 to 1.0>,
  "conceptUnderstanding": <float 0.0 to 1.0>,
  "reasoningQuality": <float 0.0 to 1.0>,
  "application": <float 0.0 to 1.0>,
  "transfer": <float 0.0 to 1.0>,
  "isPartiallyCorrect": <boolean>,
  "misconceptionDetected": <boolean>,
  "misconception": <string or null>,
  "missingConcepts": [<string>],
  "strengths": [<string>],
  "weaknesses": [<string>],
  "confidence": <float 0.0 to 1.0>,
  "recommendedPedagogicalAction": "CHALLENGE" | "SCAFFOLD" | "REPAIR" | "EXPLAIN" | "PRACTICE" | "CLARIFICATION" | "ADVANCE",
  "feedback": "<friendly, clear student-facing explanation>",
  "evidenceSummary": "<concise 1-sentence diagnostic summary>"
}`;

    // ─── T3: Execute LLM Inference ────────────────────────────────────────────
    const llmProvider = RAGProviderFactory.getLLMProvider();
    try {
      const response = await llmProvider.generateAnswer(prompt, courseContext, {
        temperature: 0.1,
        maxTokens: 500,
        timeoutMs: 8000,
      });

      const parsed = this.parseAndValidateEvaluationJSON(response.text, studentAnswer, activeTopicName);
      return {
        ...parsed,
        evaluationMode: 'LLM_SEMANTIC',
      };
    } catch (err) {
      console.warn('[ANSWER_EVALUATOR_LLM] LLM call failed or timed out, executing deterministic semantic fallback:', err);
      return this.heuristicSemanticFallback(request, activeTopicName);
    }
  }

  /**
   * Robust JSON parser and validator for LLM output.
   */
  private parseAndValidateEvaluationJSON(
    rawText: string,
    studentAnswer: string,
    topicName: string
  ): Omit<AnswerEvaluationResult, 'evaluationMode'> {
    let clean = (rawText || '').trim();
    // Strip markdown code fences if model wrapped in ```json ... ```
    if (clean.includes('```')) {
      clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    let obj: any = {};
    try {
      obj = JSON.parse(clean);
    } catch (e) {
      throw new Error(`Invalid JSON produced by evaluator: ${clean.substring(0, 100)}`);
    }

    const clamp = (val: any, def: number) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      return isNaN(num) ? def : Math.max(0.0, Math.min(1.0, num));
    };

    const correctness = clamp(obj.correctness, 0.5);
    const conceptUnderstanding = clamp(obj.conceptUnderstanding, correctness);
    const reasoningQuality = clamp(obj.reasoningQuality, correctness);
    const application = clamp(obj.application, correctness);
    const transfer = clamp(obj.transfer, correctness);
    const confidence = clamp(obj.confidence, 0.85);

    const isPartiallyCorrect = Boolean(obj.isPartiallyCorrect || (correctness >= 0.45 && correctness < 0.80));
    const misconceptionDetected = Boolean(obj.misconceptionDetected && correctness < 0.70);
    const misconception = misconceptionDetected && obj.misconception ? String(obj.misconception).trim() : null;

    let action: AnswerEvaluationResult['recommendedPedagogicalAction'] = 'PRACTICE';
    if (misconceptionDetected) {
      action = 'REPAIR';
    } else if (correctness >= 0.85 && reasoningQuality >= 0.80) {
      action = 'CHALLENGE';
    } else if (correctness >= 0.70 && reasoningQuality < 0.60) {
      action = 'SCAFFOLD';
    } else if (isPartiallyCorrect || correctness >= 0.45) {
      action = 'EXPLAIN';
    } else if (confidence < 0.50) {
      action = 'CLARIFICATION';
    }

    const feedback = obj.feedback && typeof obj.feedback === 'string' && obj.feedback.trim().length > 10
      ? obj.feedback.trim()
      : correctness >= 0.75
      ? `Great insight! You clearly understood the core mechanism of ${topicName}.`
      : `Good effort! Let's clarify the key relationship in ${topicName} so you have the full picture.`;

    const evidenceSummary = obj.evidenceSummary && typeof obj.evidenceSummary === 'string'
      ? obj.evidenceSummary.trim()
      : `Evaluation on ${topicName}: Correctness ${(correctness * 100).toFixed(0)}%, Action: ${action}`;

    return {
      correctness,
      conceptUnderstanding,
      reasoningQuality,
      application,
      transfer,
      isPartiallyCorrect,
      misconceptionDetected,
      misconception,
      missingConcepts: Array.isArray(obj.missingConcepts) ? obj.missingConcepts.map(String) : [],
      strengths: Array.isArray(obj.strengths) ? obj.strengths.map(String) : [],
      weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses.map(String) : [],
      confidence,
      recommendedPedagogicalAction: action,
      feedback,
      evidenceSummary,
    };
  }

  /**
   * Deterministic semantic heuristic fallback if local LLM is temporarily unreachable.
   */
  private heuristicSemanticFallback(
    request: AnswerEvaluationRequest,
    topicName: string
  ): AnswerEvaluationResult {
    const { question, expectedAnswer, studentAnswer } = request;
    const lower = (studentAnswer || '').toLowerCase().trim();
    const normalizedLower = lower.replace(/[-_/,.;:!?]/g, ' ');

    // 1. Detect clear misconceptions
    let misconceptionDetected = false;
    let detectedMisconception: string | null = null;

    if (
      (lower.includes('boiling') || lower.includes('filament in glass') || lower.includes('bulb') || lower.includes('evaporate') || lower.includes('glowing wires')) &&
      (topicName.toLowerCase().includes('transistor') || topicName.toLowerCase().includes('second'))
    ) {
      misconceptionDetected = true;
      detectedMisconception = 'Confusing solid-state semiconductor operation with incandescent vacuum tube filaments';
    } else if (
      lower.includes('constant force') && lower.includes('constant velocity')
    ) {
      misconceptionDetected = true;
      detectedMisconception = 'Confusing net force with constant velocity instead of acceleration';
    }

    if (misconceptionDetected) {
      return {
        correctness: 0.20,
        conceptUnderstanding: 0.20,
        reasoningQuality: 0.20,
        application: 0.20,
        transfer: 0.15,
        isPartiallyCorrect: false,
        misconceptionDetected: true,
        misconception: detectedMisconception,
        missingConcepts: ['solid-state semiconductor', 'crystal lattice conduction'],
        strengths: [],
        weaknesses: ['Physical operational mechanism'],
        confidence: 0.90,
        recommendedPedagogicalAction: 'REPAIR',
        feedback: `We noticed a fundamental confusion: ${detectedMisconception}. Transistors are solid-state devices with no heated filaments.`,
        evidenceSummary: `Misconception on ${topicName}: ${detectedMisconception}`,
        evaluationMode: 'DETERMINISTIC',
      };
    }

    // 2. Score Expected Points Matching
    const expectedPoints = Array.isArray(expectedAnswer)
      ? expectedAnswer
      : (expectedAnswer || '').split(/[,;.]/).map((s) => s.trim()).filter(Boolean);

    const validExpected = expectedPoints.filter((p) => p && p.trim().length > 0);
    let matchCount = 0;
    for (const pt of validExpected) {
      const cleanPt = pt.toLowerCase().replace(/[-_/,.;:!?]/g, ' ').trim();
      const ptWords = cleanPt.split(/\s+/).filter((w) => w.length > 2);
      const hasMatch = ptWords.some((w) => normalizedLower.includes(w)) || normalizedLower.includes(cleanPt);
      if (hasMatch) {
        matchCount += 1;
      }
    }

    const ratio = validExpected.length > 0 ? matchCount / validExpected.length : (lower.length > 30 ? 0.85 : 0.4);
    
    // Check for partial admission (e.g. "do not remember", "partially")
    const admitsPartial = lower.includes('do not remember') || lower.includes('not sure') || lower.includes('forgot');
    
    // Check for sparse/ambiguous answers
    const words = normalizedLower.split(/\s+/).filter((w) => w.length > 1);
    const isSparse = words.length < 4 || lower.length < 20;

    let correctness = 0.20;
    let confidence = 0.85;
    let action: AnswerEvaluationResult['recommendedPedagogicalAction'] = 'PRACTICE';

    if (admitsPartial) {
      correctness = 0.55;
      action = 'EXPLAIN';
    } else if (isSparse && matchCount <= 1) {
      correctness = 0.25;
      confidence = 0.45;
      action = 'CLARIFICATION';
    } else if (matchCount >= 2 || ratio >= 0.4) {
      correctness = Math.min(0.95, 0.75 + (ratio * 0.25));
      action = correctness >= 0.80 ? 'CHALLENGE' : 'PRACTICE';
    } else if (matchCount >= 1 && lower.length > 20) {
      correctness = 0.65;
      action = 'EXPLAIN';
    } else {
      correctness = Math.max(0.20, Math.min(0.50, ratio));
      action = 'SCAFFOLD';
    }

    const isPartiallyCorrect = !isSparse && (admitsPartial || (correctness >= 0.40 && correctness < 0.75));

    return {
      correctness,
      conceptUnderstanding: correctness,
      reasoningQuality: Math.max(0.2, correctness - 0.05),
      application: correctness,
      transfer: Math.max(0.1, correctness - 0.10),
      isPartiallyCorrect,
      misconceptionDetected: false,
      misconception: null,
      missingConcepts: isPartiallyCorrect ? expectedPoints.filter(p => !lower.includes(p.toLowerCase())) : [],
      strengths: correctness >= 0.6 ? ['Demonstrated key terminology', 'Clear conceptual connection'] : [],
      weaknesses: correctness < 0.6 ? ['Incomplete conceptual coverage'] : [],
      confidence: 0.85,
      recommendedPedagogicalAction: action,
      feedback: correctness >= 0.75
        ? `Solid answer! You accurately captured the essential principles of ${topicName}.`
        : isPartiallyCorrect
        ? `Good partial understanding! You correctly identified key points, but let's complete the picture on ${topicName}.`
        : `Good attempt! Let's explore the key relationships in ${topicName} step by step.`,
      evidenceSummary: `Heuristic evaluation on ${topicName}: Score ${(correctness * 100).toFixed(0)}%, Action: ${action}`,
      evaluationMode: 'DETERMINISTIC',
    };
  }
}

export const answerEvaluatorService = new AnswerEvaluationService();

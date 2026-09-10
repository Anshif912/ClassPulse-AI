import { dbService } from '../services/db.service';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { studyAssistantService } from '../services/personalization/studyAssistantService';
import { answerEvaluatorService } from '../services/personalization/answerEvaluatorService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';

interface TestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, category: string, passed: boolean, details: string) {
  results.push({ id, name, category, passed, details });
  console.log(`[Test ${id.toString().padStart(2, '0')}] [${passed ? 'PASS' : 'FAIL'}] ${name} -> ${details}`);
}

async function runAdaptiveStudyWithMeSuite() {
  console.log('================================================================');
  console.log('CLASSPULSE ADAPTIVE STUDY WITH ME TUTORING VERIFICATION SUITE');
  console.log('Semantic Answer Evaluation + Cognitive Masteries + Adaptive Loop');
  console.log('================================================================\n');

  const classId = 'CLASS_ADAPTIVE_TEST';
  const studentA = 'student_master_alice';
  const studentB = 'student_developing_bob';
  const topicId = 'second_generation';
  const topicName = 'Second Generation Computers & Transistors';

  // Seed classroom
  dbService.createClassroom({
    id: `cls_${classId}`,
    classId,
    name: 'Computer Architecture & Physics',
    subject: 'Computer Science',
    teacherId: 'teacher_alan',
    teacherName: 'Prof. Alan',
    teacherEmail: 'alan@cs.edu',
    agoraChannel: `agora_${classId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  // Seed material chunk for RAG grounding
  dbService.addMaterialChunks([{
    id: `chunk_${classId}_1`,
    classId,
    materialId: `mat_${classId}_1`,
    title: 'Generations of Computers and Transistors',
    content: 'Second generation computers (1956-1963) replaced vacuum tubes with solid-state semiconductor transistors. Transistors are far smaller, consume less electricity, generate significantly less heat, and offer higher reliability because they lack heated filaments that burn out. Memory advanced with magnetic core memory.',
    chunkIndex: 0,
    embedding: [],
    createdAt: new Date().toISOString(),
  }]);

  // =========================================================================
  // TEST 1: Deterministic Choice / MCQ Evaluation
  // =========================================================================
  try {
    const evalMCQ = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentA,
      question: 'Which component replaced vacuum tubes in second generation computers?',
      questionType: 'MCQ',
      options: ['Transistors', 'Microprocessors', 'Integrated Circuits'],
      expectedAnswer: 'Transistors',
      studentAnswer: 'Transistors',
      currentTopic: topicId,
      topicName,
    });

    const pass = evalMCQ.correctness === 1.0 &&
                 evalMCQ.evaluationMode === 'DETERMINISTIC' &&
                 evalMCQ.confidence === 1.0 &&
                 evalMCQ.recommendedPedagogicalAction === 'ADVANCE';
    recordTest(1, 'Deterministic MCQ Evaluation', 'Evaluator', pass, `Correctness: ${evalMCQ.correctness}, Mode: ${evalMCQ.evaluationMode}`);
  } catch (err: any) {
    recordTest(1, 'Deterministic MCQ Evaluation', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 2: Deterministic Numerical Evaluation
  // =========================================================================
  try {
    const evalNum = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentA,
      question: 'A 5 kg block has 20 N net force. What is the acceleration?',
      questionType: 'NUMERICAL',
      expectedAnswer: '4 m/s²',
      studentAnswer: '4',
      currentTopic: 'newton_laws',
      topicName: "Newton's Second Law",
    });

    const pass = evalNum.correctness === 1.0 &&
                 evalNum.evaluationMode === 'DETERMINISTIC' &&
                 evalNum.confidence === 1.0;
    recordTest(2, 'Deterministic Numerical Evaluation', 'Evaluator', pass, `Correctness: ${evalNum.correctness}, Feedback: ${evalNum.feedback}`);
  } catch (err: any) {
    recordTest(2, 'Deterministic Numerical Evaluation', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 3: Grounded Semantic Evaluation - Correct Open-Ended Answer
  // =========================================================================
  try {
    const evalCorrect = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentA,
      question: 'Explain why transistors are more reliable and energy efficient than vacuum tubes.',
      questionType: 'OPEN_ENDED',
      expectedAnswer: ['no filament to burn out', 'solid state semiconductor', 'lower heat and power consumption'],
      studentAnswer: 'Transistors are solid-state semiconductors with no physical heated filament to burn out, so they produce far less heat and consume much less electricity.',
      currentTopic: topicId,
      topicName,
    });

    const pass = evalCorrect.correctness >= 0.75 &&
                 evalCorrect.conceptUnderstanding >= 0.75 &&
                 evalCorrect.misconceptionDetected === false &&
                 (evalCorrect.recommendedPedagogicalAction === 'CHALLENGE' || evalCorrect.recommendedPedagogicalAction === 'PRACTICE' || evalCorrect.recommendedPedagogicalAction === 'ADVANCE');
    recordTest(3, 'Semantic Evaluation: Correct Open-Ended Answer', 'Evaluator', pass, `Correctness: ${evalCorrect.correctness.toFixed(2)}, Action: ${evalCorrect.recommendedPedagogicalAction}`);
  } catch (err: any) {
    recordTest(3, 'Semantic Evaluation: Correct Open-Ended Answer', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 4: Grounded Semantic Evaluation - Partially Correct Answer
  // =========================================================================
  try {
    const evalPartial = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentB,
      question: 'Explain the difference in hardware and memory between first and second generation computers.',
      questionType: 'REASONING',
      expectedAnswer: ['transistors replaced vacuum tubes', 'magnetic core memory replaced magnetic drums'],
      studentAnswer: 'Second generation used transistors which were smaller, but I do not remember what memory they used.',
      currentTopic: topicId,
      topicName,
    });

    const pass = evalPartial.correctness >= 0.35 &&
                 evalPartial.correctness <= 0.80 &&
                 evalPartial.isPartiallyCorrect === true;
    recordTest(4, 'Semantic Evaluation: Partially Correct Answer', 'Evaluator', pass, `Correctness: ${evalPartial.correctness.toFixed(2)}, PartiallyCorrect: ${evalPartial.isPartiallyCorrect}`);
  } catch (err: any) {
    recordTest(4, 'Semantic Evaluation: Partially Correct Answer', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 5: Grounded Semantic Evaluation - Misconception Detection
  // =========================================================================
  let misconceptionOutput: any = null;
  try {
    misconceptionOutput = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentB,
      question: 'How do transistors produce electrical flow compared to vacuum tubes?',
      questionType: 'OPEN_ENDED',
      expectedAnswer: ['semiconductor conduction without filaments', 'solid state electrons/holes'],
      studentAnswer: 'Transistors work by boiling a tungsten filament in a glass vacuum bulb until electrons evaporate.',
      currentTopic: topicId,
      topicName,
    });

    const pass = misconceptionOutput.misconceptionDetected === true &&
                 misconceptionOutput.misconception !== null &&
                 misconceptionOutput.correctness < 0.60 &&
                 misconceptionOutput.recommendedPedagogicalAction === 'REPAIR';
    recordTest(5, 'Semantic Evaluation: Misconception Detection', 'Evaluator', pass, `MisconceptionDetected: ${misconceptionOutput.misconceptionDetected}, Action: ${misconceptionOutput.recommendedPedagogicalAction}, Detail: ${misconceptionOutput.misconception}`);
  } catch (err: any) {
    recordTest(5, 'Semantic Evaluation: Misconception Detection', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 6: Misconception Persistence & Stability Lifecycle
  // =========================================================================
  try {
    // Record first occurrence
    dbService.recordMisconceptionOccurrence(
      classId,
      studentB,
      topicId,
      topicName,
      'filament_in_transistor',
      misconceptionOutput?.misconception || 'Confusing solid state transistors with incandescent filaments'
    );
    let stateB = studentLearningStateService.getStudentLearningState(classId, studentB);
    const firstOccur = stateB.activeMisconceptions.find((m) => m.topicId === topicId);
    const count1 = firstOccur?.errorFrequency ?? 1;

    // Record second occurrence -> promotes to stable misconception
    dbService.recordMisconceptionOccurrence(
      classId,
      studentB,
      topicId,
      topicName,
      'filament_in_transistor',
      'Confusing solid state transistors with incandescent filaments'
    );
    studentLearningStateService.invalidateState(classId, studentB);
    stateB = studentLearningStateService.getStudentLearningState(classId, studentB);
    const secondOccur = stateB.activeMisconceptions.find((m) => m.topicId === topicId);
    const isStable = secondOccur?.isStable === true || (secondOccur?.errorFrequency ?? 0) >= 2;

    const pass = count1 >= 1 && isStable;
    recordTest(6, 'Misconception Lifecycle: Frequency & Stability Tracking', 'LearnerModel', pass, `Count1: ${count1}, StableAfterRepeat: ${isStable}`);
  } catch (err: any) {
    recordTest(6, 'Misconception Lifecycle: Frequency & Stability Tracking', 'LearnerModel', false, err.message);
  }

  // =========================================================================
  // TEST 7: Demonstrated Mastery Resolves Active Misconception
  // =========================================================================
  try {
    dbService.resolveMisconception(classId, studentB, topicId);
    studentLearningStateService.invalidateState(classId, studentB);
    const stateResolved = studentLearningStateService.getStudentLearningState(classId, studentB);
    const activeRemaining = stateResolved.activeMisconceptions.filter((m) => m.topicId === topicId && !m.resolved);

    const pass = activeRemaining.length === 0;
    recordTest(7, 'Misconception Resolution upon Demonstrated Mastery', 'LearnerModel', pass, `Remaining Active for Topic: ${activeRemaining.length}`);
  } catch (err: any) {
    recordTest(7, 'Misconception Resolution upon Demonstrated Mastery', 'LearnerModel', false, err.message);
  }

  // =========================================================================
  // TEST 8: Adaptive "Study With Me" Session Step - High Understanding -> Challenge
  // =========================================================================
  try {
    // Seed high topic mastery for studentA
    const tmA = learnerModelService.getOrInitializeTopicMastery(classId, studentA, topicId, topicName);
    tmA.masteryScore = 0.85;
    tmA.evidenceCount = 3;
    dbService.saveTopicMastery(tmA);
    studentLearningStateService.invalidateState(classId, studentA);

    const { session } = studyAssistantService.startStudySession(classId, studentA, topicId, 'PRACTICE');
    const stepRes = await studyAssistantService.stepStudySession(
      classId,
      studentA,
      session.sessionId,
      'Second generation computers replaced vacuum tubes with transistors, which are solid-state semiconductors that draw lower power, emit less heat, and do not burn out.',
      12000
    );

    const pass = stepRes.evaluation !== undefined &&
                 stepRes.evaluation.correctness >= 0.70 &&
                 stepRes.session.score >= 0.70 &&
                 stepRes.session.completedPhases.includes('RECALL');
    recordTest(8, 'Study With Me Step: High Understanding Progression', 'StudyAssistant', pass, `Phase: ${stepRes.session.currentPhase}, Score: ${stepRes.session.score.toFixed(2)}, NextPrompt: ${stepRes.nextPrompt?.substring(0, 45)}...`);
  } catch (err: any) {
    recordTest(8, 'Study With Me Step: High Understanding Progression', 'StudyAssistant', false, err.message);
  }

  // =========================================================================
  // TEST 9: Adaptive "Study With Me" Session Step - Misconception -> Targeted Repair
  // =========================================================================
  try {
    const { session } = studyAssistantService.startStudySession(classId, studentB, topicId, 'STUDY');
    const stepRes = await studyAssistantService.stepStudySession(
      classId,
      studentB,
      session.sessionId,
      'Transistors use a heated glass bulb filament to create vacuum tubes inside magnetic drums.',
      18000
    );

    const pass = stepRes.evaluation !== undefined &&
                 stepRes.evaluation.misconceptionDetected === true &&
                 stepRes.session.plannedPhases.includes('PREREQUISITE_REPAIR') &&
                 stepRes.nextPrompt !== undefined &&
                 stepRes.nextPrompt.toLowerCase().includes('clarify');
    recordTest(9, 'Study With Me Step: Misconception -> Targeted Repair Adaptation', 'StudyAssistant', pass, `Misconception: ${stepRes.evaluation?.misconception}, NextPrompt: ${stepRes.nextPrompt?.substring(0, 50)}...`);
  } catch (err: any) {
    recordTest(9, 'Study With Me Step: Misconception -> Targeted Repair Adaptation', 'StudyAssistant', false, err.message);
  }

  // =========================================================================
  // TEST 10: Multi-Dimensional Cognitive Masteries Update
  // =========================================================================
  try {
    const stateBefore = studentLearningStateService.getStudentLearningState(classId, studentA);
    const priorConcept = stateBefore.conceptMastery ?? 0.25;

    const event: any = {
      id: `le_test_dimensions_${Date.now()}`,
      studentId: studentA,
      classId,
      topicId,
      category: 'STUDY_SESSION',
      metrics: {
        isCorrect: true,
        score: 0.95,
        conceptUnderstanding: 0.92,
        reasoningQuality: 0.88,
        application: 0.90,
        transfer: 0.85,
        timeToAnswerMs: 12000,
        attemptsCount: 1,
      },
      contextSummary: 'Dimensional mastery test evaluation',
      timestamp: new Date().toISOString(),
    };

    const { updatedProfile } = learnerModelService.processLearningEvent(event);
    studentLearningStateService.invalidateState(classId, studentA);
    const stateA = studentLearningStateService.getStudentLearningState(classId, studentA);

    const pass = stateA.conceptMastery !== undefined &&
                 stateA.reasoningMastery !== undefined &&
                 stateA.applicationMastery !== undefined &&
                 stateA.transferMastery !== undefined &&
                 stateA.conceptMastery > priorConcept;
    recordTest(10, 'Multi-Dimensional Cognitive Masteries Fusion', 'LearnerModel', pass, `Concept: ${stateA.conceptMastery} (was ${priorConcept}), Reasoning: ${stateA.reasoningMastery}, App: ${stateA.applicationMastery}, Transfer: ${stateA.transferMastery}`);
  } catch (err: any) {
    recordTest(10, 'Multi-Dimensional Cognitive Masteries Fusion', 'LearnerModel', false, err.message);
  }

  // =========================================================================
  // TEST 11: Idempotency & Duplicate Submission Handling
  // =========================================================================
  try {
    const { session } = studyAssistantService.startStudySession(classId, studentA, topicId, 'REVISION');
    // Complete session through all phases
    let currentSession = session;
    for (let i = 0; i < session.plannedPhases.length; i++) {
      const step = await studyAssistantService.stepStudySession(classId, studentA, currentSession.sessionId, 'Accurate solid state explanation answer');
      currentSession = step.session;
    }

    // Attempt duplicate step on completed session
    const duplicateStep = await studyAssistantService.stepStudySession(classId, studentA, currentSession.sessionId, 'Another submission');
    const pass = duplicateStep.isCompleted === true && duplicateStep.feedback.includes('already completed');
    recordTest(11, 'Idempotent Duplicate Submission Prevention', 'StudyAssistant', pass, `IsCompleted: ${duplicateStep.isCompleted}, Feedback: ${duplicateStep.feedback}`);
  } catch (err: any) {
    recordTest(11, 'Idempotent Duplicate Submission Prevention', 'StudyAssistant', false, err.message);
  }

  // =========================================================================
  // TEST 12: Micro-Assessment Semantic Integration
  // =========================================================================
  try {
    const question = await microAssessmentService.generateQuestion(classId, studentA, topicId);
    const evalRes = await microAssessmentService.evaluateAnswer(
      classId,
      studentA,
      question,
      question.options ? question.options[0] : 'Transistors replaced vacuum tubes in second generation computers'
    );

    const pass = evalRes.isCorrect === true && evalRes.score >= 0.70 && typeof evalRes.feedback === 'string' && evalRes.feedback.length > 5;
    recordTest(12, 'Micro-Assessment Semantic Evaluator Integration', 'MicroAssessment', pass, `IsCorrect: ${evalRes.isCorrect}, Score: ${evalRes.score}, Feedback: ${evalRes.feedback.substring(0, 40)}...`);
  } catch (err: any) {
    recordTest(12, 'Micro-Assessment Semantic Evaluator Integration', 'MicroAssessment', false, err.message);
  }

  // =========================================================================
  // TEST 13: Grounding in Course RAG Material Context
  // =========================================================================
  try {
    const evalRAG = await answerEvaluatorService.evaluate({
      classId,
      studentId: studentA,
      question: 'What memory technology was introduced in second generation computers?',
      questionType: 'SHORT_ANSWER',
      expectedAnswer: 'Magnetic core memory',
      studentAnswer: 'Magnetic core memory replaced magnetic drums',
      currentTopic: topicId,
      topicName,
    });

    const pass = evalRAG.correctness >= 0.80 &&
                 evalRAG.evidenceSummary.length > 5 &&
                 evalRAG.feedback.length > 10;
    recordTest(13, 'RAG Grounded Semantic Validation', 'Evaluator', pass, `Correctness: ${evalRAG.correctness}, EvidenceSummary: ${evalRAG.evidenceSummary}`);
  } catch (err: any) {
    recordTest(13, 'RAG Grounded Semantic Validation', 'Evaluator', false, err.message);
  }

  // =========================================================================
  // TEST 14: Contrast Verification: Student A (Master) vs Student B (Developing)
  // =========================================================================
  try {
    const sessionA = studyAssistantService.startStudySession(classId, studentA, topicId, 'STUDY');
    const sessionB = studyAssistantService.startStudySession(classId, studentB, topicId, 'STUDY');

    const stepA = await studyAssistantService.stepStudySession(classId, studentA, sessionA.session.sessionId, 'Transistors are solid state semiconductor devices that require no heated filaments and dissipate minimal thermal energy.');
    const stepB = await studyAssistantService.stepStudySession(classId, studentB, sessionB.session.sessionId, 'Transistors have glowing wires inside glass tubes to heat up memory.');

    const pass = stepA.evaluation!.correctness > stepB.evaluation!.correctness &&
                 stepA.evaluation!.recommendedPedagogicalAction !== stepB.evaluation!.recommendedPedagogicalAction &&
                 stepA.nextPrompt !== stepB.nextPrompt;
    recordTest(14, 'Pedagogical Contrast: Student A (Master) vs Student B (Developing)', 'PedagogicalTutor', pass, `Score A: ${stepA.evaluation!.correctness.toFixed(2)} (${stepA.evaluation!.recommendedPedagogicalAction}), Score B: ${stepB.evaluation!.correctness.toFixed(2)} (${stepB.evaluation!.recommendedPedagogicalAction})`);
  } catch (err: any) {
    recordTest(14, 'Pedagogical Contrast: Student A (Master) vs Student B (Developing)', 'PedagogicalTutor', false, err.message);
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n================================================================');
  console.log('ADAPTIVE STUDY WITH ME TEST RESULTS SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [Test ${r.id}] ${r.name}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 14/14 ADAPTIVE STUDY WITH ME INTEGRATION TESTS PASSED PERFECTLY! 🔥\n');
  }
}

runAdaptiveStudyWithMeSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

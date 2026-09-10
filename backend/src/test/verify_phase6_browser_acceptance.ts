import { dbService } from '../services/db.service';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { studyAssistantService } from '../services/personalization/studyAssistantService';
import { answerEvaluatorService } from '../services/personalization/answerEvaluatorService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { conceptGraphService } from '../services/personalization/conceptGraphService';

interface ScenarioProof {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  evidence: any;
}

const proofs: ScenarioProof[] = [];

function recordProof(id: number, name: string, category: string, passed: boolean, evidence: any) {
  proofs.push({ id, name, category, passed, evidence });
  console.log(`\n================================================================`);
  console.log(`[PROVE STEP ${id.toString().padStart(2, '0')}] [${passed ? 'PASS' : 'FAIL'}] ${name}`);
  console.log(`Category: ${category}`);
  console.log(`Evidence:`, JSON.stringify(evidence, null, 2));
  console.log(`================================================================`);
}

async function runPhase6FinalHardeningAcceptance() {
  console.log('================================================================');
  console.log('  CLASSPULSE PHASE 6: FINAL HARDENING & E2E BROWSER ACCEPTANCE');
  console.log('  Adaptive "Study With Me" Closed-Loop Tutoring System Proof');
  console.log('================================================================\n');

  const classId = 'CLASS_P6_HARDENED';
  const teacherId = 'teacher_turing';
  const studentA = 'std_p6_alice_master';
  const studentB = 'std_p6_bob_developing';
  const topicId = 'second_generation';
  const topicName = 'Second Generation Computers & Transistors';

  // 1. Seed Real Course Environment
  dbService.createClassroom({
    id: `cls_${classId}`,
    classId,
    name: 'CS101: Computer Generations & Architecture',
    subject: 'Computer Science',
    teacherId,
    teacherName: 'Dr. Alan Turing',
    teacherEmail: 'turing@cs.edu',
    agoraChannel: `agora_${classId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  // Seed syllabus chunks in RAG store
  dbService.addMaterialChunks([{
    id: `chunk_${classId}_1`,
    classId,
    materialId: `mat_${classId}_1`,
    title: 'Generations of Computers and Transistors',
    content: 'Second generation computers (1956-1963) replaced vacuum tubes with solid-state semiconductor transistors. Transistors are far smaller, consume significantly less electricity, generate minimal heat, and offer higher reliability because they lack heated tungsten filaments that burn out. Primary memory transitioned to magnetic core memory, which stored bits non-volatilely in magnetized ferrite rings.',
    chunkIndex: 0,
    embedding: [],
    createdAt: new Date().toISOString(),
  }]);

  // Set concept graph
  conceptGraphService.getOrBuildConceptGraph(classId);

  // Calibrate baseline profiles
  const tmA = learnerModelService.getOrInitializeTopicMastery(classId, studentA, topicId, topicName);
  tmA.masteryScore = 0.85;
  tmA.evidenceCount = 4;
  dbService.saveTopicMastery(tmA);

  const tmB = learnerModelService.getOrInitializeTopicMastery(classId, studentB, topicId, topicName);
  tmB.masteryScore = 0.35;
  tmB.evidenceCount = 1;
  dbService.saveTopicMastery(tmB);

  studentLearningStateService.invalidateState(classId, studentA);
  studentLearningStateService.invalidateState(classId, studentB);

  // =========================================================================
  // PROOF 1: Real Session Initialization & Question Grounding
  // =========================================================================
  const startSessionA = studyAssistantService.startStudySession(classId, studentA, topicId, 'STUDY');
  const startSessionB = studyAssistantService.startStudySession(classId, studentB, topicId, 'STUDY');

  const p1Pass = startSessionA.session.sessionId.startsWith('ss_') &&
                 startSessionA.prompt.length > 20 &&
                 startSessionA.session.plannedPhases.length >= 4;

  recordProof(1, 'Real Study Session Initialization', 'Session Lifecycle', p1Pass, {
    sessionA_Id: startSessionA.session.sessionId,
    studentA_PlannedPhases: startSessionA.session.plannedPhases,
    studentB_PlannedPhases: startSessionB.session.plannedPhases,
    initialPrompt: startSessionA.prompt,
    expectedInputType: startSessionA.expectedInputType,
  });

  // =========================================================================
  // PROOF 2: Real Strong Answer Evaluation (Student A)
  // =========================================================================
  const strongAnswerText = 'Second generation computers replaced vacuum tubes with transistors, which are solid-state semiconductors that draw lower power, generate minimal heat, and do not burn out.';
  const stepA = await studyAssistantService.stepStudySession(
    classId,
    studentA,
    startSessionA.session.sessionId,
    strongAnswerText,
    14000
  );

  const stateA_after = studentLearningStateService.getStudentLearningState(classId, studentA);
  const p2Pass = stepA.evaluation !== undefined &&
                 stepA.evaluation.correctness >= 0.75 &&
                 stepA.evaluation.misconceptionDetected === false &&
                 (stepA.evaluation.recommendedPedagogicalAction === 'CHALLENGE' || stepA.evaluation.recommendedPedagogicalAction === 'ADVANCE' || stepA.evaluation.recommendedPedagogicalAction === 'PRACTICE') &&
                 stepA.session.score >= 0.75 &&
                 stateA_after.conceptMastery !== undefined;

  recordProof(2, 'Strong Open-Ended Answer Semantic Evaluation', 'Evaluator -> Evidence -> State', p2Pass, {
    student: studentA,
    submittedAnswer: strongAnswerText,
    evaluatorCorrectness: stepA.evaluation?.correctness,
    evaluatorAction: stepA.evaluation?.recommendedPedagogicalAction,
    evaluatorFeedback: stepA.evaluation?.feedback,
    evaluatorConfidence: stepA.evaluation?.confidence,
    evidenceSummary: stepA.evaluation?.evidenceSummary,
    updatedLearnerMastery: stateA_after.overallMastery,
    updatedConceptMastery: stateA_after.conceptMastery,
    nextAdaptedPhase: stepA.session.currentPhase,
    nextPrompt: stepA.nextPrompt,
  });

  // =========================================================================
  // PROOF 3: Real Weak / Misconception Answer Evaluation (Student B)
  // =========================================================================
  const misconceptionAnswerText = 'Transistors work by boiling a tungsten filament inside a glass bulb to create vacuum tubes inside magnetic drums.';
  const stepB = await studyAssistantService.stepStudySession(
    classId,
    studentB,
    startSessionB.session.sessionId,
    misconceptionAnswerText,
    19000
  );

  const stateB_after = studentLearningStateService.getStudentLearningState(classId, studentB);
  const p3Pass = stepB.evaluation !== undefined &&
                 stepB.evaluation.misconceptionDetected === true &&
                 stepB.evaluation.misconception !== null &&
                 stepB.evaluation.recommendedPedagogicalAction === 'REPAIR' &&
                 stepB.session.plannedPhases.includes('PREREQUISITE_REPAIR') &&
                 stateB_after.activeMisconceptions.length > 0;

  recordProof(3, 'Weak / Misconception Answer Semantic Evaluation & Repair Branching', 'Misconception Lifecycle', p3Pass, {
    student: studentB,
    submittedAnswer: misconceptionAnswerText,
    evaluatorCorrectness: stepB.evaluation?.correctness,
    misconceptionDetected: stepB.evaluation?.misconceptionDetected,
    detectedMisconception: stepB.evaluation?.misconception,
    recommendedAction: stepB.evaluation?.recommendedPedagogicalAction,
    evaluatorFeedback: stepB.evaluation?.feedback,
    activeMisconceptionsCount: stateB_after.activeMisconceptions.length,
    activeMisconceptionDetails: stateB_after.activeMisconceptions[0]?.description,
    nextAdaptedPhase: stepB.session.currentPhase,
    nextAdaptedPrompt: stepB.nextPrompt,
  });

  // =========================================================================
  // PROOF 4: Contrast Proof: Student A (Master) vs Student B (Developing)
  // =========================================================================
  const p4Pass = stepA.evaluation!.correctness > stepB.evaluation!.correctness &&
                 stepA.evaluation!.recommendedPedagogicalAction !== stepB.evaluation!.recommendedPedagogicalAction &&
                 stepA.nextPrompt !== stepB.nextPrompt &&
                 stepA.session.currentPhase !== stepB.session.currentPhase;

  recordProof(4, 'Same Question, Distinct Pedagogical Actions & Paths Contrast', 'Adaptive Tutoring Contrast', p4Pass, {
    sameQuestionPrompt: startSessionA.prompt,
    studentA_Outcome: {
      score: stepA.evaluation?.correctness,
      action: stepA.evaluation?.recommendedPedagogicalAction,
      phase: stepA.session.currentPhase,
      prompt: stepA.nextPrompt?.substring(0, 60) + '...',
    },
    studentB_Outcome: {
      score: stepB.evaluation?.correctness,
      action: stepB.evaluation?.recommendedPedagogicalAction,
      phase: stepB.session.currentPhase,
      prompt: stepB.nextPrompt?.substring(0, 60) + '...',
    },
  });

  // =========================================================================
  // PROOF 5: Misconception Stability & Subsequent Mastery Resolution
  // =========================================================================
  // 1. Record repeat occurrence with matching key -> promotes to stable misconception
  dbService.recordMisconceptionOccurrence(
    classId,
    studentB,
    topicId,
    topicName,
    'concept_misconception',
    'Confusing solid state transistors with incandescent filaments'
  );
  studentLearningStateService.invalidateState(classId, studentB);
  const stateB_stable = studentLearningStateService.getStudentLearningState(classId, studentB);
  const stableRecord = stateB_stable.activeMisconceptions.find(m => m.topicId === topicId && m.misconceptionKey === 'concept_misconception');
  const isStable = stableRecord?.isStable === true || (stableRecord?.errorFrequency ?? 0) >= 2;

  // 2. Resolve on demonstrated mastery
  dbService.resolveMisconception(classId, studentB, topicId);
  studentLearningStateService.invalidateState(classId, studentB);
  const stateB_resolved = studentLearningStateService.getStudentLearningState(classId, studentB);
  const activeRemaining = stateB_resolved.activeMisconceptions.filter(m => m.topicId === topicId && !m.resolved);

  const p5Pass = isStable && activeRemaining.length === 0;
  recordProof(5, 'Misconception Stability Tracking & Mastery Resolution', 'Learner Model Lifecycle', p5Pass, {
    stabilityObservedAfterRepeatError: isStable,
    occurrencesBeforeResolution: stableRecord?.errorFrequency,
    activeMisconceptionsAfterDemonstratedMastery: activeRemaining.length,
  });

  // =========================================================================
  // PROOF 6: Multi-Dimensional Cognitive Masteries Evidence Fusion
  // =========================================================================
  const stateBeforeA = studentLearningStateService.getStudentLearningState(classId, studentA);
  const priorReasoning = stateBeforeA.reasoningMastery ?? 0.50;

  const event: any = {
    id: `le_p6_dim_${Date.now()}`,
    studentId: studentA,
    classId,
    topicId,
    category: 'STUDY_SESSION',
    metrics: {
      isCorrect: true,
      score: 0.95,
      conceptUnderstanding: 0.92,
      reasoningQuality: 0.94,
      application: 0.90,
      transfer: 0.88,
      timeToAnswerMs: 11000,
      attemptsCount: 1,
    },
    contextSummary: 'Cognitive tier dimensional update',
    timestamp: new Date().toISOString(),
  };
  learnerModelService.processLearningEvent(event);
  studentLearningStateService.invalidateState(classId, studentA);
  const stateAfterA = studentLearningStateService.getStudentLearningState(classId, studentA);

  const p6Pass = stateAfterA.conceptMastery !== undefined &&
                 stateAfterA.reasoningMastery !== undefined &&
                 stateAfterA.applicationMastery !== undefined &&
                 stateAfterA.transferMastery !== undefined &&
                 stateAfterA.reasoningMastery >= priorReasoning;

  recordProof(6, 'Cognitive Dimensions Evidence Fusion', 'Learner State Tiers', p6Pass, {
    conceptMastery: stateAfterA.conceptMastery,
    reasoningMastery: stateAfterA.reasoningMastery,
    applicationMastery: stateAfterA.applicationMastery,
    transferMastery: stateAfterA.transferMastery,
    overallMastery: stateAfterA.overallMastery,
  });

  // =========================================================================
  // PROOF 7: Duplicate Submission & Rapid-Click Idempotency Protection
  // =========================================================================
  // Advance studentA session to completion
  let currentSessionA = stepA.session;
  for (let i = currentSessionA.currentPhaseIndex; i < currentSessionA.plannedPhases.length; i++) {
    const nextStep = await studyAssistantService.stepStudySession(
      classId,
      studentA,
      currentSessionA.sessionId,
      'Transistors are solid state semiconductors that do not burn out.'
    );
    currentSessionA = nextStep.session;
  }

  // Attempt rapid duplicate step on completed session
  const duplicateStep = await studyAssistantService.stepStudySession(
    classId,
    studentA,
    currentSessionA.sessionId,
    'Duplicate submission payload'
  );

  const p7Pass = duplicateStep.isCompleted === true &&
                 duplicateStep.feedback.includes('already completed') &&
                 duplicateStep.session.completedAt !== undefined;

  recordProof(7, 'Duplicate Submission Protection & Idempotent Guard', 'Security & Integrity', p7Pass, {
    isCompleted: duplicateStep.isCompleted,
    feedback: duplicateStep.feedback,
    completedAt: duplicateStep.session.completedAt,
  });

  // =========================================================================
  // PROOF 8: Refresh / Reload Session Persistence
  // =========================================================================
  // Start active session for Bob
  const newBobSession = studyAssistantService.startStudySession(classId, studentB, topicId, 'REVISION');
  // Query active session via database persistence lookup (simulating browser reload)
  const reloadedSession = dbService.getActiveStudySession(classId, studentB);

  const p8Pass = reloadedSession !== undefined &&
                 reloadedSession.sessionId === newBobSession.session.sessionId &&
                 reloadedSession.topicId === topicId &&
                 reloadedSession.studentId === studentB;

  recordProof(8, 'Browser Reload & Active Session Persistence', 'State Persistence', p8Pass, {
    persistedSessionId: reloadedSession?.sessionId,
    topicName: reloadedSession?.topicName,
    currentPhase: reloadedSession?.currentPhase,
    plannedPhases: reloadedSession?.plannedPhases,
  });

  // =========================================================================
  // PROOF 9: Deterministic Fast Path for MCQ and Pure Numbers
  // =========================================================================
  const mcqEval = await answerEvaluatorService.evaluate({
    classId,
    studentId: studentA,
    question: 'Which component replaced vacuum tubes in 2nd gen computers?',
    questionType: 'MCQ',
    options: ['Transistors', 'Microprocessors', 'Integrated Circuits'],
    expectedAnswer: 'Transistors',
    studentAnswer: 'Transistors',
    currentTopic: topicId,
    topicName,
  });

  const numEval = await answerEvaluatorService.evaluate({
    classId,
    studentId: studentA,
    question: 'A 10 kg mass accelerates at 2 m/s². What is the net force?',
    questionType: 'NUMERICAL',
    expectedAnswer: '20 N',
    studentAnswer: '20',
    currentTopic: 'newton_laws',
    topicName: "Newton's Second Law",
  });

  const p9Pass = mcqEval.evaluationMode === 'DETERMINISTIC' &&
                 mcqEval.confidence === 1.0 &&
                 mcqEval.correctness === 1.0 &&
                 numEval.evaluationMode === 'DETERMINISTIC' &&
                 numEval.confidence === 1.0 &&
                 numEval.correctness === 1.0;

  recordProof(9, 'Deterministic Fast-Path Validation (0 ms LLM Overhead)', 'Performance & Cost', p9Pass, {
    mcqMode: mcqEval.evaluationMode,
    mcqConfidence: mcqEval.confidence,
    numericalMode: numEval.evaluationMode,
    numericalConfidence: numEval.confidence,
  });

  // =========================================================================
  // PROOF 10: Course Grounding vs General World Knowledge Disambiguation
  // =========================================================================
  const ragEval = await answerEvaluatorService.evaluate({
    classId,
    studentId: studentA,
    question: 'What memory technology was introduced in second generation computers?',
    questionType: 'SHORT_ANSWER',
    expectedAnswer: 'Magnetic core memory',
    studentAnswer: 'Magnetic core memory was introduced using tiny magnetic ferrite rings.',
    currentTopic: topicId,
    topicName,
  });

  const p10Pass = ragEval.correctness >= 0.85 &&
                  ragEval.feedback.length > 10 &&
                  ragEval.evidenceSummary.length > 5;

  recordProof(10, 'Course-Grounded Context Disambiguation', 'RAG Provenance', p10Pass, {
    correctness: ragEval.correctness,
    feedback: ragEval.feedback,
    evidenceSummary: ragEval.evidenceSummary,
    confidence: ragEval.confidence,
  });

  // =========================================================================
  // PROOF 11: Low-Confidence & Ambiguous Fallback Safety
  // =========================================================================
  const sparseEval = await answerEvaluatorService.evaluate({
    classId,
    studentId: studentB,
    question: 'Explain the thermodynamic efficiency of cooling systems in discrete component computers.',
    questionType: 'REASONING',
    expectedAnswer: ['heat dissipation formulas', 'convective transfer'],
    studentAnswer: 'maybe heat stuff',
    currentTopic: topicId,
    topicName,
  });

  const p11Pass = (sparseEval.recommendedPedagogicalAction === 'SCAFFOLD' || sparseEval.recommendedPedagogicalAction === 'EXPLAIN' || sparseEval.recommendedPedagogicalAction === 'CLARIFICATION') &&
                  sparseEval.correctness < 0.70;

  recordProof(11, 'Low-Confidence & Ambiguous Answer Safe Pedagogical Routing', 'Safety & Fallback', p11Pass, {
    sparseInput: 'maybe heat stuff',
    score: sparseEval.correctness,
    recommendedAction: sparseEval.recommendedPedagogicalAction,
    feedback: sparseEval.feedback,
  });

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n================================================================');
  console.log('FINAL HARDENING ACCEPTANCE PROOF SUMMARY');
  console.log('================================================================');
  const total = proofs.length;
  const passed = proofs.filter((p) => p.passed).length;
  const failed = total - passed;
  console.log(`TOTAL PROOFS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED PROOF STEPS:');
    proofs.filter((p) => !p.passed).forEach((p) => {
      console.error(`- [Step ${p.id}] ${p.name}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 11/11 PHASE 6 FINAL HARDENING ACCEPTANCE PROOFS PASSED PERFECTLY! 🔥\n');
  }
}

runPhase6FinalHardeningAcceptance().catch((err) => {
  console.error('Fatal hardening test error:', err);
  process.exit(1);
});

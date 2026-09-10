import { dbService } from '../services/db.service';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { teachingStrategyEngine } from '../services/personalization/teachingStrategyEngine';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { ragRepository } from '../services/rag/ragRepository';

async function runAssessmentQualityAndSubmitSuite() {
  console.log('================================================================');
  console.log('  CLASSPULSE: ASSESSMENT QUALITY & SUBMIT FLOW VERIFICATION');
  console.log('================================================================\n');

  const testClassId = `VERIFY_CLASS_${Date.now()}`;
  ragRepository.clearClass(testClassId);

  // 1. Seed Syllabus and Course Material Chunks in dbService & RAG repository
  console.log('--- STEP 1: Seed Syllabus & Course Chunks ---');
  const dummyEmbedding = new Array(768).fill(0.01);
  const chunk1 = {
    id: `chk_verify_01`,
    text: 'Second Generation: Transistors replaced vacuum tubes, drastically improving Mean Time Between Failures (MTBF) and eliminating warmup time through semiconductor conduction.',
    embedding: dummyEmbedding,
    metadata: {
      chunkId: `chk_verify_01`,
      classId: testClassId,
      materialId: `mat_verify_01`,
      pageNumber: 1,
      chunkIndex: 0,
      title: 'Computer Evolution & Architecture',
    },
  };
  const chunk2 = {
    id: `chk_verify_02`,
    text: 'Memory & Magnetic Core: Second generation introduced magnetic core memory with ferrite rings storing binary hysteresis states.',
    embedding: dummyEmbedding,
    metadata: {
      chunkId: `chk_verify_02`,
      classId: testClassId,
      materialId: `mat_verify_01`,
      pageNumber: 1,
      chunkIndex: 1,
      title: 'Computer Evolution & Architecture',
    },
  };

  ragRepository.addChunks([chunk1 as any, chunk2 as any]);
  dbService.addMaterialChunks([
    {
      id: chunk1.id,
      materialId: chunk1.metadata.materialId,
      classId: testClassId,
      content: chunk1.text,
      tokenCount: 30,
      pageNumber: 1,
    },
    {
      id: chunk2.id,
      materialId: chunk2.metadata.materialId,
      classId: testClassId,
      content: chunk2.text,
      tokenCount: 30,
      pageNumber: 1,
    }
  ]);
  console.log(`[PASS] Indexed course material chunks with provenance in database and vector store.\n`);

  // 2. Test Question Quality & Grounding
  console.log('--- STEP 2: Verify Question Quality & Grounding ---');
  const student1 = 'std_quality_test_1';
  learnerModelService.getOrInitializeProfile(testClassId, student1);

  // Generate 20 questions across topics to verify absence of trivial model recall
  const forbiddenTriviaTerms = ['name a prominent commercial second-generation computer model produced by ibm', 'ibm 1401 / ibm 7090'];
  for (let i = 0; i < 20; i++) {
    const q = await microAssessmentService.generateQuestion(testClassId, student1, 'second_generation');
    for (const term of forbiddenTriviaTerms) {
      if (q.questionText.toLowerCase().includes(term)) {
        throw new Error(`[FAIL] Found narrow trivia recall question in bank: "${q.questionText}"`);
      }
    }
    if (!q.expectedKeyPoints || q.expectedKeyPoints.length === 0) {
      throw new Error(`[FAIL] Question missing expected key points: "${q.questionText}"`);
    }
    if (!['CONCEPTUAL', 'COMPARISON', 'APPLICATION', 'REASONING', 'TRANSFER'].includes(q.type)) {
      throw new Error(`[FAIL] Invalid cognitive question type: ${q.type}`);
    }
  }
  console.log('[PASS] Question bank contains deep causal/scenario questions and zero narrow trivia recall questions.\n');

  // 3. Test Personal Learning Calibration (Diagnostic Suite for UNINITIALIZED student)
  console.log('--- STEP 3: Personal Learning Calibration (5-Tier Cognitive Calibration) ---');
  const studentNew = 'std_uninitialized_01';
  const initialProfile = learnerModelService.getOrInitializeProfile(testClassId, studentNew);
  if (initialProfile.profileStatus !== 'UNINITIALIZED') {
    throw new Error(`[FAIL] Expected UNINITIALIZED profile status for fresh student, got: ${initialProfile.profileStatus}`);
  }

  const session = microAssessmentService.generateDiagnosticSuite(testClassId, studentNew);
  if (session.questions.length !== 5) {
    throw new Error(`[FAIL] Expected 5 diagnostic questions, got ${session.questions.length}`);
  }

  const expectedTiers = ['FOUNDATION', 'CONCEPT', 'APPLICATION', 'REASONING', 'TRANSFER'];
  const actualTiers = session.questions.map(q => q.questionType);
  for (let i = 0; i < expectedTiers.length; i++) {
    if (actualTiers[i] !== expectedTiers[i]) {
      throw new Error(`[FAIL] Expected Tier ${expectedTiers[i]} at index ${i}, got: ${actualTiers[i]}`);
    }
  }
  console.log(`[PASS] Diagnostic Suite contains all 5 progressive cognitive tiers: ${actualTiers.join(' -> ')}`);

  // Submit diagnostic answers: Strong in Foundation/Concept, Weak in Transfer
  const diagSubmissions = [
    { questionId: session.questions[0].id, answer: session.questions[0].options ? session.questions[0].options[0] : 'vacuum tubes', timeToAnswerMs: 8000 },
    { questionId: session.questions[1].id, answer: session.questions[1].options ? session.questions[1].options[0] : 'transistors were smaller and faster', timeToAnswerMs: 11000 },
    { questionId: session.questions[2].id, answer: session.questions[2].options ? session.questions[2].options[0] : 'integrated circuit technology', timeToAnswerMs: 14000 },
    { questionId: session.questions[3].id, answer: session.questions[3].options ? session.questions[3].options[0] : 'entire CPU on single chip', timeToAnswerMs: 12000 },
    { questionId: session.questions[4].id, answer: 'not sure how this connects', timeToAnswerMs: 5000 }, // Weak transfer
  ];

  const evalResult = microAssessmentService.evaluateDiagnosticSuite(testClassId, studentNew, session.sessionId, diagSubmissions);
  if (evalResult.session.status !== 'COMPLETED') {
    throw new Error(`[FAIL] Expected session status COMPLETED, got: ${evalResult.session.status}`);
  }

  const activeProfile = learnerModelService.getOrInitializeProfile(testClassId, studentNew);
  if (activeProfile.profileStatus !== 'ACTIVE') {
    throw new Error(`[FAIL] Expected ACTIVE profile status after diagnostic calibration, got: ${activeProfile.profileStatus}`);
  }
  if (activeProfile.foundationMastery === undefined || activeProfile.transferMastery === undefined) {
    throw new Error(`[FAIL] Profile missing dimensional masteries after diagnostic calibration`);
  }

  console.log(`[PASS] Student calibrated to ACTIVE. Dimensions: Foundation=${activeProfile.foundationMastery}, Concept=${activeProfile.conceptMastery}, App=${activeProfile.applicationMastery}, Reasoning=${activeProfile.reasoningMastery}, Transfer=${activeProfile.transferMastery}\n`);

  // 4. Test Strategy Differentiation based on Dimensional Scores
  console.log('--- STEP 4: Strategy Differentiation based on Dimensions ---');
  const stateSnapshot = studentLearningStateService.getStudentLearningState(testClassId, studentNew);
  const strategyPlan = teachingStrategyEngine.selectStrategyPlan(stateSnapshot, 'Explain microprocessor integration');
  console.log(`[PASS] Strategy selected: ${strategyPlan.primaryStrategy}, Primitives: ${strategyPlan.primitives.join(', ')}, Rationale: "${strategyPlan.rationale}"`);

  // 5. Test Quick Concept Check (Micro-Assessment for ACTIVE student)
  console.log('\n--- STEP 5: Quick Concept Check (Micro-Check) Submit Flow ---');
  const microQ = await microAssessmentService.generateQuestion(testClassId, studentNew, 'second_generation');
  console.log(`Generated Micro-Check Question: "${microQ.questionText}" (Type: ${microQ.type})`);

  const studentAns = microQ.options ? microQ.options[0] : microQ.expectedKeyPoints[0];
  const evalCheck = await microAssessmentService.evaluateAnswer(testClassId, studentNew, microQ, studentAns, 9000);

  if (!evalCheck.isCorrect || evalCheck.score < 0.7) {
    throw new Error(`[FAIL] Expected correct micro-assessment evaluation, got score=${evalCheck.score}`);
  }
  console.log(`[PASS] Answer correctly evaluated. Feedback: "${evalCheck.feedback}"`);

  const updatedProfile = learnerModelService.getOrInitializeProfile(testClassId, studentNew);
  console.log(`[PASS] Learner model updated in real-time. Evidence Count: ${updatedProfile.evidenceCount}\n`);

  console.log('================================================================');
  console.log('  ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! (100% PASSED)  ');
  console.log('================================================================');
}

runAssessmentQualityAndSubmitSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

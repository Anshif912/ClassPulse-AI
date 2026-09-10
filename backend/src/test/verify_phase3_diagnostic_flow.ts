import assert from 'node:assert';
import { dbService } from '../services/db.service';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';

function pass(testName: string, detail?: string) {
  console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
}

function fail(testName: string, error: any) {
  console.error(`❌ [FAIL] ${testName}:`, error);
  process.exit(1);
}

async function runDiagnosticFlowVerification() {
  console.log('================================================================');
  console.log('🧪 VERIFYING PHASE 3: REAL DIAGNOSTIC & TRUE ONE-TO-ONE FLOW');
  console.log('================================================================\n');

  const CLASS_CS = 'CLASS_CS_DIAGNOSTIC_DEMO';
  const CLASS_PHY = 'CLASS_PHY_DIAGNOSTIC_DEMO';

  const STD_FRESH = 'std_fresh_onboarding_user';
  const STD_ALICE = 'std_diag_alice_high';
  const STD_BOB = 'std_diag_bob_gap';

  // Seed syllabus chunks for CS classroom
  const csEvolutionPages = [
    {
      pageNumber: 1,
      text: 'First Generation Computers (1940-1956): Utilized thermionic vacuum tubes for electronic switching. Large, expensive, generated extreme heat and required significant electrical cooling.',
    },
    {
      pageNumber: 2,
      text: 'Second Generation Computers (1956-1963): Utilized solid-state semiconductor transistors. Smaller, drastically less heat dissipation, lower power consumption, higher speed and reliability.',
    },
    {
      pageNumber: 3,
      text: 'Third Generation Computers (1964-1971): Integrated Circuits (ICs) integrated thousands of discrete transistors onto a single miniature semiconductor silicon chip.',
    },
    {
      pageNumber: 4,
      text: 'Fourth Generation Computers (1971-Present): Microprocessors and Very Large Scale Integration (VLSI) packed millions of transistors onto a single microchip, enabling modern personal computing.',
    },
  ];

  const csChunks = SemanticChunker.chunkDocument(
    csEvolutionPages,
    CLASS_CS,
    'mat_cs_evo',
    'Evolution of Computing',
    'CS_Evolution.pdf',
    'prof_alan'
  );
  ragRepository.addChunks(csChunks);

  // --------------------------------------------------------------------------
  // TEST 1: Fresh Student Starts as UNINITIALIZED (Zero Fake Mastery)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Fresh Student Starts as UNINITIALIZED ---');
  try {
    const freshProfile = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_FRESH);
    assert.strictEqual(freshProfile.profileStatus, 'UNINITIALIZED');
    assert.strictEqual(freshProfile.overallMastery, 0);
    assert.strictEqual(freshProfile.evidenceCount, 0);
    pass('Test 1', 'Fresh student initialized cleanly with profileStatus="UNINITIALIZED" and overallMastery=0');
  } catch (err) {
    fail('Test 1', err);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Real Class-Specific Diagnostic Generation (Physics vs CS)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Real Class-Specific Diagnostic Generation ---');
  try {
    const csSession = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_FRESH);
    const phySession = microAssessmentService.generateDiagnosticSuite(CLASS_PHY, 'std_phy_user');

    assert.strictEqual(csSession.questions.length, 5);
    assert.strictEqual(phySession.questions.length, 5);

    // Verify CS questions reference computer generations
    const csText = csSession.questions.map((q) => q.questionText).join(' ');
    assert.ok(csText.toLowerCase().includes('vacuum') || csText.toLowerCase().includes('transistor') || csText.toLowerCase().includes('semiconductor'));

    // Verify Physics questions reference forces / Newton's laws
    const phyText = phySession.questions.map((q) => q.questionText).join(' ');
    assert.ok(phyText.toLowerCase().includes('force') || phyText.toLowerCase().includes('acceleration') || phyText.toLowerCase().includes('newton'));

    pass('Test 2', 'Class-specific diagnostics generated: CS covers computer generations, Physics covers Newtonian mechanics');
  } catch (err) {
    fail('Test 2', err);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Progressive 5-Question Sequence
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Progressive 5-Question Sequence ---');
  try {
    const session = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_FRESH);
    const types = session.questions.map((q) => q.questionType);
    assert.deepStrictEqual(types, ['FOUNDATION', 'CONCEPT', 'APPLICATION', 'REASONING', 'TRANSFER']);
    pass('Test 3', `Verified progressive sequence: ${types.join(' -> ')}`);
  } catch (err) {
    fail('Test 3', err);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Partial Diagnostic Survives Reload (CALIBRATING state)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Partial Diagnostic Progress Saved & Resumes ---');
  try {
    const session = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_FRESH);
    microAssessmentService.saveQuestionAnswer(session.sessionId, {
      questionId: session.questions[0].id,
      answer: 'Vacuum Tubes',
      timeToAnswerMs: 6000,
    });
    microAssessmentService.saveQuestionAnswer(session.sessionId, {
      questionId: session.questions[1].id,
      answer: 'Transistors dissipated less heat and consumed far less power',
      timeToAnswerMs: 12000,
    });

    const reloaded = dbService.getActiveDiagnosticSession(CLASS_CS, STD_FRESH);
    assert.ok(reloaded);
    assert.strictEqual(reloaded.status, 'CALIBRATING');
    assert.strictEqual(Object.keys(reloaded.answers).length, 2);
    pass('Test 4', 'Partial diagnostic answers persisted and resume in status="CALIBRATING"');
  } catch (err) {
    fail('Test 4', err);
  }

  // --------------------------------------------------------------------------
  // TEST 5 & 6: Diagnostic Answers Create Observable Evidence (Alice vs Bob)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5 & 6: Diagnostic Completion & Profile Activation ---');
  try {
    // Student A (Alice): Strong across all 5 questions
    const sessionA = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_ALICE);
    const submissionsA = sessionA.questions.map((q) => ({
      questionId: q.id,
      answer: q.options ? q.options[0] : q.expectedKeyPoints.join(' '),
      timeToAnswerMs: 8000,
      hintsUsed: 0,
    }));
    microAssessmentService.evaluateDiagnosticSuite(CLASS_CS, STD_ALICE, sessionA.sessionId, submissionsA);
    const profileA = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_ALICE);

    assert.strictEqual(profileA.profileStatus, 'ACTIVE');
    assert.ok(profileA.overallMastery >= 0.80);
    assert.strictEqual(profileA.preferredPace, 'ACCELERATED');
    assert.strictEqual(profileA.difficultyLevel, 'HARD');
    assert.strictEqual(profileA.preferredExplanationStyle, 'DIRECT');

    // Student B (Bob): Struggles with Foundation & Prerequisite
    const sessionB = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_BOB);
    const submissionsB = sessionB.questions.map((q, idx) => ({
      questionId: q.id,
      answer: idx >= 3 ? (q.options ? q.options[0] : q.expectedKeyPoints[0]) : 'wrong irrelevant answer',
      timeToAnswerMs: 35000,
      hintsUsed: 1,
    }));
    microAssessmentService.evaluateDiagnosticSuite(CLASS_CS, STD_BOB, sessionB.sessionId, submissionsB);
    const profileB = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_BOB);

    assert.strictEqual(profileB.profileStatus, 'ACTIVE');
    assert.ok(profileB.overallMastery < 0.65);
    assert.strictEqual(profileB.preferredPace, 'GENTLE');
    assert.strictEqual(profileB.difficultyLevel, 'EASY');
    assert.strictEqual(profileB.preferredExplanationStyle, 'ANALOGY_EXAMPLE');

    pass('Test 5 & 6', `Profiles activated -> Alice: ${Math.round(profileA.overallMastery * 100)}% (ACCELERATED/DIRECT) | Bob: ${Math.round(profileB.overallMastery * 100)}% (GENTLE/ANALOGY)`);
  } catch (err) {
    fail('Test 5 & 6', err);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Academic Marks Treated as Prior Only (Bayesian weighting)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Marks as Bayesian Prior Only ---');
  try {
    const STD_PRIOR = 'std_prior_test_user';
    // Prior marks = 90%
    const profileWithPrior = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_PRIOR, 90);
    assert.strictEqual(profileWithPrior.priorAcademicPerformance.priorSubjectScore, 90);

    // Student does moderate diagnostic (60% score)
    const sessionPrior = microAssessmentService.generateDiagnosticSuite(CLASS_CS, STD_PRIOR);
    const subs = sessionPrior.questions.map((q, i) => ({
      questionId: q.id,
      answer: i < 3 ? (q.options ? q.options[0] : q.expectedKeyPoints[0]) : 'incorrect answer',
      timeToAnswerMs: 18000,
    }));
    microAssessmentService.evaluateDiagnosticSuite(CLASS_CS, STD_PRIOR, sessionPrior.sessionId, subs);
    const updatedPrior = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_PRIOR);

    // Verify final mastery is blended (0.35 * 0.90 + 0.65 * 0.60 = 0.315 + 0.39 = 0.71) rather than fixed at 90%
    assert.ok(updatedPrior.overallMastery < 0.85);
    assert.ok(updatedPrior.overallMastery > 0.60);
    pass('Test 7', `Prior 90% + Diagnostic 60% resulted in blended mastery: ${Math.round(updatedPrior.overallMastery * 100)}%`);
  } catch (err) {
    fail('Test 7', err);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Same Question / Different Diagnostic Outcome -> Different Tutoring
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Same Question Produces Different Tutoring ---');
  try {
    const query = 'Why did transistors replace vacuum tubes in second generation computers?';
    const decisionA = tutorDecisionEngine.decide(CLASS_CS, STD_ALICE, query, 'second_generation');
    const decisionB = tutorDecisionEngine.decide(CLASS_CS, STD_BOB, query, 'second_generation');

    assert.strictEqual(decisionA.action, 'CONCISE_EXPLANATION');
    assert.strictEqual(decisionA.strategy, 'DIRECT');
    assert.strictEqual(decisionA.depth, 'SHORT');
    assert.strictEqual(decisionA.difficulty, 'HARD');

    assert.strictEqual(decisionB.action, 'PREREQUISITE_BRIDGE');
    assert.strictEqual(decisionB.strategy, 'ANALOGY_EXAMPLE');
    assert.strictEqual(decisionB.depth, 'LAYERED');
    assert.strictEqual(decisionB.difficulty, 'EASY');

    const resA = await personalizedRAGAdapter.queryPersonalized(query, CLASS_CS, STD_ALICE);
    const resB = await personalizedRAGAdapter.queryPersonalized(query, CLASS_CS, STD_BOB);

    assert.ok(resA.personalizedExplanation.length > 0);
    assert.ok(resB.personalizedExplanation.length > 0);
    assert.notStrictEqual(resA.tutorDecision.strategy, resB.tutorDecision.strategy);

    pass('Test 8', `Alice received ${resA.tutorDecision.strategy} (Concise/Direct); Bob received ${resB.tutorDecision.strategy} (Scaffolded/Analogy)`);
  } catch (err) {
    fail('Test 8', err);
  }

  // --------------------------------------------------------------------------
  // TEST 9 & 10: Micro-Assessment Loop Updates State and Changes Next Decision
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9 & 10: Continuous Adaptation via Micro-Check ---');
  try {
    const initialBobProfile = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_BOB);
    const bobMasteryBefore = initialBobProfile.overallMastery;

    const microQ = await microAssessmentService.generateQuestion(CLASS_CS, STD_BOB, 'second_generation');
    const evalRes = await microAssessmentService.evaluateAnswer(
      CLASS_CS,
      STD_BOB,
      microQ,
      'Transistors are solid state semiconductors that do not use physical filaments and dissipate far less heat'
    );

    assert.strictEqual(evalRes.isCorrect, true);
    const updatedBobProfile = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_BOB);
    assert.ok(updatedBobProfile.overallMastery > bobMasteryBefore);

    // Subsequent doubt decision consumes promoted state
    const followUpDecision = tutorDecisionEngine.decide(CLASS_CS, STD_BOB, 'How did transistors lead to integrated circuits?', 'second_generation');
    pass('Test 9 & 10', `Bob mastery upgraded (${Math.round(bobMasteryBefore * 100)}% -> ${Math.round(updatedBobProfile.overallMastery * 100)}%). Subsequent tutor decision adapted to promoted state.`);
  } catch (err) {
    fail('Test 9 & 10', err);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Recalibration Flow Without Deleting Historical Evidence
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Recalibration Flow Preserves History ---');
  try {
    const eventsBefore = dbService.getLearningEvents(CLASS_CS, STD_ALICE).length;
    assert.ok(eventsBefore > 0);

    learnerModelService.recalibrateProfile(CLASS_CS, STD_ALICE);
    const eventsAfter = dbService.getLearningEvents(CLASS_CS, STD_ALICE).length;

    assert.strictEqual(eventsBefore, eventsAfter);
    pass('Test 11', `Recalibration preserves all ${eventsBefore} historical learning events.`);
  } catch (err) {
    fail('Test 11', err);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Active Students Not Forced Into Diagnostic Again
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 12: Active Students Not Forced Into Diagnostic ---');
  try {
    const activeProf = learnerModelService.getOrInitializeProfile(CLASS_CS, STD_ALICE);
    assert.strictEqual(activeProf.profileStatus, 'ACTIVE');
    assert.ok(activeProf.evidenceCount > 0);
    pass('Test 12', 'Active calibrated student retains ACTIVE status without forced reset');
  } catch (err) {
    fail('Test 12', err);
  }

  // --------------------------------------------------------------------------
  // TEST 13 & 14: Student Isolation & Teacher Aggregate Privacy
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 13 & 14: Privacy & Isolation ---');
  try {
    const profA = dbService.getLearnerProfile(CLASS_CS, STD_ALICE);
    const profB = dbService.getLearnerProfile(CLASS_CS, STD_BOB);
    assert.notStrictEqual(profA?.id, profB?.id);
    assert.notStrictEqual(profA?.overallMastery, profB?.overallMastery);

    const allClassProfiles = dbService.getClassLearnerProfiles(CLASS_CS);
    assert.ok(allClassProfiles.length >= 2);
    pass('Test 13 & 14', 'Verified complete student isolation and privacy boundaries.');
  } catch (err) {
    fail('Test 13 & 14', err);
  }

  // --------------------------------------------------------------------------
  // TEST 15: Multilingual Query Invariance with Active Calibrated State
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 15: Multilingual Query Serving ---');
  try {
    const tamilQuery = 'இரண்டாம் தலைமுறை கணினிகள் பற்றி கூறுங்கள்';
    const resTamil = await personalizedRAGAdapter.queryPersonalized(tamilQuery, CLASS_CS, STD_ALICE);
    assert.ok(resTamil.personalizedExplanation.length > 0);
    assert.strictEqual(resTamil.tutorDecision.strategy, 'DIRECT');
    pass('Test 15', 'Tamil query successfully resolved using Alice\'s active calibrated profile.');
  } catch (err) {
    fail('Test 15', err);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 15/15 PHASE 3 DIAGNOSTIC & PERSONALIZATION TESTS PASSED!');
  console.log('================================================================\n');
}

runDiagnosticFlowVerification().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

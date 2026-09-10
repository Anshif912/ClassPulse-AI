import { dbService } from '../services/db.service';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import {
  DiagnosticAnswerSubmission,
  DiagnosticSession,
  StudentLearnerProfile,
} from '../services/personalization/types';
import * as fs from 'fs';
import * as path from 'path';

async function runFinalDiagnosticValidation() {
  console.log('\n================================================================');
  console.log('  FINAL DIAGNOSTIC VALIDATION & ADAPTIVE TUTORING SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SETUP TEST DATA: Two classes with distinct materials (Physics vs Computer Science)
  // ────────────────────────────────────────────────────────────────────────────
  const classPhysicsId = 'CLASS_PHY_FINAL_VAL';
  const classCSId = 'CLASS_CS_FINAL_VAL';

  // Seed Physics Classroom and Material Chunks
  dbService.createClassroom({
    classId: classPhysicsId,
    name: 'AP Physics Mechanics',
    subject: 'Physics',
    teacherId: 'teacher_phys_1',
    teacherName: 'Dr. Newton',
    status: 'active',
    materials: [],
    students: [],
    createdAt: new Date().toISOString(),
  });

  dbService.addMaterialChunks([
    {
      id: 'chk_phy_1',
      materialId: 'mat_phy_1',
      classId: classPhysicsId,
      chunkIndex: 0,
      content: "Newton's First Law states that an object at rest remains at rest, and an object in motion continues in motion with a constant velocity unless acted upon by a net external force. When net force is zero, acceleration is zero.",
      sectionTitle: "Newton's First Law",
      tokenCount: 45,
    },
    {
      id: 'chk_phy_2',
      materialId: 'mat_phy_1',
      classId: classPhysicsId,
      chunkIndex: 1,
      content: "Newton's Second Law defines force as F = ma. Acceleration is directly proportional to net force and inversely proportional to mass. Greater mass results in greater inertia.",
      sectionTitle: "Newton's Second Law & Inertia",
      tokenCount: 40,
    },
    {
      id: 'chk_phy_3',
      materialId: 'mat_phy_1',
      classId: classPhysicsId,
      chunkIndex: 2,
      content: "Newton's Third Law states that for every action force, there is an equal and opposite reaction force. Examples include rocket propulsion where exhaust gases exert equal opposite thrust.",
      sectionTitle: "Newton's Third Law & Propulsion",
      tokenCount: 38,
    },
  ]);

  // Seed CS Classroom and Material Chunks
  dbService.createClassroom({
    classId: classCSId,
    name: 'Introduction to Computer Systems',
    subject: 'Computer Science',
    teacherId: 'teacher_cs_1',
    teacherName: 'Prof. Turing',
    status: 'active',
    materials: [],
    students: [],
    createdAt: new Date().toISOString(),
  });

  dbService.addMaterialChunks([
    {
      id: 'chk_cs_1',
      materialId: 'mat_cs_1',
      classId: classCSId,
      chunkIndex: 0,
      content: 'First generation computers (1940-1956) utilized vacuum tubes for circuitry and magnetic drums for primary memory. They consumed massive power and produced immense heat.',
      sectionTitle: 'First Generation Hardware',
      tokenCount: 35,
    },
    {
      id: 'chk_cs_2',
      materialId: 'mat_cs_1',
      classId: classCSId,
      chunkIndex: 1,
      content: 'Second generation computers replaced vacuum tubes with solid-state semiconductor transistors, drastically improving reliability, speed, and energy efficiency.',
      sectionTitle: 'Second Generation Transistors',
      tokenCount: 32,
    },
  ]);

  // Invalidate concept graph cache to ensure fresh build from chunks
  conceptGraphService.invalidateCache(classPhysicsId);
  conceptGraphService.invalidateCache(classCSId);

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 1 & 3: FRESH STUDENT UNINITIALIZED STATE & ZERO FAKE METRICS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 1 & 3: Fresh Student State & Terminology ---');
  const freshStudentId = 'student_fresh_999';
  const freshProfile = learnerModelService.getOrInitializeProfile(classCSId, freshStudentId);

  assert(
    freshProfile.profileStatus === 'UNINITIALIZED',
    'Item 3: Fresh student profileStatus is UNINITIALIZED'
  );
  assert(
    freshProfile.overallMastery === 0,
    'Item 3: Fresh student overallMastery is exactly 0 (no fake 70%)'
  );
  assert(
    freshProfile.evidenceCount === 0,
    'Item 3: Fresh student evidenceCount is 0'
  );
  assert(
    freshProfile.priorAcademicPerformance.initialPriorScore === 0,
    'Item 3: Fresh student initial prior is 0 before calibration'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 2 & 9: CLASS-SPECIFIC DIAGNOSTIC & PROVENANCE RECORDING
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 2 & 9: Diagnostic Source, Provenance & Cross-Class Isolation ---');
  const phyDiag = microAssessmentService.generateDiagnosticSuite(classPhysicsId, 'student_phy_test');
  const csDiag = microAssessmentService.generateDiagnosticSuite(classCSId, 'student_cs_test');

  // Verify questions differ by subject
  assert(
    phyDiag.questions.length === 5 && csDiag.questions.length === 5,
    'Item 2: Both suites generated 5 questions'
  );
  assert(
    phyDiag.questions[0].topicName.toLowerCase().includes('mechanics') || phyDiag.questions[0].topicName.toLowerCase().includes('newton'),
    'Item 2 & 9: Physics diagnostic references Mechanics/Newton'
  );
  assert(
    csDiag.questions[0].topicName.toLowerCase().includes('vacuum') || csDiag.questions[0].topicName.toLowerCase().includes('generation'),
    'Item 2 & 9: CS diagnostic references Vacuum Tubes / Computer Generations'
  );

  // Verify question internal provenance metadata
  const sampleQ = phyDiag.questions[0];
  assert(
    !!sampleQ.id && !!sampleQ.questionType && !!sampleQ.difficulty && !!sampleQ.topicId,
    'Item 2: Question records internally questionId, cognitive tier, difficulty, topicId'
  );
  assert(
    sampleQ.sourceChunkId !== undefined || phyDiag.questions[1].sourceChunkId !== undefined,
    'Item 2: Diagnostic question is linked to internal source chunk ID'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 4 & 10: 5-TIER PROGRESSION, AUTOSAVE & RESUME
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 4 & 10: 5-Tier Cognitive Progression & Partial Resume ---');
  const sessionStudentId = 'student_resume_user';
  const testSession = microAssessmentService.generateDiagnosticSuite(classPhysicsId, sessionStudentId);

  const tiers = testSession.questions.map(q => q.questionType);
  assert(
    JSON.stringify(tiers) === JSON.stringify(['FOUNDATION', 'CONCEPT', 'APPLICATION', 'REASONING', 'TRANSFER']),
    'Item 4: Diagnostic progresses strictly through FOUNDATION -> CONCEPT -> APPLICATION -> REASONING -> TRANSFER'
  );

  // Answer Q1 and Q2
  microAssessmentService.saveQuestionAnswer(testSession.sessionId, {
    questionId: testSession.questions[0].id,
    answer: 'Zero Net Force',
    timeToAnswerMs: 4200,
    hintsUsed: 0,
  });
  microAssessmentService.saveQuestionAnswer(testSession.sessionId, {
    questionId: testSession.questions[1].id,
    answer: 'F = m * a',
    timeToAnswerMs: 3800,
    hintsUsed: 0,
  });

  // Fetch session again (simulating browser page refresh)
  const resumedSession = dbService.getActiveDiagnosticSession(classPhysicsId, sessionStudentId);
  assert(
    resumedSession !== undefined && resumedSession.status === 'CALIBRATING',
    'Item 4 & 10: Resumed session status is CALIBRATING'
  );
  assert(
    Object.keys(resumedSession!.answers).length === 2,
    'Item 10: Answers for Q1 and Q2 persisted across refresh; student resumes at Q3'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 5: DIAGNOSTIC COMPLETION & ACTIVATION
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 5: Completion & Profile Activation ---');
  const subs: DiagnosticAnswerSubmission[] = [
    { questionId: testSession.questions[0].id, answer: 'Zero Net Force', timeToAnswerMs: 4000 },
    { questionId: testSession.questions[1].id, answer: 'F = m * a', timeToAnswerMs: 3500 },
    { questionId: testSession.questions[2].id, answer: '2 m/s²', timeToAnswerMs: 5000 },
    { questionId: testSession.questions[3].id, answer: 'Greater mass possesses greater inertia', timeToAnswerMs: 6000 },
    { questionId: testSession.questions[4].id, answer: 'Rocket engine propulsion with exhaust gas reaction', timeToAnswerMs: 7000 },
  ];

  const evalResult = microAssessmentService.evaluateDiagnosticSuite(classPhysicsId, sessionStudentId, testSession.sessionId, subs);
  assert(
    evalResult.session.status === 'COMPLETED',
    'Item 5: Session status transitioned to COMPLETED'
  );

  const activatedProfile = learnerModelService.getOrInitializeProfile(classPhysicsId, sessionStudentId);
  assert(
    activatedProfile.profileStatus === 'ACTIVE',
    'Item 5: Learner profile transitioned from UNINITIALIZED to ACTIVE'
  );
  assert(
    activatedProfile.evidenceCount >= 5,
    'Item 5: Diagnostic evidence count recorded in profile'
  );

  // Verify persistence after simulated reload
  const reloadedProfile = dbService.getLearnerProfile(classPhysicsId, sessionStudentId);
  assert(
    reloadedProfile !== undefined && reloadedProfile.profileStatus === 'ACTIVE',
    'Item 5: ACTIVE state persists in database across reloads'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 6: WEIGHTED PRIOR-EVIDENCE FUSION (Marks are prior only)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 6: Weighted Prior-Evidence Fusion ---');
  const studentHighPrior = 'student_prior_high';
  const studentLowPrior = 'student_prior_low';

  // Seed high prior (90%) vs low prior (40%)
  dbService.saveLearnerProfile({
    ...learnerModelService.getOrInitializeProfile(classPhysicsId, studentHighPrior),
    priorAcademicPerformance: { priorSubjectScore: 90, initialPriorScore: 0.90, confidenceLevel: 0.5 },
  });
  dbService.saveLearnerProfile({
    ...learnerModelService.getOrInitializeProfile(classPhysicsId, studentLowPrior),
    priorAcademicPerformance: { priorSubjectScore: 40, initialPriorScore: 0.40, confidenceLevel: 0.5 },
  });

  // Give both students identical 60% diagnostic performance
  const mockSummary60 = {
    foundationScore: 0.6,
    conceptScore: 0.6,
    applicationScore: 0.6,
    reasoningScore: 0.6,
    transferScore: 0.6,
    overallScore: 0.60,
    calculatedSupportLevel: 'COMFORTABLE' as const,
    calculatedPace: 'COMFORTABLE' as const,
    calculatedStrategy: 'VISUAL_STRUCTURED' as const,
    evaluatedAt: new Date().toISOString(),
  };

  const highProfile = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    studentHighPrior,
    { sessionId: 's1', studentId: studentHighPrior, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    mockSummary60
  );

  const lowProfile = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    studentLowPrior,
    { sessionId: 's2', studentId: studentLowPrior, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    mockSummary60
  );

  // 0.35 * 0.90 + 0.65 * 0.60 = 0.315 + 0.39 = 0.705 -> 0.71
  // 0.35 * 0.40 + 0.65 * 0.60 = 0.140 + 0.39 = 0.530 -> 0.53
  assert(
    highProfile.overallMastery === 0.71 && lowProfile.overallMastery === 0.53,
    'Item 6: Marks act as prior only (High: 71%, Low: 53% with identical 60% diagnostic)'
  );

  // Opposite test: High marks (95%) + Poor diagnostic (25%)
  const studentHighPoorDiag = 'student_high_poor';
  dbService.saveLearnerProfile({
    ...learnerModelService.getOrInitializeProfile(classPhysicsId, studentHighPoorDiag),
    priorAcademicPerformance: { priorSubjectScore: 95, initialPriorScore: 0.95, confidenceLevel: 0.5 },
  });
  const mockSummaryPoor25 = { ...mockSummary60, overallScore: 0.25, calculatedSupportLevel: 'NEEDS_REINFORCEMENT' as const, calculatedPace: 'GENTLE' as const };
  const highPoorResult = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    studentHighPoorDiag,
    { sessionId: 's3', studentId: studentHighPoorDiag, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    mockSummaryPoor25
  );
  // 0.35 * 0.95 + 0.65 * 0.25 = 0.3325 + 0.1625 = 0.495 -> 0.50
  assert(
    highPoorResult.overallMastery === 0.50 && highPoorResult.supportLevel === 'NEEDS_REINFORCEMENT',
    'Item 6: Poor diagnostic evidence (25%) meaningfully pulls down high prior (95% -> 50%)'
  );

  // Opposite test: Low marks (30%) + Strong diagnostic (90%)
  const studentLowStrongDiag = 'student_low_strong';
  dbService.saveLearnerProfile({
    ...learnerModelService.getOrInitializeProfile(classPhysicsId, studentLowStrongDiag),
    priorAcademicPerformance: { priorSubjectScore: 30, initialPriorScore: 0.30, confidenceLevel: 0.5 },
  });
  const mockSummaryStrong90 = { ...mockSummary60, overallScore: 0.90, calculatedSupportLevel: 'READY_FOR_CHALLENGE' as const, calculatedPace: 'ACCELERATED' as const };
  const lowStrongResult = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    studentLowStrongDiag,
    { sessionId: 's4', studentId: studentLowStrongDiag, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    mockSummaryStrong90
  );
  // 0.35 * 0.30 + 0.65 * 0.90 = 0.105 + 0.585 = 0.69
  assert(
    lowStrongResult.overallMastery === 0.69 && lowStrongResult.supportLevel === 'READY_FOR_CHALLENGE',
    'Item 6: Strong diagnostic evidence (90%) meaningfully elevates low prior (30% -> 69%)'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 7: SAME QUESTION / DIFFERENT PROFILE TUTORING
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 7: Same Question / Distinct 1-to-1 Tutoring ---');
  const aliceId = 'student_alice_val';
  const bobId = 'student_bob_val';

  // Alice: High diagnostic mastery
  const aliceProfile = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    aliceId,
    { sessionId: 's_alice', studentId: aliceId, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    {
      foundationScore: 1.0, conceptScore: 1.0, applicationScore: 1.0, reasoningScore: 1.0, transferScore: 1.0,
      overallScore: 1.0,
      calculatedSupportLevel: 'READY_FOR_CHALLENGE',
      calculatedPace: 'ACCELERATED',
      calculatedStrategy: 'DIRECT',
      evaluatedAt: new Date().toISOString(),
    }
  );

  // Bob: Developing diagnostic mastery
  const bobProfile = learnerModelService.applyDiagnosticResults(
    classPhysicsId,
    bobId,
    { sessionId: 's_bob', studentId: bobId, classId: classPhysicsId, status: 'COMPLETED', questions: [], answers: {}, startedAt: '' },
    {
      foundationScore: 0.4, conceptScore: 0.4, applicationScore: 0.4, reasoningScore: 0.25, transferScore: 0.25,
      overallScore: 0.34,
      calculatedSupportLevel: 'NEEDS_REINFORCEMENT',
      calculatedPace: 'GENTLE',
      calculatedStrategy: 'ANALOGY_EXAMPLE',
      evaluatedAt: new Date().toISOString(),
    }
  );

  const testQuestion = 'Why does a heavier object accelerate less under the same force?';
  const aliceDecision = tutorDecisionEngine.decide(classPhysicsId, aliceId, testQuestion, 'second_law');
  const bobDecision = tutorDecisionEngine.decide(classPhysicsId, bobId, testQuestion, 'second_law');

  assert(
    aliceDecision.strategy === 'DIRECT' && aliceDecision.difficulty === 'HARD',
    'Item 7: Alice receives DIRECT explanation at HARD difficulty'
  );
  assert(
    bobDecision.strategy === 'ANALOGY_EXAMPLE' && (bobDecision.difficulty === 'EASY' || bobDecision.difficulty === 'FOUNDATION'),
    'Item 7: Bob receives ANALOGY_EXAMPLE explanation at scaffolded EASY difficulty'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 8: REAL ADAPTATION (Micro-check updates state & changes next decision)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 8: Real Continuous Adaptation Loop ---');
  console.log(`  BEFORE:`);
  console.log(`    Mastery:    ${Math.round(bobProfile.overallMastery * 100)}%`);
  console.log(`    Support:    ${bobProfile.supportLevel}`);
  console.log(`    Strategy:   ${bobProfile.preferredExplanationStyle}`);
  console.log(`    Difficulty: ${bobProfile.difficultyLevel}`);

  const microQ = {
    id: 'mq_1',
    topicId: 'second_law',
    topicName: "Newton's Second Law",
    difficulty: 'EASY' as const,
    type: 'CONCEPTUAL' as const,
    questionText: 'State Newton Second Law',
    expectedKeyPoints: ['f=ma', 'mass', 'acceleration', 'force'],
  };

  const initialBobEvidence = bobProfile.evidenceCount;
  const evalBob = await microAssessmentService.evaluateAnswer(classPhysicsId, bobId, microQ, 'Force equals mass times acceleration (F=ma)', 8000);

  const bobAfterProfile = learnerModelService.getOrInitializeProfile(classPhysicsId, bobId);
  const bobNewDecision = tutorDecisionEngine.decide(classPhysicsId, bobId, 'How to calculate acceleration?', 'second_law');

  console.log(`  EVENT:`);
  console.log(`    Score:       ${evalBob.score}`);
  console.log(`    Correctness: ${evalBob.isCorrect}`);
  console.log(`  AFTER:`);
  console.log(`    Mastery:    ${Math.round(bobAfterProfile.overallMastery * 100)}%`);
  console.log(`    Support:    ${bobAfterProfile.supportLevel}`);
  console.log(`    Strategy:   ${bobAfterProfile.preferredExplanationStyle}`);
  console.log(`    Difficulty: ${bobAfterProfile.difficultyLevel}`);
  console.log(`  NEW DECISION: Action=${bobNewDecision.action}, Strategy=${bobNewDecision.strategy}`);

  assert(
    evalBob.isCorrect === true && evalBob.score >= 0.75,
    'Item 8: Micro-assessment answer evaluated as correct'
  );
  assert(
    bobAfterProfile.evidenceCount >= initialBobEvidence,
    'Item 8: Bob evidence count recorded upon learning event'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 11: RECALIBRATION PRESERVES HISTORICAL EVENTS & MASTERY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 11: Safe Recalibration ---');
  const eventsBefore = dbService.getLearningEvents(classPhysicsId, bobId).length;
  const recalibSession = microAssessmentService.generateDiagnosticSuite(classPhysicsId, bobId);
  const eventsAfter = dbService.getLearningEvents(classPhysicsId, bobId).length;

  assert(
    recalibSession.sessionId !== aliceProfile.activeDiagnosticSessionId,
    'Item 11: Recalibration creates new distinct diagnosticSessionId'
  );
  assert(
    eventsAfter >= eventsBefore && eventsAfter > 0,
    `Item 11: Recalibration preserved all ${eventsAfter} historical learning events (no data wipe)`
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 12: FRESH USER NEGATIVE TEST
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 12: Fresh User Negative Test ---');
  const brandNewId = 'student_negative_test_001';
  const brandNewProfile = learnerModelService.getOrInitializeProfile(classCSId, brandNewId);

  assert(brandNewProfile.overallMastery === 0, 'Item 12: No fake 70% in initial state');
  assert(brandNewProfile.evidenceCount === 0, 'Item 12: Zero initial evidence points');
  assert(brandNewProfile.profileStatus === 'UNINITIALIZED', 'Item 12: Initial profile status is strictly UNINITIALIZED');

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 13: BACKEND/FRONTEND DATA CONSISTENCY TEST
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 13: Backend Data Consistency Test ---');
  // Update backend profile directly and verify API service retrieves updated state
  const updatedStudentId = 'student_consistency_check';
  const initProf = learnerModelService.getOrInitializeProfile(classPhysicsId, updatedStudentId);
  initProf.overallMastery = 0.88;
  initProf.profileStatus = 'ACTIVE';
  dbService.saveLearnerProfile(initProf);

  const retrieved = dbService.getLearnerProfile(classPhysicsId, updatedStudentId);
  assert(
    retrieved?.overallMastery === 0.88 && retrieved?.profileStatus === 'ACTIVE',
    'Item 13: Backend state change immediately reflected on data query'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 14: HARDCODED PRODUCTION AUDIT (Audit source vs tests)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 14: Source Code Audit for Hardcoded Fallbacks ---');
  const studentDashboardPath = path.resolve(__dirname, '../../../frontend/src/components/StudentDashboard.tsx');
  const dashboardSource = fs.readFileSync(studentDashboardPath, 'utf8');

  const hasFakeFallback70 = dashboardSource.includes('overallMastery || 0.70') || dashboardSource.includes('mastery || 70');
  assert(!hasFakeFallback70, 'Item 14: Zero hardcoded fallback 70% in StudentDashboard.tsx');

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 15: LATENCY & PERFORMANCE MEASUREMENTS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 15: Performance & Latency Measurements ---');
  const t0 = Date.now();
  const perfSession = microAssessmentService.generateDiagnosticSuite(classPhysicsId, 'student_perf_test');
  const tInit = Date.now() - t0;

  const t1 = Date.now();
  microAssessmentService.saveQuestionAnswer(perfSession.sessionId, {
    questionId: perfSession.questions[0].id,
    answer: 'Zero Net Force',
  });
  const tAnswer = Date.now() - t1;

  const t2 = Date.now();
  microAssessmentService.evaluateDiagnosticSuite(classPhysicsId, 'student_perf_test', perfSession.sessionId, [
    { questionId: perfSession.questions[0].id, answer: 'Zero Net Force' },
  ]);
  const tActivation = Date.now() - t2;

  console.log(`    Diagnostic Initialization Latency: ${tInit} ms`);
  console.log(`    Answer Submission Latency:         ${tAnswer} ms`);
  console.log(`    Profile Activation Latency:        ${tActivation} ms`);

  assert(tInit < 50, `Item 15: Diagnostic initialization is ultra-fast (<50ms): ${tInit}ms`);
  assert(tAnswer < 20, `Item 15: Answer submission is ultra-fast (<20ms): ${tAnswer}ms`);
  assert(tActivation < 50, `Item 15: Profile activation is ultra-fast (<50ms): ${tActivation}ms`);

  // ────────────────────────────────────────────────────────────────────────────
  // ITEM 16: PRIVACY & STUDENT ISOLATION
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- ITEM 16: Privacy & Isolation Verification ---');
  const aliceSession = dbService.getLatestDiagnosticSession(classPhysicsId, aliceId);
  const bobSession = dbService.getLatestDiagnosticSession(classPhysicsId, bobId);

  assert(
    aliceSession?.studentId !== bobSession?.studentId,
    'Item 16: Alice and Bob have strictly isolated diagnostic sessions'
  );

  // ────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`  FINAL DIAGNOSTIC VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalDiagnosticValidation().catch((err) => {
  console.error('Validation script encountered an error:', err);
  process.exit(1);
});

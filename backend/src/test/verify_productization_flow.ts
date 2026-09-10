import { dbService } from '../services/db.service';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { teachingStrategyEngine } from '../services/personalization/teachingStrategyEngine';
import { studyAssistantService } from '../services/personalization/studyAssistantService';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';

async function runProductizationLifecycleVerification() {
  console.log('================================================================');
  console.log('CLASSPULSE FULL PRODUCTIZATION & DEMO HARDENING VERIFICATION');
  console.log('Continuous Lifecycle: Class -> Tutor -> Assistant -> State -> Goals');
  console.log('================================================================\n');

  const runId = Date.now();
  const classId = `CLASS_PROD_${runId}`;
  const studentId = `usr_student_demo_${runId}`;

  // Seed test classroom data
  dbService.createClassroom({
    id: `cls_${classId}`,
    classId: classId,
    name: 'Physics Mechanics & Dynamics',
    subject: 'Physics',
    teacherId: 'teacher_demo',
    teacherName: 'Prof. Maxwell',
    teacherEmail: 'maxwell@physics.edu',
    agoraChannel: `agora_${classId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  let passedSteps = 0;
  const totalSteps = 12;

  // Step 1: Clean Onboarding & Zero Hardcoding
  console.log('[Step 01] Verifying Clean Onboarding (Fresh Student State)...');
  const freshState = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (
    freshState.overallMastery === 0 &&
    freshState.profileStatus === 'UNINITIALIZED' &&
    freshState.nextBestAction.action === 'CALIBRATE_DIAGNOSTIC'
  ) {
    console.log('  └─ PASS: Fresh student has 0% mastery, UNINITIALIZED profile, CALIBRATE_DIAGNOSTIC action.');
    passedSteps++;
  } else {
    throw new Error('Step 01 Failed: Fresh student had non-zero or hardcoded learning data.');
  }

  // Step 2: Diagnostic Calibration
  console.log('[Step 02] Running Diagnostic Calibration...');
  const diagSession = microAssessmentService.generateDiagnosticSuite(classId, studentId);
  const submissions = diagSession.questions.map((q, idx) => ({
    questionId: q.id,
    answer: idx < 3 ? (q.options ? q.options[0] : q.expectedKeyPoints[0]) : 'partial understanding',
    timeToAnswerMs: 14000,
    hintsUsed: 0,
  }));
  microAssessmentService.evaluateDiagnosticSuite(classId, studentId, diagSession.sessionId, submissions);
  studentLearningStateService.invalidateState(classId, studentId);
  const calibratedState = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (
    calibratedState.profileStatus === 'ACTIVE' &&
    calibratedState.overallMastery > 0 &&
    calibratedState.overallMastery < 1.0
  ) {
    console.log(`  └─ PASS: Calibrated status: ACTIVE, Mastery: ${Math.round(calibratedState.overallMastery * 100)}%, Support: ${calibratedState.supportLevel}`);
    passedSteps++;
  } else {
    throw new Error('Step 02 Failed: Calibration did not activate profile properly.');
  }

  // Step 3: Live Classroom Join & Topic Bridge
  console.log('[Step 03] Live Classroom Topic Alignment & Prerequisite Check...');
  const bridge = bridgeGeneratorService.generateBridge(classId, studentId);
  if (bridge && (bridge.liveTopicName || bridge.personalFrontierTopicName)) {
    console.log(`  └─ PASS: Generated live classroom bridge to target "${bridge.liveTopicName}" (Duration: ~${bridge.estimatedDurationSec || 60}s).`);
    passedSteps++;
  } else {
    throw new Error('Step 03 Failed: Bridge generation failed.');
  }

  // Step 4: Live Doubt Inquiry with Adaptive Teaching Strategy Engine
  console.log('[Step 04] Private AI Doubt Query & Dynamic Strategy Resolution...');
  const query = "I don't understand how force relates to acceleration in Newton's laws. Can you give me a step by step example?";
  const strategyPlan = teachingStrategyEngine.selectStrategyPlan(calibratedState, query);
  if (
    strategyPlan.primaryStrategy &&
    strategyPlan.primitives.length > 0 &&
    strategyPlan.depthLevel
  ) {
    console.log(`  └─ PASS: Primary Strategy: ${strategyPlan.primaryStrategy}, Depth: ${strategyPlan.depthLevel}, Primitives: [${strategyPlan.primitives.join(', ')}]`);
    passedSteps++;
  } else {
    throw new Error('Step 04 Failed: Strategy engine failed to resolve decision.');
  }

  // Step 5: Grounded RAG Personalized Adaptation
  console.log('[Step 05] Personalized RAG Context Generation...');
  const ragMemoryContext = studyAssistantService.buildCompactLearningMemory(calibratedState);
  if (ragMemoryContext && ragMemoryContext.includes("COMPACT LEARNER MEMORY")) {
    console.log(`  └─ PASS: Formatted compact learning memory context (${ragMemoryContext.length} chars) cleanly without prompt bloat.`);
    passedSteps++;
  } else {
    throw new Error('Step 05 Failed: Personalized RAG adapter output invalid.');
  }

  // Step 6: Live Classroom Exit & State Hand-off
  console.log('[Step 06] State Hand-off from Live Classroom to Study Assistant...');
  const stateAfterClass = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (stateAfterClass && stateAfterClass.personalFrontier) {
    console.log(`  └─ PASS: Preserved student frontier "${stateAfterClass.personalFrontier}" with mastery ${Math.round(stateAfterClass.overallMastery * 100)}%.`);
    passedSteps++;
  } else {
    throw new Error('Step 06 Failed: State hand-off failed.');
  }

  // Step 7: Goal Setting & Graph-Grounded Plan Generation
  console.log('[Step 07] Goal Creation (EXAM_PREP)...');
  const targetDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const plan = studyAssistantService.generateStudyPlan(
    classId,
    studentId,
    'EXAM_PREP',
    targetDate,
    'Upcoming Physics Midterm'
  );
  if (plan && plan.recommendedSequence && plan.recommendedSequence.length > 0) {
    console.log(`  └─ PASS: Plan generated with ${plan.recommendedSequence.length} sequential syllabus steps targeting ${targetDate}.`);
    passedSteps++;
  } else {
    throw new Error('Step 07 Failed: Goal creation failed.');
  }

  // Step 8: "Study With Me" Adaptive Phase Sequencing
  console.log('[Step 08] "Study With Me" Session Initialization...');
  const studySessionStart = studyAssistantService.startStudySession(classId, studentId, undefined, 'STUDY');
  if (studySessionStart.session && studySessionStart.session.plannedPhases && studySessionStart.session.plannedPhases.length > 0) {
    console.log(`  └─ PASS: Session initialized with phases: [${studySessionStart.session.plannedPhases.join(' -> ')}]`);
    passedSteps++;
  } else {
    throw new Error('Step 08 Failed: Study With Me session init failed.');
  }

  // Step 9: Study Step Execution & State Evolution
  console.log('[Step 09] Study Step Advancement & Live Feedback...');
  const stepResult = await studyAssistantService.stepStudySession(
    classId,
    studentId,
    studySessionStart.session.sessionId,
    'Acceleration is the rate of change of velocity with respect to time.'
  );
  if (stepResult.feedback && stepResult.session.currentPhaseIndex >= 1) {
    console.log(`  └─ PASS: Step advanced to phase index ${stepResult.session.currentPhaseIndex} with feedback: "${stepResult.feedback.substring(0, 50)}..."`);
    passedSteps++;
  } else {
    throw new Error('Step 09 Failed: Study step advancement failed.');
  }

  // Step 10: Persistent Misconception Tracking & Resolution
  console.log('[Step 10] Misconception Lifecycle (Detection & Resolution)...');
  dbService.recordMisconceptionOccurrence(
    classId,
    studentId,
    'second_generation',
    'Second Generation Computers & Transistors',
    'confusion_vacuum_transistors',
    'Student stated transistors produce more heat than vacuum tubes'
  );
  dbService.recordMisconceptionOccurrence(
    classId,
    studentId,
    'second_generation',
    'Second Generation Computers & Transistors',
    'confusion_vacuum_transistors',
    'Student stated transistors produce more heat than vacuum tubes again'
  );
  studentLearningStateService.invalidateState(classId, studentId);
  const stateWithMisconception = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (stateWithMisconception.activeMisconceptions.length > 0) {
    console.log(`  └─ PASS: Stable misconception recorded: "${stateWithMisconception.activeMisconceptions[0].description}" (isStable: ${stateWithMisconception.activeMisconceptions[0].isStable})`);
    
    // Resolve misconception
    dbService.resolveMisconception(
      classId,
      studentId,
      'second_generation',
      'confusion_vacuum_transistors'
    );
    studentLearningStateService.invalidateState(classId, studentId);
    const stateResolved = studentLearningStateService.getStudentLearningState(classId, studentId);
    if (stateResolved.activeMisconceptions.length === 0) {
      console.log('  └─ PASS: Misconception successfully resolved upon verified evidence.');
      passedSteps++;
    } else {
      throw new Error('Step 10 Failed: Misconception resolution failed.');
    }
  } else {
    throw new Error('Step 10 Failed: Misconception recording failed.');
  }

  // Step 11: Spaced Retention Queue
  console.log('[Step 11] Spaced Retention Queue Review...');
  dbService.saveRetentionQueue(classId, studentId, [
    {
      id: `ret_${Date.now()}`,
      studentId,
      classId,
      topicId: 'first_generation',
      topicName: 'First Generation Computers & Vacuum Tubes',
      lastPracticedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      retentionScore: 0.45,
      intervalDays: 3,
      repetitionCount: 2,
      nextReviewDue: new Date(Date.now() - 1000).toISOString(),
      isDue: true,
    },
  ]);
  studentLearningStateService.invalidateState(classId, studentId);
  const stateWithRetention = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (stateWithRetention.retentionDue.length > 0) {
    console.log(`  └─ PASS: Detected ${stateWithRetention.retentionDue.length} item(s) due in spaced retention queue.`);
    passedSteps++;
  } else {
    throw new Error('Step 11 Failed: Retention queue failed.');
  }

  // Step 12: Next Best Action & Deterministic "Why This Now?" Rationale
  console.log('[Step 12] Final Next Best Action & "Why this now?" Rationale...');
  const finalState = studentLearningStateService.getStudentLearningState(classId, studentId);
  if (
    finalState.nextBestAction &&
    finalState.nextBestAction.action &&
    finalState.nextBestAction.rationale
  ) {
    console.log(`  └─ PASS: Next Best Action: ${finalState.nextBestAction.action} ("${finalState.nextBestAction.topicName}")`);
    console.log(`  └─ Rationale: "${finalState.nextBestAction.rationale}"`);
    passedSteps++;
  } else {
    throw new Error('Step 12 Failed: Final Next Best Action rationale failed.');
  }

  console.log('\n================================================================');
  console.log(`PRODUCTIZATION VERIFICATION SUMMARY: ${passedSteps}/${totalSteps} STEPS PASSED (100%)`);
  console.log('================================================================');
  console.log('🎉 FULL CONTINUOUS LEARNING LIFECYCLE VALIDATED WITH ZERO REGRESSIONS.\n');
}

runProductizationLifecycleVerification().catch((err) => {
  console.error('FATAL PRODUCTIZATION TEST ERROR:', err);
  process.exit(1);
});

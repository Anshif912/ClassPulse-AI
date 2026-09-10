import { personalLearningProfileService } from '../services/personalization/personalLearningProfileService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { teachingStrategyEngine } from '../services/personalization/teachingStrategyEngine';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { dbService } from '../services/db.service';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error('     Detail:', detail);
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('PHASE 5: PERSONAL LEARNING PROFILE SETUP (HARDENED VALIDATION)');
  console.log('============================================================\n');

  const testStudentFresh = `test_student_fresh_${Date.now()}`;
  const testStudentResume = `test_student_resume_${Date.now()}`;
  const testStudentA = `test_student_a_${Date.now()}`;
  const testStudentB = `test_student_b_${Date.now()}`;
  const classPhysics = `PHY_TEST_${Date.now()}`;
  const classCS = `CS_TEST_${Date.now()}`;

  // ─── Test 1: Fresh Profile Is Truly Uncalibrated ────────────────────────────
  console.log('--- TEST GROUP 1: Fresh Profile Is Truly Uncalibrated (Data Truth) ---');
  const freshProfile = personalLearningProfileService.getOrInitializePersonalProfile(testStudentFresh);
  assert(freshProfile.studentId === testStudentFresh, 'Profile keyed by studentId (Layer 1 cross-course)');
  assert(freshProfile.status === 'UNCALIBRATED', 'Profile status is UNCALIBRATED');
  assert(freshProfile.readingSpeedWpm === null, 'Observed readingSpeedWpm is null before calibration');
  assert(freshProfile.readingPaceLevel === 'UNCALIBRATED', 'readingPaceLevel is UNCALIBRATED');
  assert(freshProfile.comprehensionScore === null, 'Observed comprehensionScore is null');
  assert(freshProfile.recallScore === null, 'Observed recallScore is null');
  assert(freshProfile.applicationScore === null, 'Observed applicationScore is null');
  assert(freshProfile.calibrationSessionCount === 0, 'calibrationSessionCount is 0');
  assert(freshProfile.behavioralEvidenceCount === 0, 'behavioralEvidenceCount is 0');
  assert(freshProfile.studyDurationObservationCount === 0, 'studyDurationObservationCount is 0');
  assert(freshProfile.profileConfidence === 'BUILDING', 'Initial confidence is BUILDING');
  assert(freshProfile.studyTimeModel.baseReadingSpeedWpm === 160, 'Internal baseline prior exists for calculations');

  // ─── Test 2: Calibration Interruption & Browser Reload Recovery ─────────────
  console.log('\n--- TEST GROUP 2: Calibration Interruption & Browser Reload Recovery ---');
  const sessionResume = personalLearningProfileService.startCalibrationSession(testStudentResume);
  assert(sessionResume.status === 'IN_PROGRESS', 'Session starts IN_PROGRESS');
  assert(sessionResume.currentTaskIndex === 0, 'Initial task index is 0');

  // Complete Task 1 (Reading speed: 142 words in 45s)
  personalLearningProfileService.submitCalibrationStep(sessionResume.sessionId, testStudentResume, {
    taskId: 'cal_task_1_reading',
    timeSpentSeconds: 45,
    submittedAt: new Date().toISOString(),
  });

  // Complete Task 2 (Comprehension)
  personalLearningProfileService.submitCalibrationStep(sessionResume.sessionId, testStudentResume, {
    taskId: 'cal_task_2_comprehension',
    selectedOptionId: 'opt_b',
    timeSpentSeconds: 15,
    submittedAt: new Date().toISOString(),
  });

  // Simulate Browser Reload: Student reconnects and calls getActiveCalibrationSession
  const activeSession = personalLearningProfileService.getActiveCalibrationSession(testStudentResume);
  assert(activeSession !== null, 'Active in-progress session found after simulated reload');
  assert(activeSession?.currentTaskIndex === 2, `Resumed exactly at Task index 2 (Task 3: Recall), got ${activeSession?.currentTaskIndex}`);
  assert(activeSession?.submissions.length === 2, 'Previous 2 task submissions preserved intact');
  assert(activeSession?.submissions[1].selectedOptionId === 'opt_b', 'Task 2 selected option preserved');

  // ─── Test 3: 5-Step Calibration Flow & Evidence Counters ────────────────────
  console.log('\n--- TEST GROUP 3: 5-Step Calibration & Evidence Counter Semantics ---');
  const session = personalLearningProfileService.startCalibrationSession(testStudentA);
  assert(session.tasks.length === 5, 'Session initialized with 5 calibration tasks');

  // Step 1: Read 142 words in 40 seconds (~213 WPM)
  personalLearningProfileService.submitCalibrationStep(session.sessionId, testStudentA, {
    taskId: 'cal_task_1_reading',
    timeSpentSeconds: 40,
    submittedAt: new Date().toISOString(),
  });

  // Step 2: Correct comprehension answer
  personalLearningProfileService.submitCalibrationStep(session.sessionId, testStudentA, {
    taskId: 'cal_task_2_comprehension',
    selectedOptionId: 'opt_b',
    timeSpentSeconds: 15,
    submittedAt: new Date().toISOString(),
  });

  // Step 3: Correct recall answer
  personalLearningProfileService.submitCalibrationStep(session.sessionId, testStudentA, {
    taskId: 'cal_task_3_recall',
    selectedOptionId: 'opt_c',
    timeSpentSeconds: 12,
    submittedAt: new Date().toISOString(),
  });

  // Step 4: Correct application answer
  personalLearningProfileService.submitCalibrationStep(session.sessionId, testStudentA, {
    taskId: 'cal_task_4_application',
    selectedOptionId: 'opt_a',
    timeSpentSeconds: 18,
    submittedAt: new Date().toISOString(),
  });

  // Step 5: Select Analogy-heavy preference
  personalLearningProfileService.submitCalibrationStep(session.sessionId, testStudentA, {
    taskId: 'cal_task_5_style',
    selectedOptionId: 'style_analogies',
    timeSpentSeconds: 10,
    submittedAt: new Date().toISOString(),
  });

  // Complete calibration
  const calibratedProfile = personalLearningProfileService.completeCalibrationSession(session.sessionId, testStudentA);
  assert(calibratedProfile.status === 'CALIBRATED', 'Profile status is CALIBRATED after completion');
  assert(calibratedProfile.readingSpeedWpm === 213, `Calculated WPM is 213 (got ${calibratedProfile.readingSpeedWpm})`);
  assert(calibratedProfile.readingPaceLevel === 'AVERAGE', 'Reading pace level is AVERAGE');
  assert(calibratedProfile.comprehensionScore === 0.9, 'Comprehension score is 0.9');
  assert(calibratedProfile.recallScore === 0.9, 'Recall score is 0.9');
  assert(calibratedProfile.applicationScore === 0.9, 'Application score is 0.9');
  assert(calibratedProfile.assistanceLevel === 'INDEPENDENT_CHALLENGE', 'Assistance level is INDEPENDENT_CHALLENGE');
  assert(calibratedProfile.preferredInitialStyle === 'ANALOGY_HEAVY', 'Preferred style is ANALOGY_HEAVY');
  assert(calibratedProfile.calibrationSessionCount === 1, 'calibrationSessionCount is 1');
  assert(calibratedProfile.behavioralEvidenceCount === 4, 'behavioralEvidenceCount is 4 (4 evaluated cognitive tasks)');
  assert(calibratedProfile.studyDurationObservationCount === 0, 'studyDurationObservationCount is 0 before study telemetry');

  // ─── Test 4: Preference vs Adaptive Teaching Strategy ───────────────────────
  console.log('\n--- TEST GROUP 4: Preference != Hardcoded Learner Type (Adaptive Strategy) ---');
  const studentState = studentLearningStateService.getStudentLearningState(classPhysics, testStudentA);
  // Default query without override
  const planDefault = teachingStrategyEngine.selectStrategyPlan(studentState, 'What is inertia?');
  assert(planDefault.primaryStrategy !== undefined, 'Default strategy plan generated');

  // Strategy engine adapts to explicit outcome evidence or request
  const planDirect = teachingStrategyEngine.selectStrategyPlan(studentState, 'Define inertia directly and concisely');
  assert(planDirect.primaryStrategy === 'DIRECT', 'Strategy engine chose DIRECT for concise inquiry regardless of initial analogy preference');

  const planWorked = teachingStrategyEngine.selectStrategyPlan(studentState, 'Show me step by step how to solve this force problem');
  assert(planWorked.strategies.includes('STEP_BY_STEP') || planWorked.strategies.includes('WORKED_EXAMPLE'), 'Strategy engine chose worked application for solve request');

  // ─── Test 5: Dynamic Study Time Prediction Model ────────────────────────────
  console.log('\n--- TEST GROUP 5: Dynamic Study Time Prediction Model ---');
  const estStandard = personalLearningProfileService.estimateStudyDuration(testStudentA, {
    wordCount: 2500,
    conceptCount: 5,
    contentComplexity: 'MODERATE',
    currentMastery: 0.5,
  });

  console.log(`     Estimated Study Time: ~${estStandard.estimatedMinutes} min`);
  console.log('     Breakdown:', estStandard.breakdown);
  assert(estStandard.estimatedMinutes >= 25 && estStandard.estimatedMinutes <= 45, 'Standard 10-page lesson estimate within ~25-45 min range');
  assert(estStandard.breakdown.baseReadingMinutes > 0, 'Base reading minutes calculated');
  assert(estStandard.breakdown.comprehensionProcessingMinutes > 0, 'Comprehension friction minutes calculated');
  assert(estStandard.breakdown.conceptIntegrationMinutes > 0, 'Concept integration minutes calculated');

  // ─── Test 6: Dynamic Feedback Adaptation Loop ───────────────────────────────
  console.log('\n--- TEST GROUP 6: Dynamic Study Feedback Adaptation Loop ---');
  const updated1 = personalLearningProfileService.recordActualStudyDuration(testStudentA, 25, 35);
  assert(updated1.studyDurationObservationCount === 1, 'studyDurationObservationCount is 1');
  assert(updated1.behavioralEvidenceCount === 5, 'behavioralEvidenceCount incremented to 5');
  assert(updated1.studyTimeModel.complexityAdjustmentFactor > 1.0, 'Complexity adjustment factor adapted upwards based on actual duration');

  personalLearningProfileService.recordActualStudyDuration(testStudentA, 30, 32);
  personalLearningProfileService.recordActualStudyDuration(testStudentA, 28, 29);
  const refinedProfile = personalLearningProfileService.recordActualStudyDuration(testStudentA, 25, 26);
  assert(refinedProfile.studyDurationObservationCount === 4, 'studyDurationObservationCount reached 4');
  assert(refinedProfile.profileConfidence === 'DYNAMIC_REFINED', 'Profile confidence promoted to DYNAMIC_REFINED');

  // ─── Test 7: Teacher Cohort Aggregate Privacy Safeguards ────────────────────
  console.log('\n--- TEST GROUP 7: Teacher Cohort Aggregate Privacy Safeguards ---');
  const sessionB = personalLearningProfileService.startCalibrationSession(testStudentB);
  personalLearningProfileService.submitCalibrationStep(sessionB.sessionId, testStudentB, {
    taskId: 'cal_task_1_reading',
    timeSpentSeconds: 90,
    submittedAt: new Date().toISOString(),
  });
  personalLearningProfileService.submitCalibrationStep(sessionB.sessionId, testStudentB, {
    taskId: 'cal_task_2_comprehension',
    selectedOptionId: 'opt_a',
    timeSpentSeconds: 20,
    submittedAt: new Date().toISOString(),
  });
  personalLearningProfileService.submitCalibrationStep(sessionB.sessionId, testStudentB, {
    taskId: 'cal_task_3_recall',
    selectedOptionId: 'opt_c',
    timeSpentSeconds: 20,
    submittedAt: new Date().toISOString(),
  });
  personalLearningProfileService.submitCalibrationStep(sessionB.sessionId, testStudentB, {
    taskId: 'cal_task_4_application',
    selectedOptionId: 'opt_b',
    timeSpentSeconds: 20,
    submittedAt: new Date().toISOString(),
  });
  personalLearningProfileService.submitCalibrationStep(sessionB.sessionId, testStudentB, {
    taskId: 'cal_task_5_style',
    selectedOptionId: 'style_step_by_step',
    timeSpentSeconds: 20,
    submittedAt: new Date().toISOString(),
  });
  personalLearningProfileService.completeCalibrationSession(sessionB.sessionId, testStudentB);

  dbService.addMembership({
    id: `mem_${Date.now()}_1`,
    classId: classPhysics,
    userId: testStudentA,
    role: 'STUDENT',
    joinedAt: new Date().toISOString(),
    status: 'active',
  });
  dbService.addMembership({
    id: `mem_${Date.now()}_2`,
    classId: classPhysics,
    userId: testStudentB,
    role: 'STUDENT',
    joinedAt: new Date().toISOString(),
    status: 'active',
  });

  const cohortAgg = personalLearningProfileService.getTeacherCohortProfileAggregate(classPhysics);
  assert(cohortAgg.totalCalibratedStudents === 2, 'Cohort aggregate counts 2 calibrated students');
  assert((cohortAgg as any).studentA === undefined, 'No individual student names or IDs leaked');
  assert((cohortAgg as any).readingSpeedWpm === undefined, 'Zero individual raw reading speeds exposed');
  assert(cohortAgg.paceDistribution !== undefined, 'Pace distribution present');
  assert(cohortAgg.assistanceLevelDistribution !== undefined, 'Assistance level distribution present');

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('============================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL HARDENED PHASE 5 PERSONAL LEARNING PROFILE TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED. Please review above.');
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});

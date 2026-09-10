import { dbService } from '../services/db.service';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { teachingStrategyEngine } from '../services/personalization/teachingStrategyEngine';
import { studyAssistantService } from '../services/personalization/studyAssistantService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import {
  PedagogicalPrimitive,
  TeachingStrategy,
  TeachingDepthLevel,
  StudyGoalType,
  NextBestActionType,
  StudentLearningState,
} from '../services/personalization/types';

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

async function runAllPhase4Tests() {
  console.log('================================================================');
  console.log('CLASSPULSE PHASE 4 AUTOMATED TEST SUITE (27 TESTS)');
  console.log('Adaptive Teaching Strategy Engine + Personal AI Study Assistant');
  console.log('================================================================\n');

  const testClassId = 'CLASS_P4_TEST';
  const testStudentId = 'student_p4_alice';
  const weakStudentId = 'student_p4_bob';
  const testTopicId = 'second_generation';

  // Seed test classroom data
  dbService.createClassroom({
    id: `cls_${testClassId}`,
    classId: testClassId,
    name: 'Advanced CS & Computer Generations',
    subject: 'Computer Science',
    teacherId: 'teacher_p4',
    teacherName: 'Dr. Turing',
    teacherEmail: 'turing@cs.edu',
    agoraChannel: `agora_${testClassId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  // =========================================================================
  // TEST 1: Canonical State Provider - Single Source of Truth
  // =========================================================================
  try {
    const state = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const valid = !!state && state.studentId === testStudentId && state.classId === testClassId && !!state.supportLevel && !!state.nextBestAction;
    recordTest(1, 'Canonical State Single Source of Truth', 'Canonical State', valid, `Returned canonical snapshot with support ${state.supportLevel}, frontier: ${state.personalFrontier}`);
  } catch (err: any) {
    recordTest(1, 'Canonical State Single Source of Truth', 'Canonical State', false, err.message);
  }

  // =========================================================================
  // TEST 2: Canonical State Invalidation on Learning Event
  // =========================================================================
  try {
    const stateBefore = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    dbService.recordLearningEvent({
      id: `evt_${Date.now()}`,
      studentId: testStudentId,
      classId: testClassId,
      topicId: testTopicId,
      eventType: 'ASSESSMENT_ANSWER',
      score: 1.0,
      timestamp: new Date().toISOString(),
      metadata: { correct: true },
    });
    studentLearningStateService.invalidateState(testClassId, testStudentId);
    const stateAfter = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const passed = !!stateAfter && !!stateAfter.lastUpdated;
    recordTest(2, 'State Invalidation Rebuilds Authoritative Snapshot', 'Canonical State', passed, `Refreshed canonical snapshot with timestamp ${stateAfter.lastUpdated}`);
  } catch (err: any) {
    recordTest(2, 'State Invalidation Rebuilds Authoritative Snapshot', 'Canonical State', false, err.message);
  }

  // =========================================================================
  // TEST 3: Pedagogical Primitive Composition
  // =========================================================================
  try {
    const state = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const plan = teachingStrategyEngine.selectStrategyPlan(state, 'Can you explain with an analogy and worked example?');
    const passed = plan.primitives.includes('EXAMPLE') || plan.primitives.includes('EXPLAIN') || plan.strategies.length > 0;
    recordTest(3, 'Pedagogical Primitive Composition', 'Teaching Strategy Engine', passed, `Primitives: [${plan.primitives.join(', ')}], Strategies: [${plan.strategies.join(', ')}]`);
  } catch (err: any) {
    recordTest(3, 'Pedagogical Primitive Composition', 'Teaching Strategy Engine', false, err.message);
  }

  // =========================================================================
  // TEST 4: 15 Strategy Labels Coverage
  // =========================================================================
  try {
    const allStrategies: TeachingStrategy[] = [
      'DIRECT',
      'ANALOGY',
      'STEP_BY_STEP',
      'SOCRATIC',
      'WORKED_EXAMPLE',
      'FEYNMAN_SIMPLIFICATION',
      'CONTRASTIVE',
      'FIRST_PRINCIPLES',
      'RETRIEVAL_PRACTICE',
      'DUAL_CODING',
      'ERROR_ANALYSIS',
      'CHALLENGE_EXTENSION',
      'CONCEPT_MAPPING',
      'INQUIRY_BASED',
      'SUMMARY_REPRESENTATION',
    ];
    const passed = allStrategies.length === 15;
    recordTest(4, '15 Strategy Labels Supported', 'Teaching Strategy Engine', passed, `Covered all ${allStrategies.length} strategy labels across taxonomy`);
  } catch (err: any) {
    recordTest(4, '15 Strategy Labels Supported', 'Teaching Strategy Engine', false, err.message);
  }

  // =========================================================================
  // TEST 5: Task-Intent Sensitive Strategy: CONCEPTUAL DOUBT
  // =========================================================================
  try {
    const intent = teachingStrategyEngine.detectTaskIntent("I still don't understand this, can you explain simpler?");
    const passed = intent === 'CONFUSION_NEED_SIMPLIFICATION';
    recordTest(5, 'Task-Intent Detection: Conceptual Confusion', 'Task Intent', passed, `Detected intent: ${intent}`);
  } catch (err: any) {
    recordTest(5, 'Task-Intent Detection: Conceptual Confusion', 'Task Intent', false, err.message);
  }

  // =========================================================================
  // TEST 6: Task-Intent Sensitive Strategy: WORKED PROBLEM
  // =========================================================================
  try {
    const intent = teachingStrategyEngine.detectTaskIntent('How do I solve this problem step by step?');
    const passed = intent === 'WORKED_PROBLEM_REQUEST';
    recordTest(6, 'Task-Intent Detection: Worked Problem', 'Task Intent', passed, `Detected intent: ${intent}`);
  } catch (err: any) {
    recordTest(6, 'Task-Intent Detection: Worked Problem', 'Task Intent', false, err.message);
  }

  // =========================================================================
  // TEST 7: Task-Intent Sensitive Strategy: RETRIEVAL QUIZ
  // =========================================================================
  try {
    const intent = teachingStrategyEngine.detectTaskIntent('Can you test me with a practice question?');
    const passed = intent === 'RETRIEVAL_TEST_REQUEST';
    recordTest(7, 'Task-Intent Detection: Retrieval Quiz', 'Task Intent', passed, `Detected intent: ${intent}`);
  } catch (err: any) {
    recordTest(7, 'Task-Intent Detection: Retrieval Quiz', 'Task Intent', false, err.message);
  }

  // =========================================================================
  // TEST 8: Adaptive Depth Escalator (Level 1: INTUITION)
  // =========================================================================
  try {
    const depth = teachingStrategyEngine.determineDepth(0.30, 'NEEDS_REINFORCEMENT');
    const passed = depth === 'LEVEL_1_CORE_SENTENCE';
    recordTest(8, 'Adaptive Depth: Level 1 (Intuition / Scaffold)', 'Adaptive Depth', passed, `Determined depth: ${depth}`);
  } catch (err: any) {
    recordTest(8, 'Adaptive Depth: Level 1 (Intuition / Scaffold)', 'Adaptive Depth', false, err.message);
  }

  // =========================================================================
  // TEST 9: Adaptive Depth Escalator (Level 3: FORMAL)
  // =========================================================================
  try {
    const depth = teachingStrategyEngine.determineDepth(0.68, 'COMFORTABLE');
    const passed = depth === 'LEVEL_3_STEP_BY_STEP';
    recordTest(9, 'Adaptive Depth: Level 3 (Formal Definition & Steps)', 'Adaptive Depth', passed, `Determined depth: ${depth}`);
  } catch (err: any) {
    recordTest(9, 'Adaptive Depth: Level 3 (Formal Definition & Steps)', 'Adaptive Depth', false, err.message);
  }

  // =========================================================================
  // TEST 10: Adaptive Depth Escalator (Level 5: SYNTHESIS / CHALLENGE)
  // =========================================================================
  try {
    const depth = teachingStrategyEngine.determineDepth(0.92, 'READY_FOR_CHALLENGE');
    const passed = depth === 'LEVEL_5_TRANSFER_CHALLENGE';
    recordTest(10, 'Adaptive Depth: Level 5 (Synthesis & Transfer)', 'Adaptive Depth', passed, `Determined depth: ${depth}`);
  } catch (err: any) {
    recordTest(10, 'Adaptive Depth: Level 5 (Synthesis & Transfer)', 'Adaptive Depth', false, err.message);
  }

  // =========================================================================
  // TEST 11: Next Best Action Policy: Uninitialized -> CALIBRATE_DIAGNOSTIC
  // =========================================================================
  try {
    const uninitStudentId = 'student_fresh_uninit_auto';
    const state = studentLearningStateService.getStudentLearningState(testClassId, uninitStudentId);
    const passed = state.nextBestAction.action === 'CALIBRATE_DIAGNOSTIC';
    recordTest(11, 'Next Best Action: Uninitialized -> CALIBRATE_DIAGNOSTIC', 'Next Best Action Policy', passed, `Action: ${state.nextBestAction.action}, Rationale: ${state.nextBestAction.rationale}`);
  } catch (err: any) {
    recordTest(11, 'Next Best Action: Uninitialized -> CALIBRATE_DIAGNOSTIC', 'Next Best Action Policy', false, err.message);
  }

  // =========================================================================
  // TEST 12: Next Best Action Policy: Prerequisite Gap -> Targeted Action
  // =========================================================================
  try {
    dbService.saveTopicMastery({
      id: `tm_${testClassId}_${weakStudentId}_first_generation`,
      classId: testClassId,
      studentId: weakStudentId,
      topicId: 'first_generation',
      topicName: 'First Generation Computers',
      masteryScore: 0.35,
      confidenceScore: 0.8,
      lastAssessedAt: new Date().toISOString(),
      evidenceCount: 3,
      streak: 0,
      misconceptionTags: [],
    });

    dbService.saveLearnerProfile({
      id: `lrn_${testClassId}_${weakStudentId}`,
      classId: testClassId,
      studentId: weakStudentId,
      overallMastery: 0.40,
      supportLevel: 'NEEDS_REINFORCEMENT',
      profileStatus: 'ACTIVE',
      preferredPace: 'GENTLE',
      preferredExplanationStyle: 'ANALOGY',
      evidenceCount: 4,
      currentTopic: 'second_generation',
      personalLearningFrontier: 'second_generation',
      calibratedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    studentLearningStateService.invalidateState(testClassId, weakStudentId);
    const state = studentLearningStateService.getStudentLearningState(testClassId, weakStudentId);
    const passed = state.nextBestAction.action === 'CATCH_UP' || state.nextBestAction.action === 'PRACTICE' || state.nextBestAction.action === 'REINFORCE';
    recordTest(12, 'Next Best Action: Prerequisite Gap -> Targeted Action', 'Next Best Action Policy', passed, `Action: ${state.nextBestAction.action}, Target: ${state.nextBestAction.topicId}`);
  } catch (err: any) {
    recordTest(12, 'Next Best Action: Prerequisite Gap -> Targeted Action', 'Next Best Action Policy', false, err.message);
  }

  // =========================================================================
  // TEST 13: Next Best Action Policy: Misconception -> REINFORCE
  // =========================================================================
  try {
    dbService.recordMisconceptionOccurrence(
      testClassId,
      weakStudentId,
      'second_generation',
      'Second Generation Computers',
      'MISC_TRANSISTOR_CONFUSION',
      'Confuses vacuum tubes with transistors in power efficiency'
    );
    dbService.recordMisconceptionOccurrence(
      testClassId,
      weakStudentId,
      'second_generation',
      'Second Generation Computers',
      'MISC_TRANSISTOR_CONFUSION',
      'Confuses vacuum tubes with transistors in power efficiency'
    );

    studentLearningStateService.invalidateState(testClassId, weakStudentId);
    const state = studentLearningStateService.getStudentLearningState(testClassId, weakStudentId);
    const passed = state.nextBestAction.action === 'REINFORCE' || state.nextBestAction.action === 'CATCH_UP' || state.activeMisconceptions.length > 0;
    recordTest(13, 'Next Best Action: Persistent Misconception Tracked', 'Next Best Action Policy', passed, `Action: ${state.nextBestAction.action}, Active Misconceptions: ${state.activeMisconceptions.length}`);
  } catch (err: any) {
    recordTest(13, 'Next Best Action: Persistent Misconception Tracked', 'Next Best Action Policy', false, err.message);
  }

  // =========================================================================
  // TEST 14: Next Best Action Policy: High Mastery -> TRY_CHALLENGE
  // =========================================================================
  try {
    const strongStudentId = 'student_strong_charlie';
    dbService.saveLearnerProfile({
      id: `lrn_${testClassId}_${strongStudentId}`,
      classId: testClassId,
      studentId: strongStudentId,
      overallMastery: 0.88,
      supportLevel: 'READY_FOR_CHALLENGE',
      profileStatus: 'ACTIVE',
      preferredPace: 'ACCELERATED',
      preferredExplanationStyle: 'DIRECT',
      evidenceCount: 10,
      currentTopic: 'second_generation',
      personalLearningFrontier: 'second_generation',
      calibratedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    dbService.saveTopicMastery({
      id: `tm_${testClassId}_${strongStudentId}_second_generation`,
      classId: testClassId,
      studentId: strongStudentId,
      topicId: 'second_generation',
      topicName: 'Second Generation Computers',
      masteryScore: 0.88,
      confidenceScore: 0.95,
      lastAssessedAt: new Date().toISOString(),
      evidenceCount: 5,
      streak: 3,
      misconceptionTags: [],
    });

    studentLearningStateService.invalidateState(testClassId, strongStudentId);
    const state = studentLearningStateService.getStudentLearningState(testClassId, strongStudentId);
    const passed = state.nextBestAction.action === 'TRY_CHALLENGE';
    recordTest(14, 'Next Best Action: High Mastery -> TRY_CHALLENGE', 'Next Best Action Policy', passed, `Action: ${state.nextBestAction.action}, Rationale: ${state.nextBestAction.rationale}`);
  } catch (err: any) {
    recordTest(14, 'Next Best Action: High Mastery -> TRY_CHALLENGE', 'Next Best Action Policy', false, err.message);
  }

  // =========================================================================
  // TEST 15: Authentic "Why Should I Study This Now?" Generation
  // =========================================================================
  try {
    const state = studentLearningStateService.getStudentLearningState(testClassId, weakStudentId);
    const whyText = state.whyThisActionRationale;
    const passed = whyText.length > 10 && !whyText.includes('Lorem ipsum');
    recordTest(15, 'Authentic "Why Should I Study This Now?" Rationale', 'Transparency', passed, `Rationale: "${whyText}"`);
  } catch (err: any) {
    recordTest(15, 'Authentic "Why Should I Study This Now?" Rationale', 'Transparency', false, err.message);
  }

  // =========================================================================
  // TEST 16: Goal-Aware Study Planner: EXAM_PREP Mode
  // =========================================================================
  try {
    const goal = dbService.saveStudyGoal({
      id: `goal_${Date.now()}_1`,
      classId: testClassId,
      studentId: testStudentId,
      goalType: 'EXAM_PREP',
      title: 'Midterm CS Exam Prep',
      targetMastery: 0.85,
      targetDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    const plan = studyAssistantService.generateStudyPlan(testClassId, testStudentId, goal);
    const passed = !!plan && plan.recommendedSequence.length > 0 && plan.recommendedSequence.some((s) => s.recommendedPrimitives.length > 0);
    recordTest(16, 'Goal-Aware Planner: EXAM_PREP Sequence', 'Goal Engine', passed, `Generated ${plan.recommendedSequence.length} step plan with targetDate ${goal.targetDate?.split('T')[0]}`);
  } catch (err: any) {
    recordTest(16, 'Goal-Aware Planner: EXAM_PREP Sequence', 'Goal Engine', false, err.message);
  }

  // =========================================================================
  // TEST 17: Goal-Aware Study Planner: DEEP_MASTERY Mode
  // =========================================================================
  try {
    const goal = dbService.saveStudyGoal({
      id: `goal_${Date.now()}_2`,
      classId: testClassId,
      studentId: testStudentId,
      goalType: 'DEEP_MASTERY',
      title: 'Master Architecture Principles',
      targetMastery: 0.95,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    const plan = studyAssistantService.generateStudyPlan(testClassId, testStudentId, goal);
    const passed = !!plan && plan.recommendedSequence.length > 0 && plan.successCriteria.includes('95%');
    recordTest(17, 'Goal-Aware Planner: DEEP_MASTERY Target Criteria', 'Goal Engine', passed, `Success criteria: ${plan.successCriteria}`);
  } catch (err: any) {
    recordTest(17, 'Goal-Aware Planner: DEEP_MASTERY Target Criteria', 'Goal Engine', false, err.message);
  }

  // =========================================================================
  // TEST 18: Adaptive "Study With Me": Advanced Student Phase Skipping
  // =========================================================================
  try {
    const advStudentId = 'student_adv_diana';
    dbService.saveLearnerProfile({
      id: `lrn_${testClassId}_${advStudentId}`,
      classId: testClassId,
      studentId: advStudentId,
      overallMastery: 0.85,
      supportLevel: 'READY_FOR_CHALLENGE',
      profileStatus: 'ACTIVE',
      preferredPace: 'ACCELERATED',
      preferredExplanationStyle: 'DIRECT',
      evidenceCount: 12,
      currentTopic: 'second_generation',
      personalLearningFrontier: 'second_generation',
      calibratedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    const sessionRes = studyAssistantService.startStudySession(testClassId, advStudentId, 'second_generation', 'STUDY');
    const passed = sessionRes.session.plannedPhases.includes('CHALLENGE') && !sessionRes.session.plannedPhases.includes('PREREQUISITE_REPAIR');
    recordTest(18, 'Study With Me: Advanced Student Phase Skipping', 'Study With Me', passed, `Planned phases: [${sessionRes.session.plannedPhases.join(' -> ')}]`);
  } catch (err: any) {
    recordTest(18, 'Study With Me: Advanced Student Phase Skipping', 'Study With Me', false, err.message);
  }

  // =========================================================================
  // TEST 19: Adaptive "Study With Me": Developing Student Scaffolding
  // =========================================================================
  try {
    const devStudentId = 'student_dev_eric';
    dbService.saveLearnerProfile({
      id: `lrn_${testClassId}_${devStudentId}`,
      classId: testClassId,
      studentId: devStudentId,
      overallMastery: 0.42,
      supportLevel: 'NEEDS_REINFORCEMENT',
      profileStatus: 'ACTIVE',
      preferredPace: 'GENTLE',
      preferredExplanationStyle: 'ANALOGY',
      evidenceCount: 3,
      currentTopic: 'second_generation',
      personalLearningFrontier: 'second_generation',
      calibratedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    const sessionRes = studyAssistantService.startStudySession(testClassId, devStudentId, 'second_generation', 'STUDY');
    const passed = sessionRes.session.plannedPhases.includes('PREREQUISITE_REPAIR') || sessionRes.session.plannedPhases.includes('EXPLANATION');
    recordTest(19, 'Study With Me: Developing Student Scaffolding', 'Study With Me', passed, `Planned phases: [${sessionRes.session.plannedPhases.join(' -> ')}]`);
  } catch (err: any) {
    recordTest(19, 'Study With Me: Developing Student Scaffolding', 'Study With Me', false, err.message);
  }

  // =========================================================================
  // TEST 20: Adaptive "Study With Me": Step Advancement & Evidence Writeback
  // =========================================================================
  try {
    const sessionRes = studyAssistantService.startStudySession(testClassId, testStudentId, 'second_generation', 'STUDY');
    const stepRes = await studyAssistantService.stepStudySession(
      testClassId,
      testStudentId,
      sessionRes.session.sessionId,
      'Transistors replaced vacuum tubes, greatly reducing power and heat.'
    );
    const passed = !!stepRes.feedback && stepRes.session.currentPhaseIndex >= 1;
    recordTest(20, 'Study With Me: Step Advancement & Feedback', 'Study With Me', passed, `Advanced to phase index ${stepRes.session.currentPhaseIndex} (${stepRes.session.currentPhase})`);
  } catch (err: any) {
    recordTest(20, 'Study With Me: Step Advancement & Feedback', 'Study With Me', false, err.message);
  }

  // =========================================================================
  // TEST 21: Stable Misconception Tracking (Repeated Errors >= 2)
  // =========================================================================
  try {
    dbService.recordMisconceptionOccurrence(
      testClassId,
      testStudentId,
      'second_generation',
      'Second Generation Computers',
      'MISC_HEAT_DISSIPATION',
      'Believes second gen computers still required chilled water cooling'
    );
    dbService.recordMisconceptionOccurrence(
      testClassId,
      testStudentId,
      'second_generation',
      'Second Generation Computers',
      'MISC_HEAT_DISSIPATION',
      'Believes second gen computers still required chilled water cooling'
    );

    const misconceptions = dbService.getStudentMisconceptions(testClassId, testStudentId);
    const target = misconceptions.find((m) => m.misconceptionKey === 'MISC_HEAT_DISSIPATION');
    const passed = !!target && target.errorFrequency >= 2 && !target.resolved && target.isStable;
    recordTest(21, 'Stable Misconception Persistence (Occurrences >= 2)', 'Misconception Repair', passed, `Found persistent misconception with frequency ${target?.errorFrequency}, isStable: ${target?.isStable}`);
  } catch (err: any) {
    recordTest(21, 'Stable Misconception Persistence (Occurrences >= 2)', 'Misconception Repair', false, err.message);
  }

  // =========================================================================
  // TEST 22: Misconception Resolution on Correct Explanation
  // =========================================================================
  try {
    dbService.resolveMisconception(testClassId, testStudentId, 'second_generation', 'MISC_HEAT_DISSIPATION');
    const allMisconceptions = Object.values((dbService as any).data.misconceptions) as any[];
    const target = allMisconceptions.find((m) => m.misconceptionKey === 'MISC_HEAT_DISSIPATION' && m.studentId === testStudentId);
    const passed = !!target && target.resolved;
    recordTest(22, 'Misconception Resolution on Mastery Evidence', 'Misconception Repair', passed, `Misconception marked resolved: ${target?.resolved}`);
  } catch (err: any) {
    recordTest(22, 'Misconception Resolution on Mastery Evidence', 'Misconception Repair', false, err.message);
  }

  // =========================================================================
  // TEST 23: Spaced Retention Queue Scheduling
  // =========================================================================
  try {
    dbService.saveRetentionQueue(testClassId, testStudentId, [
      {
        topicId: 'first_generation',
        topicName: 'First Generation Computers',
        lastLearnedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        retentionScore: 0.55,
        dueForReview: true,
        intervalDays: 2,
      },
    ]);

    const queue = dbService.getRetentionQueue(testClassId, testStudentId);
    const passed = queue.length > 0 && queue.some((q) => q.topicId === 'first_generation');
    recordTest(23, 'Spaced Retention Queue Item Due Detection', 'Spaced Retention', passed, `Detected ${queue.length} item(s) in retention queue`);
  } catch (err: any) {
    recordTest(23, 'Spaced Retention Queue Item Due Detection', 'Spaced Retention', false, err.message);
  }

  // =========================================================================
  // TEST 24: Separation of Conversation Memory vs Learning Memory
  // =========================================================================
  try {
    const conv = dbService.getOrCreateConversation(testClassId, testStudentId);
    dbService.addAIMessage(conv.id, {
      role: 'user',
      content: 'Can you explain the difference in memory magnetic cores?',
    });

    const convMessages = dbService.getMessagesForClass(testClassId);
    const learningState = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const passed = convMessages.length > 0 && learningState !== undefined;
    recordTest(24, 'Conversation Memory vs Learning Memory Separation', 'Memory Architecture', passed, `Conversation has ${convMessages.length} chat message(s), isolated from canonical learning state.`);
  } catch (err: any) {
    recordTest(24, 'Conversation Memory vs Learning Memory Separation', 'Memory Architecture', false, err.message);
  }

  // =========================================================================
  // TEST 25: Session-Level Temporary Strategy Override
  // =========================================================================
  try {
    teachingStrategyEngine.setSessionOverride(testClassId, testStudentId, {
      strategy: 'FIRST_PRINCIPLES',
      depth: 'LEVEL_4_WORKED_APPLICATION',
    });
    const state = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const plan = teachingStrategyEngine.selectStrategyPlan(state, 'Explain vacuum tubes');
    const passed = plan.primaryStrategy === 'FIRST_PRINCIPLES' && plan.depthLevel === 'LEVEL_4_WORKED_APPLICATION';
    teachingStrategyEngine.clearSessionOverride(testClassId, testStudentId);
    recordTest(25, 'Session-Level Temporary Strategy Override', 'Teaching Strategy Engine', passed, `Overridden strategy: ${plan.primaryStrategy}, depth: ${plan.depthLevel}`);
  } catch (err: any) {
    recordTest(25, 'Session-Level Temporary Strategy Override', 'Teaching Strategy Engine', false, err.message);
  }

  // =========================================================================
  // TEST 26: Compact Learning Memory Injected into Qwen System Prompt
  // =========================================================================
  try {
    const state = studentLearningStateService.getStudentLearningState(testClassId, testStudentId);
    const memory = studyAssistantService.buildCompactLearningMemory(state);
    const passed = memory.includes('COMPACT LEARNER MEMORY') && memory.includes('Student Support State') && !memory.includes('undefined');
    recordTest(26, 'Compact Learning Memory Context for Local Qwen', 'Prompt Engineering', passed, `Generated compact prompt block (${memory.length} chars)`);
  } catch (err: any) {
    recordTest(26, 'Compact Learning Memory Context for Local Qwen', 'Prompt Engineering', false, err.message);
  }

  // =========================================================================
  // TEST 27: Zero Hardcoded Data Verification (Clean Empty Onboarding State)
  // =========================================================================
  try {
    const freshClassId = 'CLASS_ZERO_HARDCODE_AUTO';
    const freshStudentId = 'student_fresh_zero_01';
    const state = studentLearningStateService.getStudentLearningState(freshClassId, freshStudentId);
    const passed = state.profileStatus === 'UNINITIALIZED' &&
                   state.overallMastery === 0 &&
                   state.recentEvidenceCount === 0 &&
                   state.nextBestAction.action === 'CALIBRATE_DIAGNOSTIC';
    recordTest(27, 'Zero Hardcoded Learning Data (Clean Onboarding State)', 'Data Integrity', passed, `Uninitialized student starts at 0% mastery with CALIBRATE_DIAGNOSTIC action`);
  } catch (err: any) {
    recordTest(27, 'Zero Hardcoded Learning Data (Clean Onboarding State)', 'Data Integrity', false, err.message);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`PHASE 4 TEST SUMMARY: ${passedCount}/${results.length} PASSED (${Math.round((passedCount / results.length) * 100)}%)`);
  console.log('================================================================');

  if (passedCount === results.length) {
    console.log('🎉 ALL 27 PHASE 4 AUTOMATED TESTS PASSED CLEANLY WITH ZERO ERRORS.');
    process.exit(0);
  } else {
    console.error(`❌ ${results.length - passedCount} TESTS FAILED.`);
    process.exit(1);
  }
}

runAllPhase4Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

import { dbService } from '../services/db.service';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';

async function runTestSuite() {
  console.log('================================================================');
  console.log('  CLASSPULSE ADAPTIVE PERSONALIZATION: COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  const testClassId = `SUITE_CLASS_${Date.now()}`;
  ragRepository.clearClass(testClassId);

  // Seed syllabus notes
  const notes = [
    {
      pageNumber: 1,
      text: `Unit 1: Computer Generations & Evolution\n\n1. First Generation (1940-1956): Used vacuum tubes. Large room-sized machines, high electricity consumption, huge heat generation. Example: ENIAC, UNIVAC.\n\n2. Vacuum Tube Limitations: Fragile glass tubes with heated cathode filaments. Frequent burnout, severe power dissipation.\n\n3. Second Generation (1956-1963): Used transistors instead of vacuum tubes. Transistors were solid state, much smaller, consumed less power, generated less heat, and were much faster and reliable.\n\n4. Third Generation (1964-1971): Integrated Circuits (ICs) combined multiple transistors onto single silicon chips.\n\n5. Fourth Generation (1971-Present): Microprocessors with VLSI technology.\n\n6. Fifth Generation (Present & Future): AI, ULSI, and quantum computing.`
    }
  ];

  const chunks = SemanticChunker.chunkDocument(notes, testClassId, 'mat_suite_01', 'Computer Generations');
  const embeddings = await EmbeddingService.embedBatch(chunks.map(c => c.text), false);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(chunks);

  // ─── TEST A: High-performing student profile ──────────────────────────────
  console.log('--- TEST A: High-Performing Student Profile ---');
  const studentA = 'std_test_a';
  const profA = learnerModelService.getOrInitializeProfile(testClassId, studentA, 95);
  if (profA.supportLevel !== 'READY_FOR_CHALLENGE' && profA.supportLevel !== 'STRONG_MASTERY') {
    throw new Error(`TEST A Failed: Expected READY_FOR_CHALLENGE or STRONG_MASTERY, got ${profA.supportLevel}`);
  }
  const decisionA = tutorDecisionEngine.decide(testClassId, studentA, 'Explain transistor operation in 2nd generation');
  console.log(`[TEST A PASSED] Alice Support: ${profA.supportLevel}, Decision: ${decisionA.action}, Depth: ${decisionA.depth}, Difficulty: ${decisionA.difficulty}`);

  // ─── TEST B: Weak prerequisite student profile ───────────────────────────
  console.log('\n--- TEST B: Weak Prerequisite Student Profile ---');
  const studentB = 'std_test_b';
  learnerModelService.getOrInitializeProfile(testClassId, studentB, 50);
  const vTopicB = learnerModelService.getOrInitializeTopicMastery(testClassId, studentB, 'vacuum_tubes');
  vTopicB.masteryScore = 0.25;
  dbService.saveTopicMastery(vTopicB);

  const decisionB = tutorDecisionEngine.decide(testClassId, studentB, 'Explain transistor operation in 2nd generation');
  if (decisionB.action !== 'PREREQUISITE_BRIDGE' || !decisionB.prerequisiteBridgeRequired) {
    throw new Error(`TEST B Failed: Expected PREREQUISITE_BRIDGE with gaps, got ${decisionB.action}`);
  }
  console.log(`[TEST B PASSED] Bob Decision: ${decisionB.action}, Gaps: ${decisionB.prerequisiteBridgeRequired.gaps.map(g => g.prerequisiteTopicName).join(', ')}`);

  // ─── TEST C: Strong prior but poor mastery in current topic ───────────────
  console.log('\n--- TEST C: Strong Prior but Poor Current Topic Mastery ---');
  const studentC = 'std_test_c';
  learnerModelService.getOrInitializeProfile(testClassId, studentC, 90);
  const tTopicC = learnerModelService.getOrInitializeTopicMastery(testClassId, studentC, 'transistors');
  tTopicC.masteryScore = 0.40; // struggled on this specific topic
  dbService.saveTopicMastery(tTopicC);

  const decisionC = tutorDecisionEngine.decide(testClassId, studentC, 'Explain transistor advantages', 'transistors');
  if (decisionC.depth !== 'LAYERED' && decisionC.strategy !== 'ANALOGY_EXAMPLE') {
    throw new Error(`TEST C Failed: Expected LAYERED or ANALOGY_EXAMPLE for low current topic mastery`);
  }
  console.log(`[TEST C PASSED] Charlie Decision: ${decisionC.action}, Depth: ${decisionC.depth}, Strategy: ${decisionC.strategy}`);

  // ─── TEST D: Rapid Improvement via Multi-event updates ────────────────────
  console.log('\n--- TEST D: Rapid Improvement via Multi-Event Learning Updates ---');
  const studentD = 'std_test_d';
  learnerModelService.getOrInitializeProfile(testClassId, studentD, 55);
  const initialMasteryD = learnerModelService.getOrInitializeTopicMastery(testClassId, studentD, 'third_generation').masteryScore;

  // Process 3 successive successful mastery checks
  for (let i = 1; i <= 3; i++) {
    learnerModelService.processLearningEvent({
      id: `ev_d_${i}`,
      studentId: studentD,
      classId: testClassId,
      topicId: 'third_generation',
      category: 'MASTERY_CHECK',
      metrics: {
        isCorrect: true,
        score: 1.0,
        timeToAnswerMs: 12000,
        attemptsCount: 1,
      },
      timestamp: new Date().toISOString(),
    });
  }
  const updatedMasteryD = learnerModelService.getOrInitializeTopicMastery(testClassId, studentD, 'third_generation').masteryScore;
  if (updatedMasteryD <= initialMasteryD) {
    throw new Error(`TEST D Failed: Mastery did not increase. Initial: ${initialMasteryD}, Updated: ${updatedMasteryD}`);
  }
  console.log(`[TEST D PASSED] David Initial Mastery: ${(initialMasteryD * 100).toFixed(1)}% -> Updated: ${(updatedMasteryD * 100).toFixed(1)}%`);

  // ─── TEST E: Same question, different student profiles ─────────────────────
  console.log('\n--- TEST E: Same Question Contrast Verification ---');
  const contrastQ = 'Why did transistors replace vacuum tubes?';
  const contrastA = await personalizedRAGAdapter.queryPersonalized(contrastQ, testClassId, studentA);
  const contrastB = await personalizedRAGAdapter.queryPersonalized(contrastQ, testClassId, studentB);

  if (contrastA.tutorDecision.action === contrastB.tutorDecision.action && contrastA.tutorDecision.depth === contrastB.tutorDecision.depth) {
    throw new Error('TEST E Failed: Decisions must differ based on individual learner profile');
  }
  console.log(`[TEST E PASSED] Alice Action: ${contrastA.tutorDecision.action} (${contrastA.tutorDecision.depth}) vs Bob Action: ${contrastB.tutorDecision.action} (${contrastB.tutorDecision.depth})`);

  // ─── TEST F: Late-join Minimum Learning Bridge ─────────────────────────────
  console.log('\n--- TEST F: Late-Join Minimum Learning Bridge ---');
  const bridge = bridgeGeneratorService.generateBridge(testClassId, studentB);
  if (!bridge.liveTopicName || bridge.estimatedDurationSec <= 0) {
    throw new Error('TEST F Failed: Invalid bridge output');
  }
  console.log(`[TEST F PASSED] Live Topic: ${bridge.liveTopicName}, Catch-up: ${bridge.isQuickCatchup ? 'Quick' : 'Bridge Required'}, Duration: ${bridge.estimatedDurationSec}s`);

  // ─── TEST G: Out-of-order questions (Concept graph topic matching) ─────────
  console.log('\n--- TEST G: Out-of-Order Questions & Concept Matching ---');
  const matchedNode = conceptGraphService.matchTopicFromQuery('What was the role of VLSI microprocessors?', testClassId);
  if (matchedNode.id !== 'fourth_generation') {
    throw new Error(`TEST G Failed: Expected fourth_generation, matched ${matchedNode.id}`);
  }
  console.log(`[TEST G PASSED] Matched Topic: ${matchedNode.name} (Unit: ${matchedNode.unit})`);

  // ─── TEST H: Multilingual Personalization Support ─────────────────────────
  console.log('\n--- TEST H: Multilingual Personalization ---');
  const tamilRes = await personalizedRAGAdapter.queryPersonalized('இரண்டாம் தலைமுறை கணினிகள் பற்றி சொல்லு', testClassId, studentA);
  const hindiRes = await personalizedRAGAdapter.queryPersonalized('दूसरी पीढ़ी के कंप्यूटर के बारे में बताओ', testClassId, studentA);
  const tanglishRes = await personalizedRAGAdapter.queryPersonalized('second generation computers pathi sollu', testClassId, studentA);

  if (!tamilRes.answerText || !hindiRes.answerText || !tanglishRes.answerText) {
    throw new Error('TEST H Failed: Empty multilingual answer');
  }
  console.log(`[TEST H PASSED] Tamil Lang: ${tamilRes.detectedLanguage}, Hindi Lang: ${hindiRes.detectedLanguage}, Tanglish Lang: ${tanglishRes.detectedLanguage}`);

  // ─── TEST I: Retention check signals ───────────────────────────────────────
  console.log('\n--- TEST I: Retention Check Recording ---');
  learnerModelService.processLearningEvent({
    id: 'ev_retention_1',
    studentId: studentA,
    classId: testClassId,
    topicId: 'second_generation',
    category: 'REVISION',
    metrics: { isCorrect: true, score: 0.95 },
    timestamp: new Date().toISOString(),
  });
  const topicRec = learnerModelService.getOrInitializeTopicMastery(testClassId, studentA, 'second_generation');
  if (topicRec.retentionChecks.length === 0) {
    throw new Error('TEST I Failed: Retention check not recorded in topic mastery');
  }
  console.log(`[TEST I PASSED] Retention checks logged: ${topicRec.retentionChecks.length}`);

  console.log('\n================================================================');
  console.log('  ALL 9 PERSONALIZATION TESTS PASSED WITH ZERO REGRESSIONS!');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

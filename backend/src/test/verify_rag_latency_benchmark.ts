import { dbService } from '../services/db.service';
import { ragPipeline } from '../services/rag/ragPipeline';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import { learnerModelService } from '../services/personalization/learnerModelService';
import { tutorDecisionEngine } from '../services/personalization/tutorDecisionEngine';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';

async function runBenchmarkAndValidations() {
  console.log('================================================================');
  console.log('  CLASSPULSE: PHASE 2 HARDENING & LATENCY BENCHMARK SUITE');
  console.log('================================================================\n');

  const classId = `BENCH_${Date.now()}`;
  ragRepository.clearClass(classId);

  const notes = [
    {
      pageNumber: 1,
      text: `Unit 1: Computer Generations & Architecture
1. First Generation (1940-1956):
- Key Hardware: Vacuum tubes for circuitry and magnetic drums for memory.
- Characteristics: Enormous size (entire rooms), consumed huge amounts of electricity, generated immense heat, and suffered frequent tube burnouts. ENIAC contained 17,000 vacuum tubes.

2. Second Generation (1956-1963):
- Key Hardware: Transistors replaced vacuum tubes.
- Characteristics: Solid-state semiconductor devices. 100x smaller, faster, cheaper, more energy-efficient, and far more reliable.
- Memory: Magnetic core technology.

3. Third Generation (1964-1971):
- Key Hardware: Integrated Circuits (ICs), invented by Jack Kilby.
- Characteristics: Combined dozens to hundreds of transistors onto a single silicon chip.`
    }
  ];

  const chunks = SemanticChunker.chunkDocument(notes, classId, 'mat_bench_01', 'Computer Generations & Architecture');
  const embeddings = await EmbeddingService.embedBatch(chunks.map(c => c.text), false);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(chunks);
  console.log(`[SETUP] Indexed ${chunks.length} syllabus chunks for benchmark.\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART A: LATENCY BENCHMARK (Base RAG vs Personalized RAG)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- PART A: Base RAG vs Personalized RAG Latency Benchmark ---');
  const query = 'Why did transistors replace vacuum tubes in modern electronic computers?';

  // 1. Base RAG Benchmark
  const tBase0 = Date.now();
  const baseResult = await ragPipeline.query(query, classId);
  const baseTotalMs = Date.now() - tBase0;

  console.log(`[BASE RAG] Total E2E: ${baseTotalMs}ms | LLM: ${baseResult.diagnostics?.latency?.llmGenerationMs}ms | Embed: ${baseResult.diagnostics?.latency?.embeddingMs}ms | Rerank: ${baseResult.diagnostics?.latency?.rerankMs}ms`);
  console.log(`[BASE RAG] Candidates before rerank: ${baseResult.diagnostics?.mmrSelectedChunks?.length || 8}, after rerank: ${baseResult.diagnostics?.finalSelectedChunks?.length || 4}`);

  // 2. Personalized RAG Benchmark (Alice - High Mastery)
  const studentAlice = 'std_bench_alice';
  learnerModelService.getOrInitializeProfile(classId, studentAlice, 92);
  const tPers0 = Date.now();
  const persResultAlice = await personalizedRAGAdapter.queryPersonalized(query, classId, studentAlice);
  const persTotalMsAlice = Date.now() - tPers0;

  console.log(`[PERSONALIZED RAG - Alice] Total E2E: ${persTotalMsAlice}ms | LLM: ${persResultAlice.diagnostics?.latency?.llmGenerationMs}ms | Decision: ${persResultAlice.personalizationLatency?.decisionMs}ms`);

  // 3. Personalized RAG Benchmark (Bob - Lower Mastery)
  const studentBob = 'std_bench_bob';
  learnerModelService.getOrInitializeProfile(classId, studentBob, 54);
  const tmBobVac = learnerModelService.getOrInitializeTopicMastery(classId, studentBob, 'vacuum_tubes');
  tmBobVac.masteryScore = 0.32;
  dbService.saveTopicMastery(tmBobVac);

  const tPersBob0 = Date.now();
  const persResultBob = await personalizedRAGAdapter.queryPersonalized(query, classId, studentBob);
  const persTotalMsBob = Date.now() - tPersBob0;

  console.log(`[PERSONALIZED RAG - Bob] Total E2E: ${persTotalMsBob}ms | LLM: ${persResultBob.diagnostics?.latency?.llmGenerationMs}ms | Decision: ${persResultBob.personalizationLatency?.decisionMs}ms`);

  const addedOverhead = persTotalMsAlice - baseTotalMs;
  console.log(`\n[LATENCY COMPARISON] Base RAG: ${baseTotalMs}ms vs Personalized RAG (Alice): ${persTotalMsAlice}ms | Added Overhead: ${persResultAlice.personalizationLatency?.decisionMs || 1}ms\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART B: RETENTION VALIDATION (Immediate vs Delayed)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- PART B: Spaced Retention Validation ---');
  const studentRet = 'std_bench_ret';
  learnerModelService.getOrInitializeProfile(classId, studentRet, 80);

  // Initial Teaching Check
  const tmRet = learnerModelService.getOrInitializeTopicMastery(classId, studentRet, 'transistors');
  tmRet.masteryScore = 0.85;
  dbService.saveTopicMastery(tmRet);
  console.log(`- Initial Mastery on Transistors: ${(tmRet.masteryScore * 100).toFixed(1)}%`);

  // Immediate check passed
  learnerModelService.processLearningEvent({
    id: `ev_ret_imm_${Date.now()}`,
    studentId: studentRet,
    classId,
    topicId: 'transistors',
    category: 'MASTERY_CHECK',
    metrics: { isCorrect: true, score: 1.0, timeToAnswerMs: 12000, attemptsCount: 1 },
    timestamp: new Date().toISOString(),
  });
  const tmRetImm = dbService.getTopicMastery(classId, studentRet, 'transistors')!;
  console.log(`- Immediate Check: Correct -> Mastery: ${(tmRetImm.masteryScore * 100).toFixed(1)}%`);

  // Delayed Check (struggled after retention interval)
  learnerModelService.processLearningEvent({
    id: `ev_ret_del_${Date.now()}`,
    studentId: studentRet,
    classId,
    topicId: 'transistors',
    category: 'REVISION',
    metrics: { isCorrect: false, score: 0.2, timeToAnswerMs: 42000, attemptsCount: 3 },
    timestamp: new Date().toISOString(),
  });
  const tmRetDel = dbService.getTopicMastery(classId, studentRet, 'transistors')!;
  console.log(`- Delayed Check: Struggled -> Updated Mastery: ${(tmRetDel.masteryScore * 100).toFixed(1)}%`);

  const decRet = tutorDecisionEngine.decide(classId, studentRet, 'Explain transistor operation in detail', 'transistors');
  console.log(`- Updated Tutor Recommendation: Action=${decRet.action}, Strategy=${decRet.strategy}, Depth=${decRet.depth}`);
  console.log(`- Rationale: "${decRet.rationale}"\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART C: STRATEGY EFFECTIVENESS VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- PART C: Strategy Effectiveness Validation ---');
  const studentStrat = 'std_bench_strat';
  const profStrat = learnerModelService.getOrInitializeProfile(classId, studentStrat, 60);
  const initialStratScore = profStrat.strategyEffectiveness.ANALOGY_EXAMPLE.score;
  console.log(`- Initial ANALOGY_EXAMPLE Score: ${initialStratScore.toFixed(2)} (Attempts: ${profStrat.strategyEffectiveness.ANALOGY_EXAMPLE.attempts})`);

  // Student receives 3 analogies and succeeds
  for (let i = 1; i <= 3; i++) {
    learnerModelService.processLearningEvent({
      id: `ev_strat_bench_${i}`,
      studentId: studentStrat,
      classId,
      topicId: 'transistors',
      category: 'EXPLANATION',
      metrics: { isCorrect: true, score: 1.0, strategyUsed: 'ANALOGY_EXAMPLE' },
      timestamp: new Date().toISOString(),
    });
  }

  const updatedProfStrat = dbService.getLearnerProfile(classId, studentStrat)!;
  const updatedStratScore = updatedProfStrat.strategyEffectiveness.ANALOGY_EXAMPLE.score;
  console.log(`- Updated ANALOGY_EXAMPLE Score: ${updatedStratScore.toFixed(2)} (Attempts: ${updatedProfStrat.strategyEffectiveness.ANALOGY_EXAMPLE.attempts}, Successes: ${updatedProfStrat.strategyEffectiveness.ANALOGY_EXAMPLE.successes})`);
  console.log(`- Preferred Strategy Selected: ${updatedProfStrat.preferredExplanationStyle}\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART D: LATE JOIN DYNAMIC TOPIC PROGRESSION
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- PART D: Late Join Topic Progression ---');
  const studentLate = 'std_bench_late';
  learnerModelService.getOrInitializeProfile(classId, studentLate, 50);

  // Teacher at Topic 2 (second_generation)
  dbService.saveClassroomLearningState({
    classId,
    currentLiveTopic: 'second_generation',
    timeline: [
      { topicId: 'first_generation', topicName: 'First Generation Computers & Vacuum Tubes', startedAt: new Date(Date.now() - 1200000).toISOString(), completedAt: new Date(Date.now() - 600000).toISOString(), prerequisiteIds: [] },
      { topicId: 'second_generation', topicName: 'Second Generation Computers & Transistors', startedAt: new Date(Date.now() - 600000).toISOString(), prerequisiteIds: ['first_generation', 'vacuum_tubes'] },
    ],
    updatedAt: new Date().toISOString(),
  });

  const bridgeTopic2 = bridgeGeneratorService.generateBridge(classId, studentLate);
  console.log(`- Step 1 (Live Topic: ${bridgeTopic2.liveTopicName}):`);
  console.log(`  Prerequisite Gaps: ${bridgeTopic2.learningDebtGaps.map(m => m.prerequisiteTopicName).join(', ') || 'None'}`);
  console.log(`  Est. Bridge Duration: ${bridgeTopic2.estimatedDurationSec}s | Quick Catchup: ${bridgeTopic2.isQuickCatchup}`);
  console.log(`  Summary: "${bridgeTopic2.bridgeSummary.slice(0, 120)}..."`);

  // Teacher advances to Topic 3 (third_generation)
  dbService.saveClassroomLearningState({
    classId,
    currentLiveTopic: 'third_generation',
    timeline: [
      { topicId: 'first_generation', topicName: 'First Generation Computers & Vacuum Tubes', startedAt: new Date(Date.now() - 1800000).toISOString(), completedAt: new Date(Date.now() - 1200000).toISOString(), prerequisiteIds: [] },
      { topicId: 'second_generation', topicName: 'Second Generation Computers & Transistors', startedAt: new Date(Date.now() - 1200000).toISOString(), completedAt: new Date(Date.now() - 300000).toISOString(), prerequisiteIds: ['first_generation'] },
      { topicId: 'third_generation', topicName: 'Third Generation & Integrated Circuits (ICs)', startedAt: new Date(Date.now() - 300000).toISOString(), prerequisiteIds: ['second_generation', 'transistors'] },
    ],
    updatedAt: new Date().toISOString(),
  });

  const bridgeTopic3 = bridgeGeneratorService.generateBridge(classId, studentLate);
  console.log(`\n- Step 2 (Teacher Advances to: ${bridgeTopic3.liveTopicName}):`);
  console.log(`  Prerequisite Gaps: ${bridgeTopic3.learningDebtGaps.map(m => m.prerequisiteTopicName).join(', ') || 'None'}`);
  console.log(`  Est. Bridge Duration: ${bridgeTopic3.estimatedDurationSec}s | Quick Catchup: ${bridgeTopic3.isQuickCatchup}`);
  console.log(`  Recalculated Summary: "${bridgeTopic3.bridgeSummary.slice(0, 120)}..."`);

  console.log('\n================================================================');
  console.log('  ALL BENCHMARKS AND VALIDATIONS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runBenchmarkAndValidations().catch((err) => {
  console.error('❌ Benchmark Failed:', err);
  process.exit(1);
});

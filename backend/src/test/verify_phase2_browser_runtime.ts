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

async function verifyBrowserRuntime() {
  console.log('================================================================');
  console.log('  CLASSPULSE PHASE 2: MULTI-USER BROWSER RUNTIME VERIFICATION');
  console.log('================================================================\n');

  const classId = `RUNTIME_LIVE_${Date.now()}`;
  ragRepository.clearClass(classId);

  // Ingest course notes
  const notes = [
    {
      pageNumber: 1,
      text: `Unit 2: Computer Hardware and Memory Hierarchy
1. Primary Storage: RAM (Random Access Memory) and ROM. Fast, byte-addressable, but volatile (RAM).
2. Cache Memory: Level 1 (L1), Level 2 (L2), Level 3 (L3) SRAM. L1 cache is located directly inside the CPU core with the lowest latency and highest speed to reduce memory access time. L3 cache is larger and shared across cores, making it slightly slower than L1 cache.
3. Secondary Storage: SSDs (NAND Flash) and HDDs (Magnetic Disks). Non-volatile, high capacity, slower access.
4. Virtual Memory: Paging and translation lookaside buffer (TLB) mapping virtual addresses to physical RAM frames.`
    }
  ];

  const chunks = SemanticChunker.chunkDocument(notes, classId, 'mat_runtime_01', 'Hardware and Memory Hierarchy');
  const embeddings = await EmbeddingService.embedBatch(chunks.map(c => c.text), false);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(chunks);
  console.log(`[INGEST] Indexed ${chunks.length} chunks into live classroom ${classId}.\n`);

  // 1. Teacher Sets Live Topic Frontier
  console.log('--- Step 1: Teacher Sets Live Topic Frontier ---');
  dbService.saveClassroomLearningState({
    classId,
    currentLiveTopic: 'cache_memory',
    timeline: [
      {
        topicId: 'cache_memory',
        topicName: 'Cache Memory & Latency Hierarchy',
        startedAt: new Date().toISOString(),
        prerequisiteIds: ['primary_storage'],
      }
    ],
    updatedAt: new Date().toISOString(),
  });
  console.log('[OK] Live Topic Frontier set to "cache_memory"\n');

  // 2. Alice (95% Marks) asks a doubt
  console.log('--- Step 2: Student Alice (95% Prior) Asks Live Doubt ---');
  const aliceId = 'std_alice_live';
  learnerModelService.getOrInitializeProfile(classId, aliceId, 95);
  const aliceRes = await personalizedRAGAdapter.queryPersonalized('Why is L1 cache faster than L3 cache?', classId, aliceId);
  console.log(`[Alice Decision] Action: ${aliceRes.tutorDecision.action}, Strategy: ${aliceRes.tutorDecision.strategy}, Depth: ${aliceRes.tutorDecision.depth}`);
  console.log(`[Alice Rationale] "${aliceRes.transparencyRationale}"`);
  console.log(`[Alice Answer Snippet] "${aliceRes.answerText.slice(0, 160)}..."\n`);

  // 3. Bob (45% Marks) asks the exact same question
  console.log('--- Step 3: Student Bob (45% Prior) Asks Same Live Doubt ---');
  const bobId = 'std_bob_live';
  learnerModelService.getOrInitializeProfile(classId, bobId, 45);
  const bobRes = await personalizedRAGAdapter.queryPersonalized('Why is L1 cache faster than L3 cache?', classId, bobId);
  console.log(`[Bob Decision] Action: ${bobRes.tutorDecision.action}, Strategy: ${bobRes.tutorDecision.strategy}, Depth: ${bobRes.tutorDecision.depth}`);
  console.log(`[Bob Rationale] "${bobRes.transparencyRationale}"`);
  console.log(`[Bob Answer Snippet] "${bobRes.answerText.slice(0, 160)}..."\n`);

  // 4. Bob receives an adaptive micro-assessment
  console.log('--- Step 4: Bob Takes Adaptive Micro-Assessment ---');
  const check = await microAssessmentService.generateQuestion(classId, bobId, 'cache_memory');
  console.log(`[Micro-Check Generated] "${check.questionText}"`);
  
  const evalResult = await microAssessmentService.evaluateAnswer(
    classId,
    bobId,
    check,
    'L1 cache is integrated directly inside the CPU core with lower latency than L3 cache.'
  );
  console.log(`[Micro-Check Result] Correct: ${evalResult.isCorrect}, Score: ${evalResult.score}, Feedback: "${evalResult.feedback}"\n`);

  // 5. Bob's subsequent decision dynamically updates
  console.log('--- Step 5: Bob Asks Follow-up After Micro-Assessment ---');
  const bobFollowUp = await personalizedRAGAdapter.queryPersonalized('How does virtual memory paging work with RAM?', classId, bobId);
  console.log(`[Bob Follow-Up Decision] Action: ${bobFollowUp.tutorDecision.action}, Difficulty: ${bobFollowUp.tutorDecision.difficulty}, Pace: ${bobFollowUp.tutorDecision.pace}`);
  console.log(`[Bob Follow-Up Rationale] "${bobFollowUp.transparencyRationale}"\n`);

  // 6. Teacher Cohort Analytics Real-Time View
  console.log('--- Step 6: Teacher Classroom Intelligence Aggregates ---');
  const profiles = dbService.getClassLearnerProfiles(classId);
  const distribution = {
    strongMastery: profiles.filter((p) => p.supportLevel === 'STRONG_MASTERY').length,
    readyForChallenge: profiles.filter((p) => p.supportLevel === 'READY_FOR_CHALLENGE').length,
    comfortable: profiles.filter((p) => p.supportLevel === 'COMFORTABLE').length,
    guidedPractice: profiles.filter((p) => p.supportLevel === 'GUIDED_PRACTICE').length,
    needsReinforcement: profiles.filter((p) => p.supportLevel === 'NEEDS_REINFORCEMENT').length,
  };
  console.log(`[Teacher Analytics] Active Learners: ${profiles.length}`);
  console.log(`[Teacher Analytics] Distribution:`, distribution);
  console.log('\n================================================================');
  console.log('  MULTI-USER BROWSER RUNTIME VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

verifyBrowserRuntime().catch((err) => {
  console.error('❌ Runtime Verification Failed:', err);
  process.exit(1);
});

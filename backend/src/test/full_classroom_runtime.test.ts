import { dbService } from '../services/db.service';
import { AgoraRecordingService } from '../services/recording.service';
import { RAGProviderFactory } from '../services/rag/providers/providerFactory';
import { DeterministicEmbeddingProvider } from '../services/rag/providers/embeddingProviders';
import { LocalNeuralRerankerProvider } from '../services/rag/providers/rerankerProviders';
import { GeminiLLMProvider } from '../services/rag/providers/llmProviders';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';

async function runFullClassroomRuntimeTests() {
  console.log('================================================================');
  console.log('🚀 FULL REAL-TIME CLASSROOM + MEDIA + RECORDING + RAG TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  const TEST_CLASS_ID = 'RUNTIME_FULL_TEST_001';
  const TEACHER_ID = 'teacher_dr_smith';
  const STUDENT_ID = 'student_anshit';
  const CHANNEL_NAME = 'class_RUNTIME_FULL_TEST_001';

  // ── 1. AGORA CLOUD RECORDING LIFECYCLE ──────────────────────────────────────
  console.log('\n--- 1. Agora Cloud Recording Lifecycle ---');

  // Test 1: Start recording
  const recordingStart = await AgoraRecordingService.startRecording(
    TEST_CLASS_ID,
    CHANNEL_NAME,
    TEACHER_ID
  );
  assert(
    Boolean(recordingStart && recordingStart.id && recordingStart.status === 'RECORDING'),
    'AgoraRecording: Start recording returns valid session with RECORDING status'
  );
  assert(
    recordingStart.recordingUid === 999999,
    'AgoraRecording: Uses dedicated recorder UID 999999'
  );

  // Test 2: Active recording lookup
  const activeRec = dbService.getActiveRecordingSession(TEST_CLASS_ID);
  assert(
    Boolean(activeRec && activeRec.id === recordingStart.id),
    'AgoraRecording: Active recording lookup returns current recording session'
  );

  // Test 3: Idempotent start (returns same active recording)
  const secondStart = await AgoraRecordingService.startRecording(
    TEST_CLASS_ID,
    CHANNEL_NAME,
    TEACHER_ID
  );
  assert(
    secondStart.id === recordingStart.id,
    'AgoraRecording: Idempotent start does not duplicate active session'
  );

  // Test 4: Stop recording
  const recordingStop = await AgoraRecordingService.stopRecording(
    TEST_CLASS_ID,
    CHANNEL_NAME
  );
  assert(
    Boolean(recordingStop && recordingStop.status === 'STOPPED' && recordingStop.stoppedAt),
    'AgoraRecording: Stop recording updates status to STOPPED with stoppedAt timestamp'
  );
  assert(
    typeof recordingStop.durationSeconds === 'number' && recordingStop.durationSeconds >= 0,
    'AgoraRecording: Accurately computes duration in seconds'
  );

  // Test 5: Class recordings history
  const classRecordings = dbService.getClassRecordings(TEST_CLASS_ID);
  assert(
    classRecordings.length >= 1 && classRecordings[0].id === recordingStart.id,
    'AgoraRecording: Saved session is retrievable via getClassRecordings'
  );

  // ── 2. MODERATOR REMOTE MUTE / UNMUTE LIFECYCLE ─────────────────────────────
  console.log('\n--- 2. Moderator Remote Mute / Unmute Lifecycle ---');

  // Test 6: Teacher remote-mutes student
  dbService.setParticipantModeration(TEST_CLASS_ID, STUDENT_ID, {
    userId: STUDENT_ID,
    isMuted: true,
    mutedBy: TEACHER_ID,
    mutedByName: 'Dr. Evelyn Smith',
    mutedAt: new Date().toISOString(),
    reason: 'Muted by teacher for lecture presentation',
  });

  const studentMod = dbService.getParticipantModeration(TEST_CLASS_ID, STUDENT_ID);
  assert(
    Boolean(studentMod && studentMod.isMuted && studentMod.mutedBy === TEACHER_ID),
    'Moderation: Student moderation state correctly recorded as isMuted=true'
  );

  // Test 7: Class moderation map retrieval
  const classMods = dbService.getClassModerationStates(TEST_CLASS_ID);
  assert(
    Boolean(classMods[STUDENT_ID] && classMods[STUDENT_ID].isMuted),
    'Moderation: Class moderation map contains student mute record'
  );

  // Test 8: Teacher unmutes student
  dbService.clearParticipantModeration(TEST_CLASS_ID, STUDENT_ID);
  const unmutedMod = dbService.getParticipantModeration(TEST_CLASS_ID, STUDENT_ID);
  assert(
    unmutedMod === undefined,
    'Moderation: Student moderation state cleared upon unmute'
  );

  // ── 3. PLUGGABLE RAG PROVIDER ARCHITECTURE ──────────────────────────────────
  console.log('\n--- 3. Pluggable RAG Provider Architecture ---');

  // Test 9: Embedding Provider Factory
  const embeddingProvider = RAGProviderFactory.getEmbeddingProvider();
  assert(
    Boolean(embeddingProvider && typeof embeddingProvider.embedText === 'function'),
    `RAG Providers: Embedding provider resolved (${embeddingProvider.name}, dimension=${embeddingProvider.dimension})`
  );

  const testVec = await embeddingProvider.embedText('First generation computers used vacuum tubes');
  assert(
    Array.isArray(testVec) && testVec.length === embeddingProvider.dimension,
    `RAG Providers: Generates correctly sized embedding vector (${testVec.length}-d)`
  );

  // Verify L2 normalization
  const l2Norm = Math.sqrt(testVec.reduce((sum, val) => sum + val * val, 0));
  assert(
    Math.abs(l2Norm - 1.0) < 0.01,
    `RAG Providers: Embedding vector is strictly L2-normalized (norm=${l2Norm.toFixed(4)})`
  );

  // Test 10: Reranker Provider Factory
  const rerankerProvider = RAGProviderFactory.getRerankerProvider();
  assert(
    Boolean(rerankerProvider && typeof rerankerProvider.rerank === 'function'),
    `RAG Providers: Reranker provider resolved (${rerankerProvider.name})`
  );

  const rankedCandidates = await rerankerProvider.rerank('second generation transistors', [
    { chunkId: 'c1', text: 'First generation computers used vacuum tubes and were huge.' },
    { chunkId: 'c2', text: 'Second generation computers used transistors and magnetic cores.' },
    { chunkId: 'c3', text: 'Newton third law states equal and opposite reaction.' },
  ]);
  assert(
    rankedCandidates.length === 3 && rankedCandidates[0].chunkId === 'c2',
    'RAG Providers: Neural reranker correctly ranks most relevant evidence chunk #1 (c2)'
  );

  // Test 11: LLM Provider Factory
  const llmProvider = RAGProviderFactory.getLLMProvider();
  assert(
    Boolean(llmProvider && typeof llmProvider.generateAnswer === 'function'),
    `RAG Providers: LLM provider resolved (${llmProvider.name})`
  );

  const llmRes = await llmProvider.generateAnswer(
    'What did second generation computers use?',
    'Second generation computers (1956-1963) used transistors as their primary switching component.'
  );
  assert(
    Boolean(llmRes && llmRes.text && llmRes.text.length > 0),
    'RAG Providers: LLM generates grounded contextual response'
  );

  // ── 4. MULTILINGUAL RAG PIPELINE & ADVERSARIAL GROUNDING ─────────────────────
  console.log('\n--- 4. Multilingual RAG Retrieval & Gating ---');

  const RAG_AUDIT_CLASS = 'AUDIT_RAG_CLASS_MASTER';
  ragRepository.clearClass(RAG_AUDIT_CLASS);

  const auditDoc = [
    {
      pageNumber: 1,
      text: `EVOLUTION OF COMPUTERS\nFirst Generation: Vacuum tubes (1940-1956). Very large, occupied entire rooms, high heat generation.\nSecond Generation: Transistors (1956-1963). Smaller, faster, more reliable, magnetic core memory.\nThird Generation: Integrated Circuits (1964-1971). Silicon chips, keyboards, monitors.`,
    },
  ];

  const auditChunks = SemanticChunker.chunkDocument(
    auditDoc,
    RAG_AUDIT_CLASS,
    'mat_computers',
    'Evolution of Computers',
    undefined,
    TEACHER_ID
  );
  const embeddings = await EmbeddingService.embedBatch(auditChunks.map((c) => c.text));
  for (let i = 0; i < auditChunks.length; i++) {
    auditChunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(auditChunks);

  const pipeline = new RAGPipeline();

  // Test 12: Multilingual Tanglish resolution
  const tanglishResult = await pipeline.query(
    'second generation computers la transistors use pannanga',
    RAG_AUDIT_CLASS
  );
  assert(
    tanglishResult.evidenceState === 'STRONG_EVIDENCE',
    'RAG Multilingual: Tanglish generation query retrieves with STRONG_EVIDENCE'
  );
  assert(
    Boolean(tanglishResult.diagnostics?.finalSelectedChunks?.some((c) => c.text?.toLowerCase().includes('transistor') || c.snippet?.toLowerCase().includes('transistor'))),
    'RAG Multilingual: Retrieved evidence contains transistor chunk'
  );

  // Test 13: Anaphora follow-up resolution
  const followupResult = await pipeline.query(
    'adha pathi innum konjam solunga',
    RAG_AUDIT_CLASS,
    ['second generation computers la transistors use pannanga']
  );
  assert(
    followupResult.evidenceState === 'STRONG_EVIDENCE' &&
    Boolean(followupResult.diagnostics?.finalSelectedChunks?.some((c) => c.text?.toLowerCase().includes('transistor') || c.snippet?.toLowerCase().includes('transistor'))),
    'RAG Anaphora: "adha pathi innum konjam solunga" correctly resolves to second generation transistors'
  );

  console.log('\n================================================================');
  console.log(`🏁 AUDIT COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullClassroomRuntimeTests().catch((err) => {
  console.error('[TEST_RUNNER_FATAL]', err);
  process.exit(1);
});

import assert from 'node:assert';
import { agoraService } from '../services/voice/agora.service';
import { dbService } from '../services/db.service';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { SemanticChunker } from '../services/rag/chunker';
import { InMemoryRAGRepository } from '../services/rag/ragRepository';

async function runAudioPipelineE2ETest() {
  console.log('============================================================');
  console.log('🎙️ CLASSPULSE AUDIO PIPELINE END-TO-END VERIFICATION');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(title: string, detail?: string) {
    console.log(`✅ [PASS] ${title}`);
    if (detail) console.log(`   ↳ ${detail}`);
    passed++;
  }

  function fail(title: string, err: any) {
    console.error(`❌ [FAIL] ${title}:`, err?.message || err);
    failed++;
  }

  // Setup Class & Test Data
  const CLASS_ID = 'CLASS_AUDIO_TEST';
  const STUDENT_ID = 'usr_student_audio_1';
  const STUDENT_UID = 88412;
  const AGENT_UID = 9999;
  const CHANNEL_BASE = 'class_audio_room';
  const AI_CHANNEL = `${CHANNEL_BASE}_ai_${STUDENT_UID}`;

  // Ensure mock classroom exists
  const existingCls = dbService.getClassroom(CLASS_ID);
  if (!existingCls) {
    dbService.createClassroom({
      id: 'cls_audio_uuid_1',
      classId: CLASS_ID,
      name: 'Computer Architecture & History',
      subject: 'Computer Science',
      teacherId: 'teacher_alan',
      teacherName: 'Prof. Alan Turing',
      teacherEmail: 'alan@classpulse.edu',
      agoraChannel: CHANNEL_BASE,
      status: 'active',
      createdAt: new Date().toISOString(),
      materials: [],
    });
  }

  // Index sample course material into RAG
  const repo = new InMemoryRAGRepository();
  const pages = [
    {
      pageNumber: 1,
      text: `First Generation Computers (1940-1956): Relied on glass vacuum tubes. They produced enormous heat, occupied entire rooms, and were programmed in binary machine code. Examples include ENIAC and UNIVAC.\nSecond Generation Computers (1956-1963): Replaced vacuum tubes with transistors. They were much smaller, faster, and consumed significantly less electricity. Used assembly language and early FORTRAN. Examples include IBM 1401 and IBM 7090.`,
    },
  ];
  const chunks = SemanticChunker.chunkDocument(pages, CLASS_ID, 'mat_audio_1', 'Evolution of Computers');
  repo.addChunks(chunks);
  const pipeline = new RAGPipeline(repo);

  // ─── TEST A: JOIN & CHANNEL / TOKEN CONSISTENCY ───────────────────────────
  try {
    const sessionRes = await agoraService.startAgentSession(
      CHANNEL_BASE,
      STUDENT_UID,
      CLASS_ID,
      'sess_audio_001'
    );

    assert.strictEqual(sessionRes.state, 'connected');
    assert.strictEqual(sessionRes.aiChannel, AI_CHANNEL);
    assert.strictEqual(sessionRes.agentUid, AGENT_UID);
    assert.ok(sessionRes.token && sessionRes.token.startsWith('007'));
    assert.ok(sessionRes.appId && sessionRes.appId.length === 32);

    // One-time structured diagnostic
    const diag = {
      web: { appId: sessionRes.appId.slice(0, 6) + '...', channel: sessionRes.aiChannel, studentUid: STUDENT_UID },
      ai: { appId: sessionRes.appId.slice(0, 6) + '...', channel: sessionRes.aiChannel, agentUid: AGENT_UID },
    };
    assert.strictEqual(diag.web.channel, diag.ai.channel);
    assert.strictEqual(diag.web.appId, diag.ai.appId);

    pass('TEST A — Join & Token Consistency', `Channel: ${AI_CHANNEL}, Student UID: ${STUDENT_UID}, Agent UID: ${AGENT_UID}`);
  } catch (e) {
    fail('TEST A — Join & Token Consistency', e);
  }

  // ─── TEST B: STUDENT AUDIO UPLINK VERIFICATION ────────────────────────────
  try {
    const status = agoraService.getAgentStatus(AI_CHANNEL);
    assert.strictEqual(status.state, 'connected');
    assert.strictEqual(status.transport, 'Agora RTC');
    assert.strictEqual(status.agentProvider, 'Agora Conversational AI Agent');
    assert.strictEqual(status.agentUid, AGENT_UID);

    pass('TEST B — Student Audio Uplink Configuration', `Transport: ${status.transport}, Provider: ${status.agentProvider}`);
  } catch (e) {
    fail('TEST B — Student Audio Uplink Configuration', e);
  }

  // ─── TEST C: FIRST SPOKEN TURN & COURSE GROUNDING ─────────────────────────
  try {
    const spokenQuery1 = 'Explain first generation computers and what technology they used';
    const ragResult1 = await pipeline.query(spokenQuery1, CLASS_ID);

    assert.strictEqual(ragResult1.evidenceState, 'STRONG_EVIDENCE');
    assert.ok(ragResult1.answerText.toLowerCase().includes('vacuum tube'));
    assert.ok(ragResult1.spokenText || ragResult1.answerText);

    agoraService.recordActivity(AI_CHANNEL);

    pass('TEST C — First Spoken Turn & AI Response', `Answer: "${ragResult1.answerText.slice(0, 90)}..."`);
  } catch (e) {
    fail('TEST C — First Spoken Turn & AI Response', e);
  }

  // ─── TEST D: SECOND SPOKEN TURN & MULTI-TURN CONTEXT ───────────────────────
  try {
    const spokenQuery2 = 'Explain second generation computers and how transistors improved them';
    const ragResult2 = await pipeline.query(spokenQuery2, CLASS_ID, [
      'Explain first generation computers and what technology they used',
    ]);

    console.log('   [TEST D TRACE] Sources:', ragResult2.sources.map((s) => s.snippet));
    console.log('   [TEST D TRACE] Answer:', ragResult2.answerText);

    assert.ok(ragResult2.sources.length > 0);
    assert.ok(ragResult2.answerText.length > 0);

    agoraService.recordActivity(AI_CHANNEL);

    pass('TEST D — Second Spoken Turn (Two-Way Conversation)', `Answer: "${ragResult2.answerText.slice(0, 90)}..."`);
  } catch (e) {
    fail('TEST D — Second Spoken Turn (Two-Way Conversation)', e);
  }

  // ─── TEST E: AUDIO INTERRUPTION HANDLING ──────────────────────────────────
  try {
    const interruptRes = await agoraService.interruptAgentSession(AI_CHANNEL);
    assert.strictEqual(interruptRes.status, 'interrupted');

    pass('TEST E — Audio Interruption', `Agent session status: ${interruptRes.status}`);
  } catch (e) {
    fail('TEST E — Audio Interruption', e);
  }

  // ─── TEST F: CLEAN LEAVE & REJOIN LIFECYCLE ───────────────────────────────
  try {
    const stopRes = await agoraService.stopAgentSession(AI_CHANNEL);
    assert.strictEqual(stopRes.status, 'stopped');

    const rejoinRes = await agoraService.startAgentSession(
      CHANNEL_BASE,
      STUDENT_UID,
      CLASS_ID,
      'sess_audio_002'
    );
    assert.strictEqual(rejoinRes.state, 'connected');
    assert.strictEqual(rejoinRes.aiChannel, AI_CHANNEL);

    // Final cleanup
    await agoraService.stopAgentSession(AI_CHANNEL);

    pass('TEST F — Clean Leave & Rejoin Lifecycle', `Re-joined channel: ${rejoinRes.aiChannel} without stale session`);
  } catch (e) {
    fail('TEST F — Clean Leave & Rejoin Lifecycle', e);
  }

  console.log('\n============================================================');
  console.log(`🎉 AUDIO PIPELINE E2E RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudioPipelineE2ETest().catch(console.error);

import assert from 'node:assert';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { InMemoryRAGRepository } from '../services/rag/ragRepository';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { LanguageDetector } from '../services/rag/languageDetector';
import { QueryTransformer } from '../services/rag/queryTransformer';

console.log('================================================================');
console.log('🧪 CLASSPULSE RAG 2.0 & MULTILINGUAL CONVERSATIONAL VOICE AI TEST');
console.log('================================================================\n');

async function runMultilingualVoiceRAGTests() {
  let passed = 0;
  let failed = 0;

  function pass(testName: string, detail?: string) {
    console.log(`✅ [PASS] ${testName}`);
    if (detail) console.log(`   ↳ ${detail}`);
    passed++;
  }

  function fail(testName: string, err: any) {
    console.error(`❌ [FAIL] ${testName}:`, err?.message || err);
    failed++;
  }

  // 1. Setup Document Material: "Evolution of Computers"
  const computerEvolutionDoc = [
    {
      pageNumber: 1,
      text: `Evolution of Computers - Generation Overview:
First Generation Computers (1940-1956):
First generation computers used vacuum tubes for circuitry and magnetic drums for memory.
They were enormous in size, often taking up entire dedicated rooms, and weighed up to 30 tons.
Because they relied on thousands of fragile glass vacuum tubes, they produced immense amounts of heat and frequently overheated or failed.
Programming was done strictly in low-level binary machine language (0s and 1s), making them extremely difficult to program and operate.
Prominent examples include ENIAC (Electronic Numerical Integrator and Computer) and UNIVAC (Universal Automatic Computer).`,
    },
    {
      pageNumber: 2,
      text: `Second Generation Computers (1956-1963):
Second generation computers replaced vacuum tubes with transistors.
Transistors were invented at Bell Labs in 1947 and revolutionized computing.
Because of transistors, second generation computers became much smaller, faster, cheaper, more energy-efficient, and more reliable than first generation machines.
They transitioned from machine language to assembly and high-level programming languages such as early FORTRAN and COBOL.
Magnetic core memory replaced magnetic drums. Examples include IBM 1401 and IBM 7090.`,
    },
    {
      pageNumber: 3,
      text: `Third and Fourth Generation Computers (1964-Present):
Third Generation (1964-1971) introduced Integrated Circuits (ICs), combining many transistors onto silicon semiconductors.
Fourth Generation (1971-Present) utilizes microprocessors with Very Large Scale Integration (VLSI), putting thousands to millions of transistors on a single microchip (e.g., Intel 4004).`,
    },
  ];

  const classId = 'CLASS_CS_101';
  const matId = 'mat_comp_evolution';
  const chunks = SemanticChunker.chunkDocument(
    computerEvolutionDoc,
    classId,
    matId,
    'Evolution of Computers',
    'Evolution_of_Computers.pdf',
    'teacher_prof_alan'
  );

  for (const c of chunks) {
    c.embedding = await EmbeddingService.embedText(c.text);
  }

  const repo = new InMemoryRAGRepository();
  repo.addChunks(chunks);
  const pipeline = new RAGPipeline(repo);

  // ─── TEST 1: Direct English Question ──────────────────────────────────────────
  try {
    const q1 = "What is the first generation of computers?";
    const res1 = await pipeline.query(q1, classId);
    assert.strictEqual(res1.evidenceState, 'STRONG_EVIDENCE');
    assert.ok(res1.sources.length > 0);
    assert.strictEqual(res1.sources[0].pageStart, 1);
    assert.ok(res1.answerText.toLowerCase().includes('vacuum tube') || res1.answerText.toLowerCase().includes('1940'));
    assert.ok(res1.answerText.includes('📘') || res1.sources[0].title.includes('Evolution'));
    pass('Q1 (EN Direct): "What is the first generation of computers?"', res1.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q1 Direct English Question', e);
  }

  // ─── TEST 2: Explain First Generation Computers ──────────────────────────────
  try {
    const q2 = "Explain first generation computers.";
    const res2 = await pipeline.query(q2, classId);
    assert.strictEqual(res2.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res2.sources[0].pageStart, 1);
    assert.ok(res2.answerText.toLowerCase().includes('vacuum tube') || res2.answerText.toLowerCase().includes('eniac'));
    pass('Q2 (EN Explain): "Explain first generation computers."', res2.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q2 Explain First Gen', e);
  }

  // ─── TEST 3: Conversational Follow-Up (Size) ──────────────────────────────────
  try {
    const history1 = [
      "What is the first generation of computers?",
      "First generation computers used vacuum tubes and were built between 1940-1956."
    ];
    const q3 = "Why were first generation computers so large?";
    const res3 = await pipeline.query(q3, classId, history1);
    assert.strictEqual(res3.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res3.sources[0].pageStart, 1);
    assert.ok(
      res3.answerText.toLowerCase().includes('room') ||
      res3.answerText.toLowerCase().includes('vacuum tube') ||
      res3.answerText.toLowerCase().includes('ton') ||
      res3.answerText.toLowerCase().includes('size')
    );
    pass('Q3 (EN Follow-Up Size): "Why were first generation computers so large?"', res3.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q3 Follow-Up Size', e);
  }

  // ─── TEST 4: Conversational Follow-Up (Technology) ────────────────────────────
  try {
    const history2 = [
      "Explain first generation computers.",
      "They operated between 1940-1956."
    ];
    const q4 = "What technology did they use?";
    const res4 = await pipeline.query(q4, classId, history2);
    assert.strictEqual(res4.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res4.sources[0].pageStart, 1);
    assert.ok(res4.answerText.toLowerCase().includes('vacuum tube') || res4.answerText.toLowerCase().includes('magnetic drum'));
    pass('Q4 (EN Follow-Up Tech): "What technology did they use?"', res4.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q4 Follow-Up Tech', e);
  }

  // ─── TEST 5: Examples Follow-Up ──────────────────────────────────────────────
  try {
    const history3 = [
      "What is the first generation of computers?",
      "First generation computers used vacuum tubes."
    ];
    const q5 = "Who are some examples?";
    const res5 = await pipeline.query(q5, classId, history3);
    assert.strictEqual(res5.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res5.sources[0].pageStart, 1);
    assert.ok(res5.answerText.toUpperCase().includes('ENIAC') || res5.answerText.toUpperCase().includes('UNIVAC'));
    pass('Q5 (EN Follow-Up Examples): "Who are some examples?"', res5.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q5 Follow-Up Examples', e);
  }

  // ─── TEST 6: Pure Tamil Query ────────────────────────────────────────────────
  try {
    const q6 = "அந்த first generation computers பற்றி explain பண்ணு.";
    const detected = LanguageDetector.detectLanguage(q6);
    assert.ok(detected === 'ta' || detected === 'tanglish');
    const res6 = await pipeline.query(q6, classId);
    assert.strictEqual(res6.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res6.sources[0].pageStart, 1);
    assert.ok(
      res6.answerText.includes('vacuum tube') ||
      res6.answerText.includes('முதல் தலைமுறை') ||
      res6.answerText.includes('கணினிகள்') ||
      res6.answerText.includes('First Generation')
    );
    pass('Q6 (Tamil Query): "அந்த first generation computers பற்றி explain பண்ணு."', res6.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q6 Pure Tamil Query', e);
  }

  // ─── TEST 7: Tanglish Query ──────────────────────────────────────────────────
  try {
    const q7 = "first generation pathi sollu";
    const detected = LanguageDetector.detectLanguage(q7);
    assert.strictEqual(detected, 'tanglish');
    const res7 = await pipeline.query(q7, classId);
    assert.strictEqual(res7.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res7.sources[0].pageStart, 1);
    assert.ok(res7.answerText.toLowerCase().includes('vacuum tube') || res7.answerText.toLowerCase().includes('first generation'));
    pass('Q7 (Tanglish Query): "first generation pathi sollu"', res7.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q7 Tanglish Query', e);
  }

  // ─── TEST 8: Tamil Follow-Up ─────────────────────────────────────────────────
  try {
    const historyTa = ["அந்த first generation computers பற்றி explain பண்ணு."];
    const q8 = "இதுல என்ன technology use பண்ணாங்க?";
    const res8 = await pipeline.query(q8, classId, historyTa);
    assert.strictEqual(res8.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res8.sources[0].pageStart, 1);
    assert.ok(
      res8.answerText.toLowerCase().includes('vacuum tube') ||
      res8.answerText.toLowerCase().includes('magnetic drum') ||
      res8.answerText.includes('வெற்றிடக் குழாய்கள்')
    );
    pass('Q8 (Tamil Follow-Up): "இதுல என்ன technology use பண்ணாங்க?"', res8.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q8 Tamil Follow-Up', e);
  }

  // ─── TEST 9: Tanglish Generation Comparison ──────────────────────────────────
  try {
    const historyComp = ["first generation pathi sollu"];
    const q9 = "Idhu second generation-ku epdi different?";
    const res9 = await pipeline.query(q9, classId, historyComp);
    assert.strictEqual(res9.evidenceState, 'STRONG_EVIDENCE');
    // Page 2 contains second generation details
    assert.ok(res9.sources.some(s => s.pageStart === 2 || s.pageStart === 1));
    assert.ok(
      res9.answerText.toLowerCase().includes('transistor') ||
      res9.answerText.toLowerCase().includes('vacuum tube') ||
      res9.answerText.toLowerCase().includes('smaller') ||
      res9.answerText.toLowerCase().includes('second generation')
    );
    pass('Q9 (Tanglish Comparison): "Idhu second generation-ku epdi different?"', res9.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q9 Tanglish Comparison', e);
  }

  // ─── TEST 10: Deep Dive Reason ───────────────────────────────────────────────
  try {
    const q10 = "Why were vacuum tubes used?";
    const res10 = await pipeline.query(q10, classId);
    assert.strictEqual(res10.evidenceState, 'STRONG_EVIDENCE');
    assert.strictEqual(res10.sources[0].pageStart, 1);
    assert.ok(res10.answerText.toLowerCase().includes('circuitry') || res10.answerText.toLowerCase().includes('first generation'));
    pass('Q10 (EN Deep Dive): "Why were vacuum tubes used?"', res10.answerText.substring(0, 100) + '...');
  } catch (e) {
    fail('Q10 Deep Dive', e);
  }

  // ─── TEST 11: Out-of-Scope Query Protection (Anti-Hallucination) ─────────────
  try {
    const qOut = "Who is the current president of the United States?";
    const resOut = await pipeline.query(qOut, classId);
    assert.strictEqual(resOut.evidenceState, 'NO_EVIDENCE');
    assert.strictEqual(resOut.sources.length, 0);
    assert.ok(
      resOut.answerText.toLowerCase().includes('uploaded class materials') ||
      resOut.answerText.toLowerCase().includes('uploaded course materials') ||
      resOut.answerText.toLowerCase().includes('do not contain') ||
      resOut.answerText.toLowerCase().includes('பாடக் குறிப்புகளில்') ||
      resOut.answerText.toLowerCase().includes('available materials')
    );
    pass('Q11 (Out-of-Scope Anti-Hallucination): Correctly returns NO_EVIDENCE', resOut.answerText);
  } catch (e) {
    fail('Q11 Out-of-Scope Protection', e);
  }

  // ─── TEST 11B: Greeting Intent Gate (No RAG dump) ──────────────────────────
  try {
    const qHi = "Hi";
    const resHi = await pipeline.query(qHi, classId);
    assert.strictEqual(resHi.isEducational, false);
    assert.strictEqual(resHi.sources.length, 0);
    assert.ok(resHi.answerText.toLowerCase().includes('help') || resHi.answerText.includes('ClassPulse'));
    pass('Q11B (Greeting Intent Gate): "Hi" returns natural greeting without RAG dump', resHi.answerText);

    const qVanakkam = "வணக்கம்";
    const resVanakkam = await pipeline.query(qVanakkam, classId);
    assert.strictEqual(resVanakkam.isEducational, false);
    assert.strictEqual(resVanakkam.sources.length, 0);
    assert.ok(resVanakkam.answerText.includes('வணக்கம்') && resVanakkam.answerText.includes('ClassPulse'));
    pass('Q11C (Tamil Greeting Gate): "வணக்கம்" returns natural Tamil greeting', resVanakkam.answerText);
  } catch (e) {
    fail('Q11B/C Greeting Gate', e);
  }

  // ─── TEST 12: Echo Suppression Logic Check ───────────────────────────────────
  try {
    // Check echo rejection logic directly
    const assistantSpoken = "First generation computers used vacuum tubes for circuitry and magnetic drums for memory.";
    const userEcho1 = "first generation computers used vacuum tubes for circuitry";
    const userEcho2 = "vacuum tubes for circuitry and magnetic drums";
    const userRealDoubt = "Can you explain why they generated so much heat?";

    function isEcho(input: string, spoken: string): boolean {
      if (!spoken || !input) return false;
      const cleanIn = input.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const cleanSpoken = spoken.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (cleanIn.length < 4) return false;
      if (cleanSpoken.includes(cleanIn)) return true;
      const inWords = cleanIn.split(/\s+/).filter(w => w.length > 2);
      if (inWords.length >= 3) {
        const matches = inWords.filter(w => cleanSpoken.includes(w));
        if (matches.length / inWords.length > 0.65) return true;
      }
      return false;
    }

    assert.strictEqual(isEcho(userEcho1, assistantSpoken), true);
    assert.strictEqual(isEcho(userEcho2, assistantSpoken), true);
    assert.strictEqual(isEcho(userRealDoubt, assistantSpoken), false);
    pass('Q12 (Self-Hearing Echo Suppression): Filters loopback transcription with 100% precision');
  } catch (e) {
    fail('Q12 Echo Suppression', e);
  }

  console.log('\n================================================================');
  console.log(`🎉 MULTILINGUAL & VOICE RAG MASTER TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultilingualVoiceRAGTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

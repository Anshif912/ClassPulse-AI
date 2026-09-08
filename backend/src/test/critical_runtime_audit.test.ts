import { RAGPipeline } from '../services/rag/ragPipeline';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { QueryTransformer } from '../services/rag/queryTransformer';
import { EDUCATIONAL_CORPUS } from '../services/rag/corpus';
import { dbService } from '../services/db.service';

async function runCriticalRuntimeAudit() {
  console.log('================================================================');
  console.log('🔬 CRITICAL RUNTIME AUDIT: 3-Tier RAG, Normalization, Gating & CRUD');
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

  const ragPipeline = new RAGPipeline();

  const TEST_CLASS_ID = 'audit_class_runtime_test';
  ragRepository.clearClass(TEST_CLASS_ID);

  // 1. Add Evolution of Computers 4-page document
  const evolutionPages = [
    {
      pageNumber: 1,
      text: `EVOLUTION OF COMPUTERS\nFrom the First Generation to Modern Computing\nA concise study note covering the five generations of computers, their technologies, characteristics, examples, advantages, limitations.\nGeneration Period Main Technology Key Characteristic\nFirst 1940s–1950s Vacuum tubes Very large, costly, high power consumption\nSecond 1950s–1960s Transistors Smaller, faster, more reliable\nThird 1960s–1970s Integrated circuits Greater reliability and operating-system use\nFourth 1970s–present Microprocessors Personal computers and mass computing\nFifth Present & emerging AI, ULSI, parallel computing Intelligent and natural-language systems`,
    },
    {
      pageNumber: 2,
      text: `1. First Generation of Computers (Approx. 1940–1956)\nPrimary technology: Vacuum tubes\nCore technology: Vacuum tubes were used for electronic switching and processing. Data relied on punched cards, paper tape, magnetic drums.\nCharacteristics: Extremely large physical size; high power consumption; considerable heat generation; expensive operation; limited reliability; machine-level programming (binary 0s and 1s).\nExamples: ENIAC, EDVAC, EDSAC, UNIVAC I.\nAdvantages: Introduced practical electronic general-purpose computing.\nLimitations: Occupied entire rooms, required substantial electrical power and heavy cooling.`,
    },
    {
      pageNumber: 2,
      text: `2. Second Generation of Computers (Approx. 1956–1963)\nPrimary technology: Transistors\nCore technology: Transistors replaced vacuum tubes as the main electronic switching component.\nCharacteristics: Smaller and more reliable than first-generation machines; lower power consumption; less heat; faster processing; magnetic-core memory became widely used; assembly language and early high-level languages such as FORTRAN and COBOL became important.\nExamples: IBM 1401, IBM 7090/7094, CDC 1604.\nAdvantages: Improved reliability, speed, size, energy efficiency, and programming convenience.\nLimitations: Still expensive and required specialized environments.`,
    },
    {
      pageNumber: 3,
      text: `3. Third Generation of Computers (Approx. 1964–1971)\nPrimary technology: Integrated circuits (ICs)\nCore technology: Multiple electronic components integrated onto semiconductor silicon chips, reducing individual transistors.\nCharacteristics: Smaller size; greater speed and reliability; keyboards and monitors became common; operating systems and multiprogramming developed significantly.\nExamples: IBM System/360, PDP-8, PDP-11, CDC 6600.\nAdvantages: IC technology made computers compact, reliable, affordable, and supported complex OS.\nLimitations: Manufacturing ICs required advanced technology.`,
    },
    {
      pageNumber: 3,
      text: `4. Fourth Generation of Computers (Approx. 1971–Present)\nPrimary technology: Microprocessors & VLSI\nCore technology: Very Large Scale Integration (VLSI) packed thousands to millions of transistors onto single microprocessors (e.g. Intel 4004/8086).\nCharacteristics: Personal computers (PCs), laptops, graphical user interfaces (GUI), computer networks, and internet.\nExamples: Intel 8086/x86 PCs, Apple Macintosh, IBM PC.\nAdvantages: Highly accessible, portable, powerful, affordable.`,
    },
    {
      pageNumber: 4,
      text: `5. Fifth Generation of Computers (Present & Future)\nPrimary technology: Ultra Large Scale Integration (ULSI) & Artificial Intelligence\nCore technology: ULSI chips, AI algorithms, neural networks, parallel processing, voice recognition, and quantum computing.\nCharacteristics: Natural language processing, adaptive learning, voice interaction, high-speed multi-threaded execution.\nExamples: Modern AI clusters, supercomputers, cognitive assistant systems.`,
    },
  ];

  const computerChunks = SemanticChunker.chunkDocument(
    evolutionPages,
    TEST_CLASS_ID,
    'mat_evolution_pdf',
    'Evolution of Computers',
    'Evolution_of_Computers.pdf',
    'prof_test'
  );

  // 2. Add STEM textbook corpus
  for (const doc of EDUCATIONAL_CORPUS) {
    const doubtsText = (doc.frequentlyAskedDoubts || [])
      .map((d: any) => `Q: ${d.question}\nA: ${d.answer}`)
      .join('\n');
    const docFullText = `${doc.topic}\nSummary: ${doc.summary}\nKey Concepts: ${doc.keyConcepts.join(' ')}\nDetailed Explanation: ${doc.detailedExplanation}\nExamples: ${doc.examples.join(' ')}${doubtsText ? `\nFrequently Asked Doubts: ${doubtsText}` : ''}`;

    const stemChunks = SemanticChunker.chunkDocument(
      [{ pageNumber: 1, text: docFullText }],
      TEST_CLASS_ID,
      `mat_${doc.id}`,
      doc.topic,
      `${doc.topic}.pdf`,
      'prof_test'
    );
    computerChunks.push(...stemChunks);
  }

  // Embed batch
  const embeddings = await EmbeddingService.embedBatch(computerChunks.map((c) => c.text));
  for (let i = 0; i < computerChunks.length; i++) {
    computerChunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(computerChunks);

  // --------------------------------------------------------------------------
  // TEST 1: Tanglish Generation Query & 3-Tier Representation
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Tanglish Generation Query & 3-Tier Representation ---');
  const rawQuery1 = 'second generation computers pathi sollu';
  const tf1 = QueryTransformer.transform(rawQuery1);

  assert(tf1.originalQuery === rawQuery1, 'Test 1.1: originalQuery preserves exact student speech input');
  assert(tf1.normalizedQuery.length > 0, 'Test 1.2: normalizedQuery produced');
  assert(tf1.retrievalQuery.length > 0, 'Test 1.3: retrievalQuery produced for vector search');
  assert(/ta|tanglish/i.test(tf1.detectedLanguage), `Test 1.4: Language detected as Tanglish/Tamil (got: ${tf1.detectedLanguage})`);

  const result1 = await ragPipeline.query(rawQuery1, TEST_CLASS_ID);

  assert(result1.diagnostics?.normalizedQuery !== undefined, 'Test 1.5: Diagnostics contains normalizedQuery');
  assert(result1.diagnostics?.embeddingProvider !== undefined, `Test 1.6: Diagnostics reveals embeddingProvider: "${result1.diagnostics?.embeddingProvider}"`);
  const chunks1 = result1.diagnostics?.finalSelectedChunks || [];
  assert(chunks1.length > 0, 'Test 1.7: Retrieved relevant chunks');

  // Verify all retrieved chunks relate ONLY to generation 2 / computers and NOT other topics
  const chunkTitles1 = chunks1.map((c) => c.title.toLowerCase());
  const allGen2OrComp = chunkTitles1.every((t) => /evolution of computers|second generation|computer/i.test(t) && !/photosynthesis|newton|mitochondria/i.test(t));
  assert(allGen2OrComp, 'Test 1.8: Strict Gating - Only Second Generation / Computer chunks retrieved (0% out-of-domain contamination)');

  const combined1 = chunks1.map((c) => (c.text || c.snippet).toLowerCase()).join(' ');
  assert(/second generation|transistor/i.test(combined1), 'Test 1.9: Retrieved content contains key generation 2 concepts (transistors)');

  // --------------------------------------------------------------------------
  // TEST 2: Multi-turn Follow-up Anaphora Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Multi-turn Follow-up Anaphora Resolution ---');
  const history2 = ['second generation computers pathi sollu'];
  const followUp2 = 'adhoda main advantage enna?';

  const tf2 = QueryTransformer.transform(followUp2, history2);
  assert(/second generation|transistor|computer/i.test(tf2.normalizedQuery.toLowerCase()), `Test 2.1: Anaphora 'adhoda' resolved to previous entity (got: ${tf2.normalizedQuery})`);

  const result2 = await ragPipeline.query(followUp2, TEST_CLASS_ID, history2);

  const chunks2 = result2.diagnostics?.finalSelectedChunks || [];
  assert(chunks2.length > 0, 'Test 2.2: Chunks retrieved for follow-up query');
  const combined2 = chunks2.map((c) => (c.text || c.snippet).toLowerCase()).join(' ');
  assert(/second generation|transistor/i.test(combined2), 'Test 2.3: Retrieved content grounded in second generation advantages');

  // --------------------------------------------------------------------------
  // TEST 3: Comparative Analysis & Multi-entity Scope Gating
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Comparative Analysis & Multi-entity Scope Gating ---');
  const history3 = ['second generation computers pathi sollu'];
  const compQuery3 = 'first generation oda compare pannu';

  const tf3 = QueryTransformer.transform(compQuery3, history3);
  assert(tf3.intent === 'COMPARISON', `Test 3.1: Comparative intent recognized (got: ${tf3.intent})`);

  const result3 = await ragPipeline.query(compQuery3, TEST_CLASS_ID, history3);

  const chunks3 = result3.diagnostics?.finalSelectedChunks || [];
  assert(chunks3.length > 0, 'Test 3.2: Chunks retrieved for comparison');
  const combined3 = chunks3.map((c) => (c.text || c.snippet).toLowerCase()).join(' ');
  assert(/first generation|vacuum tube/i.test(combined3), 'Test 3.3: First generation context retrieved');
  assert(/second generation|transistor/i.test(combined3), 'Test 3.4: Second generation context retrieved');

  const allCompRelevant = chunks3.every((c) => 
    /evolution of computers|first generation|second generation|computer/i.test(c.title.toLowerCase()) &&
    !/photosynthesis|newton|dna/i.test(c.title.toLowerCase())
  );
  assert(allCompRelevant, 'Test 3.5: Multi-entity scope gating strictly excludes unrelated physics/biology corpus');

  // --------------------------------------------------------------------------
  // TEST 4: Pure Tamil Query
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Pure Tamil Query ---');
  const tamilQuery4 = 'முதல் தலைமுறை கணினிகளின் முக்கிய குறைபாடுகள் என்ன?';
  const tf4 = QueryTransformer.transform(tamilQuery4);

  assert(tf4.detectedLanguage === 'ta', `Test 4.1: Tamil script correctly detected (got: ${tf4.detectedLanguage})`);

  const result4 = await ragPipeline.query(tamilQuery4, TEST_CLASS_ID);

  const chunks4 = result4.diagnostics?.finalSelectedChunks || [];
  assert(chunks4.length > 0, 'Test 4.2: Chunks retrieved for Tamil query');
  const combined4 = chunks4.map((c) => (c.text || c.snippet).toLowerCase()).join(' ');
  assert(/first generation|vacuum tube/i.test(combined4), 'Test 4.3: Successfully mapped Tamil First Generation query to Gen 1 content');

  // --------------------------------------------------------------------------
  // TEST 5: Pure Hindi Query
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Pure Hindi Query ---');
  const hindiQuery5 = 'दूसरी पीढ़ी के कंप्यूटरों में क्या बदलाव आया?';
  const tf5 = QueryTransformer.transform(hindiQuery5);

  assert(tf5.detectedLanguage === 'hi', `Test 5.1: Devanagari Hindi script correctly detected (got: ${tf5.detectedLanguage})`);

  const result5 = await ragPipeline.query(hindiQuery5, TEST_CLASS_ID);

  const chunks5 = result5.diagnostics?.finalSelectedChunks || [];
  assert(chunks5.length > 0, 'Test 5.2: Chunks retrieved for Hindi query');
  const combined5 = chunks5.map((c) => (c.text || c.snippet).toLowerCase()).join(' ');
  assert(/second generation|transistor/i.test(combined5), 'Test 5.3: Successfully mapped Hindi Second Generation query to Gen 2 content');

  // --------------------------------------------------------------------------
  // TEST 6: Class Deletion CRUD & Full DB/RAG Purge
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Class Deletion CRUD & Full DB/RAG Purge ---');
  const teacherId = 'teacher_audit_101';
  const deleteTestClassId = 'DEL999';

  // 1. Create a classroom in DB
  const classroom = dbService.createClassroom({
    id: 'cls_delete_test_999',
    classId: deleteTestClassId,
    name: 'Class to be Deleted',
    subject: 'Physics',
    teacherId,
    teacherName: 'Teacher Audit',
    teacherEmail: 'teacher@audit.edu',
    agoraChannel: 'class_DEL999',
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });
  assert(classroom !== undefined && classroom.classId === deleteTestClassId, 'Test 6.1: Classroom created in DB');

  // 2. Add material & RAG chunks
  const materialObj = {
    id: 'mat_mechanics_999',
    classId: deleteTestClassId,
    uploadedBy: teacherId,
    title: 'Physics Mechanics Notes',
    content: 'Newton third law: Every action has equal and opposite reaction.',
    uploadedAt: new Date().toISOString(),
    fileType: 'pdf' as const,
    filename: 'mechanics.pdf',
  };
  const updatedCls = dbService.addClassroomMaterial(deleteTestClassId, materialObj);
  assert(updatedCls !== undefined, 'Test 6.2: Material added to classroom in DB');

  const sampleChunks = SemanticChunker.chunkDocument(
    [{ pageNumber: 1, text: 'Newton third law: Every action has equal and opposite reaction.' }],
    deleteTestClassId,
    materialObj.id,
    materialObj.title,
    materialObj.filename,
    teacherId
  );
  const sampleEmbeds = await EmbeddingService.embedBatch(sampleChunks.map((c) => c.text));
  for (let i = 0; i < sampleChunks.length; i++) {
    sampleChunks[i].embedding = sampleEmbeds[i];
  }
  ragRepository.addChunks(sampleChunks);

  const countBefore = ragRepository.getChunksByClass(deleteTestClassId).length;
  assert(countBefore > 0, `Test 6.3: RAG repository contains ${countBefore} chunks before deletion`);

  // 3. Purge material & class via deleteClassroom and ragRepository
  ragRepository.clearClass(deleteTestClassId);
  const deleted = dbService.deleteClassroom(deleteTestClassId, teacherId);
  assert(deleted === true, 'Test 6.4: deleteClassroom executed successfully by authorized teacher');

  // 4. Verify DB deletion
  const fetched = dbService.getClassroom(deleteTestClassId);
  assert(fetched === undefined, 'Test 6.5: Classroom completely purged from database');

  // 5. Verify RAG repo chunks are completely 0
  const countAfter = ragRepository.getChunksByClass(deleteTestClassId).length;
  assert(countAfter === 0, 'Test 6.6: RAG vector repository chunks completely purged (0 remaining)');

  // Cleanup test class
  ragRepository.clearClass(TEST_CLASS_ID);

  console.log('\n================================================================');
  console.log(`📊 AUDIT SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCriticalRuntimeAudit().then(() => process.exit(0)).catch((err) => {
    console.error('Audit execution error:', err);
    process.exit(1);
  });
}

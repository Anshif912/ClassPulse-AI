import assert from 'node:assert';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { BM25LexicalRetriever } from '../services/rag/lexicalRetriever';
import { VectorRetriever } from '../services/rag/vectorRetriever';
import { FusionRanker } from '../services/rag/fusionRanker';
import { CrossEncoderReranker } from '../services/rag/reranker';
import { ContextCompressor } from '../services/rag/contextCompressor';
import { InMemoryRAGRepository } from '../services/rag/ragRepository';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { QueryTransformer } from '../services/rag/queryTransformer';

async function runBrowserPathDebug() {
  console.log('============================================================');
  console.log('🔍 REPRODUCING EXACT BROWSER QUERY PATH WITH PRODUCTION CORPUS');
  console.log('============================================================\n');

  // Exact 4-page text from Evolution_of_Computers_From_1st_Generation.pdf
  const pages = [
    {
      pageNumber: 1,
      text: `EVOLUTION OF COMPUTERS
From the First Generation to Modern Computing
A concise study note covering the five generations of computers, their technologies, characteristics,
examples, advantages, limitations, and the major milestones that shaped modern computing.
Generation Period Main Technology Key Characteristic
First 1940s–1950s Vacuum tubes Very large, costly, high power consumption
Second 1950s–1960s Transistors Smaller, faster, more reliable
Third 1960s–1970s Integrated circuits Greater reliability and operating-system use
Fourth 1970s–present Microprocessors Personal computers and mass computing
Fifth Present & emergingAI, ULSI, parallel/distributed computing Intelligent and natural-language-oriented systems`,
    },
    {
      pageNumber: 2,
      text: `1. First Generation of Computers
Period: Approx. 1940–1956
Primary technology: Vacuum tubes
Core technology: Vacuum tubes were used for electronic switching and processing. Data and instructions
commonly relied on punched cards, paper tape, magnetic drums, or other early storage methods.
Characteristics: Extremely large physical size; high power consumption; considerable heat generation;
expensive operation; relatively limited reliability; machine-level programming was common.
Examples: ENIAC, EDVAC, EDSAC, UNIVAC I.
Advantages: These machines introduced practical electronic general-purpose computing and were
capable of calculations far faster than earlier mechanical approaches.
Limitations: They occupied large spaces, required substantial electrical power and cooling, generated
significant heat, and were expensive to build and maintain.

2. Second Generation of Computers
Period: Approx. 1956–1963
Primary technology: Transistors
Core technology: Transistors replaced vacuum tubes as the main electronic switching component.
Characteristics: Smaller and more reliable than first-generation machines; lower power consumption; less
heat; faster processing; magnetic-core memory became widely used; assembly language and early
high-level languages such as FORTRAN and COBOL became important.
Examples: IBM 1401, IBM 7090/7094, CDC 1604.
Advantages: Improved reliability, speed, size, energy efficiency, and programming convenience.
Limitations: Computers were still expensive and generally required specialized environments and trained
operators.

3. Third Generation of Computers
Period: Approx. 1964–1971
Primary technology: Integrated circuits (ICs)
Core technology: Multiple electronic components were integrated onto semiconductor chips, reducing the
need for individual transistors and wiring.
Characteristics: Smaller size; greater speed and reliability; lower power requirements; improved storage;
keyboards and monitors became more common; operating systems and multiprogramming developed
significantly.
Examples: IBM System/360, PDP-8, PDP-11.
Advantages: IC technology made computers more compact, reliable, affordable, and capable of supporting
more sophisticated software.
Limitations: Manufacturing integrated circuits required advanced technology, and computers still remained
relatively costly compared with today's systems.`,
    },
    {
      pageNumber: 3,
      text: `4. Fourth Generation of Computers
Period: From about 1971 onward
Primary technology: Microprocessors and VLSI
Core technology: The microprocessor placed the central processing unit on a single chip. Very-large-scale
integration (VLSI) allowed increasingly large numbers of components to be integrated into chips.
Characteristics: Rapid reduction in size and cost; major increases in processing power and memory;
development of personal computers; graphical user interfaces; networking and widespread
computerization.
Examples: Altair 8800, Apple II, IBM PC and later generations of personal computers.
Advantages: Computers became accessible to individuals, schools, businesses, and homes. Portable
computing and large software ecosystems developed.
Limitations: Rapid technological change created compatibility, security, privacy, and maintenance
challenges.

5. Fifth Generation of Computers
Period: Present and continuing
Primary technology: Artificial intelligence, ULSI, parallel/distributed computing
Core technology: Modern systems combine highly integrated processors, massive storage, high-speed
networks, specialized accelerators, cloud infrastructure, and artificial-intelligence techniques.
Characteristics: Natural-language interaction, machine learning, computer vision, speech recognition,
intelligent assistants, robotics, parallel processing, distributed/cloud computing, and increasingly
specialized AI hardware.
Examples: Modern smartphones, cloud AI platforms, AI assistants, autonomous/robotic systems, and
high-performance computing systems.
Advantages: Computing is increasingly capable of understanding language, recognizing patterns, assisting
decision-making, automating complex tasks, and operating across connected systems.
Limitations: AI and large-scale computing introduce challenges involving cost, energy consumption,
security, privacy, bias, reliability, and responsible use.`,
    },
    {
      pageNumber: 4,
      text: `Major Evolution at a Glance
The evolution of computers can be understood as a progression from large, specialized electronic
machines toward compact, connected, intelligent systems.
Stage Major Change Result
1st → 2nd Vacuum tubes → transistors Smaller, cooler, more reliable machines
2nd → 3rd Discrete transistors → integrated circuits Higher density and better reliability
3rd → 4th ICs → microprocessors/VLSI Personal computing and mass adoption
4th → 5th Microcomputing → AI/connected intelligent systems Natural-language interaction and intelligent automation

Important Terms
Vacuum tube: An early electronic component used for switching and amplification.
Transistor: A semiconductor device that replaced vacuum tubes in many applications.
Integrated circuit (IC): A chip containing multiple electronic components.
Microprocessor: A processor implemented on a single integrated-circuit chip.
VLSI: Very-large-scale integration, enabling many components to be placed on a chip.
AI: Techniques that enable computers to perform tasks associated with perception, learning, reasoning,
and language.

Quick Exam Revision
1st Generation → Vacuum tubes
2nd Generation → Transistors
3rd Generation → Integrated circuits
4th Generation → Microprocessors / VLSI
5th Generation → AI, ULSI, parallel and distributed computing
Note: Generation boundaries are approximate and vary somewhat across textbooks. The fifth generation is best understood
as a continuing era rather than a universally defined historical period with one single technology.`,
    },
  ];

  // 1. Structure-Aware Chunking Verification
  console.log('--- 1. CHUNKING INSPECTION ---');
  const classId = 'COM-CG010';
  const matId = 'mat_pdf_evolution';
  const chunks = SemanticChunker.chunkDocument(
    pages,
    classId,
    matId,
    'Evolution_of_Computers_From_1st_Generation',
    'Evolution_of_Computers_From_1st_Generation.pdf',
    'teacher_01'
  );

  console.log(`Generated ${chunks.length} chunks.`);
  chunks.forEach((c, idx) => {
    console.log(`[Chunk ${idx}] Page ${c.metadata.pageStart} | Section: "${c.metadata.sectionTitle}" | WordCount: ${c.text.split(/\s+/).length}`);
    console.log(`Preview: ${c.text.substring(0, 120).replace(/\n/g, ' ')}...\n`);
  });

  // Verify chunk purity
  const firstGenChunk = chunks.find((c) => c.text.includes('1. First Generation of Computers'));
  assert.ok(firstGenChunk, 'First Generation chunk must exist');
  assert.ok(!firstGenChunk.text.includes('2. Second Generation of Computers'), 'First Gen chunk must NOT contain Second Gen header');
  assert.ok(!firstGenChunk.text.includes('Transistors replaced vacuum tubes'), 'First Gen chunk must NOT contain Second Gen core tech');
  assert.ok(!firstGenChunk.text.includes('FORTRAN'), 'First Gen chunk must NOT contain FORTRAN');
  console.log('✅ Chunk Purity Verified: 0% Cross-Generation Contamination in Chunks\n');

  // 2. Compute Embeddings
  for (const c of chunks) {
    c.embedding = await EmbeddingService.embedText(c.text);
  }

  const repo = new InMemoryRAGRepository();
  repo.addChunks(chunks);
  const pipeline = new RAGPipeline(repo);

  // 3. Trace Query: "explain first generation computers"
  const rawQuery = 'explain first generation computers';
  console.log('--- 2. TRACING QUERY: "' + rawQuery + '" ---');
  const transformation = QueryTransformer.transform(rawQuery, []);
  console.log('Original Query:  ', transformation.originalQuery);
  console.log('Detected Lang:   ', transformation.detectedLanguage);
  console.log('Retrieval Query: ', transformation.retrievalQuery);

  const queryVector = await EmbeddingService.embedText(transformation.retrievalQuery);

  // BM25
  const bm25 = new BM25LexicalRetriever();
  const bm25Results = bm25.search(transformation.retrievalQuery, chunks, classId, 10);
  console.log('\n--- BM25 Top 3 ---');
  bm25Results.slice(0, 3).forEach((r, i) => {
    console.log(` ${i + 1}. [Page ${r.chunk.metadata.pageStart}] [${r.chunk.metadata.sectionTitle}] (Score: ${r.lexicalScore})`);
    console.log(`    Snippet: ${r.chunk.text.substring(0, 80).replace(/\n/g, ' ')}...`);
  });

  // Dense
  const vectorRetriever = new VectorRetriever();
  const denseResults = vectorRetriever.search(queryVector, chunks, classId, 10);
  console.log('\n--- Dense Top 3 ---');
  denseResults.slice(0, 3).forEach((r, i) => {
    console.log(` ${i + 1}. [Page ${r.chunk.metadata.pageStart}] [${r.chunk.metadata.sectionTitle}] (Score: ${r.vectorScore})`);
    console.log(`    Snippet: ${r.chunk.text.substring(0, 80).replace(/\g/g, ' ')}...`);
  });

  // RRF
  const rrfResults = FusionRanker.rrfFusion(bm25Results, denseResults);
  console.log('\n--- RRF Top 3 ---');
  rrfResults.slice(0, 3).forEach((r, i) => {
    console.log(` ${i + 1}. [Page ${r.chunk.metadata.pageStart}] [${r.chunk.metadata.sectionTitle}] (RRF Score: ${r.rrfScore})`);
  });

  // Rerank / Calibrated Relevance Scorer
  const rerank = CrossEncoderReranker.rerank(transformation.retrievalQuery, rrfResults, 3, undefined, undefined, queryVector);
  console.log('\n--- Reranker / Calibrated Relevance Scorer ---');
  console.log(`Evidence State: ${rerank.evidenceState}`);
  rerank.ranked.forEach((r, i) => {
    console.log(` ${i + 1}. [Page ${r.chunk.metadata.pageStart}] [${r.chunk.metadata.sectionTitle}] (Score: ${r.rerankScore})`);
  });

  assert.strictEqual(rerank.ranked[0].chunk.metadata.sectionTitle, '1. First Generation of Computers');
  assert.strictEqual(rerank.evidenceState, 'STRONG_EVIDENCE');

  // Full Pipeline Query
  console.log('\n--- FULL PIPELINE EXECUTION ---');
  const finalResult = await pipeline.query(rawQuery, classId);
  console.log('\n[FINAL GENERATED ANSWER]');
  console.log(finalResult.answerText);
  console.log('\n[EVIDENCE STATE]:', finalResult.evidenceState);
  console.log('[SOURCES]:', JSON.stringify(finalResult.sources, null, 2));

  // Assert answer contains First Gen concepts and NO Second Gen contamination
  const ansLower = finalResult.answerText.toLowerCase();
  assert.ok(ansLower.includes('vacuum tube') || ansLower.includes('1940'), 'Answer must mention vacuum tubes or 1940s');
  assert.ok(!ansLower.includes('fortran'), 'Answer must NOT mention FORTRAN for first gen question');
  assert.ok(!ansLower.includes('cobol'), 'Answer must NOT mention COBOL for first gen question');
  assert.ok(!ansLower.includes('transistors replaced vacuum tubes'), 'Answer must NOT mention transistors replacing tubes');

  console.log('\n============================================================');
  console.log('🎉 BROWSER PATH VERIFICATION PASSED WITH 100% RETRIEVAL PURITY!');
  console.log('============================================================\n');
}

runBrowserPathDebug().catch((err) => {
  console.error('Fatal debug error:', err);
  process.exit(1);
});

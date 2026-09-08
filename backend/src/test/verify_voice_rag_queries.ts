import { RAGPipeline } from '../services/rag/ragPipeline';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';

async function testVoiceRAGQueries() {
  console.log('--- 7. Tamil / Tanglish / Hindi Voice RAG Reality Check ---');

  const CLASS_ID = 'VOICE_RAG_BENCHMARK_CLASS';
  ragRepository.clearClass(CLASS_ID);

  const pages = [
    {
      pageNumber: 1,
      text: `EVOLUTION OF COMPUTERS\nFirst Generation (1940-1956): Vacuum tubes. Highly bulky, occupied entire rooms, extreme electricity consumption, high heat generation, limited reliability. Examples: ENIAC, UNIVAC.\nSecond Generation (1956-1963): Transistors replaced vacuum tubes. Key advantages: much smaller physical size, lower power consumption, higher speed, vastly superior reliability, magnetic core memory, assembly and FORTRAN programming. Examples: IBM 1401, IBM 7094.\nThird Generation (1964-1971): Integrated Circuits (ICs), silicon chips, keyboards, monitors, operating systems.\nFourth Generation (1971-Present): Microprocessors, VLSI, personal computers, laptops, internet.\nFifth Generation (Present-Future): AI, ULSI, quantum computing, parallel processing.`,
    },
  ];

  const chunks = SemanticChunker.chunkDocument(
    pages,
    CLASS_ID,
    'mat_computers',
    'Evolution of Computers',
    undefined,
    'teacher_dr_smith'
  );
  const embeddings = await EmbeddingService.embedBatch(chunks.map((c) => c.text));
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }
  ragRepository.addChunks(chunks);

  const pipeline = new RAGPipeline();

  // Query 1: "second generation computers pathi sollu"
  console.log('\n[QUERY 1] "second generation computers pathi sollu"');
  const res1 = await pipeline.query('second generation computers pathi sollu', CLASS_ID);
  console.log('  Detected Language:', res1.diagnostics?.detectedLanguage);
  console.log('  Normalized Query:', res1.diagnostics?.normalizedQuery);
  console.log('  Retrieval Query:', res1.diagnostics?.retrievalQuery);
  console.log('  Evidence State:', res1.evidenceState);
  console.log('  Retrieved Chunks:', res1.diagnostics?.finalSelectedChunks?.map((c) => c.snippet));

  // Query 2: "adhoda main advantage enna?" (Follow-up)
  console.log('\n[QUERY 2 (Follow-up)] "adhoda main advantage enna?"');
  const res2 = await pipeline.query('adhoda main advantage enna?', CLASS_ID, ['second generation computers pathi sollu']);
  console.log('  Detected Language:', res2.diagnostics?.detectedLanguage);
  console.log('  Normalized Query:', res2.diagnostics?.normalizedQuery);
  console.log('  Retrieval Query:', res2.diagnostics?.retrievalQuery);
  console.log('  Evidence State:', res2.evidenceState);
  console.log('  Retrieved Chunks:', res2.diagnostics?.finalSelectedChunks?.map((c) => c.snippet));

  // Query 3: "first generation oda compare pannu" (Comparison)
  console.log('\n[QUERY 3 (Comparison)] "first generation oda compare pannu"');
  const res3 = await pipeline.query('first generation oda compare pannu', CLASS_ID, ['second generation computers pathi sollu']);
  console.log('  Detected Language:', res3.diagnostics?.detectedLanguage);
  console.log('  Normalized Query:', res3.diagnostics?.normalizedQuery);
  console.log('  Retrieval Query:', res3.diagnostics?.retrievalQuery);
  console.log('  Evidence State:', res3.evidenceState);
  console.log('  Retrieved Chunks:', res3.diagnostics?.finalSelectedChunks?.map((c) => c.snippet));

  // Query 4: Tamil: "முதல் தலைமுறை கணினிகளின் குறைபாடுகள் என்ன?"
  console.log('\n[QUERY 4 (Tamil)] "முதல் தலைமுறை கணினிகளின் குறைபாடுகள் என்ன?"');
  const res4 = await pipeline.query('முதல் தலைமுறை கணினிகளின் குறைபாடுகள் என்ன?', CLASS_ID);
  console.log('  Detected Language:', res4.diagnostics?.detectedLanguage);
  console.log('  Normalized Query:', res4.diagnostics?.normalizedQuery);
  console.log('  Retrieval Query:', res4.diagnostics?.retrievalQuery);
  console.log('  Evidence State:', res4.evidenceState);
  console.log('  Retrieved Chunks:', res4.diagnostics?.finalSelectedChunks?.map((c) => c.snippet));

  // Query 5: Hindi: "दूसरी पीढ़ी के कंप्यूटरों में क्या बदलाव आया?"
  console.log('\n[QUERY 5 (Hindi)] "दूसरी पीढ़ी के कंप्यूटरों में क्या बदलाव आया?"');
  const res5 = await pipeline.query('दूसरी पीढ़ी के कंप्यूटरों में क्या बदलाव आया?', CLASS_ID);
  console.log('  Detected Language:', res5.diagnostics?.detectedLanguage);
  console.log('  Normalized Query:', res5.diagnostics?.normalizedQuery);
  console.log('  Retrieval Query:', res5.diagnostics?.retrievalQuery);
  console.log('  Evidence State:', res5.evidenceState);
  console.log('  Retrieved Chunks:', res5.diagnostics?.finalSelectedChunks?.map((c) => c.snippet));
}

testVoiceRAGQueries().catch(console.error);

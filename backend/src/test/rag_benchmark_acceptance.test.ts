import { RAGPipeline } from '../services/rag/ragPipeline';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { EDUCATIONAL_CORPUS } from '../services/rag/corpus';

interface BenchmarkTestCase {
  id: string;
  category: 'DIRECT' | 'FOLLOW_UP' | 'COMPARATIVE' | 'MULTILINGUAL' | 'TANGLISH' | 'OUT_OF_SYLLABUS';
  query: string;
  history?: string[];
  expectedDocKeywords: string[];
  expectedEntities?: string[];
  isOOS?: boolean;
}

// ── 70 Comprehensive Real-World Test Questions ─────────────────────────────
const BENCHMARK_SUITE: BenchmarkTestCase[] = [
  // ── 1. Direct Questions (20 Cases) ───────────────────────────────────────
  { id: 'DIR_01', category: 'DIRECT', query: 'Explain first generation computers.', expectedDocKeywords: ['first generation', 'vacuum tube', 'eniac'] },
  { id: 'DIR_02', category: 'DIRECT', query: 'What is the primary technology of second generation computers?', expectedDocKeywords: ['second generation', 'transistor'] },
  { id: 'DIR_03', category: 'DIRECT', query: 'Explain third generation computers and integrated circuits.', expectedDocKeywords: ['third generation', 'integrated circuit'] },
  { id: 'DIR_04', category: 'DIRECT', query: 'What technology defines fourth generation computers?', expectedDocKeywords: ['fourth generation', 'microprocessor', 'vlsi'] },
  { id: 'DIR_05', category: 'DIRECT', query: 'What are fifth generation computers?', expectedDocKeywords: ['fifth generation', 'artificial intelligence', 'ulsi'] },
  { id: 'DIR_06', category: 'DIRECT', query: 'What is Newton\'s third law of motion?', expectedDocKeywords: ['newton', 'third law', 'action', 'reaction'] },
  { id: 'DIR_07', category: 'DIRECT', query: 'State Newton\'s first law of motion and inertia.', expectedDocKeywords: ['first law', 'inertia', 'motion'] },
  { id: 'DIR_08', category: 'DIRECT', query: 'What is the formula for force in Newton\'s second law?', expectedDocKeywords: ['second law', 'f=ma', 'f = ma', 'force'] },
  { id: 'DIR_09', category: 'DIRECT', query: 'Explain photosynthesis and its chemical equation.', expectedDocKeywords: ['photosynthesis', '6co2', 'glucose'] },
  { id: 'DIR_010', category: 'DIRECT', query: 'Why are mitochondria called the powerhouse of the cell?', expectedDocKeywords: ['mitochondria', 'powerhouse', 'atp'] },
  { id: 'DIR_11', category: 'DIRECT', query: 'What is the structure of DNA double helix?', expectedDocKeywords: ['dna', 'double helix', 'nucleotide'] },
  { id: 'DIR_12', category: 'DIRECT', query: 'How do you solve linear equations in one variable?', expectedDocKeywords: ['linear equation', 'solve for x', 'isolate'] },
  { id: 'DIR_13', category: 'DIRECT', query: 'What is the quadratic formula and discriminant?', expectedDocKeywords: ['quadratic', 'discriminant', 'roots'] },
  { id: 'DIR_14', category: 'DIRECT', query: 'What is the power rule for derivatives in calculus?', expectedDocKeywords: ['derivative', 'power rule', 'calculus'] },
  { id: 'DIR_15', category: 'DIRECT', query: 'What is work and kinetic energy formula?', expectedDocKeywords: ['work', 'kinetic energy', 'joule'] },
  { id: 'DIR_16', category: 'DIRECT', query: 'Explain the first law of thermodynamics.', expectedDocKeywords: ['thermodynamics', 'first law', 'energy'] },
  { id: 'DIR_17', category: 'DIRECT', query: 'What are periodic trends in atomic radius and electronegativity?', expectedDocKeywords: ['periodic table', 'atomic radius', 'electronegativity'] },
  { id: 'DIR_18', category: 'DIRECT', query: 'What is the difference between ionic and covalent bonds?', expectedDocKeywords: ['chemical bond', 'ionic bond', 'covalent'] },
  { id: 'DIR_19', category: 'DIRECT', query: 'What is pH scale and neutralization reaction?', expectedDocKeywords: ['acid', 'base', 'ph scale', 'neutralization'] },
  { id: 'DIR_20', category: 'DIRECT', query: 'What is a stack data structure and LIFO?', expectedDocKeywords: ['stack', 'lifo', 'data structure'] },

  // ── 2. Follow-Up Questions (10 Cases) ────────────────────────────────────
  { id: 'FOL_01', category: 'FOLLOW_UP', query: 'Why were they so large?', history: ['Explain first generation computers.'], expectedDocKeywords: ['first generation', 'vacuum tube', 'large', 'heat', 'size'] },
  { id: 'FOL_02', category: 'FOLLOW_UP', query: 'What memory did they use?', history: ['Tell me about first generation machines.'], expectedDocKeywords: ['first generation', 'magnetic drum', 'punched card', 'vacuum'] },
  { id: 'FOL_03', category: 'FOLLOW_UP', query: 'Can you give some examples of them?', history: ['Explain second generation computers.'], expectedDocKeywords: ['second generation', 'ibm 1401', 'cdc 1604', 'transistor'] },
  { id: 'FOL_04', category: 'FOLLOW_UP', query: 'What programming language did they introduce?', history: ['Explain second generation computers.'], expectedDocKeywords: ['second generation', 'assembly language', 'fortran', 'cobol'] },
  { id: 'FOL_05', category: 'FOLLOW_UP', query: 'What user interfaces did they introduce?', history: ['Tell me about third generation computers.'], expectedDocKeywords: ['third generation', 'keyboard', 'monitor', 'operating system'] },
  { id: 'FOL_06', category: 'FOLLOW_UP', query: 'Why don\'t they cancel each other out?', history: ['What is Newton\'s third law?'], expectedDocKeywords: ['third law', 'action', 'reaction', 'cancel'] },
  { id: 'FOL_07', category: 'FOLLOW_UP', query: 'Do plants perform this at night?', history: ['Explain photosynthesis process.'], expectedDocKeywords: ['photosynthesis', 'night', 'respiration'] },
  { id: 'FOL_08', category: 'FOLLOW_UP', query: 'What happens when its discriminant is zero?', history: ['Explain quadratic equations.'], expectedDocKeywords: ['quadratic', 'discriminant', 'root'] },
  { id: 'FOL_09', category: 'FOLLOW_UP', query: 'adhuku oru real-life example solunga', history: ['Newton third law explain pannu'], expectedDocKeywords: ['third law', 'action', 'reaction', 'rocket'] },
  { id: 'FOL_10', category: 'FOLLOW_UP', query: 've itne bade kyon the?', history: ['Pehli peedhi ke computer samjhaiye.'], expectedDocKeywords: ['first generation', 'vacuum tube', 'large', 'size', 'heat'] },

  // ── 3. Comparative Questions (10 Cases) ──────────────────────────────────
  { id: 'COMP_01', category: 'COMPARATIVE', query: 'What is the difference between first and second generation computers?', expectedDocKeywords: ['first generation', 'second generation', 'vacuum tube', 'transistor'] },
  { id: 'COMP_02', category: 'COMPARATIVE', query: 'Which one was faster, first or second generation?', expectedDocKeywords: ['first generation', 'second generation', 'faster', 'speed'] },
  { id: 'COMP_03', category: 'COMPARATIVE', query: 'Why did transistors replace vacuum tubes?', expectedDocKeywords: ['transistor', 'vacuum tube', 'second generation', 'heat', 'size'] },
  { id: 'COMP_04', category: 'COMPARATIVE', query: 'How is third generation different from second generation?', expectedDocKeywords: ['third generation', 'second generation', 'integrated circuit', 'transistor'] },
  { id: 'COMP_05', category: 'COMPARATIVE', query: 'Compare all computer generations from 1st to 5th.', expectedDocKeywords: ['first', 'second', 'third', 'fourth', 'fifth', 'generation'] },
  { id: 'COMP_06', category: 'COMPARATIVE', query: 'Which generation introduced ICs and keyboards?', expectedDocKeywords: ['third generation', 'integrated circuit', 'keyboard'] },
  { id: 'COMP_07', category: 'COMPARATIVE', query: 'Compare Newton\'s first law with the second law.', expectedDocKeywords: ['first law', 'second law', 'inertia', 'f=ma'] },
  { id: 'COMP_08', category: 'COMPARATIVE', query: 'What is the difference between DNA and RNA?', expectedDocKeywords: ['dna', 'rna', 'thymine', 'uracil'] },
  { id: 'COMP_09', category: 'COMPARATIVE', query: 'Compare stack and queue data structures.', expectedDocKeywords: ['stack', 'queue', 'lifo', 'fifo'] },
  { id: 'COMP_10', category: 'COMPARATIVE', query: 'Compare ionic bonding and covalent bonding.', expectedDocKeywords: ['ionic', 'covalent', 'electron'] },

  // ── 4. Multilingual Questions - Tamil & Hindi (10 Cases) ─────────────────
  { id: 'ML_01', category: 'MULTILINGUAL', query: 'முதல் தலைமுறை கணினிகள் பற்றி விளக்குங்கள்.', expectedDocKeywords: ['first generation', 'vacuum tube'] },
  { id: 'ML_02', category: 'MULTILINGUAL', query: 'இரண்டாம் தலைமுறை கணினிகளின் முக்கிய தொழில்நுட்பம் என்ன?', expectedDocKeywords: ['second generation', 'transistor'] },
  { id: 'ML_03', category: 'MULTILINGUAL', query: 'மூன்றாம் தலைமுறை கணினிகளில் நுண்சுற்றுகள் எவ்வாறு பயன்பட்டன?', expectedDocKeywords: ['third generation', 'integrated circuit'] },
  { id: 'ML_04', category: 'MULTILINGUAL', query: 'நியூட்டனின் மூன்றாவது விதியை விளக்கவும்.', expectedDocKeywords: ['newton', 'third law', 'action', 'reaction'] },
  { id: 'ML_05', category: 'MULTILINGUAL', query: 'ஒளிச்சேர்க்கை என்றால் என்ன? அதன் சமன்பாடு தருக.', expectedDocKeywords: ['photosynthesis', 'glucose', 'chlorophyll'] },
  { id: 'ML_06', category: 'MULTILINGUAL', query: 'पहली पीढ़ी के कंप्यूटर समझाइए।', expectedDocKeywords: ['first generation', 'vacuum tube'] },
  { id: 'ML_07', category: 'MULTILINGUAL', query: 'दूसरी पीढ़ी के कंप्यूटरों में क्या तकनीक इस्तेमाल हुई थी?', expectedDocKeywords: ['second generation', 'transistor'] },
  { id: 'ML_08', category: 'MULTILINGUAL', query: 'न्यूटन का तीसरा गति नियम क्या है?', expectedDocKeywords: ['newton', 'third law', 'action', 'reaction'] },
  { id: 'ML_09', category: 'MULTILINGUAL', query: 'प्रकाश संश्लेषण की परिभाषा और रासायनिक समीकरण क्या है?', expectedDocKeywords: ['photosynthesis', 'glucose'] },
  { id: 'ML_10', category: 'MULTILINGUAL', query: 'डीएनए (DNA) की संरचना क्या है?', expectedDocKeywords: ['dna', 'double helix'] },

  // ── 5. Tanglish Questions (10 Cases) ─────────────────────────────────────
  { id: 'TG_01', category: 'TANGLISH', query: 'first generation computers ah simple ah explain pannu bro', expectedDocKeywords: ['first generation', 'vacuum tube'] },
  { id: 'TG_02', category: 'TANGLISH', query: 'second generation computers la enna technology use pannanga?', expectedDocKeywords: ['second generation', 'transistor'] },
  { id: 'TG_03', category: 'TANGLISH', query: 'third generation computers pathi sollu, ic chips epdi work aachu?', expectedDocKeywords: ['third generation', 'integrated circuit'] },
  { id: 'TG_04', category: 'TANGLISH', query: 'yen first generation computers avlo perusa irundhuchu?', expectedDocKeywords: ['first generation', 'vacuum tube', 'large', 'size', 'heat'] },
  { id: 'TG_05', category: 'TANGLISH', query: 'first generation kum second generation kum enna difference?', expectedDocKeywords: ['first generation', 'second generation', 'vacuum tube', 'transistor'] },
  { id: 'TG_06', category: 'TANGLISH', query: 'Newton oda third law explain pannunga', expectedDocKeywords: ['newton', 'third law', 'action', 'reaction'] },
  { id: 'TG_07', category: 'TANGLISH', query: 'photosynthesis na enna? plants la epdi glucose form aagudhu?', expectedDocKeywords: ['photosynthesis', 'glucose'] },
  { id: 'TG_08', category: 'TANGLISH', query: 'quadratic equation roots epdi kandupidikuradhu?', expectedDocKeywords: ['quadratic', 'discriminant', 'roots'] },
  { id: 'TG_09', category: 'TANGLISH', query: 'mitochondria va yen powerhouse of cell nu solranga?', expectedDocKeywords: ['mitochondria', 'powerhouse', 'atp'] },
  { id: 'TG_10', category: 'TANGLISH', query: 'stack data structure la LIFO principle epdi work aagum?', expectedDocKeywords: ['stack', 'lifo'] },

  // ── 6. Out-Of-Syllabus Questions (10 Cases) ──────────────────────────────
  { id: 'OOS_01', category: 'OUT_OF_SYLLABUS', query: 'What is a GPU and how does it render 3D graphics?', expectedDocKeywords: ['gpu'], isOOS: true },
  { id: 'OOS_02', category: 'OUT_OF_SYLLABUS', query: 'What is quantum computing and qubits?', expectedDocKeywords: ['quantum'], isOOS: true },
  { id: 'OOS_03', category: 'OUT_OF_SYLLABUS', query: 'Explain TCP/IP protocol suite.', expectedDocKeywords: ['tcp/ip'], isOOS: true },
  { id: 'OOS_04', category: 'OUT_OF_SYLLABUS', query: 'What is Docker containerization?', expectedDocKeywords: ['docker'], isOOS: true },
  { id: 'OOS_05', category: 'OUT_OF_SYLLABUS', query: 'What is Kubernetes orchestration?', expectedDocKeywords: ['kubernetes'], isOOS: true },
  { id: 'OOS_06', category: 'OUT_OF_SYLLABUS', query: 'What is blockchain and distributed ledger?', expectedDocKeywords: ['blockchain'], isOOS: true },
  { id: 'OOS_07', category: 'OUT_OF_SYLLABUS', query: 'GPU na enna bro? adhu epdi work aagum?', expectedDocKeywords: ['gpu'], isOOS: true },
  { id: 'OOS_08', category: 'OUT_OF_SYLLABUS', query: 'குவாண்டம் கணினி (Quantum Computer) என்றால் என்ன?', expectedDocKeywords: ['quantum'], isOOS: true },
  { id: 'OOS_09', category: 'OUT_OF_SYLLABUS', query: 'ஜிபியு (GPU) என்றால் என்ன? அது எவ்வாறு இயங்குகிறது?', expectedDocKeywords: ['gpu'], isOOS: true },
  { id: 'OOS_10', category: 'OUT_OF_SYLLABUS', query: 'क्वांटम कंप्यूटिंग क्या है?', expectedDocKeywords: ['quantum'], isOOS: true },
];

export async function runRAGBenchmark() {
  console.log('================================================================');
  console.log('🚀 CLASSPULSE RAG 2.0 ACCURACY & RELIABILITY BENCHMARK SUITE');
  console.log('================================================================');
  console.log(`Evaluating ${BENCHMARK_SUITE.length} realistic benchmark questions...\n`);

  // Index educational corpus and lecture materials into test repository
  const classId = 'COM-BENCHMARK';
  ragRepository.clearClass(classId);

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
    classId,
    'mat_evolution_pdf',
    'Evolution of Computers',
    'Evolution_of_Computers.pdf',
    'prof_test'
  );

  // 2. Add STEM textbook corpus
  for (const doc of EDUCATIONAL_CORPUS) {
    const doubtsText = (doc.frequentlyAskedDoubts || [])
      .map((d) => `Q: ${d.question}\nA: ${d.answer}`)
      .join('\n');
    const docFullText = `${doc.topic}\nSummary: ${doc.summary}\nKey Concepts: ${doc.keyConcepts.join(' ')}\nDetailed Explanation: ${doc.detailedExplanation}\nExamples: ${doc.examples.join(' ')}${doubtsText ? `\nFrequently Asked Doubts: ${doubtsText}` : ''}`;

    const stemChunks = SemanticChunker.chunkDocument(
      [{ pageNumber: 1, text: docFullText }],
      classId,
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

  const pipeline = new RAGPipeline(ragRepository);

  let correctRecall1 = 0;
  let correctRecall3 = 0;
  let sumRR = 0;
  let sumNDCG = 0;
  let correctCitations = 0;
  let wrongDocumentCount = 0;
  let totalEvaluated = 0;

  const failures: Array<{ id: string; query: string; reason: string; retrieved?: string }> = [];

  for (const testCase of BENCHMARK_SUITE) {
    totalEvaluated++;
    const tc = testCase;

    const res = await pipeline.query(tc.query, classId, tc.history || []);

    // Out of Syllabus evaluation
    if (tc.isOOS || tc.category === 'OUT_OF_SYLLABUS') {
      const isCorrectOOS = res.evidenceState === 'NO_EVIDENCE' || !res.sources || res.sources.length === 0;
      if (isCorrectOOS) {
        correctRecall1++;
        correctRecall3++;
        sumRR += 1.0;
        sumNDCG += 1.0;
        correctCitations++;
      } else {
        failures.push({
          id: tc.id,
          query: tc.query,
          reason: `OOS expected NO_EVIDENCE, got state=${res.evidenceState}`,
          retrieved: res.answerText.substring(0, 100),
        });
      }
      continue;
    }

    // In-syllabus evaluation: Check top 3 retrieved candidate chunks
    const topChunks = (res.diagnostics?.finalSelectedChunks || []).slice(0, 3);
    const topChunkText = ((topChunks[0] as any)?.text || topChunks[0]?.snippet || '').toLowerCase();
    const topChunkTitle = (topChunks[0]?.title || '').toLowerCase();

    // Check if expected keywords match in top 1 and top 3
    const matchTop1 = tc.expectedDocKeywords.some((kw) => topChunkText.includes(kw.toLowerCase()) || topChunkTitle.includes(kw.toLowerCase()));
    
    let matchTop3Rank = 0;
    for (let rank = 0; rank < topChunks.length; rank++) {
      const txt = ((topChunks[rank] as any)?.text || topChunks[rank]?.snippet || '').toLowerCase();
      const tit = (topChunks[rank]?.title || '').toLowerCase();
      if (tc.expectedDocKeywords.some((kw) => txt.includes(kw.toLowerCase()) || tit.includes(kw.toLowerCase()))) {
        matchTop3Rank = rank + 1;
        break;
      }
    }

    // Specific Generation Disambiguation: Ensure wrong generation is not returned
    let wrongGenerationReturned = false;
    if (tc.category !== 'COMPARATIVE') {
      const qLower = tc.query.toLowerCase();
      const isAsking2nd = /second\s*generation|2nd\s*generation|இரண்டாம்|दूसरी/i.test(qLower) && !/first|1st|முதல்|पहली/i.test(qLower);
      const isAsking1st = /first\s*generation|1st\s*generation|முதல்|पहली/i.test(qLower) && !/second|2nd|இரண்டாம்|दूसरी/i.test(qLower);

      if (isAsking2nd) {
        if (topChunkText.includes('1. first generation') && !topChunkText.includes('2. second generation')) {
          wrongGenerationReturned = true;
        }
      }
      if (isAsking1st) {
        if (topChunkText.includes('2. second generation') && !topChunkText.includes('1. first generation')) {
          wrongGenerationReturned = true;
        }
      }
    }

    if (wrongGenerationReturned) {
      wrongDocumentCount++;
      failures.push({
        id: tc.id,
        query: tc.query,
        reason: `Wrong Generation Returned: Query asked for specific generation but got opposite`,
        retrieved: topChunkText.substring(0, 100),
      });
    }

    if (matchTop1 && !wrongGenerationReturned) {
      correctRecall1++;
    }

    if (matchTop3Rank > 0 && !wrongGenerationReturned) {
      correctRecall3++;
      sumRR += 1.0 / matchTop3Rank;
      sumNDCG += 1.0 / (Math.log2(matchTop3Rank + 1));
    } else if (!wrongGenerationReturned) {
      failures.push({
        id: tc.id,
        query: tc.query,
        reason: `Expected keywords [${tc.expectedDocKeywords.join(', ')}] missing from top-3 chunks`,
        retrieved: topChunkText.substring(0, 100),
      });
    }

    // Citation accuracy: In-syllabus questions must contain citation
    if (res.sources && res.sources.length > 0) {
      correctCitations++;
    } else {
      failures.push({
        id: tc.id,
        query: tc.query,
        reason: `Missing source citation for in-syllabus query`,
      });
    }
  }

  const recall1 = (correctRecall1 / totalEvaluated) * 100;
  const recall3 = (correctRecall3 / totalEvaluated) * 100;
  const mrr = sumRR / totalEvaluated;
  const ndcg = sumNDCG / totalEvaluated;
  const citationAcc = (correctCitations / totalEvaluated) * 100;
  const wrongDocRate = (wrongDocumentCount / totalEvaluated) * 100;

  console.log('----------------------------------------------------------------');
  console.log('📊 BENCHMARK RESULTS SUMMARY:');
  console.log('----------------------------------------------------------------');
  console.log(`Total Questions Evaluated:  ${totalEvaluated}`);
  console.log(`Recall@1:                   ${recall1.toFixed(1)}%`);
  console.log(`Recall@3:                   ${recall3.toFixed(1)}%`);
  console.log(`MRR (Mean Recip. Rank):     ${mrr.toFixed(3)}`);
  console.log(`nDCG:                       ${ndcg.toFixed(3)}`);
  console.log(`Citation Accuracy:          ${citationAcc.toFixed(1)}%`);
  console.log(`Wrong Document Rate:        ${wrongDocRate.toFixed(1)}%`);
  console.log('----------------------------------------------------------------');

  if (failures.length > 0) {
    console.log(`\n⚠️ Failures (${failures.length}):`);
    for (const f of failures) {
      console.log(`- [${f.id}] "${f.query}" -> ${f.reason} (Retrieved: ${f.retrieved || 'None'})`);
    }
  } else {
    console.log('🎉 ALL 70 BENCHMARK QUESTIONS PASSED WITH ZERO DISAMBIGUATION FAILURES!');
  }

  return {
    totalEvaluated,
    recall1,
    recall3,
    mrr,
    ndcg,
    citationAcc,
    wrongDocRate,
    failures,
  };
}

if (require.main === module) {
  runRAGBenchmark().then(() => process.exit(0)).catch((err) => {
    console.error('Benchmark error:', err);
    process.exit(1);
  });
}

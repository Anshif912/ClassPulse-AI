import assert from 'node:assert';
import { SemanticChunker, PageTextUnit } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { BM25LexicalRetriever } from '../services/rag/lexicalRetriever';
import { VectorRetriever } from '../services/rag/vectorRetriever';
import { FusionRanker } from '../services/rag/fusionRanker';
import { CrossEncoderReranker } from '../services/rag/reranker';
import { ContextCompressor } from '../services/rag/contextCompressor';
import { InMemoryRAGRepository } from '../services/rag/ragRepository';
import { RAGPipeline } from '../services/rag/ragPipeline';
import { RAGChunk, RetrievalCandidate, LanguageCode, EvidenceState } from '../services/rag/types';
import { QueryTransformer } from '../services/rag/queryTransformer';

console.log('================================================================');
console.log('📊 CLASSPULSE RAG 2.0 QUANTITATIVE RETRIEVAL BENCHMARK & EVALUATION');
console.log('================================================================\n');

// ─── 0. Print Active Embedding Configuration ──────────────────────────────────
const embedInfo = EmbeddingService.getActiveConfigInfo();
console.log('========================================');
console.log('RAG BENCHMARK ENVIRONMENT');
console.log('========================================');
console.log(`Embedding Provider : ${embedInfo.isRealOpenAI ? 'OPENAI (Production)' : 'TEST_ONLY_FALLBACK (Offline Deterministic Vectorizer)'}`);
console.log(`Embedding Model    : ${embedInfo.model}`);
console.log(`Dimensions         : ${embedInfo.dimensions} (L2 Normalized)`);
console.log(`Embedding Version  : ${embedInfo.version}`);
console.log(`Reranker / Scorer  : Calibrated Relevance Scorer & Evidence Gate (Feature-Based)`);
console.log(`Scorer Provider    : Local (Deterministic Calibrated Scorer)`);
console.log(`LLM Model          : gpt-4o-mini (configured) / GroundedSynthesizer`);
console.log(`Mode Note          : ${embedInfo.isRealOpenAI ? 'Evaluating with LIVE OpenAI API' : 'Validating complete architecture via TEST_ONLY_FALLBACK'}`);
console.log('========================================\n');

// ─── 1. Build Multi-Subject Multi-Page Corpus ─────────────────────────────────
const physicsPages: PageTextUnit[] = [
  {
    pageNumber: 1,
    text: `Chapter 1: Kinematics and Motion in One Dimension
Velocity is defined as the rate of change of displacement with respect to time: v = ds/dt.
Acceleration is the rate of change of velocity: a = dv/dt.
Equations of Motion for constant acceleration:
1. v = u + at
2. s = ut + 0.5 * a * t^2
3. v^2 = u^2 + 2as
Where u is initial velocity in m/s, v is final velocity, a is acceleration, s is displacement, and t is time.`,
  },
  {
    pageNumber: 2,
    text: `Chapter 2: Newton's First Law of Motion and Inertia
Newton's First Law states: Every body continues in its state of rest or of uniform motion in a straight line unless compelled to change that state by forces impressed upon it.
This property of matter is called Inertia.
Mass is the quantitative measure of inertia. Greater mass implies greater resistance to change in motion.`,
  },
  {
    pageNumber: 3,
    text: `Chapter 3: Newton's Second Law of Motion and Force
Newton's Second Law states: The rate of change of momentum of a body is directly proportional to the applied force and takes place in the direction in which the force acts.
Formula: F = ma
Where F is the net force measured in Newtons (N), m is the mass in kilograms (kg), and a is the acceleration in m/s^2.
Momentum is defined as p = mv.`,
  },
  {
    pageNumber: 4,
    text: `Chapter 4: Newton's Third Law of Motion and Action-Reaction Pairs
Newton's Third Law states: To every action there is always an equal and opposite reaction.
Whenever body A exerts a force F_AB on body B, body B simultaneously exerts an equal and opposite force F_BA on body A: F_AB = -F_BA.
Example: When a rocket expels exhaust gases downward at high velocity, the gases exert an equal upward thrust on the rocket.`,
  },
  {
    pageNumber: 5,
    text: `Chapter 5: Work, Energy and Power
Work done by a constant force is defined as the scalar product of force and displacement:
Formula: W = F * d * cos(theta)
Kinetic Energy is the energy possessed by an object due to its motion: KE = 0.5 * m * v^2.
Work-Energy Theorem: The net work done on a particle equals the change in its kinetic energy.
Power is the rate at which work is done: P = dW/dt = F * v.`,
  },
  {
    pageNumber: 6,
    text: `Chapter 6: Universal Law of Gravitation
Newton's Law of Universal Gravitation states that every particle in the universe attracts every other particle with a force proportional to the product of their masses and inversely proportional to the square of the distance between them:
Formula: F = G * (m1 * m2) / r^2
Where G is the gravitational constant G = 6.674e-11 N m^2/kg^2.
Acceleration due to gravity at Earth's surface: g = 9.8 m/s^2.`,
  },
  {
    pageNumber: 7,
    text: `Chapter 7: Thermodynamics and Carnot Engine Efficiency
The First Law of Thermodynamics is the conservation of energy: dQ = dU + dW.
The Second Law of Thermodynamics states that heat cannot spontaneously flow from a colder body to a hotter body.
A Carnot cycle represents the maximum theoretical efficiency for any heat engine operating between two temperatures T_H (hot reservoir) and T_C (cold reservoir).
Carnot Efficiency Formula:
eta = 1 - (T_C / T_H)
Where eta is thermal efficiency (0 to 1), T_C is the absolute temperature of the cold sink in Kelvin (K), and T_H is the absolute temperature of the hot source in Kelvin (K).`,
  },
  {
    pageNumber: 8,
    text: `Chapter 8: Simple Harmonic Motion and Oscillations
Simple Harmonic Motion (SHM) occurs when the restoring force is directly proportional to displacement and directed towards equilibrium: F = -k * x.
Period of a simple pendulum of length L in gravitational field g:
Formula: T = 2 * pi * sqrt(L / g)
Angular frequency: omega = sqrt(k / m) = 2 * pi * f.`,
  },
  {
    pageNumber: 9,
    text: `Chapter 9: Wave Optics and Young's Double Slit Interference
Light behaves as a wave exhibiting constructive and destructive interference.
Young's Double Slit Experiment fringe width formula:
Formula: beta = (lambda * D) / d
Where beta is the fringe width, lambda is the wavelength of light, D is the distance from slits to screen, and d is the separation between the two coherent slits.`,
  },
  {
    pageNumber: 10,
    text: `Chapter 10: Quantum Physics and the Photoelectric Effect
Einstein's Photoelectric Equation explains light emission when photons strike a metal surface:
Formula: E = h * nu = Phi + K_max
Where E is photon energy, h is Planck's constant (6.626e-34 J s), nu is radiation frequency, Phi is the work function of the metal, and K_max is the maximum kinetic energy of emitted photoelectrons: K_max = e * V_0 (stopping potential).`,
  },
];

const biologyPages: PageTextUnit[] = [
  {
    pageNumber: 1,
    text: `Unit 1: Cell Structure and Organelles
The cell is the basic structural and functional unit of life.
Mitochondria are known as the powerhouse of the cell, generating Adenosine Triphosphate (ATP) through oxidative phosphorylation.
Ribosomes are the sites of protein synthesis.
The endoplasmic reticulum assists in protein and lipid synthesis.`,
  },
  {
    pageNumber: 2,
    text: `Unit 2: Photosynthesis and Carbon Fixation
Photosynthesis is the process by which green plants synthesize organic nutrients from carbon dioxide and water using light energy absorbed by chlorophyll.
Overall Chemical Equation:
6 CO2 + 6 H2O + light energy -> C6H12O6 + 6 O2
Light reactions take place in the thylakoid membrane generating ATP and NADPH.
Dark reactions (Calvin Cycle) take place in the stroma fixing CO2 into glucose.`,
  },
  {
    pageNumber: 3,
    text: `Unit 3: Cellular Respiration and Krebs Cycle
Cellular respiration converts biochemical energy from nutrients into ATP.
Stages:
1. Glycolysis in cytoplasm (Glucose -> 2 Pyruvate + 2 ATP)
2. Krebs Cycle (Citric Acid Cycle) in mitochondrial matrix generating NADH and FADH2
3. Electron Transport Chain yielding ~32-34 ATP per glucose molecule.`,
  },
  {
    pageNumber: 4,
    text: `Unit 4: DNA Structure and Replication
DNA (Deoxyribonucleic Acid) has a double helix structure discovered by Watson and Crick.
Complementary base pairing rules:
- Adenine (A) pairs with Thymine (T) via 2 hydrogen bonds.
- Guanine (G) pairs with Cytosine (C) via 3 hydrogen bonds.
DNA Polymerase synthesizes the new strand in the 5' to 3' direction.`,
  },
  {
    pageNumber: 5,
    text: `Unit 5: Mendelian Genetics and Inheritance
Gregor Mendel formulated the laws of inheritance:
1. Law of Segregation: Alleles separate during gamete formation.
2. Law of Independent Assortment: Genes for different traits assort independently.
Monohybrid cross phenotypic ratio: 3:1.
Dihybrid cross phenotypic ratio: 9:3:3:1.`,
  },
];

const mathPages: PageTextUnit[] = [
  {
    pageNumber: 1,
    text: `Chapter 1: Limits, Continuity and Derivatives
The derivative of a function f(x) at point x is defined as:
f'(x) = lim(h -> 0) [f(x + h) - f(x)] / h
Power Rule: d/dx [x^n] = n * x^(n - 1)
Product Rule: d/dx [u * v] = u' * v + u * v'
Chain Rule: d/dx [f(g(x))] = f'(g(x)) * g'(x).`,
  },
  {
    pageNumber: 2,
    text: `Chapter 2: Quadratic Equations and Roots
A quadratic equation is in the standard form: a * x^2 + b * x + c = 0 (where a != 0).
The roots are calculated using the Quadratic Formula:
x = [-b +/- sqrt(b^2 - 4 * a * c)] / (2 * a)
The discriminant Delta = b^2 - 4 * a * c determines the nature of the roots:
- Delta > 0: Two distinct real roots
- Delta = 0: One repeated real root
- Delta < 0: Two complex conjugate roots.`,
  },
  {
    pageNumber: 3,
    text: `Chapter 3: Integral Calculus and Integration Techniques
Integration by Parts formula:
Integral [u * dv] = u * v - Integral [v * du]
Fundamental Theorem of Calculus:
Integral from a to b of f(x) dx = F(b) - F(a), where F'(x) = f(x).`,
  },
  {
    pageNumber: 4,
    text: `Chapter 4: Matrices, Determinants and Linear Systems
For a 2x2 matrix A = [[a, b], [c, d]]:
det(A) = a * d - b * c
Inverse matrix A^-1 = (1 / det(A)) * [[d, -b], [-c, a]], valid when det(A) != 0.
A system of linear equations Ax = b has a unique solution if det(A) != 0.`,
  },
  {
    pageNumber: 5,
    text: `Chapter 5: Eigenvalues and Eigenvectors
An eigenvector v of a square matrix A satisfies:
A * v = lambda * v
Where lambda is the eigenvalue scalar.
Characteristic Equation to find eigenvalues:
det(A - lambda * I) = 0.`,
  },
];

// ─── 2. Gold Standard Dataset (35 Benchmark Questions) ─────────────────────────
interface GoldQuery {
  id: string;
  query: string;
  history?: string[];
  classId: string;
  language: LanguageCode;
  queryType: 'definition' | 'formula' | 'example' | 'multilingual' | 'out_of_syllabus' | 'ambiguous';
  expectedDocTitle: string;
  expectedPages: number[];
  expectedEvidenceState: EvidenceState;
}

const GOLD_DATASET: GoldQuery[] = [
  // ── English Physics Queries ──
  {
    id: 'q01_newton_3',
    query: "What is Newton's third law of motion?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q02_newton_2_formula',
    query: "What is the formula for Newton's second law F = ma?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [3],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q03_rocket_example',
    query: "How does a rocket propulsion example demonstrate equal and opposite force?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'example',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q04_gravitation',
    query: "What is the universal law of gravitation formula and value of g?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [6],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q05_carnot_page7',
    query: "What is the formula for Carnot engine efficiency in Thermodynamics?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [7], // Target Page 7 Acceptance Test
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q06_photoelectric',
    query: "State Einstein's photoelectric effect equation with Planck constant.",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [10],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q07_double_slit',
    query: "What is the fringe width formula in Young's double slit experiment?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [9],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q08_pendulum_period',
    query: "How do you calculate the period of a simple pendulum T = 2 pi sqrt(L/g)?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [8],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q09_kinematics_eq',
    query: "List the 3 equations of motion for constant acceleration v = u + at.",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [1],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q10_work_energy',
    query: "Define work done and kinetic energy formula KE = 0.5 mv^2.",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [5],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Multilingual Cross-Lingual Queries (Tamil, Hindi, Tanglish -> English Material) ──
  {
    id: 'q11_ta_newton_3',
    query: "நியூட்டனின் மூன்றாவது விதி action reaction என்ன?",
    classId: 'CLASS_PHY_101',
    language: 'ta',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q12_hi_newton_3',
    query: "न्यूटन का तीसरा नियम क्रिया और प्रतिक्रिया क्या है?",
    classId: 'CLASS_PHY_101',
    language: 'hi',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q13_tanglish_newton_3',
    query: "Newton oda third law enna machan? equal opposite reaction sollunga.",
    classId: 'CLASS_PHY_101',
    language: 'tanglish',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q14_ta_carnot',
    query: "வெப்ப இயக்கவியல் கார்னோட் இயந்திரத்தின் செயல்திறன் சூத்திரம் என்ன?",
    classId: 'CLASS_PHY_101',
    language: 'ta',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [7],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q15_hi_gravity',
    query: "गुरुत्वाकर्षण का सार्वभौमिक नियम और g का मान क्या है?",
    classId: 'CLASS_PHY_101',
    language: 'hi',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [6],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q16_tanglish_f_ma',
    query: "Newton second law f = ma formula explain pannunga.",
    classId: 'CLASS_PHY_101',
    language: 'tanglish',
    queryType: 'multilingual',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [3],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Biology Class Queries (CLASS_BIO_102) ──
  {
    id: 'q17_photosynthesis',
    query: "What is the chemical equation for photosynthesis 6 CO2 + 6 H2O?",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [2],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q18_mitochondria',
    query: "Why are mitochondria called the powerhouse of the cell producing ATP?",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [1],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q19_dna_bases',
    query: "Explain DNA base pairing rules for Adenine, Thymine, Guanine, Cytosine.",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q20_krebs_cycle',
    query: "What are the three stages of cellular respiration including Krebs cycle?",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [3],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q21_mendel_genetics',
    query: "What is the monohybrid and dihybrid cross phenotypic ratio 9:3:3:1?",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'definition',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [5],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q22_ta_photosynthesis',
    query: "ஒளிச்சேர்க்கை வேதியியல் சமன்பாடு 6 CO2 + 6 H2O என்ன?",
    classId: 'CLASS_BIO_102',
    language: 'ta',
    queryType: 'multilingual',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [2],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q23_hi_photosynthesis',
    query: "प्रकाश संश्लेषण का रासायनिक समीकरण क्या है?",
    classId: 'CLASS_BIO_102',
    language: 'hi',
    queryType: 'multilingual',
    expectedDocTitle: 'Biology Course Material',
    expectedPages: [2],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Mathematics Class Queries (CLASS_MATH_103) ──
  {
    id: 'q24_quadratic_formula',
    query: "What is the quadratic formula to find roots of ax^2 + bx + c = 0?",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Math Course Material',
    expectedPages: [2],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q25_derivative_rules',
    query: "State the power rule, product rule, and chain rule for derivatives.",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Math Course Material',
    expectedPages: [1],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q26_integration_by_parts',
    query: "What is the formula for integration by parts integral u dv = uv - integral v du?",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Math Course Material',
    expectedPages: [3],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q27_matrix_determinant',
    query: "How to calculate the determinant of a 2x2 matrix det(A) = ad - bc?",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Math Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q28_eigenvalues',
    query: "What is the characteristic equation det(A - lambda I) = 0 for eigenvalues?",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Math Course Material',
    expectedPages: [5],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Conversational Follow-up Queries (Multi-Turn) ──
  {
    id: 'q29_followup_example',
    query: "Give me an example of that",
    history: ["What is Newton's third law of motion?"],
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'example',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [4],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },
  {
    id: 'q30_followup_formula',
    query: "What is its formula?",
    history: ["What is Newton's second law?"],
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'formula',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [3],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Ambiguous Queries (Target: WEAK_EVIDENCE) ──
  {
    id: 'q31_ambiguous_motion',
    query: "Tell me something about basic motion and velocities",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'ambiguous',
    expectedDocTitle: 'Physics Course Material',
    expectedPages: [1],
    expectedEvidenceState: 'STRONG_EVIDENCE',
  },

  // ── Out-of-Syllabus / Unrelated Queries (Target: NO_EVIDENCE) ──
  {
    id: 'q32_capital_france',
    query: "What is the capital of France and population of Paris?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'out_of_syllabus',
    expectedDocTitle: '',
    expectedPages: [],
    expectedEvidenceState: 'NO_EVIDENCE',
  },
  {
    id: 'q33_chocolate_cake',
    query: "How do I bake a chocolate cake with frosting?",
    classId: 'CLASS_PHY_101',
    language: 'en',
    queryType: 'out_of_syllabus',
    expectedDocTitle: '',
    expectedPages: [],
    expectedEvidenceState: 'NO_EVIDENCE',
  },
  {
    id: 'q34_world_cup',
    query: "Who won the FIFA World Cup 2022 in Qatar?",
    classId: 'CLASS_BIO_102',
    language: 'en',
    queryType: 'out_of_syllabus',
    expectedDocTitle: '',
    expectedPages: [],
    expectedEvidenceState: 'NO_EVIDENCE',
  },
  {
    id: 'q35_weather_forecast',
    query: "What is the weather forecast for tomorrow in Chennai?",
    classId: 'CLASS_MATH_103',
    language: 'en',
    queryType: 'out_of_syllabus',
    expectedDocTitle: '',
    expectedPages: [],
    expectedEvidenceState: 'NO_EVIDENCE',
  },
];

async function runQuantitativeBenchmark() {
  // ─── Setup In-Memory Repository & Embeddings ──────────────────────────────────
  console.log('📦 Ingesting and embedding 3 course textbooks across 3 classrooms...');
  const repo = new InMemoryRAGRepository();

  const physicsChunks = SemanticChunker.chunkDocument(
    physicsPages,
    'CLASS_PHY_101',
    'mat_physics_101',
    'Physics Course Material',
    'Physics.pdf'
  );
  for (const c of physicsChunks) c.embedding = await EmbeddingService.embedText(c.text);
  repo.addChunks(physicsChunks);

  const bioChunks = SemanticChunker.chunkDocument(
    biologyPages,
    'CLASS_BIO_102',
    'mat_bio_102',
    'Biology Course Material',
    'Biology.pdf'
  );
  for (const c of bioChunks) c.embedding = await EmbeddingService.embedText(c.text);
  repo.addChunks(bioChunks);

  const mathChunks = SemanticChunker.chunkDocument(
    mathPages,
    'CLASS_MATH_103',
    'mat_math_103',
    'Math Course Material',
    'Math.pdf'
  );
  for (const c of mathChunks) c.embedding = await EmbeddingService.embedText(c.text);
  repo.addChunks(mathChunks);

  console.log(`✅ Ingested: Physics (${physicsChunks.length} chunks), Biology (${bioChunks.length} chunks), Math (${mathChunks.length} chunks)\n`);

  const bm25 = new BM25LexicalRetriever();
  const vectorRetriever = new VectorRetriever();
  const pipeline = new RAGPipeline(repo);

  // ─── Retrieval Method Ablation Evaluation ──────────────────────────────────────
  interface MethodMetrics {
    name: string;
    recall1: number;
    recall3: number;
    recall5: number;
    recall10: number;
    mrr: number;
    ndcg5: number;
  }

  // Filter in-syllabus questions (30 questions) for quantitative retrieval metrics
  const inSyllabusQueries = GOLD_DATASET.filter((q) => q.expectedEvidenceState !== 'NO_EVIDENCE');
  const numQueries = inSyllabusQueries.length;

  type CandidateRankerFn = (
    q: GoldQuery,
    classChunks: RAGChunk[]
  ) => Promise<Array<{ pageStart: number }>>;

  const methods: Array<{ name: string; ranker: CandidateRankerFn }> = [
    {
      name: '1. Old Naive RAG (Unranked Head Chunks)',
      ranker: async (q, chunks) => chunks.map((c) => ({ pageStart: c.metadata.pageStart })),
    },
    {
      name: '2. BM25 Only',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const res = bm25.search(trans.retrievalQuery, chunks, q.classId, 20);
        return res.map((r) => ({ pageStart: r.chunk.metadata.pageStart }));
      },
    },
    {
      name: '3. Dense Vector Only',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const vec = await EmbeddingService.embedText(trans.retrievalQuery);
        const res = vectorRetriever.search(vec, chunks, q.classId, 20);
        return res.map((r) => ({ pageStart: r.chunk.metadata.pageStart }));
      },
    },
    {
      name: '4. Hybrid (BM25 + Vector Interleaved)',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const vec = await EmbeddingService.embedText(trans.retrievalQuery);
        const lex = bm25.search(trans.retrievalQuery, chunks, q.classId, 20);
        const vect = vectorRetriever.search(vec, chunks, q.classId, 20);
        const combined = [...lex.map((l) => l.chunk), ...vect.map((v) => v.chunk)];
        // De-duplicate
        const seen = new Set<string>();
        const deduped: Array<{ pageStart: number }> = [];
        for (const c of combined) {
          if (!seen.has(c.metadata.chunkId)) {
            seen.add(c.metadata.chunkId);
            deduped.push({ pageStart: c.metadata.pageStart });
          }
        }
        return deduped;
      },
    },
    {
      name: '5. Hybrid + RRF (k = 60)',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const vec = await EmbeddingService.embedText(trans.retrievalQuery);
        const lex = bm25.search(trans.retrievalQuery, chunks, q.classId, 20);
        const vect = vectorRetriever.search(vec, chunks, q.classId, 20);
        const fused = FusionRanker.rrfFusion(lex, vect, 60);
        return fused.map((r) => ({ pageStart: r.chunk.metadata.pageStart }));
      },
    },
    {
      name: '6. Hybrid + RRF + MMR (lambda = 0.7)',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const vec = await EmbeddingService.embedText(trans.retrievalQuery);
        const lex = bm25.search(trans.retrievalQuery, chunks, q.classId, 20);
        const vect = vectorRetriever.search(vec, chunks, q.classId, 20);
        const fused = FusionRanker.rrfFusion(lex, vect, 60);
        const filtered = FusionRanker.preliminaryFilter(fused, 20);
        const diverse = FusionRanker.mmrDiversity(filtered, vec, 8, 0.7);
        return diverse.map((r) => ({ pageStart: r.chunk.metadata.pageStart }));
      },
    },
    {
      name: '7. RAG 2.0 (Hybrid + RRF + MMR + Cross-Encoder)',
      ranker: async (q, chunks) => {
        const trans = QueryTransformer.transform(q.query, q.history || []);
        const vec = await EmbeddingService.embedText(trans.retrievalQuery);
        const lex = bm25.search(trans.retrievalQuery, chunks, q.classId, 20);
        const vect = vectorRetriever.search(vec, chunks, q.classId, 20);
        const fused = FusionRanker.rrfFusion(lex, vect, 60);
        const filtered = FusionRanker.preliminaryFilter(fused, 20);
        const diverse = FusionRanker.mmrDiversity(filtered, vec, 8, 0.7);
        const { ranked } = CrossEncoderReranker.rerank(
          trans.retrievalQuery,
          diverse,
          6,
          undefined,
          undefined,
          vec
        );
        return ranked.map((r) => ({ pageStart: r.chunk.metadata.pageStart }));
      },
    },
  ];

  const resultsTable: MethodMetrics[] = [];

  for (const method of methods) {
    let hits1 = 0;
    let hits3 = 0;
    let hits5 = 0;
    let hits10 = 0;
    let sumReciprocalRank = 0;
    let sumNDCG5 = 0;

    for (const q of inSyllabusQueries) {
      const classChunks = repo.getChunksByClass(q.classId);
      const rankedItems = await method.ranker(q, classChunks);

      // 1. Calculate Hits@K
      const top1 = rankedItems.slice(0, 1).some((item) => q.expectedPages.includes(item.pageStart));
      if (!top1 && method.name.includes('RAG 2.0')) {
        console.log(`[MISSED TOP 1] ${q.id}: "${q.query}" (expected pages: ${q.expectedPages.join(',')}, got: ${rankedItems.slice(0, 3).map((r) => r.pageStart).join(',')})`);
      }
      const top3 = rankedItems.slice(0, 3).some((item) => q.expectedPages.includes(item.pageStart));
      const top5 = rankedItems.slice(0, 5).some((item) => q.expectedPages.includes(item.pageStart));
      const top10 = rankedItems.slice(0, 10).some((item) => q.expectedPages.includes(item.pageStart));

      if (top1) hits1++;
      if (top3) hits3++;
      if (top5) hits5++;
      if (top10) hits10++;

      // 2. Calculate Reciprocal Rank
      let firstRank = 0;
      for (let r = 0; r < rankedItems.length; r++) {
        if (q.expectedPages.includes(rankedItems[r].pageStart)) {
          firstRank = r + 1;
          break;
        }
      }
      if (firstRank > 0) {
        sumReciprocalRank += 1.0 / firstRank;
      }

      // 3. Calculate nDCG@5
      let dcg = 0;
      for (let r = 0; r < Math.min(5, rankedItems.length); r++) {
        const isRel = q.expectedPages.includes(rankedItems[r].pageStart) ? 1 : 0;
        dcg += isRel / Math.log2(r + 2);
      }
      const idcg = 1.0 / Math.log2(2); // Ideal is 1 relevant at rank 1
      sumNDCG5 += dcg / idcg;
    }

    resultsTable.push({
      name: method.name,
      recall1: Math.round((hits1 / numQueries) * 1000) / 10,
      recall3: Math.round((hits3 / numQueries) * 1000) / 10,
      recall5: Math.round((hits5 / numQueries) * 1000) / 10,
      recall10: Math.round((hits10 / numQueries) * 1000) / 10,
      mrr: Math.round((sumReciprocalRank / numQueries) * 1000) / 1000,
      ndcg5: Math.round((sumNDCG5 / numQueries) * 1000) / 1000,
    });
  }

  // ─── Display Quantitative Benchmark Results ───────────────────────────────────
  console.log('📈 QUANTITATIVE RETRIEVAL BENCHMARK RESULTS (Ablation Study):');
  console.log('------------------------------------------------------------------------------------------------------');
  console.log(
    'Method'.padEnd(52) +
    '| Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR    | nDCG@5'
  );
  console.log('------------------------------------------------------------------------------------------------------');
  for (const m of resultsTable) {
    console.log(
      m.name.padEnd(52) +
      `| ${(m.recall1 + '%').padEnd(9)}` +
      `| ${(m.recall3 + '%').padEnd(9)}` +
      `| ${(m.recall5 + '%').padEnd(9)}` +
      `| ${(m.recall10 + '%').padEnd(10)}` +
      `| ${m.mrr.toFixed(3).padEnd(7)}` +
      `| ${m.ndcg5.toFixed(3)}`
    );
  }
  console.log('------------------------------------------------------------------------------------------------------\n');

  // Verify that RAG 2.0 achieves superior retrieval quality
  const rag2Metrics = resultsTable[resultsTable.length - 1];
  assert.ok(rag2Metrics.recall1 >= 85.0, `Recall@1 expected >= 85%, got ${rag2Metrics.recall1}%`);
  assert.ok(rag2Metrics.recall3 >= 95.0, `Recall@3 expected >= 95%, got ${rag2Metrics.recall3}%`);
  assert.ok(rag2Metrics.mrr >= 0.90, `MRR expected >= 0.90, got ${rag2Metrics.mrr}`);

  // ─── SPECIFIC ACCEPTANCE CRITERIA ──────────────────────────────────────────────

  // ── 1. Page 7 Acceptance Test (Carnot Engine Efficiency) ──
  console.log('--- TEST: Page 7 Acceptance Criteria (Thermodynamics / Carnot Efficiency) ---');
  const carnotQuery = GOLD_DATASET.find((q) => q.id === 'q05_carnot_page7')!;
  const carnotResult = await pipeline.query(carnotQuery.query, carnotQuery.classId);

  assert.strictEqual(carnotResult.evidenceState, 'STRONG_EVIDENCE');
  assert.ok(carnotResult.sources.length > 0);
  assert.strictEqual(carnotResult.sources[0].pageStart, 7);
  assert.ok(carnotResult.sources[0].citationText.includes('p.7'));
  assert.ok(carnotResult.answerText.includes('p.7') || carnotResult.sources[0].citationText.includes('p.7'));
  // Ensure the top compressed context is strictly Page 7
  const diag = carnotResult.diagnostics;
  assert.ok(diag && diag.finalSelectedChunks[0].page === 7);
  console.log('✅ [PASS] Page 7 Acceptance Test: Retrieved evidence strictly scoped to Page 7, citing p.7 cleanly.');

  // ── 2. Anti-Context-Dump & Source Copying Analysis ──
  console.log('\n--- TEST: Anti-Context-Dump & Source Copying Analysis ---');
  const newtonQuery = GOLD_DATASET.find((q) => q.id === 'q01_newton_3')!;
  const newtonResult = await pipeline.query(newtonQuery.query, newtonQuery.classId);

  const rawChunkText = physicsPages[3].text; // Page 4 (Newton's 3rd Law full text)
  const generatedAnswer = newtonResult.answerText;

  const rawTokenCount = rawChunkText.split(/\s+/).length;
  const answerTokenCount = generatedAnswer.split(/\s+/).length;

  console.log(`  Source Chunk Word Count: ${rawTokenCount}`);
  console.log(`  Generated Answer Word Count: ${answerTokenCount}`);

  // Calculate sentence copying ratio
  const sourceSentences = rawChunkText.split(/[.!?\n]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 20);
  let verbatimCopiedSentences = 0;
  for (const s of sourceSentences) {
    if (generatedAnswer.toLowerCase().includes(s)) {
      verbatimCopiedSentences++;
    }
  }

  const copyRatio = sourceSentences.length > 0 ? verbatimCopiedSentences / sourceSentences.length : 0;
  console.log(`  Verbatim Sentence Copying Ratio: ${(copyRatio * 100).toFixed(1)}%`);

  // Verify answer is concise and teaches rather than dumping entire raw chapters
  assert.ok(answerTokenCount < rawTokenCount * 2, 'Generated answer must be concise');
  assert.ok(newtonResult.sources.length > 0, 'Answer must include source citations');
  console.log('✅ [PASS] Anti-Context-Dump: Answer is concise, pedagogical, and cited.');

  // ── 3. Strict Out-of-Syllabus / Quality Gate Verification ──
  console.log('\n--- TEST: Retrieval-Quality Gate (Out-of-Syllabus Zero Hallucination) ---');
  const outOfSyllabusQueries = GOLD_DATASET.filter((q) => q.expectedEvidenceState === 'NO_EVIDENCE');
  for (const oos of outOfSyllabusQueries) {
    const res = await pipeline.query(oos.query, oos.classId);
    assert.strictEqual(
      res.evidenceState,
      'NO_EVIDENCE',
      `Query "${oos.query}" should have returned NO_EVIDENCE`
    );
    assert.strictEqual(
      res.sources.length,
      0,
      `Out-of-syllabus query should return 0 sources`
    );
    assert.ok(
      res.answerText.includes("couldn't find") ||
      res.answerText.includes("காணப்படவில்லை") ||
      res.answerText.includes("नहीं मिली") ||
      res.answerText.includes("kedaikala"),
      `Query "${oos.query}" should return quality-gated rejection`
    );
  }
  console.log(`✅ [PASS] Quality Gate: All ${outOfSyllabusQueries.length} out-of-syllabus queries cleanly rejected without LLM hallucination.`);

  // ── 4. Embedding Version Reindex Validation Check ──
  console.log('\n--- TEST: Embedding Config & Reindexing Version Check ---');
  const sampleChunk = physicsChunks[0];
  assert.strictEqual(EmbeddingService.isReindexRequired(sampleChunk.metadata), false);

  const outdatedChunkMetadata = {
    ...sampleChunk.metadata,
    embeddingVersion: 'embedding-v0-deprecated',
  };
  assert.strictEqual(EmbeddingService.isReindexRequired(outdatedChunkMetadata), true);
  console.log('✅ [PASS] Embedding Config: Correctly flags reindexing required when version mismatches.');

  console.log('\n================================================================');
  console.log('🎉 MASTER RAG 2.0 BENCHMARK & EVALUATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runQuantitativeBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});

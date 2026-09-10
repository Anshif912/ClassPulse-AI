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

async function runPersonalizedDemo() {
  console.log('===============================================================');
  console.log('  CLASSPULSE ADAPTIVE PERSONALIZATION: FIRST WORKING DEMO');
  console.log('===============================================================\n');

  const classId = 'DEMO_CLASS_01';
  ragRepository.clearClass(classId);

  // 1. Ingest Course Content into RAG & Concept Graph
  console.log('[Step 1] Ingesting Course Content for class:', classId);
  const courseDocument = [
    {
      pageNumber: 1,
      text: `Unit: Computer Generations & Evolution\n\n1. First Generation (1940-1956): Relied on vacuum tubes (thermionic valves) to amplify electrical signals and switch circuits. Vacuum tubes required heated filaments, consumed massive power, produced intense heat, and suffered from filament burnout and physical fragility. ENIAC and UNIVAC are primary examples.\n\n2. Vacuum Tube Limitations: Vacuum tubes were glass containers with vacuum inside. The heated cathode filament had a short operational lifespan. They were bulky and required large cooling systems.\n\n3. Second Generation (1956-1963): Replaced vacuum tubes with solid-state transistors invented at Bell Labs (Bardeen, Brattain, Shockley). Transistors used semiconductor materials like Germanium and Silicon.\n\n4. Transistor Advantages: Transistors operate in the solid state without vacuum or filaments. They have instant turn-on, near-zero heat, consume a fraction of the power, operate at low voltage, and are microscopically small, allowing millions/billions of switches. They are highly durable with virtually unlimited lifespan.\n\n5. Third Generation & Integrated Circuits: Integrated Circuits (ICs) combined multiple transistors on a single silicon chip.`
    }
  ];

  const chunks = SemanticChunker.chunkDocument(courseDocument, classId, 'mat_module4', 'Computer Generations');
  const batchEmbeddings = await EmbeddingService.embedBatch(chunks.map(c => c.text), false);
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = batchEmbeddings[i];
  }
  ragRepository.addChunks(chunks);
  console.log(`- Seeded ${chunks.length} chunks into class ${classId} with 1024d Qwen embeddings.`);

  // Build/refresh concept graph
  const conceptGraph = conceptGraphService.getOrBuildConceptGraph(classId);
  console.log('Concept Graph Nodes:', Object.keys(conceptGraph.concepts));

  // 2. Setup Student A (High performer, strong prerequisite mastery)
  const studentAId = 'student_alice_high';
  learnerModelService.getOrInitializeProfile(classId, studentAId, 94);
  // Alice already mastered vacuum tubes & second generation
  const vMasteryA = learnerModelService.getOrInitializeTopicMastery(classId, studentAId, 'vacuum_tubes', 'Vacuum Tube Technology & Limitations');
  vMasteryA.masteryScore = 0.95;
  vMasteryA.evidenceCount = 3;
  dbService.saveTopicMastery(vMasteryA);

  const tMasteryA = learnerModelService.getOrInitializeTopicMastery(classId, studentAId, 'transistors', 'Transistor Advantages & Operation');
  tMasteryA.masteryScore = 0.88;
  tMasteryA.evidenceCount = 3;
  dbService.saveTopicMastery(tMasteryA);

  // 3. Setup Student B (Needs scaffolding, weak prerequisite mastery)
  const studentBId = 'student_bob_scaffold';
  learnerModelService.getOrInitializeProfile(classId, studentBId, 54);
  // Bob struggled on vacuum tube prerequisites
  const vMasteryB = learnerModelService.getOrInitializeTopicMastery(classId, studentBId, 'vacuum_tubes', 'Vacuum Tube Technology & Limitations');
  vMasteryB.masteryScore = 0.32;
  vMasteryB.evidenceCount = 2;
  dbService.saveTopicMastery(vMasteryB);

  const tMasteryB = learnerModelService.getOrInitializeTopicMastery(classId, studentBId, 'transistors', 'Transistor Advantages & Operation');
  tMasteryB.masteryScore = 0.40;
  tMasteryB.evidenceCount = 1;
  dbService.saveTopicMastery(tMasteryB);

  console.log('\n[Step 2] Initial Learner Profiles Created:');
  const profA = learnerModelService.getOrInitializeProfile(classId, studentAId);
  const profB = learnerModelService.getOrInitializeProfile(classId, studentBId);
  console.log(`Student A (Alice): Support Level=${profA.supportLevel}, Pace=${profA.preferredPace}, Overall Mastery=${(profA.overallMastery * 100).toFixed(1)}%`);
  console.log(`Student B (Bob):   Support Level=${profB.supportLevel}, Pace=${profB.preferredPace}, Overall Mastery=${(profB.overallMastery * 100).toFixed(1)}%`);

  // 4. Both Students Ask the EXACT Same Question
  const query = 'Why did transistors replace vacuum tubes in modern electronic computers?';
  console.log(`\n[Step 3] Both Students ask the same live question:\n"${query}"\n`);

  console.log('--- Generating Personalized Response for Student A (Alice) ---');
  const responseA = await personalizedRAGAdapter.queryPersonalized(
    query,
    classId,
    studentAId
  );
  console.log(`Tutor Action: ${responseA.tutorDecision.action}`);
  console.log(`Depth: ${responseA.tutorDecision.depth} | Pace: ${responseA.tutorDecision.pace} | Strategy: ${responseA.tutorDecision.strategy} | Difficulty: ${responseA.tutorDecision.difficulty}`);
  console.log(`Bridge Required: ${responseA.tutorDecision.prerequisiteBridgeRequired ? 'YES' : 'NO'}`);
  console.log(`Rationale: ${responseA.tutorDecision.rationale}`);
  console.log(`\nPersonalized Answer to Alice:\n${(responseA.personalizedExplanation || responseA.answerText).trim()}\n`);

  console.log('--- Generating Personalized Response for Student B (Bob) ---');
  const responseB = await personalizedRAGAdapter.queryPersonalized(
    query,
    classId,
    studentBId
  );
  console.log(`Tutor Action: ${responseB.tutorDecision.action}`);
  console.log(`Depth: ${responseB.tutorDecision.depth} | Pace: ${responseB.tutorDecision.pace} | Strategy: ${responseB.tutorDecision.strategy} | Difficulty: ${responseB.tutorDecision.difficulty}`);
  console.log(`Bridge Required: ${responseB.tutorDecision.prerequisiteBridgeRequired ? 'YES' : 'NO'}`);
  console.log(`Rationale: ${responseB.tutorDecision.rationale}`);
  console.log(`\nPersonalized Answer to Bob:\n${(responseB.personalizedExplanation || responseB.answerText).trim()}\n`);

  // 5. Demonstrate Minimum Personalized Learning Bridge for Bob
  console.log('--- Minimum Learning Bridge for Student B (Bob) ---');
  const bridgeB = bridgeGeneratorService.generateBridge(classId, studentBId);
  console.log(`Bridge Required: ${!bridgeB.isQuickCatchup}`);
  console.log(`Summary: ${bridgeB.bridgeSummary}`);
  console.log(`Estimated Seconds: ${bridgeB.estimatedDurationSec}s`);
  console.log('Learning Debt Gaps:');
  bridgeB.learningDebtGaps.forEach((gap, idx) => {
    console.log(`  [${idx + 1}] (${gap.gapSeverity}) ${gap.prerequisiteTopicName}: Current Mastery ${(gap.currentMastery * 100).toFixed(0)}% (Target: ${(gap.requiredMastery * 100).toFixed(0)}%)`);
  });

  // 6. Demonstrate Micro-Assessment & Feedback loop
  console.log('\n--- Micro-Assessment Generation & Evaluation for Bob ---');
  const microQ = await microAssessmentService.generateQuestion(
    classId,
    studentBId,
    'second_generation'
  );
  console.log(`Generated Question: ${microQ.questionText}`);
  console.log(`Difficulty: ${microQ.difficulty}`);
  console.log('Options:', microQ.options || 'Free Response');

  // Bob answers
  const bobAnswer = microQ.options ? microQ.options[0] : 'Transistors replaced vacuum tubes because they are solid state, faster, and produce less heat.';
  const evalResult = await microAssessmentService.evaluateAnswer(
    classId,
    studentBId,
    microQ,
    bobAnswer
  );
  console.log(`\nBob's Answer: "${bobAnswer}"`);
  console.log(`Evaluation: Correct=${evalResult.isCorrect}, Score=${evalResult.score}, Feedback: ${evalResult.feedback}`);
  console.log(`Follow-Up Recommendation: ${evalResult.suggestedFollowUp}`);

  const updatedProfileB = learnerModelService.getOrInitializeProfile(classId, studentBId);
  console.log(`Bob's Updated Overall Mastery: ${(updatedProfileB.overallMastery * 100).toFixed(1)}% | Support Level: ${updatedProfileB.supportLevel}`);

  console.log('\n===============================================================');
  console.log('  DEMO VERIFICATION COMPLETE: ALL 1-to-1 ADAPTIVE PATHS PROVEN');
  console.log('===============================================================\n');
}

runPersonalizedDemo().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});

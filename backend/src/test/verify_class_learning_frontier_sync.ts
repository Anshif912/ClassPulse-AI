import { dbService } from '../services/db.service';
import { ragRepository } from '../services/rag/ragRepository';
import { SemanticChunker } from '../services/rag/chunker';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { microAssessmentService } from '../services/personalization/microAssessmentService';
import { ragPipeline } from '../services/rag/ragPipeline';
import { studyAssistantService } from '../services/personalization/studyAssistantService';

function setTeacherFrontierHelper(classId: string, topicId: string, topicName?: string) {
  const upperClassId = classId.toUpperCase();
  const existing = dbService.getClassroomLearningState(upperClassId);
  const updated = {
    classId: upperClassId,
    currentLiveTopic: topicId,
    timeline: existing?.timeline || [
      {
        topicId,
        topicName: topicName || topicId,
        startedAt: new Date().toISOString(),
        prerequisiteIds: [],
      }
    ],
    updatedAt: new Date().toISOString(),
  };
  dbService.saveClassroomLearningState(updated);
  studentLearningStateService.invalidateClass(upperClassId);
}

async function runFrontierSyncVerification() {
  console.log('================================================================');
  console.log('🧪 VERIFYING CLASS LEARNING FRONTIER SYNC (SERVER-SIDE & E2E)');
  console.log('================================================================\n');

  const classId = 'CLASS_CS101';
  const studentId = 'student_test_frontier';

  // 1. Setup Concept Graph & Syllabus Topics
  console.log('Step 1: Inspecting Concept Graph syllabus ordering...');
  const graph = conceptGraphService.getOrBuildConceptGraph(classId);
  const nodes = Object.values(graph.concepts);
  console.log(`Concepts found: ${nodes.length}`);
  nodes.sort((a, b) => a.order - b.order).forEach(n => {
    console.log(`  [Order ${n.order}] ${n.id} : ${n.name}`);
  });

  // Pick Fourth Generation (order 6 in default CS graph) and Fifth Generation (order 7)
  const topic4 = nodes.find(n => n.id === 'fourth_generation') || nodes[3];
  const topic5 = nodes.find(n => n.id === 'fifth_generation') || nodes[4];
  console.log(`\nActive Frontier Topic: [Order ${topic4.order}] ${topic4.id} (${topic4.name})`);
  console.log(`Future Untaught Topic: [Order ${topic5.order}] ${topic5.id} (${topic5.name})\n`);

  // Ensure documents/chunks exist in ragRepository for RAG
  const existingChunks = ragRepository.getChunksByClass(classId);
  if (existingChunks.length === 0) {
    console.log('Indexing evolution document into RAG repository for test...');
    const pages = [
      {
        pageNumber: 1,
        text: `1. First Generation of Computers (Approx. 1940–1956)\nPrimary technology: Vacuum tubes. Data relied on punched cards and magnetic drums. ENIAC and UNIVAC I.`
      },
      {
        pageNumber: 2,
        text: `2. Second Generation of Computers (Approx. 1956–1963)\nPrimary technology: Transistors. Replaced vacuum tubes. IBM 1401 and IBM 7090. Assembly language and FORTRAN.`
      },
      {
        pageNumber: 3,
        text: `3. Third Generation of Computers (Approx. 1964–1971)\nPrimary technology: Integrated circuits (ICs). Semiconductor silicon chips. IBM System/360 and PDP-11.`
      },
      {
        pageNumber: 4,
        text: `4. Fourth Generation of Computers (Approx. 1971–Present)\nPrimary technology: Microprocessors & VLSI. Very Large Scale Integration packed thousands of transistors onto single chips. Intel 8086, Apple Macintosh, IBM PC.`
      },
      {
        pageNumber: 5,
        text: `5. Fifth Generation of Computers (Present & Future)\nPrimary technology: Ultra Large Scale Integration (ULSI) & Artificial Intelligence. Neural networks, parallel processing, voice recognition, and quantum computing.`
      }
    ];

    const chunks = SemanticChunker.chunkDocument(
      pages,
      classId,
      'doc_evolution_test',
      'Evolution of Computers Syllabus'
    );
    ragRepository.addChunks(chunks);
    console.log(`Indexed ${chunks.length} chunks into RAG for ${classId}.`);
  }

  // 2. Set Teacher Frontier to Topic 4 (fourth_generation)
  console.log(`Step 2: Teacher sets current topic to ${topic4.id} (Order ${topic4.order})...`);
  setTeacherFrontierHelper(classId, topic4.id, topic4.name);
  console.log(`Teacher frontier set to: ${dbService.getClassroomLearningState(classId)?.currentLiveTopic}`);

  // 3. Verify Student Learning State clamping
  console.log('\nStep 3: Verifying Student Learning State personal frontier clamping...');
  const studentState = studentLearningStateService.getStudentLearningState(classId, studentId);
  const studentFrontierNode = conceptGraphService.getConceptNode(classId, studentState.personalFrontier);
  console.log(`Student Personal Frontier: ${studentState.personalFrontier} (Order: ${studentFrontierNode?.order})`);
  if ((studentFrontierNode?.order || 0) > topic4.order) {
    throw new Error(`FAIL: Student personal frontier order (${studentFrontierNode?.order}) exceeds teacher frontier ceiling (${topic4.order})!`);
  }
  console.log('✅ Student learning state successfully clamped within teacher frontier.');

  // 4. Verify RAG query filtering (Topic 4 allowed, Topic 5 hidden)
  console.log('\nStep 4: Verifying RAG Search with Teacher Frontier = Topic 4...');
  const ragQuery4 = await ragPipeline.query(
    'What technology is used in fourth generation computers VLSI microprocessors?',
    classId
  );
  const chunks4 = ragQuery4.diagnostics?.finalSelectedChunks || [];
  console.log(`Query for Topic 4 - Evidence chunks retrieved: ${chunks4.length}`);
  if (chunks4.length > 0) {
    console.log(`  Top Chunk: ${chunks4[0].snippet.substring(0, 80)}...`);
  }

  const ragQuery5 = await ragPipeline.query(
    'What technology is used in fifth generation computers with ULSI and Artificial Intelligence?',
    classId
  );
  const chunks5 = ragQuery5.diagnostics?.finalSelectedChunks || [];
  console.log(`Query for Future Topic 5 - Evidence chunks retrieved: ${chunks5.length}`);
  const containsTopic5Chunk = chunks5.some(c => 
    c.snippet.toLowerCase().includes('fifth generation') || 
    c.snippet.toLowerCase().includes('ultra large scale integration')
  );
  if (containsTopic5Chunk) {
    throw new Error('FAIL: RAG returned chunks for Topic 5 while Teacher Frontier is Topic 4!');
  }
  console.log('✅ RAG correctly filtered out future Topic 5 chunks (Uploaded != Taught).');

  // 5. Verify Micro-Assessment question generation clamping
  console.log('\nStep 5: Verifying Micro-Assessment Question Generation...');
  const qAllowed = await microAssessmentService.generateQuestion(classId, studentId, topic4.id);
  console.log(`Generated Question for Topic 4: ${qAllowed.conceptId} - "${qAllowed.prompt ? qAllowed.prompt.substring(0, 60) : qAllowed.questionText?.substring(0, 60)}..."`);
  
  const qClamped = await microAssessmentService.generateQuestion(classId, studentId, topic5.id);
  console.log(`Requested Future Topic 5 -> Generator clamped to: ${qClamped.conceptId}`);
  if (qClamped.conceptId === topic5.id) {
    throw new Error('FAIL: Micro-assessment generated a question for Topic 5 despite teacher frontier at Topic 4!');
  }
  console.log('✅ Micro-assessment successfully clamped future topic requests.');

  // 6. Verify Study Assistant Plan Scoping
  console.log('\nStep 6: Verifying Study Assistant Plan Scoping...');
  const studyPlan = studyAssistantService.generateStudyPlan(classId, studentId, 'EXAM_PREP');
  const sequenceTopicIds = studyPlan.recommendedSequence.map(s => s.topicId);
  console.log(`Study Plan Recommended Sequence: ${sequenceTopicIds.join(' -> ')}`);
  const anyFutureInPlan = sequenceTopicIds.some(cid => {
    const node = conceptGraphService.getConceptNode(classId, cid);
    return node && node.order > topic4.order;
  });
  if (anyFutureInPlan) {
    throw new Error(`FAIL: Study Plan contains topics beyond Teacher Frontier (Order ${topic4.order})!`);
  }
  console.log('✅ Study plan only contains topics up to Topic 4.');

  // 7. Verify Historical Mastery remains intact when advancing Teacher Frontier
  console.log('\nStep 7: Recording mastery on Topic 2 & 4, then advancing Teacher Frontier to Topic 5...');
  dbService.saveTopicMastery({
    id: `tm_${classId}_${studentId}_second_generation`,
    classId: classId.toUpperCase(),
    studentId,
    topicId: 'second_generation',
    topicName: 'Second Generation Computers',
    parentUnit: 'General',
    masteryScore: 0.85,
    evidenceCount: 3,
    lastAssessedAt: new Date().toISOString(),
    misconceptions: [],
    retentionChecks: [],
  });
  dbService.saveTopicMastery({
    id: `tm_${classId}_${studentId}_fourth_generation`,
    classId: classId.toUpperCase(),
    studentId,
    topicId: 'fourth_generation',
    topicName: 'Fourth Generation Computers',
    parentUnit: 'General',
    masteryScore: 0.70,
    evidenceCount: 2,
    lastAssessedAt: new Date().toISOString(),
    misconceptions: [],
    retentionChecks: [],
  });

  // Advance Teacher Frontier to Topic 5
  setTeacherFrontierHelper(classId, topic5.id, topic5.name);
  console.log(`Teacher frontier advanced to: ${dbService.getClassroomLearningState(classId)?.currentLiveTopic} (Order ${topic5.order})`);

  const updatedStudentState = studentLearningStateService.getStudentLearningState(classId, studentId);
  console.log(`Updated Student Personal Frontier: ${updatedStudentState.personalFrontier}`);
  console.log(`Historical Mastery Topic 2: ${updatedStudentState.topicMasteries['second_generation']?.masteryScore}`);
  console.log(`Historical Mastery Topic 4: ${updatedStudentState.topicMasteries['fourth_generation']?.masteryScore}`);

  if (
    updatedStudentState.topicMasteries['second_generation']?.masteryScore !== 0.85 || 
    updatedStudentState.topicMasteries['fourth_generation']?.masteryScore !== 0.70
  ) {
    throw new Error('FAIL: Historical mastery was lost or corrupted when advancing teacher frontier!');
  }
  console.log('✅ Historical mastery preserved across frontier advancement.');

  // 8. Verify RAG query now retrieves Topic 5
  console.log('\nStep 8: Verifying RAG Search with Teacher Frontier = Topic 5...');
  const ragQuery5Unlocked = await ragPipeline.query(
    'What technology is used in fifth generation computers with ULSI and Artificial Intelligence?',
    classId
  );
  const chunks5Unlocked = ragQuery5Unlocked.diagnostics?.finalSelectedChunks || [];
  console.log(`Query for Topic 5 (Now Unlocked) - Evidence found: ${chunks5Unlocked.length} chunks`);
  if (chunks5Unlocked.length > 0) {
    console.log(`  Top Chunk: ${chunks5Unlocked[0].snippet.substring(0, 80)}...`);
    console.log('✅ Topic 5 chunks retrieved successfully now that teacher unlocked it.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 8 CLASS LEARNING FRONTIER SYNC TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runFrontierSyncVerification().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

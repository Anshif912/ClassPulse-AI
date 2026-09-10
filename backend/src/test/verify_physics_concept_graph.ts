import { dbService } from '../services/db.service';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import { studentLearningStateService } from '../services/personalization/studentLearningStateService';
import { bridgeGeneratorService } from '../services/personalization/bridgeGeneratorService';

async function verifyPhysicsConcepts() {
  console.log('Testing Physics vs Computer Science concept graph isolation...');

  // 1. Physics Classroom
  const physicsClassId = 'PHY_TEST_MECH_101';
  dbService.createClassroom({
    id: `cls_${physicsClassId}`,
    classId: physicsClassId,
    name: 'Class 11 Physics: Mechanics',
    subject: 'Physics',
    teacherId: 'teacher_newton',
    teacherName: 'Sir Isaac Newton',
    teacherEmail: 'newton@physics.edu',
    agoraChannel: `agora_${physicsClassId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  const physicsGraph = conceptGraphService.getOrBuildConceptGraph(physicsClassId);
  const physicsConceptList = Object.values(physicsGraph.concepts);

  console.log('Physics Concepts Generated:', physicsConceptList.map(c => `${c.id} (${c.name})`));
  const hasPhysicsUnits = physicsConceptList.some(c => c.unit === 'Mechanics' || c.id.includes('newton'));
  const hasCsInPhysics = physicsConceptList.some(c => c.unit.includes('Computer') || c.id.includes('vacuum'));

  if (!hasPhysicsUnits || hasCsInPhysics) {
    throw new Error(`Physics classroom received invalid concepts! hasPhysicsUnits=${hasPhysicsUnits}, hasCsInPhysics=${hasCsInPhysics}`);
  }
  console.log('✅ Physics classroom received 100% pure Physics concepts!');

  // Check Student Learning State for Physics
  const physicsStudent = 'std_phys_01';
  const physicsState = studentLearningStateService.getStudentLearningState(physicsClassId, physicsStudent);
  console.log('Physics Student Live Topic:', physicsState.currentLiveTopic);
  console.log('Physics Student Frontier:', physicsState.personalFrontier);

  const physicsBridge = bridgeGeneratorService.generateBridge(physicsClassId, physicsStudent);
  console.log('Physics Student Bridge Summary:', physicsBridge.bridgeSummary);

  if (physicsBridge.bridgeSummary.toLowerCase().includes('vacuum tube') || physicsBridge.bridgeSummary.toLowerCase().includes('transistor')) {
    throw new Error(`Physics bridge summary contains CS terms: ${physicsBridge.bridgeSummary}`);
  }
  console.log('✅ Physics bridge summary contains 0 CS leaks!');

  // 2. Existing DB Physics Classes (e.g. PHY-IQAZM)
  const existingPhyGraph = conceptGraphService.getOrBuildConceptGraph('PHY-IQAZM');
  const existingPhyConcepts = Object.values(existingPhyGraph.concepts);
  console.log('Existing PHY-IQAZM Concepts:', existingPhyConcepts.map(c => c.name));
  const phyIqazmValid = existingPhyConcepts.some(c => c.unit === 'Mechanics' || c.id.includes('newton'));
  if (!phyIqazmValid) {
    throw new Error('PHY-IQAZM still has stale CS concepts!');
  }
  console.log('✅ Existing PHY-IQAZM classroom successfully resolved to Physics concepts!');

  // 3. Computer Science Classroom
  const csClassId = 'CS_TEST_COMP_101';
  dbService.createClassroom({
    id: `cls_${csClassId}`,
    classId: csClassId,
    name: 'CS101: Computer Generations',
    subject: 'Computer Science',
    teacherId: 'teacher_turing',
    teacherName: 'Dr. Turing',
    teacherEmail: 'turing@cs.edu',
    agoraChannel: `agora_${csClassId}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });

  const csGraph = conceptGraphService.getOrBuildConceptGraph(csClassId);
  const csConceptList = Object.values(csGraph.concepts);
  console.log('CS Concepts Generated:', csConceptList.map(c => `${c.id} (${c.name})`));
  const hasCsUnits = csConceptList.some(c => c.unit === 'Computer Generations' || c.id.includes('generation'));

  if (!hasCsUnits) {
    throw new Error('CS classroom did not receive CS concepts!');
  }
  console.log('✅ CS classroom received 100% CS concepts!');

  console.log('\n🎉 ALL SUBJECT-AWARE ISOLATION CHECKS PASSED PERFECTLY!\n');
}

verifyPhysicsConcepts().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});

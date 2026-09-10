import { ragRepository } from '../services/rag/ragRepository';
import { ragPipeline } from '../services/rag/ragPipeline';
import { SemanticChunker } from '../services/rag/chunker';

async function testNewton() {
  console.log('================================================================');
  console.log('  TESTING NEWTON LAWS & MULTI-TURN ISOLATION');
  console.log('================================================================\n');

  const classId = 'PHYS_TEST_' + Date.now();
  const notes = [{
    pageNumber: 4,
    text: 'Physics Newtons Laws ClassPulse Test Material. Newton Third Law of Motion: For every action, there is an equal and opposite reaction. When object A exerts a force on object B, object B exerts an equal and opposite force on object A.'
  }, {
    pageNumber: 6,
    text: 'Newton First Law of Motion (Law of Inertia): Every body continues in its state of rest or uniform motion unless compelled to change by an external force.'
  }];

  const chunks = SemanticChunker.chunkDocument(notes, classId, 'mat_phys', 'Physics Newtons Laws ClassPulse Test Material.pdf');
  ragRepository.addChunks(chunks);

  // Test 1: Newton's Third Law after previous multi-turn comparison history
  console.log('--- TEST 1: Newton Third Law with previous history ---');
  const res3 = await ragPipeline.query("explain Newton's third law", classId, ['compare 1st and 2nd generation']);
  console.log('Answer:\n', res3.answerText);
  if (res3.answerText.includes('1st Generation vs 2nd Generation') || (!res3.answerText.includes('Third Law') && !res3.answerText.includes('Action'))) {
    throw new Error('FAIL: Returned computer generation instead of Newton 3rd law!');
  }
  console.log('✅ TEST 1 PASSED: Correctly returned Newton Third Law!\n');

  // Test 2: Newton's First Law in Tamil
  console.log('--- TEST 2: Newton First Law in Tamil ---');
  const res1 = await ragPipeline.query('நியூட்டன் பர்ஸ்ட் லாவை பத்தி எக்ஸ்பிளைன் பண்ணு', classId);
  console.log('Answer:\n', res1.answerText);
  if (!res1.answerText.includes('முதல் இயக்க விதி') && !res1.answerText.includes('நிலைம')) {
    throw new Error('FAIL: Did not return Tamil Newton 1st law!');
  }
  console.log('✅ TEST 2 PASSED: Correctly returned Tamil Newton First Law!\n');

  // Test 3: Standalone 2nd Law query
  console.log('--- TEST 3: Newton Second Law ---');
  const res2 = await ragPipeline.query("explain Newton's second law", classId);
  console.log('Answer:\n', res2.answerText);
  if (!res2.answerText.includes('Second Law') && !res2.answerText.includes('F = ma')) {
    throw new Error('FAIL: Did not return Newton 2nd law!');
  }
  console.log('✅ TEST 3 PASSED: Correctly returned Newton Second Law!\n');

  console.log('================================================================');
  console.log('  ALL TESTS PASSED SUCCESSFULLY WITH ZERO REGRESSIONS!');
  console.log('================================================================');
}

testNewton().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

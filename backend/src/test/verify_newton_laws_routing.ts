import { RAGPipeline } from '../services/rag/ragPipeline';

async function runTest() {
  console.log('--- TESTING NEWTON LAWS RAG ROUTING ---');
  const rag = new RAGPipeline();

  const testCases = [
    {
      query: 'நியூட்டன் செகண்ட் ஆஃப் மோஷன்',
      expectedLaw: 2,
      expectedKeyword: 'இரண்டாம்',
    },
    {
      query: 'நியூட்டனின் இரண்டாம் இயக்க விதி என்றால் என்ன?',
      expectedLaw: 2,
      expectedKeyword: 'இரண்டாம்',
    },
    {
      query: 'explain newton second law of motion',
      expectedLaw: 2,
      expectedKeyword: 'Second Law',
    },
    {
      query: 'நியூட்டனின் முதல் இயக்க விதி என்றால் என்ன?',
      expectedLaw: 1,
      expectedKeyword: 'முதல்',
    },
    {
      query: 'what is newtons third law of motion?',
      expectedLaw: 3,
      expectedKeyword: 'Third Law',
    },
    {
      query: 'நியூட்டன் 3rd law explain pannu',
      expectedLaw: 3,
      expectedKeyword: 'மூன்றாம்',
    },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = await rag.query(tc.query, 'TEST-CLASS', []);
    console.log(`\nQuery: "${tc.query}"`);
    console.log(`Detected Lang: ${result.detectedLanguage}`);
    console.log(`Answer Snippet: ${result.answerText.substring(0, 120)}...`);

    const hasExpectedKeyword = result.answerText.toLowerCase().includes(tc.expectedKeyword.toLowerCase());
    if (hasExpectedKeyword) {
      console.log(`✅ PASS: Correctly routed to Newton's ${tc.expectedLaw} Law`);
      passed++;
    } else {
      console.error(`❌ FAIL: Expected keyword "${tc.expectedKeyword}" not found in response`);
    }
  }

  console.log(`\nResults: ${passed}/${testCases.length} passed.`);
  if (passed === testCases.length) {
    console.log('ALL NEWTON LAW ROUTING TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

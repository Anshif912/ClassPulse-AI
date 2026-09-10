import { ragPipeline } from '../services/rag/ragPipeline';

async function testNewtonQuery() {
  console.log('Testing RAG Query: "explain Newton second law"...');
  const result = await ragPipeline.query('explain Newton second law', 'PHY-IQAZM');
  console.log('--- RAG ANSWER ---');
  console.log(result.answerText);
  console.log('--- CITATIONS ---');
  console.log(result.sources);

  if (result.answerText.includes('1st Generation vs 2nd Generation') || result.answerText.includes('Vacuum Tubes')) {
    throw new Error('FAILED: Newton Second Law query returned CS content!');
  }

  if (!result.answerText.includes("Newton's Second Law") && !result.answerText.includes('F = ma')) {
    throw new Error('FAILED: Newton Second Law query did not contain F = ma or Newton Second Law!');
  }

  console.log('\n🎉 SUCCESS: Newton Second Law query returned pure Physics content with F = ma!');
}

testNewtonQuery().catch((err) => {
  console.error(err);
  process.exit(1);
});

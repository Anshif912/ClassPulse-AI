import assert from 'assert';
import { solveLinearEquation, evaluateSimpleArithmetic, explainArithmeticOperation } from '../services/rag/mathSolver';
import { ragEngine } from '../services/rag/ragEngine';
import { validateMeetUrl } from '../services/urlValidator';
import { agoraService } from '../services/voice/agora.service';
import { dbService } from '../services/db.service';
import { config } from '../config';

console.log('====================================================');
console.log('🧪 CLASSPULSE AI — 20 NATURAL QUESTIONS & FOLLOW-UP SUITE');
console.log('====================================================\n');

// 1. hi
console.log('[1] Testing: "hi"');
const q1 = ragEngine.processQuery('hi');
assert.strictEqual(q1.intent, 'greeting');
assert.ok(q1.answerText.toLowerCase().includes('help you with today\'s class') || q1.answerText.toLowerCase().includes('hi'));
console.log(`  ✓ "${q1.answerText}" (Intent: ${q1.intent})`);

// 2. hello
console.log('\n[2] Testing: "hello"');
const q2 = ragEngine.processQuery('hello');
assert.strictEqual(q2.intent, 'greeting');
console.log(`  ✓ "${q2.answerText}" (Intent: ${q2.intent})`);

// 3. i have a doubt
console.log('\n[3] Testing: "i have a doubt"');
const q3 = ragEngine.processQuery('i have a doubt');
assert.strictEqual(q3.intent, 'doubt_request');
assert.ok(q3.answerText.includes('What is your doubt') || q3.answerText.includes("What's your doubt"));
assert.ok(!q3.answerText.includes('Mathematics, Physics, Chemistry'), 'Must NOT list STEM subjects');
console.log(`  ✓ "${q3.answerText}" (Intent: ${q3.intent})`);

// 4. i have a question
console.log('\n[4] Testing: "i have a question"');
const q4 = ragEngine.processQuery('i have a question');
assert.strictEqual(q4.intent, 'doubt_request');
assert.ok(q4.answerText.includes('What is your doubt') || q4.answerText.includes("What's your doubt"));
console.log(`  ✓ "${q4.answerText}" (Intent: ${q4.intent})`);

// 5. how are you
console.log('\n[5] Testing: "how are you"');
const q5 = ragEngine.processQuery('how are you');
assert.strictEqual(q5.intent, 'casual');
assert.ok(q5.answerText.includes('doing great') || q5.answerText.includes('ready to help'));
console.log(`  ✓ "${q5.answerText}" (Intent: ${q5.intent})`);

// 6. what can you do
console.log('\n[6] Testing: "what can you do"');
const q6 = ragEngine.processQuery('what can you do');
assert.strictEqual(q6.intent, 'casual');
assert.ok(q6.answerText.includes('ClassPulse') && q6.answerText.includes('doubts'));
console.log(`  ✓ "${q6.answerText}" (Intent: ${q6.intent})`);

// 7. thank you
console.log('\n[7] Testing: "thank you"');
const q7 = ragEngine.processQuery('thank you');
assert.strictEqual(q7.intent, 'thank_you');
assert.ok(q7.answerText.toLowerCase().includes('welcome'));
console.log(`  ✓ "${q7.answerText}" (Intent: ${q7.intent})`);

// 8. okay
console.log('\n[8] Testing: "okay"');
const q8 = ragEngine.processQuery('okay');
assert.strictEqual(q8.intent, 'confirmation');
assert.ok(q8.answerText.includes('Got it') || q8.answerText.includes('Let me know'));
console.log(`  ✓ "${q8.answerText}" (Intent: ${q8.intent})`);

// 9. what is 2+5
console.log('\n[9] Testing: "what is 2+5"');
const q9 = ragEngine.processQuery('what is 2+5');
assert.strictEqual(q9.intent, 'simple_math');
assert.strictEqual(q9.answerText, '7');
console.log(`  ✓ "${q9.answerText}" (Intent: ${q9.intent})`);

// 10. how 2+5 is 7
console.log('\n[10] Testing: "how 2+5 is 7"');
const q10 = ragEngine.processQuery('how 2+5 is 7');
assert.strictEqual(q10.intent, 'math_explanation');
assert.ok(q10.answerText.includes('2 + 5 = 7') || q10.answerText.includes('combining'));
console.log(`  ✓ "${q10.answerText.replace(/\n/g, ' ')}" (Intent: ${q10.intent})`);

// 11. why is 2+5 equal to 7
console.log('\n[11] Testing: "why is 2+5 equal to 7"');
const q11 = ragEngine.processQuery('why is 2+5 equal to 7');
assert.strictEqual(q11.intent, 'math_explanation');
assert.ok(q11.answerText.includes('2 + 5 = 7'));
console.log(`  ✓ "${q11.answerText.replace(/\n/g, ' ')}" (Intent: ${q11.intent})`);

// 12. how do you get 7 from 2+5
console.log('\n[12] Testing: "how do you get 7 from 2+5"');
const q12 = ragEngine.processQuery('how do you get 7 from 2+5');
assert.strictEqual(q12.intent, 'math_explanation');
assert.ok(q12.answerText.includes('2 + 5 = 7'));
console.log(`  ✓ "${q12.answerText.replace(/\n/g, ' ')}" (Intent: ${q12.intent})`);

// 13. what is 10+20
console.log('\n[13] Testing: "what is 10+20"');
const q13 = ragEngine.processQuery('what is 10+20');
assert.strictEqual(q13.intent, 'simple_math');
assert.strictEqual(q13.answerText, '30');
console.log(`  ✓ "${q13.answerText}" (Intent: ${q13.intent})`);

// 14. what is 10-3
console.log('\n[14] Testing: "what is 10-3"');
const q14 = ragEngine.processQuery('what is 10-3');
assert.strictEqual(q14.intent, 'simple_math');
assert.strictEqual(q14.answerText, '7');
console.log(`  ✓ "${q14.answerText}" (Intent: ${q14.intent})`);

// 15. what is science
console.log('\n[15] Testing: "what is science"');
const q15 = ragEngine.processQuery('what is science');
assert.ok(q15.intent === 'science' || q15.intent === 'educational');
assert.ok(q15.answerText.toLowerCase().includes('observation') || q15.answerText.toLowerCase().includes('systematic'));
assert.ok(!q15.answerText.includes("I'm not sure I understood"), 'Must NOT return unknown fallback!');
console.log(`  ✓ "${q15.answerText.substring(0, 75)}..." (Intent: ${q15.intent})`);

// 16. what is photosynthesis
console.log('\n[16] Testing: "what is photosynthesis"');
const q16 = ragEngine.processQuery('what is photosynthesis');
assert.ok(q16.intent === 'educational' || q16.intent === 'science');
assert.ok(q16.answerText.includes('glucose') || q16.answerText.includes('light') || q16.answerText.includes('oxygen'));
console.log(`  ✓ "${q16.answerText.substring(0, 75)}..." (Intent: ${q16.intent})`);

// 17. what is gravity
console.log('\n[17] Testing: "what is gravity"');
const q17 = ragEngine.processQuery('what is gravity');
assert.ok(q17.intent === 'science' || q17.intent === 'educational');
assert.ok(q17.answerText.toLowerCase().includes('mass') || q17.answerText.includes('9.8'));
console.log(`  ✓ "${q17.answerText.substring(0, 75)}..." (Intent: ${q17.intent})`);

// 18. what is a linear equation
console.log('\n[18] Testing: "what is a linear equation"');
const q18 = ragEngine.processQuery('what is a linear equation');
assert.ok(q18.intent === 'educational' || q18.intent === 'science');
assert.ok(q18.answerText.toLowerCase().includes('degree 1') || q18.answerText.toLowerCase().includes('straight line') || q18.answerText.toLowerCase().includes('ax + b'));
console.log(`  ✓ "${q18.answerText.substring(0, 75)}..." (Intent: ${q18.intent})`);

// 19. why do we subtract from both sides
console.log('\n[19] Testing: "why do we subtract from both sides"');
const q19 = ragEngine.processQuery('why do we subtract from both sides');
assert.strictEqual(q19.intent, 'conceptual');
assert.ok(q19.answerText.includes('balanced scale') || q19.answerText.includes('isolate the variable'));
console.log(`  ✓ "${q19.answerText.substring(0, 75)}..." (Intent: ${q19.intent})`);

// 20. asdfgh
console.log('\n[20] Testing: "asdfgh"');
const q20 = ragEngine.processQuery('asdfgh');
assert.strictEqual(q20.intent, 'unknown');
assert.strictEqual(q20.answerText, "I'm not sure I understood that. Could you ask your question another way?");
console.log(`  ✓ "${q20.answerText}" (Intent: ${q20.intent})`);

// ====================================================
// FOLLOW-UP CONVERSATION TESTS (STEP 16)
// ====================================================
console.log('\n====================================================');
console.log('🔄 TESTING MULTI-TURN CONVERSATIONS WITH CONTEXT');
console.log('====================================================\n');

// Conversation A:
console.log('[CONVERSATION A] Arithmetic Follow-up: "what is 2+5" -> "how?"');
const sessA = dbService.createSession({
  id: 'sess_conv_a',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  participantId: 'student_a',
  startedAt: new Date().toISOString(),
});
dbService.addMessage(sessA.id, {
  id: 'msg_a1',
  sessionId: sessA.id,
  role: 'student',
  content: 'what is 2+5',
  timestamp: new Date().toISOString(),
});
dbService.addMessage(sessA.id, {
  id: 'msg_a2',
  sessionId: sessA.id,
  role: 'companion',
  content: '7',
  timestamp: new Date().toISOString(),
  intent: 'simple_math',
});
const convARes = ragEngine.processQuery('how?', dbService.getSession(sessA.id));
assert.strictEqual(convARes.intent, 'followup');
assert.ok(convARes.answerText.includes('2 + 5 = 7') || convARes.answerText.includes('combining'));
console.log(`  ✓ User: "what is 2+5" -> AI: "7"`);
console.log(`  ✓ User: "how?" -> AI: "${convARes.answerText.replace(/\n/g, ' ')}"`);

// Conversation B:
console.log('\n[CONVERSATION B] Algebra Follow-up: "how do I solve 2x+5=7" -> "how?"');
const sessB = dbService.createSession({
  id: 'sess_conv_b',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  participantId: 'student_b',
  startedAt: new Date().toISOString(),
});
const resB1 = ragEngine.processQuery('how do I solve 2x+5=7', sessB);
dbService.addMessage(sessB.id, {
  id: 'msg_b1',
  sessionId: sessB.id,
  role: 'student',
  content: 'how do I solve 2x+5=7',
  timestamp: new Date().toISOString(),
});
dbService.addMessage(sessB.id, {
  id: 'msg_b2',
  sessionId: sessB.id,
  role: 'companion',
  content: resB1.answerText,
  timestamp: new Date().toISOString(),
  intent: 'math_problem',
});
const convBRes = ragEngine.processQuery('how?', dbService.getSession(sessB.id));
assert.strictEqual(convBRes.intent, 'followup');
assert.ok(convBRes.answerText.includes('x = 1'));
console.log(`  ✓ User: "how do I solve 2x+5=7" -> AI: x = 1`);
console.log(`  ✓ User: "how?" -> AI: Step-by-step breakdown provided`);

// Conversation C:
console.log('\n[CONVERSATION C] Biology Follow-up: "what is photosynthesis" -> "why is it important?"');
const sessC = dbService.createSession({
  id: 'sess_conv_c',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  participantId: 'student_c',
  startedAt: new Date().toISOString(),
});
const resC1 = ragEngine.processQuery('what is photosynthesis', sessC);
dbService.addMessage(sessC.id, {
  id: 'msg_c1',
  sessionId: sessC.id,
  role: 'student',
  content: 'what is photosynthesis',
  timestamp: new Date().toISOString(),
});
dbService.addMessage(sessC.id, {
  id: 'msg_c2',
  sessionId: sessC.id,
  role: 'companion',
  content: resC1.answerText,
  timestamp: new Date().toISOString(),
  intent: 'educational',
});
const convCRes = ragEngine.processQuery('why is it important?', dbService.getSession(sessC.id));
assert.strictEqual(convCRes.intent, 'followup');
assert.ok(convCRes.answerText.toLowerCase().includes('oxygen') || convCRes.answerText.toLowerCase().includes('food chain'));
console.log(`  ✓ User: "what is photosynthesis" -> AI: Photosynthesis explanation`);
console.log(`  ✓ User: "why is it important?" -> AI: "${convCRes.answerText.substring(0, 90)}..."`);

console.log('\n====================================================');
console.log('🎉 ALL 20 QUESTIONS & FOLLOW-UP CONVERSATIONS PASSED 100%!');
console.log('====================================================\n');

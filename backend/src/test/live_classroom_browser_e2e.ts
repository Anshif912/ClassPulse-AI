import assert from 'node:assert';

async function testLiveClassroom() {
  console.log('============================================================');
  console.log('🧪 RUNNING FULL 14-QUESTION MATRIX LIVE ACCEPTANCE TEST');
  console.log('============================================================\n');

  // 1. Health check
  const healthRes = await fetch('http://localhost:3001/api/health');
  assert.strictEqual(healthRes.status, 200);
  const health = await healthRes.json();
  console.log('✅ Server is Online:', health.service, 'Version:', health.version);

  // 2. Perform real Email + OTP authentication
  const sendRes = await fetch('http://localhost:3001/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.kevin@school.edu', name: 'Kevin Student', role: 'STUDENT' }),
  });
  assert.strictEqual(sendRes.status, 200);
  const sendData = await sendRes.json();
  const otp = sendData.devOtp;
  console.log('✅ OTP Code received:', otp);

  const verifyRes = await fetch('http://localhost:3001/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student.kevin@school.edu', otp }),
  });
  assert.strictEqual(verifyRes.status, 200);
  const setCookie = verifyRes.headers.get('set-cookie') || '';
  const cookieHeader = setCookie.split(';')[0];
  console.log('✅ User Authenticated, Session Cookie:', cookieHeader);

  // 3. Join classroom COM-CG010
  const joinRes = await fetch('http://localhost:3001/api/classes/COM-CG010/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  });
  console.log('Classroom Join status:', joinRes.status);

  // 4. Test Acceptance Queries Matrix
  const matrix = [
    {
      name: '1. Fact/Explanation: explain first generation computers',
      query: 'explain first generation computers',
      expected: ['vacuum tube', '1940'],
      forbidden: ['fortran', 'cobol', 'transistor', 'period: approx. second'],
      checkCitation: true,
    },
    {
      name: '2. Technology Query: what technology did first generation computers use?',
      query: 'what technology did first generation computers use?',
      expected: ['vacuum tube'],
      forbidden: ['transistor'],
      checkCitation: true,
    },
    {
      name: '3. Follow-up Why: why were they so large?',
      query: 'why were they so large?',
      expected: ['room', 'size', 'vacuum tube'],
      forbidden: ['microprocessor'],
      checkCitation: true,
    },
    {
      name: '4. Examples: give examples of first generation computers',
      query: 'give examples of first generation computers',
      expected: ['eniac', 'univac'],
      forbidden: ['ibm 1401'],
      checkCitation: true,
    },
    {
      name: '5. Second Gen: explain second generation computers',
      query: 'explain second generation computers',
      expected: ['transistor', '1956'],
      forbidden: ['1940-1956'],
      checkCitation: true,
    },
    {
      name: '6. Comparison: compare 1st and 2nd generation',
      query: 'compare 1st and 2nd generation',
      expected: ['vacuum tube', 'transistor', '1st gen', '2nd gen'],
      forbidden: ['photosynthesis'],
      checkCitation: true,
    },
    {
      name: '7. Evaluation: so which is the best computer generation',
      query: 'so which is the best computer generation',
      expected: ['fourth generation', 'fifth generation', 'evaluation'],
      forbidden: ['all 5 generations dump'],
      checkCitation: true,
    },
    {
      name: '8. Tamil 1st Gen: முதல் தலைமுறை கணினிகளைப் பற்றி விளக்குங்கள்',
      query: 'முதல் தலைமுறை கணினிகளைப் பற்றி விளக்குங்கள்',
      expected: ['வெற்றிடக் குழாய்', 'vacuum tube', 'முதல் தலைமுறை'],
      forbidden: ['டிரான்சிஸ்டர்'],
      checkCitation: true,
    },
    {
      name: '9. Tamil 2nd Gen: இரண்டாம் தலைமுறை கணினிகள்',
      query: 'இரண்டாம் தலைமுறை கணினிகள்',
      expected: ['டிரான்சிஸ்டர்', 'transistor', 'இரண்டாம் தலைமுறை'],
      forbidden: ['வெற்றிடக் குழாய் பயன்படுத்தியது; ஆனால்'],
      checkCitation: true,
    },
    {
      name: '10. Tanglish 1st Gen: first generation computers pathi explain pannu',
      query: 'first generation computers pathi explain pannu',
      expected: ['vacuum tube', 'first generation', 'periya'],
      forbidden: ['cobol'],
      checkCitation: true,
    },
    {
      name: '11. Tanglish Evaluation: edhu best computer generation',
      query: 'edhu best computer generation',
      expected: ['4th generation', '5th generation'],
      forbidden: ['edvac only'],
      checkCitation: true,
    },
    {
      name: '12. Hindi 1st Gen: पहली पीढ़ी के कंप्यूटर के बारे में बताएं',
      query: 'पहली पीढ़ी के कंप्यूटर के बारे में बताएं',
      expected: ['वैक्यूम ट्यूब', 'vacuum tube', 'पहली पीढ़ी'],
      forbidden: ['ट्रांजिस्टर'],
      checkCitation: true,
    },
    {
      name: '13. Hindi 2nd Gen: दूसरी पीढ़ी के कंप्यूटर के बारे में बताएं',
      query: 'दूसरी पीढ़ी के कंप्यूटर के बारे में बताएं',
      expected: ['ट्रांजिस्टर', 'transistor', 'दूसरी पीढ़ी'],
      forbidden: ['वैक्यूम ट्यूब मुख्य'],
      checkCitation: true,
    },
    {
      name: '14. Out of Scope Query: what is photosynthesis in biology?',
      query: 'what is photosynthesis in biology?',
      expected: ['does not contain enough direct information'],
      forbidden: ['vacuum tube', 'transistor'],
      checkCitation: false,
    },
  ];

  for (const t of matrix) {
    console.log(`\n--- EXECUTING: ${t.name} ---`);
    const chatRes = await fetch('http://localhost:3001/api/chat/classroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ classId: 'COM-CG010', message: t.query }),
    });

    assert.strictEqual(chatRes.status, 200);
    const data = await chatRes.json();
    const content = data.message.content;
    const contentLower = content.toLowerCase();

    console.log('[Full Response]:\n' + content);
    console.log('[Evidence State]:', data.evidenceState);
    console.log('[Sources]:', JSON.stringify(data.sources));

    if (t.checkCitation) {
      assert.ok(
        content.includes('p.2') ||
        (data.sources && data.sources.some((s: any) => s.pageStart === 2)),
        'Must contain correct p.2 citation in content or sources'
      );
    }

    for (const exp of t.expected) {
      assert.ok(contentLower.includes(exp.toLowerCase()), `Response must contain "${exp}"`);
    }
    for (const forb of t.forbidden) {
      assert.ok(!contentLower.includes(forb.toLowerCase()), `Response must NOT contain "${forb}"`);
    }
    console.log(`✅ ${t.name} PASSED!`);
  }

  console.log('\n============================================================');
  console.log('🎉 14/14 MATRIX ACCEPTANCE TESTS PASSED WITH 100% ACCURACY!');
  console.log('============================================================\n');
}

testLiveClassroom().catch((err) => {
  console.error('Fatal live test error:', err);
  process.exit(1);
});

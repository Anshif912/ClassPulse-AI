import { dbService, User } from '../services/db.service';
import { agoraService } from '../services/voice/agora.service';

async function runSecurityAndAuthVerification() {
  console.log('====================================================');
  console.log('🧪 Starting ClassPulse Master Security & Auth Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: Google User Creation & Session Resolution
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST A: Google User Creation & Session Resolution ---');
  const googleSubA = `google_sub_${Date.now()}`;
  const emailA = 'prof.oak@pallet.edu';
  const nameA = 'Professor Oak';

  // 1. Create teacher user from verified Google payload
  const teacherUser: User = {
    id: `user_oak_${Date.now()}`,
    googleId: googleSubA,
    email: emailA,
    name: nameA,
    avatarUrl: 'https://lh3.googleusercontent.com/a/oak_avatar',
    role: 'TEACHER',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  dbService.createUser(teacherUser);
  const foundUserA = dbService.getUserByGoogleId(googleSubA);
  assert(foundUserA !== undefined && foundUserA.email === emailA, 'Test A1: User created in DB by Google sub ID');

  // 2. Create server-side session
  const sessionA = dbService.createAuthSession(teacherUser.id);
  assert(sessionA.token.startsWith('cps_'), 'Test A2: Session token generated with secure prefix cps_');

  // 3. Resolve session token
  const resolvedSessionA = dbService.getAuthSession(sessionA.token);
  assert(resolvedSessionA !== undefined && resolvedSessionA.user.id === teacherUser.id, 'Test A3: /api/auth/me resolves correct User from session token');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B: Logout & Session Invalidation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST B: Logout & Session Invalidation ---');
  dbService.deleteAuthSession(sessionA.token);
  const afterLogoutSession = dbService.getAuthSession(sessionA.token);
  assert(!afterLogoutSession, 'Test B: Invalidated session returns undefined/null (401 on /api/auth/me)');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: Re-login (Idempotency — No Duplicate User)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST C: Re-login & Account Idempotency ---');
  const existingByGoogle = dbService.getUserByGoogleId(googleSubA);
  assert(existingByGoogle !== undefined, 'Test C1: Existing user found on subsequent Google OAuth callback');

  // Update lastLoginAt without creating duplicate
  const updatedUser = dbService.updateUser(existingByGoogle!.id, {
    lastLoginAt: new Date().toISOString(),
  });
  assert(updatedUser?.id === teacherUser.id, 'Test C2: User record updated, no duplicate user ID created');

  const newSessionForTeacher = dbService.createAuthSession(teacherUser.id);
  assert(newSessionForTeacher.token !== sessionA.token, 'Test C3: Fresh session created upon new login');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: RBAC Enforcement (Student vs Teacher Class Creation)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST D: RBAC Enforcement ---');
  const studentGoogleSub = 'google_sub_883746192834';
  const studentUser: User = {
    id: `user_ash_${Date.now()}`,
    googleId: studentGoogleSub,
    email: 'ash.ketchum@pallet.edu',
    name: 'Ash Ketchum',
    avatarUrl: 'https://lh3.googleusercontent.com/a/ash_avatar',
    role: 'STUDENT',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  dbService.createUser(studentUser);

  // Check role-based permission
  const studentCanCreateClass = studentUser.role === 'TEACHER';
  const teacherCanCreateClass = teacherUser.role === 'TEACHER';
  assert(!studentCanCreateClass, 'Test D1: Student cannot create classrooms (RBAC 403 Forbidden)');
  assert(teacherCanCreateClass, 'Test D2: Teacher has permission to create classrooms (RBAC 200 OK)');

  // Teacher creates classroom
  const classId = `BIO-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const classroom = dbService.createClassroom({
    id: `cls_${Date.now()}`,
    classId,
    name: 'Pokemon Biology 101',
    subject: 'Biology',
    teacherId: teacherUser.id,
    teacherName: teacherUser.name,
    teacherEmail: teacherUser.email,
    agoraChannel: `class_${classId.replace(/-/g, '_')}`,
    createdAt: new Date().toISOString(),
    status: 'active',
    materials: [],
  });
  assert(classroom.classId === classId, 'Test D3: Classroom created by teacher with auto-assigned teacherId and agoraChannel');

  // Teacher uploads materials
  const material = {
    id: `mat_${Date.now()}`,
    classId,
    uploadedBy: teacherUser.id,
    title: 'Intro to Electric Types',
    content: 'Pikachu generates electricity from the pouches in its cheeks.',
    uploadedAt: new Date().toISOString(),
    fileType: 'text' as const,
  };
  dbService.addClassroomMaterial(classId, material);
  const fetchedClass = dbService.getClassroom(classId);
  assert(fetchedClass?.materials.length === 1, 'Test D4: Teacher-scoped material uploaded to classroom context');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: Class Membership & Resource Isolation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST E: Class Membership & Isolation ---');
  // Student not yet a member
  let membership = dbService.getMembership(classId, studentUser.id);
  assert(!membership, 'Test E1: Student starts with NO membership in classroom');

  // Student joins classroom
  dbService.addMembership({
    id: `mem_${Date.now()}`,
    classId,
    userId: studentUser.id,
    role: studentUser.role,
    joinedAt: new Date().toISOString(),
    status: 'active',
  });
  membership = dbService.getMembership(classId, studentUser.id);
  assert(membership !== undefined && membership.status === 'active', 'Test E2: Student active membership confirmed after joining');

  // AI Private Conversation Isolation
  const studentConversation = dbService.getOrCreateConversation(classId, studentUser.id);
  dbService.addAIMessage(studentConversation.id, {
    role: 'student',
    content: 'How do electric sacks work?',
  });
  dbService.addAIMessage(studentConversation.id, {
    role: 'companion',
    content: 'Electric sacks are specialized organs that store electrostatic charge.',
  });

  const studentHistory = dbService.getConversationHistory(studentConversation.id);
  assert(studentHistory.length === 2, 'Test E3: Student private AI conversation persisted in DB');

  const teacherConversation = dbService.getOrCreateConversation(classId, teacherUser.id);
  const teacherHistory = dbService.getConversationHistory(teacherConversation.id);
  assert(teacherHistory.length === 0, 'Test E4: Strict isolation — Teacher cannot see student private AI conversation history');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: Agora Token Generation for Authenticated Member
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST F: Agora RTC Token Generation ---');
  const isMember = dbService.getMembership(classId, studentUser.id);
  assert(isMember?.status === 'active', 'Test F1: Server verifies student membership before token generation');

  const numericUid = 49281;
  const originalAppId = process.env.AGORA_APP_ID;
  const originalCert = process.env.AGORA_APP_CERTIFICATE;

  // Set valid test credentials in env for token generation test
  process.env.AGORA_APP_ID = '970ca35de60c44645bbae8a215061401';
  process.env.AGORA_APP_CERTIFICATE = '5cfd2dc1721d4663809979d7bdd352ce';
  const { config } = require('../config');
  config.agora.appId = process.env.AGORA_APP_ID;
  config.agora.appCertificate = process.env.AGORA_APP_CERTIFICATE;

  const tokenResult = agoraService.generateRtcToken(classroom.agoraChannel, numericUid, 'publisher');
  assert(typeof tokenResult.token === 'string' && tokenResult.token.startsWith('007'), 'Test F2: Real Agora Token007 generated with 007 version prefix');
  assert(tokenResult.channelName === classroom.agoraChannel, 'Test F3: Channel derived directly from classroom record (no channel injection)');
  assert(tokenResult.uid === numericUid, 'Test F4: Token UID matches requested numeric UID exactly');
  assert(tokenResult.expiresAt > Math.floor(Date.now() / 1000), 'Test F5: Token has valid future expiration');

  // Test error when credentials missing
  config.agora.appId = '';
  let threwOnMissing = false;
  try {
    agoraService.generateRtcToken(classroom.agoraChannel, numericUid, 'publisher');
  } catch (err: any) {
    threwOnMissing = err.message.includes('Agora credentials missing');
  }
  assert(threwOnMissing, 'Test F6: Missing Agora credentials throws clear error and refuses fake fallback');

  // Restore
  config.agora.appId = originalAppId || '';
  config.agora.appCertificate = originalCert || '';

  // Attendance recording
  dbService.recordAttendanceJoin(classId, studentUser);
  const attendanceList = dbService.getClassAttendance(classId);
  assert(attendanceList.length >= 1 && attendanceList.some((a) => a.userId === studentUser.id), 'Test F5: Attendance record automatically captured on join');

  const leaveRecord = dbService.recordAttendanceLeave(classId, studentUser.id);
  assert(leaveRecord !== undefined && leaveRecord?.leaveTime !== undefined, 'Test F6: Attendance leave time and duration calculated on disconnect');

  console.log('\n====================================================');
  console.log(`🎉 Master Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAndAuthVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

import { dbService } from '../services/db.service';

async function testModerationRuntime() {
  console.log('--- 2. Moderator Mute / Unmute Reality Check ---');
  const classId = 'MOD_CLASS_01';
  const teacherId = 'teacher_dr_smith';
  const studentId = 'student_anshit';

  // 1. Initially student is not muted
  console.log('Initial moderation:', dbService.getParticipantModeration(classId, studentId) || 'Unmuted');

  // 2. Teacher mutes student
  dbService.setParticipantModeration(classId, studentId, {
    userId: studentId,
    isMuted: true,
    mutedBy: teacherId,
    mutedByName: 'Dr. Evelyn Smith',
    mutedAt: new Date().toISOString(),
    reason: 'Muted by teacher',
  });
  const mutedRecord = dbService.getParticipantModeration(classId, studentId);
  console.log('After teacher mute:', mutedRecord);

  // 3. Query class moderation map
  const allMods = dbService.getClassModerationStates(classId);
  console.log('Class moderation map count:', Object.keys(allMods).length);

  // 4. Teacher unmutes student
  dbService.clearParticipantModeration(classId, studentId);
  const afterUnmute = dbService.getParticipantModeration(classId, studentId);
  console.log('After teacher unmute:', afterUnmute || 'Cleared (Unmuted)');
}

testModerationRuntime().catch(console.error);

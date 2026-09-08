import { config } from '../config';
import { AgoraRecordingService } from '../services/recording.service';
import { dbService } from '../services/db.service';

async function testRecordingRuntime() {
  console.log('--- 1. Agora Cloud Recording Reality Check ---');
  console.log('Agora App ID Present:', Boolean(config.agora.appId));
  console.log('Agora Customer ID Present:', Boolean(config.agora.customerId));
  console.log('Agora Customer Secret Present:', Boolean(config.agora.customerSecret));
  console.log('Storage Configured (S3/GCS):', config.recording.isStorageConfigured);
  console.log('Storage Bucket:', config.recording.bucket ? '[CONFIGURED]' : '(None)');
  console.log('Recording Infrastructure Ready for Cloud:', config.agora.isRecordingConfigured && config.recording.isStorageConfigured);

  // Test start -> wait -> stop flow
  const testClassId = 'REC_VERIFY_01';
  const startRes = await AgoraRecordingService.startRecording(testClassId, 'class_REC_VERIFY_01', 'teacher_dr_smith');
  console.log('Start result:', {
    id: startRes.id,
    status: startRes.status,
    storageMode: startRes.storageMode,
    recordingUid: startRes.recordingUid,
  });

  const active = dbService.getActiveRecordingSession(testClassId);
  console.log('Active session in DB:', Boolean(active));

  const stopRes = await AgoraRecordingService.stopRecording(testClassId, 'class_REC_VERIFY_01');
  console.log('Stop result:', {
    id: stopRes.id,
    status: stopRes.status,
    durationSeconds: stopRes.durationSeconds,
    stoppedAt: stopRes.stoppedAt,
    fileList: stopRes.fileList,
  });

  const recordings = dbService.getClassRecordings(testClassId);
  console.log('Saved recordings count:', recordings.length);
}

testRecordingRuntime().catch(console.error);

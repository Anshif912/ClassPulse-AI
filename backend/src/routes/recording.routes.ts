import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { AgoraRecordingService } from '../services/recording.service';
import { requireAuth, requireTeacher, requireTeacherOwnership, requireMembership } from '../middleware/auth.middleware';

const router = Router();

// ─── POST /api/classes/:classId/recording/start ──────────────────────────────
// Teacher-only: start cloud recording for the classroom session
router.post(
  '/:classId/recording/start',
  requireAuth,
  requireTeacherOwnership(),
  async (req: Request, res: Response): Promise<void> => {
    const classId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(classId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    const channelName = classroom.agoraChannel || `class_${classId.replace(/-/g, '_')}`;

    try {
      const recording = await AgoraRecordingService.startRecording(
        classId,
        channelName,
        req.user!.id
      );

      res.status(200).json({
        success: true,
        recordingId: recording.id,
        status: recording.status,
        startedAt: recording.startedAt,
        channelName: recording.agoraChannel,
      });
    } catch (err: any) {
      console.error('[RECORDING_START_ROUTE_ERROR]', err.message);
      res.status(500).json({ error: err.message || 'Failed to start cloud recording.' });
    }
  }
);

// ─── POST /api/classes/:classId/recording/stop ───────────────────────────────
// Teacher-only: stop cloud recording for the classroom session
router.post(
  '/:classId/recording/stop',
  requireAuth,
  requireTeacherOwnership(),
  async (req: Request, res: Response): Promise<void> => {
    const classId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(classId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    const channelName = classroom.agoraChannel || `class_${classId.replace(/-/g, '_')}`;

    try {
      const recording = await AgoraRecordingService.stopRecording(classId, channelName);

      res.status(200).json({
        success: true,
        recordingId: recording.id,
        status: recording.status,
        startedAt: recording.startedAt,
        stoppedAt: recording.stoppedAt,
        durationSeconds: recording.durationSeconds,
        fileList: recording.fileList || [],
      });
    } catch (err: any) {
      console.error('[RECORDING_STOP_ROUTE_ERROR]', err.message);
      res.status(500).json({ error: err.message || 'Failed to stop cloud recording.' });
    }
  }
);

// ─── GET /api/classes/:classId/recording/active ──────────────────────────────
// Members: get current active recording status
router.get(
  '/:classId/recording/active',
  requireAuth,
  requireMembership(),
  (req: Request, res: Response): void => {
    try {
      const classId = req.params.classId.toUpperCase();
      const active = dbService.getActiveRecordingSession(classId);

      if (!active) {
        res.json({ isRecording: false, recording: null });
        return;
      }

      res.json({
        isRecording: true,
        recording: {
          id: active.id,
          startedAt: active.startedAt,
          status: active.status,
        },
      });
    } catch (err: any) {
      console.warn('[RECORDING_ACTIVE_GET_WARNING]', err?.message);
      res.json({ isRecording: false, recording: null });
    }
  }
);

// ─── GET /api/classes/:classId/recordings ────────────────────────────────────
// Teacher-only: get list of past recordings for this classroom
router.get(
  '/:classId/recordings',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const recordings = dbService.getClassRecordings(classId);
    res.json({ recordings });
  }
);

// ─── GET /api/classes/recordings/all ─────────────────────────────────────────
// Teacher-only: get list of all recordings across all classrooms created by this teacher
router.get(
  '/recordings/all',
  requireAuth,
  requireTeacher,
  (req: Request, res: Response): void => {
    const teacherClasses = dbService.getClassroomsForUser(req.user!.id);
    const teacherClassIds = new Set(teacherClasses.map((c) => c.classId.toUpperCase()));

    const allRecordings = dbService
      .getAllRecordings()
      .filter((r) => teacherClassIds.has(r.classId.toUpperCase()));

    res.json({ recordings: allRecordings });
  }
);

export default router;

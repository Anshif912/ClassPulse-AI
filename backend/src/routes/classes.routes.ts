import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dbService, ClassMembership, MaterialChunk } from '../services/db.service';
import { PdfService } from '../services/pdf.service';
import { SemanticChunker } from '../services/rag/chunker';
import { EmbeddingService } from '../services/rag/embeddingService';
import { ragRepository } from '../services/rag/ragRepository';
import { insightsService } from '../services/insights.service';
import { conceptGraphService } from '../services/personalization/conceptGraphService';
import {
  requireAuth,
  requireTeacher,
  requireTeacherOwnership,
  requireMembership,
  rateLimit,
} from '../middleware/auth.middleware';

const router = Router();
const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  storage: multer.memoryStorage(),
});

// ─── GET /api/classes/insights/summary ───────────────────────────────────────
// Teacher-only: aggregate meeting analytics across all teacher's classrooms.
router.get('/insights/summary',
  requireAuth,
  requireTeacher,
  (req: Request, res: Response): void => {
    const overview = insightsService.generateTeacherOverview(req.user!.id);
    res.json(overview);
  }
);

// ─── POST /api/classes/create ─────────────────────────────────────────────────
// Teacher-only: creates a new classroom.
// classId, agoraChannel generated server-side — never trusted from client.
router.post('/create',
  requireAuth,
  requireTeacher,
  rateLimit(10, 60_000),
  (req: Request, res: Response): void => {
    const { name, subject } = req.body as { name?: string; subject?: string };

    if (!name?.trim() || !subject?.trim()) {
      res.status(400).json({ error: 'name and subject are required.' });
      return;
    }

    const classId = generateClassId(subject.trim());
    const agoraChannel = classIdToChannel(classId);
    const now = new Date().toISOString();

    const classroom = dbService.createClassroom({
      id: `cls_${Date.now()}`,
      classId,
      name: name.trim(),
      subject: subject.trim(),
      teacherId: req.user!.id,
      teacherName: req.user!.name,
      teacherEmail: req.user!.email,
      agoraChannel,
      createdAt: now,
      status: 'active',
      materials: [],
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    console.log(`[CLASS_CREATED] id=${classId} teacher=${req.user!.email} name="${name}"`);

    res.status(201).json({
      classId: classroom.classId,
      name: classroom.name,
      subject: classroom.subject,
      teacherName: classroom.teacherName,
      agoraChannel: classroom.agoraChannel,
      joinUrl: `${frontendUrl}/class/${classroom.classId}`,
      createdAt: classroom.createdAt,
    });
  }
);

// ─── GET /api/classes/my ──────────────────────────────────────────────────────
// Returns classrooms the authenticated user belongs to.
router.get('/my', requireAuth, (req: Request, res: Response): void => {
  const classrooms = dbService.getClassroomsForUser(req.user!.id);
  const result = classrooms.map((cls) => {
    const activeMeeting = dbService.getActiveMeetingSession(cls.classId);
    return {
      classId: cls.classId,
      name: cls.name,
      subject: cls.subject,
      teacherName: cls.teacherName,
      status: cls.status,
      isLive: Boolean(activeMeeting),
      materialCount: cls.materials.length,
      createdAt: cls.createdAt,
    };
  });
  res.json({ classrooms: result });
});

// ─── GET /api/classes/:classId ────────────────────────────────────────────────
// Returns public-safe classroom info + membership status for the current user.
router.get('/:classId', requireAuth, (req: Request, res: Response): void => {
  const classId = req.params.classId.toUpperCase();
  const classroom = dbService.getClassroom(classId);

  if (!classroom) {
    res.status(404).json({ error: `Classroom "${classId}" not found.` });
    return;
  }

  const membership = dbService.getMembership(classId, req.user!.id);
  const activeMeeting = dbService.getActiveMeetingSession(classId);

  res.json({
    classId: classroom.classId,
    name: classroom.name,
    subject: classroom.subject,
    teacherName: classroom.teacherName,
    teacherEmail: classroom.teacherEmail,
    status: classroom.status,
    isLive: Boolean(activeMeeting),
    materialCount: classroom.materials.length,
    createdAt: classroom.createdAt,
    membership: membership
      ? { role: membership.role, joinedAt: membership.joinedAt, status: membership.status }
      : null,
  });
});

// ─── POST /api/classes/:classId/join ─────────────────────────────────────────
// Authenticated student joins a classroom by classId.
// Creates a ClassMembership record server-side.
router.post('/:classId/join',
  requireAuth,
  rateLimit(20, 60_000),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(classId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    if (classroom.status === 'ended') {
      res.status(410).json({ error: 'This classroom has ended.' });
      return;
    }

    const existing = dbService.getMembership(classId, req.user!.id);
    if (existing && existing.status === 'active') {
      res.json({
        success: true,
        message: 'Already a member.',
        role: existing.role,
      });
      return;
    }

    const membership: ClassMembership = {
      id: `mem_${Date.now()}_${req.user!.id}`,
      classId,
      userId: req.user!.id,
      role: req.user!.role,   // role comes from authenticated user, NOT request body
      joinedAt: new Date().toISOString(),
      status: 'active',
    };

    dbService.addMembership(membership);
    console.log(`[CLASS_JOIN] user=${req.user!.email} class=${classId} role=${req.user!.role}`);

    res.status(201).json({ success: true, role: membership.role, joinedAt: membership.joinedAt });
  }
);

// ─── POST /api/classes/:classId/start-session ─────────────────────────────────
// Teacher-only: starts a MeetingSession for this classroom.
router.post('/:classId/start-session',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const session = dbService.startMeetingSession(classId);

    console.log(`[MEETING_STARTED] class=${classId} session=${session.id} teacher=${req.user!.email}`);

    res.json({
      sessionId: session.id,
      classId: session.classId,
      agoraChannel: session.agoraChannel,
      startedAt: session.startedAt,
      status: session.status,
    });
  }
);

// ─── POST /api/classes/:classId/end-session ───────────────────────────────────
// Teacher-only: ends the active MeetingSession and closes all attendance records.
router.post('/:classId/end-session',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const session = dbService.endMeetingSession(classId);

    if (!session) {
      res.status(404).json({ error: 'No active session found for this classroom.' });
      return;
    }

    console.log(`[MEETING_ENDED] class=${classId} session=${session.id} teacher=${req.user!.email}`);

    res.json({
      sessionId: session.id,
      classId: session.classId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      status: session.status,
    });
  }
);

// ─── DELETE /api/classes/:classId ───────────────────────────────────────────
// Teacher-only + ownership check: deletes classroom, associated memberships, sessions, materials, and RAG chunks.
router.delete('/:classId',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(classId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    // Purge all materials from RAG repository
    if (classroom.materials) {
      for (const mat of classroom.materials) {
        ragRepository.removeMaterial(classId, mat.id);
      }
    }

    const deleted = dbService.deleteClassroom(classId, req.user!.id);
    if (!deleted) {
      res.status(403).json({ error: 'You are not authorized to delete this classroom.' });
      return;
    }

    console.log(`[CLASS_DELETED] id=${classId} teacher=${req.user!.email}`);

    res.json({
      success: true,
      message: `Classroom "${classroom.name}" (${classId}) and all associated materials were permanently deleted.`,
    });
  }
);

// ─── POST /api/classes/:classId/materials ────────────────────────────────────
// ─── POST /api/classes/:classId/materials ────────────────────────────────────
// Teacher-only + ownership check: upload course material to classroom context.
router.post('/:classId/materials',
  requireAuth,
  requireTeacherOwnership(),
  rateLimit(30, 60_000),
  async (req: Request, res: Response): Promise<void> => {
    const classId = req.params.classId.toUpperCase();
    const { title, content, fileType = 'text' } = req.body as {
      title?: string;
      content?: string;
      fileType?: 'text' | 'pdf';
    };

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: 'title and content are required.' });
      return;
    }

    const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Structure-aware semantic chunking
    const ragChunks = SemanticChunker.chunkDocument(
      [{ pageNumber: 1, text: content.trim() }],
      classId,
      materialId,
      title.trim(),
      undefined,
      req.user!.id
    );

    // 2. Embeddings (bypassed in lexical_fast mode)
    const retrievalMode = (process.env.RAG_RETRIEVAL_MODE || 'lexical_fast').toLowerCase();
    if (retrievalMode !== 'lexical_fast') {
      const embeddings = await EmbeddingService.embedBatch(ragChunks.map((c) => c.text));
      for (let i = 0; i < ragChunks.length; i++) {
        ragChunks[i].embedding = embeddings[i];
      }
    }

    // 3. Add to RAG 2.0 Repository
    ragRepository.addChunks(ragChunks);

    const legacyChunks: MaterialChunk[] = ragChunks.map((c) => ({
      id: c.metadata.chunkId,
      materialId,
      classId,
      title: title.trim(),
      pageNumber: 1,
      chunkIndex: c.metadata.chunkIndex,
      content: c.text,
      tokenCount: c.metadata.tokenCount,
    }));

    const material = {
      id: materialId,
      classId,
      uploadedBy: req.user!.id,
      title: title.trim(),
      content: content.trim(),
      uploadedAt: new Date().toISOString(),
      fileType: fileType as 'text' | 'pdf',
      chunks: legacyChunks,
    };

    const updated = dbService.addClassroomMaterial(classId, material);

    if (!updated) {
      res.status(404).json({ error: 'Classroom not found.' });
      return;
    }

    console.log(`[MATERIAL_UPLOADED] class=${classId} title="${title}" chunks=${ragChunks.length} teacher=${req.user!.email}`);

    res.status(201).json({
      success: true,
      materialId: material.id,
      message: `"${title.trim()}" added to ClassPulse AI context (${ragChunks.length} chunks indexed).`,
    });
  }
);

// ─── POST /api/classes/:classId/materials/upload-pdf ─────────────────────────
// Teacher-only: upload and ingest PDF course material into RAG knowledge base.
router.post('/:classId/materials/upload-pdf',
  requireAuth,
  requireTeacherOwnership(),
  rateLimit(15, 60_000),
  upload.single('pdf'),
  async (req: Request, res: Response): Promise<void> => {
    const classId = req.params.classId.toUpperCase();
    const file = req.file;
    const titleOverride = req.body?.title;

    if (!file || !file.buffer) {
      res.status(400).json({ error: 'PDF file is required (multipart field name: "pdf").' });
      return;
    }

    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      res.status(400).json({ error: 'Only PDF documents are supported.' });
      return;
    }

    try {
      const materialId = `mat_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const processed = await PdfService.processPdfBuffer(
        file.buffer,
        file.originalname,
        classId,
        materialId,
        titleOverride,
        req.user!.id
      );

      // Index in RAG Repository
      ragRepository.addChunks(processed.ragChunks);

      const material = {
        id: materialId,
        classId,
        uploadedBy: req.user!.id,
        title: processed.title,
        content: processed.totalText.substring(0, 2000) + '...', // summary preview
        filename: file.originalname,
        pageCount: processed.pageCount,
        uploadedAt: new Date().toISOString(),
        fileType: 'pdf' as const,
        chunks: processed.chunks,
      };

      const updated = dbService.addClassroomMaterial(classId, material);
      if (!updated) {
        res.status(404).json({ error: 'Classroom not found.' });
        return;
      }

      // Invalidate concept graph cache so it rebuilds from new materials/subject
      conceptGraphService.invalidateCache(classId);

      console.log(`[PDF_INGESTED] class=${classId} file="${file.originalname}" pages=${processed.pageCount} chunks=${processed.chunks.length}`);

      res.status(201).json({
        success: true,
        materialId: material.id,
        title: processed.title,
        pageCount: processed.pageCount,
        chunkCount: processed.chunks.length,
        message: `"${processed.title}" (${processed.pageCount} pages, ${processed.chunks.length} chunks) ingested into ClassPulse AI RAG context.`,
      });
    } catch (err: any) {
      console.error('[PDF_INGEST_ERROR]', err.message);
      res.status(400).json({ error: err.message || 'Failed to process PDF document.' });
    }
  }
);

// ─── DELETE /api/classes/:classId/materials/:materialId ─────────────────────
// Teacher-only + ownership check: removes material and purges its RAG chunks immediately.
router.delete('/:classId/materials/:materialId',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const { materialId } = req.params;

    const removed = dbService.deleteClassroomMaterial(classId, materialId);
    if (!removed) {
      res.status(404).json({ error: 'Material or Classroom not found.' });
      return;
    }

    // Immediately purge chunks from RAG retrieval index
    ragRepository.removeMaterial(classId, materialId);

    console.log(`[MATERIAL_DELETED] class=${classId} materialId=${materialId} teacher=${req.user!.email}`);

    res.json({
      success: true,
      message: 'Material and all associated AI retrieval chunks deleted successfully.',
    });
  }
);

// ─── GET /api/classes/:classId/roster ─────────────────────────────────────────
// Returns live active participant roster mapping (Agora UID -> Authoritative User Profile)
router.get('/:classId/roster',
  requireAuth,
  requireMembership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const roster = dbService.getActiveRoster(classId);
    res.json({ roster });
  }
);

// ─── GET /api/classes/:classId/materials ─────────────────────────────────────
// Returns material titles only (not content) for members.
router.get('/:classId/materials',
  requireAuth,
  requireMembership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(classId);

    const materials = (classroom?.materials || []).map((m) => ({
      id: m.id,
      title: m.title,
      fileType: m.fileType,
      uploadedAt: m.uploadedAt,
    }));

    res.json({ materials });
  }
);

// ─── GET /api/classes/:classId/attendance ────────────────────────────────────
// Teacher-only: full attendance records for the classroom.
router.get('/:classId/attendance',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const records = dbService.getClassAttendance(classId);

    res.json({
      classId,
      records: records.map((r) => ({
        userId: r.userId,
        userName: r.userName,
        joinTime: r.joinTime,
        leaveTime: r.leaveTime,
        durationSeconds: r.durationSeconds,
        durationFormatted: formatDuration(r.durationSeconds),
      })),
      totalParticipants: records.length,
    });
  }
);

// ─── GET /api/classes/:classId/members ───────────────────────────────────────
// Teacher-only: member list for the classroom.
router.get('/:classId/members',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const members = dbService.getClassMembers(classId);

    res.json({
      classId,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
        status: m.status,
      })),
      total: members.length,
    });
  }
);

// ─── GET /api/classes/:classId/insights ─────────────────────────────────────
// Teacher-only: detailed meeting analytics, topics covered, and past session history.
router.get('/:classId/insights',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const analytics = insightsService.generateClassroomAnalytics(classId);
    res.json(analytics);
  }
);

// ─── POST /api/classes/:classId/moderation/mute-participant ──────────────────
// Teacher-only: remote-mute a specific student's microphone
router.post('/:classId/moderation/mute-participant',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const { targetUserId, reason } = req.body as { targetUserId?: string; reason?: string };

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required.' });
      return;
    }

    const record = {
      userId: targetUserId,
      isMuted: true,
      mutedBy: req.user!.id,
      mutedByName: req.user!.name,
      mutedAt: new Date().toISOString(),
      reason: reason || 'Muted by teacher',
    };

    dbService.setParticipantModeration(classId, targetUserId, record);
    console.log(`[MODERATION_MUTE] class=${classId} teacher=${req.user!.email} muted student=${targetUserId}`);

    res.json({
      success: true,
      message: `Participant ${targetUserId} has been muted.`,
      moderation: record,
    });
  }
);

// ─── POST /api/classes/:classId/moderation/unmute-participant ────────────────
// Teacher-only: allow a previously muted student to unmute
router.post('/:classId/moderation/unmute-participant',
  requireAuth,
  requireTeacherOwnership(),
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const { targetUserId } = req.body as { targetUserId?: string };

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required.' });
      return;
    }

    dbService.clearParticipantModeration(classId, targetUserId);
    console.log(`[MODERATION_UNMUTE] class=${classId} teacher=${req.user!.email} unmuted student=${targetUserId}`);

    res.json({
      success: true,
      message: `Participant ${targetUserId} has been unmuted.`,
    });
  }
);

// ─── GET /api/classes/:classId/moderation ────────────────────────────────────
// Members: get moderation state for the classroom
router.get('/:classId/moderation',
  requireAuth,
  requireMembership(),
  (req: Request, res: Response): void => {
    try {
      const classId = req.params.classId.toUpperCase();
      const moderations = dbService.getClassModerationStates(classId);
      const myModeration = dbService.getParticipantModeration(classId, req.user!.id);

      res.json({
        moderations: moderations || {},
        isUserMutedByModerator: Boolean(myModeration?.isMuted),
        myModeration: myModeration || null,
      });
    } catch (err: any) {
      console.warn('[CLASS_MODERATION_GET_WARNING]', err?.message);
      res.json({
        moderations: {},
        isUserMutedByModerator: false,
        myModeration: null,
      });
    }
  }
);

export default router;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateClassId(subject: string): string {
  const prefix = subject
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .substring(0, 3)
    .padEnd(3, 'X');
  const suffix = Math.random().toString(36).toUpperCase().substring(2, 7);
  return `${prefix}-${suffix}`;
}

function classIdToChannel(classId: string): string {
  return `class_${classId.replace(/-/g, '_')}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

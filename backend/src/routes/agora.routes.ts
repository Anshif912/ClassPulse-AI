import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { agoraService } from '../services/voice/agora.service';
import { requireAuth, requireMembership, rateLimit } from '../middleware/auth.middleware';

const router = Router();

// ─── POST /api/agora/token ────────────────────────────────────────────────────
// Requires: authenticated user + class membership
// Server derives the Agora channel from classId — browser never specifies channel.
// UID is a stable hash derived from user.id to prevent identity collisions.
router.post('/token',
  requireAuth,
  rateLimit(120, 60_000), // 120 token requests per minute per IP
  async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.body as { classId: string };

    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    // Verify membership — server-side only
    const membership = dbService.getMembership(upperClassId, req.user!.id);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    // Stable numeric UID derived from user ID (avoids duplicate UID collisions)
    const uid = stableUid(req.user!.id);

    // Channel is derived from classroom, never from client input
    const channel = classroom.agoraChannel;
    const role = membership.role === 'TEACHER' ? 'publisher' : 'publisher';

    try {
      const tokenResult = agoraService.generateRtcToken(channel, uid, role);

      // Record attendance join time
      try {
        dbService.recordAttendanceJoin(upperClassId, req.user!);
        dbService.registerActiveParticipant(upperClassId, {
          userId: req.user!.id,
          agoraUid: uid,
          displayName: req.user!.name,
          email: req.user!.email,
          role: membership.role,
          avatarUrl: req.user!.avatarUrl,
          joinedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[AGORA_TOKEN] Attendance/Roster record failed (non-fatal):', (e as Error).message);
      }

      console.log(`[TOKEN_ISSUED] user=${req.user!.email} class=${upperClassId} uid=${uid} channel=${channel}`);

      res.json({
        appId: tokenResult.appId,
        channel,
        token: tokenResult.token,
        uid,
        expiresAt: tokenResult.expiresAt,
        role: membership.role,
        userName: req.user!.name,
        userAvatar: req.user!.avatarUrl,
      });
    } catch (err: any) {
      console.error(`[AGORA_TOKEN_ERROR] class=${upperClassId} user=${req.user!.email}:`, err.message);
      res.status(500).json({
        error: `Agora token generation failed: ${err.message}`,
      });
    }
  }
);

// ─── GET /api/agora/roster/:classId ──────────────────────────────────────────
// Returns classroom roster with stable numeric UIDs so client resolves real names & roles.
router.get('/roster/:classId',
  requireAuth,
  requireMembership,
  (req: Request, res: Response): void => {
    const classId = req.params.classId.toUpperCase();
    const members = dbService.getClassMembers(classId);
    const activeRoster = dbService.getActiveRoster(classId);

    const roster = members.map((m) => {
      const uid = stableUid(m.userId);
      const active = activeRoster[uid];
      return {
        uid,
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: (m.role === 'TEACHER' ? 'teacher' : 'student') as 'teacher' | 'student',
        isOnline: Boolean(active),
      };
    });
    res.json({ roster, activeRoster });
  }
);

// ─── POST /api/agora/attendance/leave ─────────────────────────────────────────
// Called by the browser when a user leaves the classroom.
// Also reconciled server-side when meeting sessions end.
router.post('/attendance/leave',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.body as { classId: string };

    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const uid = stableUid(req.user!.id);
    dbService.removeActiveParticipant(upperClassId, uid);
    const record = dbService.recordAttendanceLeave(upperClassId, req.user!.id);

    if (record) {
      console.log(`[PARTICIPANT_LEAVE] user=${req.user!.email} class=${classId} duration=${record.durationSeconds}s`);
    }

    res.json({ success: true, durationSeconds: record?.durationSeconds ?? 0 });
  }
);

// ─── POST /api/agora/agent/start ─────────────────────────────────────────────
// Starts an Agora Conversational AI Agent session for the student's private AI interaction.
// Derives classroom and private AI sub-channel server-side.
router.post('/agent/start',
  requireAuth,
  rateLimit(30, 60_000),
  async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.body as { classId: string };

    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    const membership = dbService.getMembership(upperClassId, req.user!.id);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    const studentUid = stableUid(req.user!.id);
    const conversation = dbService.getOrCreateConversation(upperClassId, req.user!.id);

    try {
      const result = await agoraService.startAgentSession(
        classroom.agoraChannel,
        studentUid,
        upperClassId,
        conversation.id
      );

      res.json({
        agentId: result.agentId,
        aiChannel: result.aiChannel,
        agentUid: result.agentUid,
        studentUid,
        state: result.state,
        token: result.token,
        appId: result.appId,
        message: result.message,
        developerDiagnostic: (result as any).developerDiagnostic,
      });
    } catch (err: any) {
      console.error(`[AGORA_AGENT_START_ERROR] user=${req.user!.email} class=${upperClassId}:`, err.message);
      res.status(500).json({
        error: `Failed to start agent: ${err.message}`,
        developerDiagnostic: 'Agora Conversational AI Agent failed',
      });
    }
  }
);

// ─── GET /api/agora/agent/diagnostics ────────────────────────────────────────
// Safe diagnostic check verifying backend Gemini Live + Agora config without exposing keys.
router.get('/agent/diagnostics',
  (req: Request, res: Response): void => {
    const diagnostics = agoraService.getDiagnostics();
    res.json(diagnostics);
  }
);

// ─── POST /api/agora/agent/stop ──────────────────────────────────────────────
router.post('/agent/stop',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.body as { classId: string };
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    const studentUid = stableUid(req.user!.id);
    const aiChannel = `${classroom.agoraChannel}_ai_${studentUid}`;

    const result = await agoraService.stopAgentSession(aiChannel);
    res.json(result);
  }
);

// ─── POST /api/agora/agent/interrupt ─────────────────────────────────────────
router.post('/agent/interrupt',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { classId } = req.body as { classId: string };
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const upperClassId = classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    const studentUid = stableUid(req.user!.id);
    const aiChannel = `${classroom.agoraChannel}_ai_${studentUid}`;

    const result = await agoraService.interruptAgentSession(aiChannel);
    res.json(result);
  }
);

// ─── GET /api/agora/agent/status/:classId ────────────────────────────────────
router.get('/agent/status/:classId',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    const studentUid = stableUid(req.user!.id);
    const aiChannel = `${classroom.agoraChannel}_ai_${studentUid}`;

    const status = agoraService.getAgentStatus(aiChannel);
    res.json(status);
  }
);

// ─── POST /api/agora/llm-webhook (Secondary Fallback Webhook) ────────────────
router.post('/llm-webhook', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization || (req.headers['x-webhook-secret'] as string) || '';

  const result = await agoraService.handleLLMWebhook(authHeader, req.body);

  if (!result.authorized) {
    res.status(401).json({
      error: 'Unauthorized: Invalid or missing CLASSPULSE_WEBHOOK_SECRET token.',
    });
    return;
  }

  res.json({
    choices: [
      {
        message: result.response,
        finish_reason: 'stop',
      },
    ],
    usage: {
      total_tokens: 120,
    },
  });
});

export default router;

// ─── Stable UID helper ─────────────────────────────────────────────────────────
// Converts a string user ID into a stable non-zero 32-bit unsigned integer
// suitable for Agora (which requires numeric UIDs).
// Uses a simple DJB2-style hash — collision risk is negligible for <1000 users.
function stableUid(userId: string): number {
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 33) ^ userId.charCodeAt(i);
  }
  // Ensure positive, non-zero, fits in 32-bit uint
  const uid = Math.abs(hash >>> 0) % 999_000_000 + 1_000;
  return uid;
}

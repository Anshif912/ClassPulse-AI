import { Router, Request, Response } from 'express';
import { dbService } from '../services/db.service';
import { ragPipeline } from '../services/rag/ragPipeline';
import { ragEngine } from '../services/rag/ragEngine';
import { personalizedRAGAdapter } from '../services/personalization/personalizedRAGAdapter';
import { requireAuth, requireMembership, rateLimit } from '../middleware/auth.middleware';

const router = Router();

// ─── POST /api/chat/classroom ─────────────────────────────────────────────────
// Authenticated, class-membership-verified AI chat.
// User identity comes from req.user (server-side session) — never from request body.
// Conversations are private per user+class and stored in DB.
router.post('/classroom',
  requireAuth,
  rateLimit(40, 60_000), // 40 messages per minute per IP
  async (req: Request, res: Response): Promise<void> => {
    const { classId, message, source = 'text' } = req.body as {
      classId?: string;
      message?: string;
      source?: 'text' | 'voice';
    };

    if (!classId?.trim()) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }
    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required.' });
      return;
    }

    const upperClassId = classId.trim().toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${upperClassId}" not found.` });
      return;
    }

    // Verify membership server-side — user identity from session, not body
    const membership = dbService.getMembership(upperClassId, req.user!.id);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    try {
      // Get or create private conversation for this user+class pair
      const conversation = dbService.getOrCreateConversation(upperClassId, req.user!.id);

      const recentStudentQuestions = dbService
        .getConversationHistory(conversation.id)
        .filter((m) => m.role === 'student')
        .slice(-5)
        .map((m) => m.content);

      // 1. Process via Adaptive Personalized RAG Adapter (Qwen3 4B)
      const ragResult = await personalizedRAGAdapter.queryPersonalized(
        message.trim(),
        upperClassId,
        req.user!.id,
        recentStudentQuestions
      );

      const now = new Date().toISOString();

      // Persist both sides of the conversation in DB
      dbService.addAIMessage(conversation.id, {
        role: 'student',
        content: message.trim(),
        topic: ragResult.topic,
      });

      dbService.addAIMessage(conversation.id, {
        role: 'companion',
        content: ragResult.answerText,
        topic: ragResult.topic,
      });

      console.log(`[AI_REQUEST] user=${req.user!.email} class=${upperClassId} lang=${ragResult.detectedLanguage} evidence=${ragResult.evidenceState} strategy=${ragResult.tutorDecision?.strategy}`);

      // Response matches the ChatMessage type the frontend expects
      res.json({
        message: {
          id: `msg_${Date.now()}_companion`,
          sessionId: conversation.id,
          role: 'companion',
          content: ragResult.answerText,
          timestamp: now,
          intent: 'educational',
          evidenceState: ragResult.evidenceState,
          sources: ragResult.sources,
          ragContext: ragResult.topic
            ? {
                topic: ragResult.topic,
                relevanceScore: ragResult.evidenceState === 'STRONG_EVIDENCE' ? 0.95 : 0.4,
              }
            : undefined,
          tutorDecision: ragResult.tutorDecision,
          transparencyRationale: ragResult.transparencyRationale,
          suggestedFollowUpPractice: ragResult.suggestedFollowUpPractice,
        },
        spokenText: ragResult.spokenText || ragResult.answerText,
        detectedLanguage: ragResult.detectedLanguage,
        voiceLocale: ragResult.detectedLanguage === 'ta' || ragResult.detectedLanguage === 'tanglish' ? 'ta-IN' : ragResult.detectedLanguage === 'hi' ? 'hi-IN' : 'en-US',
        isEducational: ragResult.isEducational,
        evidenceState: ragResult.evidenceState,
        sources: ragResult.sources,
        diagnostics: ragResult.diagnostics,
        tutorDecision: ragResult.tutorDecision,
        transparencyRationale: ragResult.transparencyRationale,
        suggestedFollowUpPractice: ragResult.suggestedFollowUpPractice,
      });
    } catch (err: any) {
      console.error(`[AI_ERROR] user=${req.user!.email} class=${upperClassId}`, err.message);
      res.status(500).json({ error: 'AI assistant encountered an error. Please try again.' });
    }
  }
);

// ─── GET /api/chat/classroom/:classId/history ─────────────────────────────────
// Returns the authenticated user's private AI conversation history for a class.
// Strictly isolated — each user only sees their own conversation.
router.get('/classroom/:classId/history',
  requireAuth,
  (req: Request, res: Response): void => {
    const upperClassId = req.params.classId.toUpperCase();

    const membership = dbService.getMembership(upperClassId, req.user!.id);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    const conversation = dbService.getOrCreateConversation(upperClassId, req.user!.id);
    const history = dbService.getConversationHistory(conversation.id);

    res.json({
      conversationId: conversation.id,
      classId: upperClassId,
      userId: req.user!.id,   // confirm isolation: only user's own conversation
      messages: history.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        topic: m.topic,
      })),
    });
  }
);

// ─── Legacy POST /api/chat ────────────────────────────────────────────────────
// Preserved for backward compatibility with the legacy companion flow.
// Does NOT require auth (legacy sessions are identified by sessionId).
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, message, source = 'text' } = req.body as {
    sessionId?: string;
    message?: string;
    source?: 'text' | 'voice';
  };

  if (!sessionId?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'sessionId and message are required.' });
    return;
  }

  const session = dbService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: `Session "${sessionId}" not found.` });
    return;
  }

  try {
    const ragResult = ragEngine.processQuery(message.trim(), session);
    const now = new Date().toISOString();

    const studentMsg = {
      id: `msg_${Date.now()}_student`,
      sessionId,
      role: 'student' as const,
      content: message.trim(),
      timestamp: now,
    };

    const companionMsg = {
      id: `msg_${Date.now()}_companion`,
      sessionId,
      role: 'companion' as const,
      content: ragResult.answerText,
      timestamp: now,
      intent: ragResult.intent,
      ragContext: ragResult.topic
        ? {
            topic: ragResult.topic,
            chapter: ragResult.chapter || '',
            relevanceScore: ragResult.relevanceScore || 0,
            matchedKeywords: ragResult.matchedKeywords || [],
          }
        : undefined,
    };

    dbService.addMessage(sessionId, studentMsg);
    dbService.addMessage(sessionId, companionMsg);

    res.json({
      message: companionMsg,
      spokenText: ragResult.spokenText || ragResult.answerText,
      isEducational: ragResult.isEducational,
      intent: ragResult.intent,
    });
  } catch (err: any) {
    console.error('[CHAT_ERROR]', err.message);
    res.status(500).json({ error: 'AI assistant encountered an error.' });
  }
});

export default router;

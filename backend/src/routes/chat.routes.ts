import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { dbService } from '../services/db.service';
import { ragEngine } from '../services/rag/ragEngine';

const router = Router();

const chatRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  message: z.string().min(1, 'Message cannot be empty'),
  source: z.enum(['text', 'voice']).optional().default('text'),
});

function processMessage(sessionId: string, message: string, source: 'text' | 'voice', res: Response): void {
  const session = dbService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: `Session "${sessionId}" not found. Please join a valid class session.` });
    return;
  }

  try {
    const ragResult = ragEngine.processQuery(message, session);

    const now = new Date().toISOString();
    const studentMsg = {
      id: `msg_${Date.now()}_student`,
      sessionId,
      role: 'student' as const,
      content: message,
      timestamp: now,
    };

    const companionMsg = {
      id: `msg_${Date.now()}_companion`,
      sessionId,
      role: 'companion' as const,
      content: ragResult.answerText,
      timestamp: now,
      intent: ragResult.intent,
      ragContext: ragResult.topic ? {
        topic: ragResult.topic,
        chapter: ragResult.chapter || '',
        relevanceScore: ragResult.relevanceScore || 1.0,
        matchedKeywords: ragResult.matchedKeywords || [],
      } : undefined,
    };

    dbService.addMessage(sessionId, studentMsg);
    dbService.addMessage(sessionId, companionMsg);

    if (ragResult.topic) {
      dbService.updateSession(sessionId, { currentTopic: ragResult.topic });
    }

    res.json({
      message: companionMsg,
      spokenText: ragResult.spokenText,
      isEducational: ragResult.isEducational,
      intent: ragResult.intent,
      proactiveSuggestion: ragResult.proactiveSuggestion,
    });
  } catch (err: any) {
    console.error('[CHAT ERROR]', err);
    res.status(500).json({
      error: 'An error occurred while analyzing your question. Please try rephrasing.',
      details: err.message,
    });
  }
}

// POST /api/chat
router.post('/', (req: Request, res: Response): void => {
  const parseResult = chatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { sessionId, message, source } = parseResult.data;
  processMessage(sessionId, message, source, res);
});

// POST /api/voice/question
router.post('/voice/question', (req: Request, res: Response): void => {
  const { sessionId, recognizedText } = req.body;
  if (!sessionId || !recognizedText) {
    res.status(400).json({ error: 'sessionId and recognizedText are required' });
    return;
  }

  processMessage(sessionId, recognizedText, 'voice', res);
});

export default router;

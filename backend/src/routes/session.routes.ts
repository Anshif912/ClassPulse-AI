import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { dbService, Session } from '../services/db.service';
import { validateMeetUrl } from '../services/urlValidator';
import { agoraService } from '../services/voice/agora.service';
import { insightsService } from '../services/insights.service';
import { config } from '../config';
import { EDUCATIONAL_CORPUS } from '../services/rag/corpus';

const router = Router();

const createSessionSchema = z.object({
  meetingUrl: z.string().min(1, 'Meeting URL is required'),
  participantName: z.string().optional(),
  participantEmail: z.string().optional(),
  subject: z.string().optional(),
  chapter: z.string().optional(),
  isAddon: z.boolean().optional(),
});

// POST /api/session/create
router.post('/create', (req: Request, res: Response): void => {
  const parseResult = createSessionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors[0].message });
    return;
  }

  const { meetingUrl, participantName, participantEmail, subject, chapter, isAddon } = parseResult.data;

  // Validate Google Meet URL without destructive modification
  const urlValidation = validateMeetUrl(meetingUrl);

  console.log('----------------------------------------------------');
  console.log('[ClassPulse Session Creation]');
  console.log(`- Meeting URL:       "${urlValidation.finalUrl}"`);
  console.log(`- Meeting Code:      "${urlValidation.meetingCode}"`);
  console.log(`- Mode:              ${isAddon ? 'Google Meet Add-on' : 'Web Companion'}`);
  console.log('----------------------------------------------------');

  if (!urlValidation.isValid) {
    res.status(400).json({
      error: urlValidation.error || 'Invalid Google Meet link. Please paste the complete meeting URL.',
      validationDetails: urlValidation,
    });
    return;
  }

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const participantId = `student_${Math.floor(1000 + Math.random() * 9000)}`;
  const channelName = `classpulse_${urlValidation.meetingCode || 'room'}`;

  const session = dbService.createSession({
    id: sessionId,
    meetingUrl: urlValidation.finalUrl,
    originalMeetingUrl: meetingUrl,
    normalizedMeetingUrl: urlValidation.finalUrl,
    meetingCode: urlValidation.meetingCode,
    participantId,
    participantName: participantName?.trim() || 'Student',
    participantEmail: participantEmail?.trim(),
    startedAt: new Date().toISOString(),
    subject: subject || 'Mathematics',
    chapter: chapter || 'Algebra',
    isAddonSession: Boolean(isAddon),
  });

  const voiceMode = config.agora.isConfigured ? 'agora' : 'browser_fallback';
  const agoraData = agoraService.generateRtcToken(channelName, 1001);

  const baseUrl = config.webhook.publicUrl || 'http://localhost:5173';
  const addonUrls = {
    sidePanelUrl: `${baseUrl}/addon/side-panel?session_id=${sessionId}&meeting_url=${encodeURIComponent(urlValidation.finalUrl)}`,
    mainStageUrl: `${baseUrl}/addon/main-stage?session_id=${sessionId}&meeting_url=${encodeURIComponent(urlValidation.finalUrl)}`,
  };

  res.status(201).json({
    session,
    agora: {
      appId: agoraData.appId,
      channelName: agoraData.channelName,
      token: agoraData.token,
      uid: agoraData.uid,
      agentConfigured: config.agora.isConfigured,
      voiceName: 'en-US-JennyNeural',
    },
    voiceMode,
    addonUrls,
    debug: {
      originalInput: urlValidation.originalInput,
      trimmedInput: urlValidation.trimmedInput,
      finalUrl: urlValidation.finalUrl,
      isModified: urlValidation.isModified,
      openedExternally: true,
      meetingCode: urlValidation.meetingCode || '',
    },
  });
});

// POST /api/session/join
router.post('/join', (req: Request, res: Response): void => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = dbService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({ session });
});

// GET /api/session/:id
router.get('/:id', (req: Request, res: Response): void => {
  const session = dbService.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ session });
});

// GET /api/session/:id/insights (Classroom level teacher insights - Phase 14)
router.get('/:id/insights', (req: Request, res: Response): void => {
  const insights = insightsService.generateClassroomInsights(req.params.id);
  res.json({ insights });
});

// POST /api/session/end
router.post('/end', (req: Request, res: Response): void => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = dbService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const endedAt = new Date().toISOString();
  dbService.updateSession(sessionId, { endedAt });

  // Calculate duration
  const startTime = new Date(session.startedAt).getTime();
  const endTime = new Date(endedAt).getTime();
  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));

  const studentMessages = session.conversationHistory.filter(m => m.role === 'student');
  const companionMessages = session.conversationHistory.filter(m => m.role === 'companion');

  const topicsDiscussedSet = new Set<string>();
  if (session.currentTopic) topicsDiscussedSet.add(session.currentTopic);

  companionMessages.forEach(m => {
    if (m.ragContext?.topic) {
      topicsDiscussedSet.add(m.ragContext.topic);
    }
  });

  const topicsDiscussed = Array.from(topicsDiscussedSet);
  if (topicsDiscussed.length === 0) {
    topicsDiscussed.push(session.subject || 'Classroom Discussion');
  }

  const keyConceptsLearned = topicsDiscussed.map(topicName => {
    const doc = EDUCATIONAL_CORPUS.find(d => d.topic === topicName);
    return {
      concept: topicName,
      summary: doc?.summary || `Discussed during class session.`,
      keyPoints: doc?.keyConcepts || ['Reviewed core subject principles.'],
    };
  });

  const conceptsToReview = topicsDiscussed.slice(0, 2).map(topicName => ({
    concept: topicName,
    suggestion: `Review fundamental formulas and practice problems for ${topicName}.`,
  }));

  const insights = insightsService.generateClassroomInsights(sessionId);
  const classroomInsights = insights.map(i => `${i.topic}: ${i.insight}`);

  const conversationLog = studentMessages.map((sMsg, idx) => {
    const cMsg = companionMessages[idx];
    return {
      question: sMsg.content,
      answer: cMsg?.content || 'Answered in session.',
      timestamp: sMsg.timestamp,
    };
  });

  const summary = {
    sessionId: session.id,
    meetingUrl: session.meetingUrl,
    durationMinutes,
    totalQuestions: studentMessages.length,
    topicsDiscussed,
    keyConceptsLearned,
    conceptsToReview,
    classroomInsights,
    conversationLog,
  };

  res.json({
    session: dbService.getSession(sessionId),
    summary,
  });
});

// POST /api/materials/upload
router.post('/materials/upload', (req: Request, res: Response): void => {
  const { sessionId, note, title } = req.body;
  if (!sessionId || !note) {
    res.status(400).json({ error: 'sessionId and note are required' });
    return;
  }

  const session = dbService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const noteContent = title ? `[${title}]: ${note}` : note;
  dbService.addNote(sessionId, noteContent);

  res.json({
    success: true,
    message: 'Material notes uploaded successfully to session context.',
    totalNotes: session.notes.length + 1,
  });
});

export default router;

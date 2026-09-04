import { Router, Request, Response } from 'express';
import { agoraService } from '../services/voice/agora.service';
import { config } from '../config';

const router = Router();

// POST /api/agora/token
router.post('/token', (req: Request, res: Response): void => {
  const { channelName, uid, role } = req.body;
  if (!channelName) {
    res.status(400).json({ error: 'channelName is required' });
    return;
  }

  const tokenData = agoraService.generateRtcToken(channelName, uid || 0, role || 'publisher');
  res.json(tokenData);
});

// POST /api/agora/agent/start
router.post('/agent/start', async (req: Request, res: Response): Promise<void> => {
  const { channelName, sessionId, participantUid } = req.body;
  if (!channelName || !sessionId) {
    res.status(400).json({ error: 'channelName and sessionId are required' });
    return;
  }

  try {
    const startResult = await agoraService.startAgent(channelName, sessionId, participantUid);
    res.json(startResult);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start Agora Conversational AI Agent', details: err.message });
  }
});

// POST /api/agora/agent/stop
router.post('/agent/stop', async (req: Request, res: Response): Promise<void> => {
  const { channelName } = req.body;
  if (!channelName) {
    res.status(400).json({ error: 'channelName is required' });
    return;
  }

  try {
    const stopResult = await agoraService.stopAgent(channelName);
    res.json(stopResult);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to stop Agora Conversational AI Agent', details: err.message });
  }
});

// POST /api/agora/llm-webhook (Authenticated via CLASSPULSE_WEBHOOK_SECRET - FIX 2)
router.post('/llm-webhook', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization || (req.headers['x-webhook-secret'] as string) || '';

  const result = agoraService.handleLLMWebhook(authHeader, req.body);

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

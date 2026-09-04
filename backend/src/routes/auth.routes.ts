import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// GET /api/auth/google/url
router.get('/google/url', (req: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = `${config.webhook.publicUrl || 'http://localhost:3001'}/api/auth/google/callback`;
  const scopes = [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/meetings.space.readonly',
  ].join(' ');

  if (!clientId) {
    res.json({
      authRequired: false,
      message: 'Google Client ID not configured. Running in open local companion mode.',
      authUrl: null,
    });
    return;
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(
    scopes
  )}&access_type=offline&prompt=consent`;

  res.json({
    authRequired: true,
    authUrl,
  });
});

// GET /api/auth/google/callback
router.get('/google/callback', (req: Request, res: Response): void => {
  const { code, error } = req.query;

  if (error) {
    res.redirect(`http://localhost:5173/?auth_error=${encodeURIComponent(String(error))}`);
    return;
  }

  // Redirect back to frontend with success token parameter
  res.redirect(`http://localhost:5173/?auth_success=true&code=${encodeURIComponent(String(code))}`);
});

// GET /api/auth/status
router.get('/status', (req: Request, res: Response): void => {
  res.json({
    googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    agoraConfigured: config.agora.isConfigured,
  });
});

export default router;

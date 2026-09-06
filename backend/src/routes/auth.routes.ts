import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { dbService, User } from '../services/db.service';
import { requireAuth, rateLimit, cookieOptions } from '../middleware/auth.middleware';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function getRedirectUri() {
  return `${BACKEND_URL}/api/auth/google/callback`;
}

function getOAuthClient() {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, getRedirectUri());
}

// ─── OTP In-Memory Store ──────────────────────────────────────────────────────
interface OtpRecord {
  otp: string;
  email: string;
  name?: string;
  role: 'TEACHER' | 'STUDENT';
  expiresAt: number;
}

const otpStore = new Map<string, OtpRecord>();

// ─── POST /api/auth/otp/send ──────────────────────────────────────────────────
// Sends a 6-digit OTP for Email-based authentication
router.post('/otp/send',
  rateLimit(10, 60_000),
  (req: Request, res: Response): void => {
    const { email, name, role = 'STUDENT' } = req.body as {
      email?: string;
      name?: string;
      role?: 'TEACHER' | 'STUDENT';
    };

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanEmail, {
      otp,
      email: cleanEmail,
      name: name?.trim(),
      role: role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
      expiresAt,
    });

    console.log(`\n====================================================`);
    console.log(`🔑 [CLASS PULSE OTP] Email: ${cleanEmail}`);
    console.log(`🔐 Verification Code: ${otp}`);
    console.log(`====================================================\n`);

    res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}`,
      devOtp: otp, // Returned for instant testing
    });
  }
);

// ─── POST /api/auth/otp/verify ────────────────────────────────────────────────
// Verifies OTP, creates/finds User in DB, creates HttpOnly session cookie
router.post('/otp/verify',
  rateLimit(20, 60_000),
  (req: Request, res: Response): void => {
    const { email, otp, name, role } = req.body as {
      email?: string;
      otp?: string;
      name?: string;
      role?: 'TEACHER' | 'STUDENT';
    };

    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore.get(cleanEmail);

    if (!record || record.expiresAt < Date.now()) {
      res.status(400).json({ error: 'OTP has expired or was not requested. Please request a new code.' });
      return;
    }

    if (record.otp !== otp.trim()) {
      res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
      return;
    }

    otpStore.delete(cleanEmail);

    let user = dbService.getUserByEmail(cleanEmail);
    const userName = name?.trim() || record.name || cleanEmail.split('@')[0];
    const userRole = role || record.role || 'STUDENT';

    if (!user) {
      const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        name: userName,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
        role: userRole,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      user = dbService.createUser(newUser);
      console.log(`[AUTH_OTP] New user created: ${cleanEmail} (${userRole})`);
    } else {
      user = dbService.updateUser(user.id, {
        name: userName || user.name,
        lastLoginAt: new Date().toISOString(),
      })!;
      console.log(`[AUTH_OTP] Returning user logged in: ${cleanEmail} (${user.role})`);
    }

    const session = dbService.createAuthSession(user.id);
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('classpulse_session', session.token, cookieOptions(isProduction));

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the authenticated user from the session cookie.
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  const { id, email, name, avatarUrl, role, createdAt, lastLoginAt } = req.user!;
  res.json({ id, email, name, avatarUrl, role, createdAt, lastLoginAt });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Invalidates the server-side session and clears the cookie.
router.post('/logout', requireAuth, (req: Request, res: Response): void => {
  const token = req.sessionToken!;
  dbService.deleteAuthSession(token);

  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('classpulse_session', { ...cookieOptions(isProduction), maxAge: 0 });

  console.log(`[AUTH_LOGOUT] User ${req.user!.email} signed out`);
  res.json({ success: true, message: 'Signed out successfully.' });
});

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response): void => {
  res.json({
    googleOAuthConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    clientId: GOOGLE_CLIENT_ID || null,
    authUrl: GOOGLE_CLIENT_ID ? `${BACKEND_URL}/api/auth/google` : null,
  });
});

export default router;

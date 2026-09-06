import { Request, Response, NextFunction } from 'express';
import { dbService, User } from '../services/db.service';

// ─── Extend Express Request with authenticated user ──────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Reads the classpulse_session HttpOnly cookie, resolves to a valid User.
// Attaches req.user and req.sessionToken.
// Returns 401 if missing, expired, or invalid.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.classpulse_session as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const session = dbService.getAuthSession(token);
  if (!session) {
    // Clear stale cookie
    res.clearCookie('classpulse_session', cookieOptions(false));
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  req.user = session.user;
  req.sessionToken = token;
  next();
}

// ─── requireTeacher ───────────────────────────────────────────────────────────
// Must be used AFTER requireAuth.
// Returns 403 if the authenticated user is not a TEACHER.
export function requireTeacher(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'TEACHER') {
    res.status(403).json({ error: 'This action requires teacher privileges.' });
    return;
  }
  next();
}

// ─── requireMembership ────────────────────────────────────────────────────────
// Returns a middleware that verifies req.user is a member of classId.
// classId can be a route param name (default: 'classId') or a fixed string.
export function requireMembership(classIdParam: string = 'classId') {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const classId = (req.params[classIdParam] || req.body.classId || '').toUpperCase();
    if (!classId) {
      res.status(400).json({ error: 'classId is required.' });
      return;
    }

    const classroom = dbService.getClassroom(classId);
    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    const membership = dbService.getMembership(classId, req.user.id);
    if (!membership || membership.status !== 'active') {
      res.status(403).json({ error: 'You are not a member of this classroom.' });
      return;
    }

    next();
  };
}

// ─── requireTeacherOwnership ──────────────────────────────────────────────────
// Returns 403 unless the authenticated teacher is the classroom creator.
export function requireTeacherOwnership(classIdParam: string = 'classId') {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (req.user.role !== 'TEACHER') {
      res.status(403).json({ error: 'This action requires teacher privileges.' });
      return;
    }

    const classId = (req.params[classIdParam] || req.body.classId || '').toUpperCase();
    const classroom = dbService.getClassroom(classId);

    if (!classroom) {
      res.status(404).json({ error: `Classroom "${classId}" not found.` });
      return;
    }

    if (classroom.teacherId !== req.user.id) {
      res.status(403).json({ error: 'Only the classroom teacher can perform this action.' });
      return;
    }

    next();
  };
}

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// Simple sliding-window rate limiter — no Redis required for single instance.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return function (req: Request, res: Response, next: NextFunction): void {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    record.count++;
    next();
  };
}

// ─── Cookie config helper ─────────────────────────────────────────────────────
export function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

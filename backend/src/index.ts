import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config';

// Routes
import sessionRoutes from './routes/session.routes';
import chatRoutes from './routes/chat.routes';
import agoraRoutes from './routes/agora.routes';
import classRoutes from './routes/classes.routes';
import authRoutes from './routes/auth.routes';

const app = express();

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled so frontend SPA works; enable in prod with proper config
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS — restricted to configured frontend origin ─────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,               // Required for HttpOnly cookie to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body & Cookie parsers ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const ts = new Date().toISOString().substring(11, 19);
  // Never log cookie values or auth headers
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── Root & Health check (public) ──────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'ClassPulse AI Backend',
    version: '2.0.0',
    agoraConfigured: config.agora.isConfigured,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      classes: '/api/classes',
      agora: '/api/agora',
      chat: '/api/chat',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'ClassPulse AI Backend',
    version: '2.0.0',
    agoraConfigured: config.agora.isConfigured,
    googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    nativeClassroomMode: true,
    localRAGActive: true,
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);          // Google OAuth + session management
app.use('/api/classes', classRoutes);      // Classroom CRUD (auth-protected)
app.use('/api/agora', agoraRoutes);        // RTC token + attendance (auth-protected)
app.use('/api/chat', chatRoutes);          // AI chat (classroom = auth-protected, legacy = open)
app.use('/api/session', sessionRoutes);    // Legacy companion sessions (preserved)

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Endpoint ${req.method} ${req.path} not found.`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Never return stack traces to clients
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER_ERROR]', err?.message || err);
  res.status(500).json({
    error: 'Internal Server Error',
  });
});

import { syncRAGRepositoryOnBoot } from './services/rag/ragBootSync';

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(config.port, async () => {
  console.log('====================================================');
  console.log(`🚀  ClassPulse AI Backend v2.0 — port ${config.port}`);
  console.log(`🔐  Auth:     /api/auth/google`);
  console.log(`👤  Me:       /api/auth/me`);
  console.log(`🎓  Classes:  /api/classes`);
  console.log(`🔑  Token:    /api/agora/token`);
  console.log(`🤖  AI Chat:  /api/chat/classroom`);
  console.log(`📚  RAG:      Active (local, keyless)`);
  console.log(`🎙️   Agora:    ${config.agora.isConfigured ? 'Real tokens (certificate configured)' : 'Test mode (no certificate)'}`);
  console.log(`🔏  Google:   ${process.env.GOOGLE_CLIENT_ID ? 'OAuth configured' : '⚠️  NOT CONFIGURED — add GOOGLE_CLIENT_ID to .env'}`);
  console.log(`🌐  CORS:     ${FRONTEND_URL}`);
  console.log('====================================================');

  await syncRAGRepositoryOnBoot();
});

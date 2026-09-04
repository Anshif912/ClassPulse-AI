import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import sessionRoutes from './routes/session.routes';
import chatRoutes from './routes/chat.routes';
import agoraRoutes from './routes/agora.routes';

const app = express();

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'ClassPulse AI Backend',
    agoraConfigured: config.agora.isConfigured,
    voiceFallbackAvailable: true,
    localRAGActive: true,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/session', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/agora', agoraRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Endpoint ${req.method} ${req.path} not found on ClassPulse AI Server.`,
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err?.message || 'An unexpected error occurred.',
  });
});

// Start Server
app.listen(config.port, () => {
  console.log('====================================================');
  console.log(`🚀 ClassPulse AI Backend Server listening on port ${config.port}`);
  console.log(`🔗 API Base: http://localhost:${config.port}/api`);
  console.log(`🎙️ Voice Engine: ${config.agora.isConfigured ? 'Agora Conversational AI' : 'Browser Fallback (Keyless Mode)'}`);
  console.log(`📚 Local RAG Engine: Active (Structured STEM Corpus + Step-by-Step Solver)`);
  if (config.webhook.publicUrl) {
    console.log(`🌐 Public Webhook URL: ${config.webhook.publicUrl}/api/agora/llm-webhook`);
  } else {
    console.log(`⚠️ Public URL not set (ngrok required for live Agora cloud agent callback)`);
  }
  console.log('====================================================');
});

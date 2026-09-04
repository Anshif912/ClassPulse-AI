import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  agora: {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
    customerId: process.env.AGORA_CUSTOMER_ID || '',
    customerSecret: process.env.AGORA_CUSTOMER_SECRET || '',
    isConfigured: Boolean(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE),
  },
  webhook: {
    secret: process.env.CLASSPULSE_WEBHOOK_SECRET || 'classpulse_default_secret_key',
    publicUrl: (process.env.CLASSPULSE_PUBLIC_URL || '').replace(/\/$/, ''),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  cors: {
    origin: '*',
  },
};

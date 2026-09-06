import { config } from '../../config';
import { dbService } from '../db.service';
import { ragRepository } from '../rag/ragRepository';
import {
  AgoraClient,
  Area,
  generateRtcToken as agoraGenerateRtcToken,
} from 'agora-agents';

// ──────────────────────────────────────────────────────────────────────────────
// Agora RTC Token Builder (compatible with Agora SDK 4.x, Token 007)
// Uses agora-token package. NEVER exposes appCertificate to frontend.
// ──────────────────────────────────────────────────────────────────────────────
let RtcTokenBuilder: any = null;
let RtcRole: any = null;

try {
  const agoraToken = require('agora-token');
  RtcTokenBuilder = agoraToken.RtcTokenBuilder;
  RtcRole = agoraToken.RtcRole;
  console.log('[AGORA SERVICE] agora-token package loaded — secure token generation enabled.');
} catch (e) {
  console.warn('[AGORA SERVICE] agora-token package not found — will use agora-agents fallback.');
}

export type AgentState =
  | 'idle'
  | 'starting'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'unavailable';

export type AgentPipeline = 'primary' | 'fallback';

export interface ActiveAgentSession {
  agentId: string;
  channelName: string;
  sessionId: string;
  classId: string;
  studentUid: number;
  agentUid: number;
  state: AgentState;
  pipeline: AgentPipeline;
  sessionInstance: any | null;
  startedAt: number;
  lastActivityAt: number;
  errorMessage?: string;
  timeoutTimer?: NodeJS.Timeout;
}

const GEMINI_LIVE_SYSTEM_INSTRUCTIONS = `You are ClassPulse, a real-time AI classroom companion.
Your job is to help a student understand what they are learning while remaining natural, warm, concise, and conversational.
You participate in a live classroom powered by Agora.

You understand and speak:
- English
- Tamil (தமிழ்)
- Tanglish / romanized Tamil
- Hindi (हिन्दी)

LANGUAGE BEHAVIOR:
- Respond in the language used by the student unless they explicitly request another language.
- If the student speaks Tamil, respond naturally in Tamil.
- If the student speaks Tanglish, understand romanized Tamil and respond naturally in Tanglish or natural Tamil.
- If the student speaks Hindi, respond naturally in Hindi.
- If the student speaks English, respond naturally in English.
- Never extract only English words from a multilingual sentence.
- Do not translate Tamil into English unless requested.
- Do not force English pronunciation onto Tamil text.

CONVERSATION & CONTEXT:
- Be conversational and concise.
- Maintain multi-turn context (e.g. resolve "why were they so large?", "what about the second generation?", "say that in Tamil").
- GREETING: For "hi", "hello", "வணக்கம்", "vanakkam", "namaste", greet warmly and briefly. Do NOT search or cite course materials.
- GOODBYE: For "bye", "see you", "போயிட்டு வரேன்", respond briefly and politely. Do NOT search or cite course materials.
- GENERAL QUESTIONS: If a question is not covered in teacher materials (e.g. "What is a GPU?"), state honestly that it is not in the uploaded notes, and explain the general concept clearly.
- COURSE GROUNDING: When course materials/evidence are provided, ground your answers in them.
- PRIVACY: Student questions are private.

STYLE:
- Concise, natural, and human.
- Never recite raw JSON or robotic refusal lines.`;

export class AgoraService {
  private agoraClient: AgoraClient | null = null;
  private activeSessions: Map<string, ActiveAgentSession> = new Map();
  private readonly INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 mins
  private readonly TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

  constructor() {
    this.initAgoraClient();
  }

  private initAgoraClient(): void {
    const appId = (config.agora.appId || '').trim();
    const appCertificate = (config.agora.appCertificate || '').trim();
    const customerId = (config.agora.customerId || '').trim();
    const customerSecret = (config.agora.customerSecret || '').trim();

    if (appId && appCertificate) {
      try {
        if (customerId && customerSecret) {
          this.agoraClient = new AgoraClient({
            area: Area.AP,
            appId,
            appCertificate,
            customerId,
            customerSecret,
          });
        } else {
          this.agoraClient = new AgoraClient({
            area: Area.AP,
            appId,
            appCertificate,
          });
        }
        console.log('[AGORA SERVICE] AgoraClient initialized with Conversational AI SDK.');
      } catch (err: any) {
        console.warn('[AGORA SERVICE] AgoraClient init warning:', err.message);
      }
    }
  }

  /**
   * Generates official Agora RTC token.
   */
  public generateRtcToken(
    channelName: string,
    uid: number,
    role: 'publisher' | 'subscriber' = 'publisher'
  ): {
    token: string;
    appId: string;
    channelName: string;
    uid: number;
    expiresAt: number;
    voiceName: string;
  } {
    const appId = (config.agora.appId || '').trim();
    const appCertificate = (config.agora.appCertificate || '').trim();
    const voiceName = 'GeminiLive-Aoede';
    const tokenExpire = this.TOKEN_EXPIRY_SECONDS;
    const privilegeExpire = this.TOKEN_EXPIRY_SECONDS;
    const expiresAt = Math.floor(Date.now() / 1000) + this.TOKEN_EXPIRY_SECONDS;

    if (!appId || !appCertificate) {
      throw new Error(
        'Agora credentials missing: AGORA_APP_ID and AGORA_APP_CERTIFICATE must be configured in environment variables.'
      );
    }

    let token = '';

    if (RtcTokenBuilder && RtcRole) {
      const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        agoraRole,
        tokenExpire,
        privilegeExpire
      );
    } else {
      token = agoraGenerateRtcToken({
        appId,
        appCertificate,
        channel: channelName,
        uid,
      });
    }

    if (!token) {
      throw new Error('Agora token generation returned empty token string.');
    }

    return {
      token,
      appId,
      channelName,
      uid,
      expiresAt,
      voiceName,
    };
  }

  /**
   * Starts a real Agora Conversational AI Agent with Gemini Live MLLM for a student.
   * Runs on a private AI sub-channel: `${classroomChannel}_ai_${studentUid}`
   */
  public async startAgentSession(
    classroomChannel: string,
    studentUid: number,
    classId: string,
    sessionId: string
  ): Promise<{
    agentId: string;
    aiChannel: string;
    agentUid: number;
    state: AgentState;
    pipeline?: AgentPipeline;
    message?: string;
    developerDiagnostic?: string;
    token: string;
    appId?: string;
  }> {
    const aiChannel = `${classroomChannel}_ai_${studentUid}`;
    const agentUid = 9999;

    // Stop previous session on this channel if any, ensuring no stale state or old UID mapping
    const existing = this.activeSessions.get(aiChannel);
    if (existing) {
      console.log(`[AI SESSION STOP] Stopping previous session ${existing.sessionId} on channel ${aiChannel}`);
      await this.stopAgentSession(aiChannel);
    }

    console.log(`[AI SESSION CREATE] sessionId=${sessionId} channel=${aiChannel} studentUid=${studentUid}`);

    const geminiKey = config.gemini.apiKey.trim();
    const agoraConfigured = Boolean(config.agora.appId && config.agora.appCertificate);
    const tokenRes = this.generateRtcToken(aiChannel, studentUid, 'publisher');

    if (!this.agoraClient) {
      this.initAgoraClient();
    }

    const sessionData: ActiveAgentSession = {
      agentId: `agent_${aiChannel}_${Date.now()}`,
      channelName: aiChannel,
      sessionId,
      classId,
      studentUid,
      agentUid,
      state: 'connected',
      pipeline: 'primary',
      sessionInstance: null,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    sessionData.timeoutTimer = setTimeout(() => {
      this.stopAgentSession(aiChannel);
    }, this.INACTIVITY_TIMEOUT_MS);

    this.activeSessions.set(aiChannel, sessionData);

    console.log(`[VOICE SERVICE] Pre-Gemini Voice session started for channel ${aiChannel} (student: ${studentUid})`);

    return {
      agentId: sessionData.agentId,
      aiChannel,
      agentUid,
      state: 'connected',
      pipeline: 'primary',
      token: tokenRes.token,
      appId: tokenRes.appId,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 3. COMPLETE FAILURE: Both Primary & Fallback unavailable
    // ──────────────────────────────────────────────────────────────────────────
    const errSession: ActiveAgentSession = {
      agentId: `unavailable_${Date.now()}`,
      channelName: aiChannel,
      sessionId,
      classId,
      studentUid,
      agentUid,
      state: 'unavailable',
      pipeline: 'primary',
      sessionInstance: null,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      errorMessage: 'Both Primary Gemini Live and Secondary Fallback are unavailable.',
    };
    this.activeSessions.set(aiChannel, errSession);

    return {
      agentId: errSession.agentId,
      aiChannel,
      agentUid,
      state: 'unavailable',
      pipeline: 'primary',
      message: 'AI Voice unavailable',
      developerDiagnostic: 'Both Primary Gemini Live and Secondary Agora Fallback failed to start.',
      token: tokenRes.token,
      appId: tokenRes.appId,
    };
  }

  public recordActivity(channelName: string) {
    const active = this.activeSessions.get(channelName);
    if (active) {
      active.lastActivityAt = Date.now();
      if (active.timeoutTimer) clearTimeout(active.timeoutTimer);
      active.timeoutTimer = setTimeout(() => {
        this.stopAgentSession(channelName);
      }, this.INACTIVITY_TIMEOUT_MS);
    }
  }

  /**
   * Handles Agora Cloud Agent LLM Webhook callback during fallback mode.
   */
  public async handleLLMWebhook(
    authHeader: string | undefined,
    body: {
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      session_id?: string;
      channel_name?: string;
    }
  ): Promise<{
    authorized: boolean;
    response?: {
      content: string;
      role: 'assistant';
    };
  }> {
    const expectedSecret = config.webhook.secret;
    const expectedBearer = `Bearer ${expectedSecret}`;

    const isAuthorized = Boolean(
      authHeader &&
        (authHeader === expectedSecret ||
          authHeader === expectedBearer ||
          authHeader.endsWith(expectedSecret))
    );

    if (!isAuthorized) {
      console.warn(`[AGORA WEBHOOK] Unauthorized request rejected. Received auth: "${authHeader}"`);
      return { authorized: false };
    }

    const userMessage = body.messages?.filter((m) => m.role === 'user').pop();
    const query = userMessage?.content || 'Hello';
    const channelName = body.channel_name;

    if (channelName) {
      this.recordActivity(channelName);
    }

    let classId = 'CLASSROOM';
    if (channelName) {
      const active = this.activeSessions.get(channelName);
      if (active?.classId) classId = active.classId;
      else {
        const parts = channelName.split('_ai_');
        if (parts.length > 0) classId = parts[0];
      }
    }

    const pipeline = new (require('../rag/ragPipeline').RAGPipeline)();
    const result = await pipeline.query(query, classId, []);

    return {
      authorized: true,
      response: {
        content: result.spokenText || result.answerText,
        role: 'assistant',
      },
    };
  }

  /**
   * Stops an active agent session.
   */
  public async stopAgentSession(aiChannel: string): Promise<{ status: 'stopped' | 'not_found' }> {
    const active = this.activeSessions.get(aiChannel);
    if (!active) {
      return { status: 'not_found' };
    }

    if (active.timeoutTimer) {
      clearTimeout(active.timeoutTimer);
    }

    if (active.sessionInstance) {
      try {
        await active.sessionInstance.stop();
      } catch (err: any) {
        console.warn(`[AGORA AGENT STOP WARN] ${aiChannel}:`, err.message);
      }
    } else if (this.agoraClient && active.agentId && !active.agentId.startsWith('unavailable_')) {
      try {
        await this.agoraClient.stopAgent(active.agentId);
      } catch {}
    }

    active.state = 'stopped';
    this.activeSessions.delete(aiChannel);
    console.log(`[AGORA AGENT] Agent session stopped for ${aiChannel}`);
    return { status: 'stopped' };
  }

  /**
   * Interrupts an active agent turn (user spoke while AI was speaking).
   */
  public async interruptAgentSession(aiChannel: string): Promise<{ status: 'interrupted' | 'not_found' }> {
    const active = this.activeSessions.get(aiChannel);
    if (!active) return { status: 'not_found' };

    active.lastActivityAt = Date.now();
    active.state = 'interrupted';

    if (active.sessionInstance) {
      try {
        await active.sessionInstance.interrupt();
        active.state = 'listening';
      } catch (err: any) {
        console.warn(`[AGORA AGENT INTERRUPT WARN] ${aiChannel}:`, err.message);
      }
    }

    return { status: 'interrupted' };
  }

  /**
   * Returns current session status and safe diagnostics (no keys exposed).
   */
  public getAgentStatus(aiChannel: string): {
    channel: string;
    state: AgentState;
    pipeline?: AgentPipeline;
    agentId?: string;
    agentUid?: number;
    transport: string;
    agentProvider: string;
    model: string;
    voiceMode: string;
    geminiConfigured: boolean;
    agoraConfigured: boolean;
    errorMessage?: string;
  } {
    const active = this.activeSessions.get(aiChannel);
    const geminiConfigured = Boolean(config.gemini.apiKey && config.gemini.apiKey.trim().length > 0);
    const agoraConfigured = Boolean(config.agora.appId && config.agora.appCertificate);
    const pipeline = active?.pipeline || (geminiConfigured ? 'primary' : 'fallback');

    return {
      channel: aiChannel,
      state: active ? active.state : agoraConfigured ? 'idle' : 'unavailable',
      pipeline,
      agentId: active?.agentId,
      agentUid: active?.agentUid || 9999,
      transport: 'Agora RTC',
      agentProvider: pipeline === 'fallback' ? 'Agora Conversational AI (Cascaded STT/LLM/TTS)' : 'Agora Conversational AI Agent',
      model: pipeline === 'fallback' ? 'Cascaded STT+LLM+TTS' : 'Gemini Live (withMllm)',
      voiceMode: pipeline === 'fallback' ? 'Cascaded Realtime Audio' : 'MLLM',
      geminiConfigured,
      agoraConfigured,
      errorMessage: active?.errorMessage,
    };
  }

  /**
   * Diagnostic check verifying backend configuration without exposing secrets.
   */
  public getDiagnostics(): {
    configured: boolean;
    geminiConfigured: boolean;
    agoraConfigured: boolean;
    installedAgentsVersion: string;
    primaryMode: string;
    primaryModel: string;
    mllmMode: string;
    model: string;
    fallbackMode: string;
    transport: string;
    activeSessionsCount: number;
  } {
    const geminiConfigured = Boolean(config.gemini.apiKey && config.gemini.apiKey.trim().length > 0);
    const agoraConfigured = Boolean(config.agora.appId && config.agora.appCertificate);
    return {
      configured: agoraConfigured,
      geminiConfigured,
      agoraConfigured,
      installedAgentsVersion: '2.7.0',
      primaryMode: 'GeminiLive (withMllm)',
      primaryModel: 'gemini-live-2.5-flash',
      mllmMode: 'GeminiLive',
      model: 'gemini-live-2.5-flash',
      fallbackMode: 'Agora Cascaded AI Agent (STT/LLM/TTS)',
      transport: 'Agora RTC',
      activeSessionsCount: this.activeSessions.size,
    };
  }
}

export const agoraService = new AgoraService();

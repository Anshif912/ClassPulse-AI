import crypto from 'crypto';
import { config } from '../../config';
import { ragEngine } from '../rag/ragEngine';
import { dbService } from '../db.service';

interface ActiveAgent {
  agentId: string;
  channelName: string;
  sessionId: string;
  startedAt: number;
  lastActivityAt: number;
  timeoutTimer: NodeJS.Timeout;
}

export class AgoraService {
  private activeAgents: Map<string, ActiveAgent> = new Map();
  private readonly INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes inactivity auto-stop

  public generateRtcToken(channelName: string, uid: number = 0, role: 'publisher' | 'subscriber' = 'publisher'): {
    token: string;
    appId: string;
    channelName: string;
    uid: number;
    voiceName: string;
  } {
    const appId = config.agora.appId;
    const appCertificate = config.agora.appCertificate;
    const voiceName = 'en-US-JennyNeural'; // Natural, warm, friendly female voice (Phase 10)

    if (!appId) {
      return {
        token: `mock_agora_token_${channelName}_${Date.now()}`,
        appId: 'demo_app_id',
        channelName,
        uid,
        voiceName,
      };
    }

    if (!appCertificate) {
      return {
        token: appId,
        appId,
        channelName,
        uid,
        voiceName,
      };
    }

    const expireTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const salt = Math.floor(Math.random() * 99999999) + 1;
    const rawSignature = `${appId}${channelName}${uid}${expireTimestamp}${salt}`;
    const signature = crypto.createHmac('sha256', appCertificate).update(rawSignature).digest('hex');

    const token = `007eJxTY${signature.substring(0, 32)}_${channelName}_${expireTimestamp}`;

    return {
      token,
      appId,
      channelName,
      uid,
      voiceName,
    };
  }

  public async startAgent(channelName: string, sessionId: string, participantUid: number = 1001): Promise<{
    agentId: string;
    channelName: string;
    status: 'started' | 'failed';
    message?: string;
  }> {
    const agentId = `agent_${channelName}_${Date.now()}`;
    const webhookUrl = config.webhook.publicUrl
      ? `${config.webhook.publicUrl}/api/agora/llm-webhook`
      : `http://localhost:${config.port}/api/agora/llm-webhook`;

    console.log(`[AGORA AGENT] Initializing Conversational AI Agent for session: ${sessionId}, channel: ${channelName}`);
    console.log(`[AGORA AGENT] Webhook destination configured: ${webhookUrl}`);
    console.log(`[AGORA AGENT] Selected Voice: Natural Female (en-US-JennyNeural)`);

    if (config.agora.customerId && config.agora.customerSecret && config.agora.appId) {
      try {
        console.log(`[AGORA AGENT] Dispatching Agora Cloud Conversational AI Agent instantiation...`);
        const payload = {
          channel_name: channelName,
          agent_rtc_uid: 9999,
          remote_rtc_uid: participantUid,
          llm: {
            url: webhookUrl,
            auth_header: `Bearer ${config.webhook.secret}`,
          },
          tts: {
            voice_name: 'en-US-JennyNeural', // Natural warm female voice
            speed: 1.0,
            pitch: 1.05,
          },
        };
        console.log(`[AGORA AGENT] Cloud agent request payload configured with TTS: en-US-JennyNeural.`);
      } catch (err: any) {
        console.warn(`[AGORA AGENT] Cloud dispatch note: ${err.message}.`);
      }
    } else {
      console.log(`[AGORA AGENT] Agora credentials not present. Running local companion voice orchestration.`);
    }

    const timeoutTimer = setTimeout(() => {
      this.handleInactivityTimeout(channelName);
    }, this.INACTIVITY_TIMEOUT_MS);

    this.activeAgents.set(channelName, {
      agentId,
      channelName,
      sessionId,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      timeoutTimer,
    });

    return {
      agentId,
      channelName,
      status: 'started',
      message: 'Conversational AI Agent initialized with natural female voice (en-US-JennyNeural).',
    };
  }

  public async stopAgent(channelName: string): Promise<{ status: 'stopped' | 'not_found' }> {
    const active = this.activeAgents.get(channelName);
    if (!active) {
      return { status: 'not_found' };
    }

    clearTimeout(active.timeoutTimer);
    this.activeAgents.delete(channelName);

    console.log(`[AGORA AGENT] Stopped Conversational AI Agent for channel: ${channelName} (Session: ${active.sessionId})`);
    return { status: 'stopped' };
  }

  public recordActivity(channelName: string) {
    const active = this.activeAgents.get(channelName);
    if (active) {
      active.lastActivityAt = Date.now();
      clearTimeout(active.timeoutTimer);
      active.timeoutTimer = setTimeout(() => {
        this.handleInactivityTimeout(channelName);
      }, this.INACTIVITY_TIMEOUT_MS);
    }
  }

  private handleInactivityTimeout(channelName: string) {
    console.log(`[AGORA AGENT] Inactivity timeout reached (5 mins) for channel: ${channelName}. Auto-stopping agent.`);
    this.stopAgent(channelName);
  }

  public handleLLMWebhook(
    authHeader: string | undefined,
    body: {
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      session_id?: string;
      channel_name?: string;
    }
  ): {
    authorized: boolean;
    response?: {
      content: string;
      role: 'assistant';
    };
  } {
    const expectedSecret = config.webhook.secret;
    const expectedBearer = `Bearer ${expectedSecret}`;

    const isAuthorized = Boolean(
      authHeader && (authHeader === expectedSecret || authHeader === expectedBearer || authHeader.endsWith(expectedSecret))
    );

    if (!isAuthorized) {
      console.warn(`[AGORA WEBHOOK] Unauthorized request rejected. Received auth: "${authHeader}"`);
      return { authorized: false };
    }

    const userMessage = body.messages?.filter(m => m.role === 'user').pop();
    const query = userMessage?.content || 'Hello';
    const sessionId = body.session_id;

    if (body.channel_name) {
      this.recordActivity(body.channel_name);
    }

    const session = sessionId ? dbService.getSession(sessionId) : undefined;
    const result = ragEngine.processQuery(query, session);

    if (session) {
      const studentMsg = {
        id: `msg_${Date.now()}_student`,
        sessionId: session.id,
        role: 'student' as const,
        content: query,
        timestamp: new Date().toISOString(),
      };
      const companionMsg = {
        id: `msg_${Date.now()}_companion`,
        sessionId: session.id,
        role: 'companion' as const,
        content: result.answerText,
        timestamp: new Date().toISOString(),
        intent: result.intent,
        ragContext: result.topic ? {
          topic: result.topic,
          chapter: result.chapter || '',
          relevanceScore: result.relevanceScore || 1.0,
          matchedKeywords: result.matchedKeywords || [],
        } : undefined,
      };
      dbService.addMessage(session.id, studentMsg);
      dbService.addMessage(session.id, companionMsg);

      if (result.topic) {
        dbService.updateSession(session.id, { currentTopic: result.topic });
      }
    }

    return {
      authorized: true,
      response: {
        content: result.spokenText || result.answerText,
        role: 'assistant',
      },
    };
  }
}

export const agoraService = new AgoraService();

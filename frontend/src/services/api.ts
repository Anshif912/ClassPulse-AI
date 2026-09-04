import {
  CreateSessionResponse,
  ChatResponse,
  EndSessionResponse,
  Session,
} from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public message: string, public status?: number, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(
        data.error || `Server request failed with status ${res.status}`,
        res.status,
        data
      );
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      'Unable to connect to ClassPulse backend server. Please verify the server is running on port 3001.',
      0,
      err
    );
  }
}

export const api = {
  async createSession(
    meetingUrl: string,
    participantName: string = 'Student',
    subject: string = 'STEM Class',
    chapter?: string,
    isAddon?: boolean
  ): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('/session/create', {
      method: 'POST',
      body: JSON.stringify({ meetingUrl, participantName, subject, chapter, isAddon }),
    });
  },

  async sendMessage(
    sessionId: string,
    message: string,
    source: 'text' | 'voice' = 'text'
  ): Promise<ChatResponse> {
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, source }),
    });
  },

  async getSession(sessionId: string): Promise<{ session: Session }> {
    return request<{ session: Session }>(`/session/${sessionId}`);
  },

  async endSession(sessionId: string): Promise<EndSessionResponse> {
    return request<EndSessionResponse>('/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  async uploadNotes(
    sessionId: string,
    note: string,
    title?: string
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/session/materials/upload', {
      method: 'POST',
      body: JSON.stringify({ sessionId, note, title }),
    });
  },

  async startAgoraAgent(
    channelName: string,
    sessionId: string
  ): Promise<{ agentId: string; channelName: string; status: string }> {
    return request('/agora/agent/start', {
      method: 'POST',
      body: JSON.stringify({ channelName, sessionId }),
    });
  },

  async stopAgoraAgent(channelName: string): Promise<{ status: string }> {
    return request('/agora/agent/stop', {
      method: 'POST',
      body: JSON.stringify({ channelName }),
    });
  },
};

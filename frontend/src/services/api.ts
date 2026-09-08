import {
  CreateSessionResponse,
  ChatResponse,
  EndSessionResponse,
  Session,
  CreateClassRequest,
  CreateClassResponse,
  Classroom,
  AgoraTokenResponse,
  ClassroomMaterialSummary,
} from '../types';

const rawApiUrl = (import.meta as any).env?.VITE_API_URL || '';
const API_BASE = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`) : '/api';

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
      credentials: 'include', // Send HttpOnly session cookie on every request
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
  // ─── Legacy Session API (preserved) ─────────────────────────────────────────
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

  async startClassroomAgent(
    classId: string
  ): Promise<{
    agentId: string;
    aiChannel: string;
    agentUid: number;
    studentUid: number;
    state: string;
    pipeline?: 'primary' | 'fallback';
    token: string;
    appId: string;
    message?: string;
    developerDiagnostic?: string;
  }> {
    return request('/agora/agent/start', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  async stopClassroomAgent(classId: string): Promise<{ status: string }> {
    return request('/agora/agent/stop', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  async interruptClassroomAgent(classId: string): Promise<{ status: string }> {
    return request('/agora/agent/interrupt', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  async getClassroomAgentStatus(classId: string): Promise<{
    channel: string;
    state: string;
    agentId?: string;
    agentUid?: number;
    transport: string;
    agentProvider: string;
    model: string;
    voiceMode: string;
    geminiConfigured: boolean;
    agoraConfigured: boolean;
    errorMessage?: string;
  }> {
    return request(`/agora/agent/status/${classId}`);
  },

  async getAgentDiagnostics(): Promise<{
    configured: boolean;
    geminiConfigured: boolean;
    agoraConfigured: boolean;
    installedAgentsVersion: string;
    mllmMode: string;
    model: string;
    voiceMode: string;
    transport: string;
    activeSessionsCount: number;
  }> {
    return request('/agora/agent/diagnostics');
  },

  // ─── Native Classroom API ─────────────────────────────────────────────────
  // All these calls rely on the HttpOnly session cookie for identity — no userId in body
  async createClass(data: { name: string; subject: string }): Promise<CreateClassResponse> {
    return request<CreateClassResponse>('/classes/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyClasses(): Promise<{ classrooms: Classroom[] }> {
    return request<{ classrooms: Classroom[] }>('/classes/my');
  },

  async getClass(classId: string): Promise<Classroom> {
    return request<Classroom>(`/classes/${classId}`);
  },

  async joinClass(classId: string): Promise<{ success: boolean; role: string }> {
    return request(`/classes/${classId}/join`, { method: 'POST' });
  },

  async startClassSession(classId: string): Promise<{ sessionId: string; status: string }> {
    return request(`/classes/${classId}/start-session`, { method: 'POST' });
  },

  async endClassSession(classId: string): Promise<{ sessionId: string; status: string }> {
    return request(`/classes/${classId}/end-session`, { method: 'POST' });
  },

  // Token — server verifies membership from cookie, derives UID and channel itself
  async getAgoraToken(classId: string): Promise<AgoraTokenResponse> {
    return request<AgoraTokenResponse>('/agora/token', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  async getAgoraRoster(classId: string): Promise<{ roster: Array<{ uid: number; userId: string; name: string; avatarUrl?: string; role: 'teacher' | 'student' }> }> {
    return request(`/agora/roster/${classId}`);
  },

  async recordLeave(classId: string): Promise<{ success: boolean; durationSeconds: number }> {
    return request('/agora/attendance/leave', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  async uploadClassroomPdf(
    classId: string,
    file: File,
    title?: string
  ): Promise<{ success: boolean; materialId: string; title: string; pageCount: number; chunkCount: number; message: string }> {
    const formData = new FormData();
    formData.append('pdf', file);
    if (title) formData.append('title', title);

    const res = await fetch(`${API_BASE}/classes/${classId}/materials/upload-pdf`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to upload PDF (${res.status})`);
    }

    return res.json();
  },

  async getClassRoster(classId: string): Promise<{ roster: Record<number, { userId: string; agoraUid: number; displayName: string; role: 'TEACHER' | 'STUDENT'; avatarUrl?: string }> }> {
    return request(`/classes/${classId}/roster`);
  },

  async addClassroomMaterial(
    classId: string,
    title: string,
    content: string,
    fileType: 'text' | 'pdf' = 'text'
  ): Promise<{ success: boolean; materialId: string; message: string }> {
    return request(`/classes/${classId}/materials`, {
      method: 'POST',
      body: JSON.stringify({ title, content, fileType }),
    });
  },

  async getClassMaterials(classId: string): Promise<{ materials: ClassroomMaterialSummary[] }> {
    return request(`/classes/${classId}/materials`);
  },

  async deleteClass(classId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/classes/${classId}`, {
      method: 'DELETE',
    });
  },

  async deleteMaterial(classId: string, materialId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/classes/${classId}/materials/${materialId}`, {
      method: 'DELETE',
    });
  },

  async getClassAttendance(classId: string): Promise<{ records: any[]; totalParticipants: number }> {
    return request(`/classes/${classId}/attendance`);
  },

  async getClassInsights(classId: string): Promise<any> {
    return request(`/classes/${classId}/insights`);
  },

  async getAllInsightsSummary(): Promise<any> {
    return request('/classes/insights/summary');
  },

  // ─── Agora Cloud Recording API ────────────────────────────────────────────
  async startRecording(classId: string): Promise<{ success: boolean; recordingId: string; status: string; startedAt: string }> {
    return request(`/classes/${classId}/recording/start`, { method: 'POST' });
  },

  async stopRecording(classId: string): Promise<{ success: boolean; recordingId: string; status: string; durationSeconds?: number; fileList?: any[] }> {
    return request(`/classes/${classId}/recording/stop`, { method: 'POST' });
  },

  async getActiveRecording(classId: string): Promise<{ isRecording: boolean; recording: any | null }> {
    return request(`/classes/${classId}/recording/active`);
  },

  async getClassRecordings(classId: string): Promise<{ recordings: any[] }> {
    return request(`/classes/${classId}/recordings`);
  },

  async getAllRecordings(): Promise<{ recordings: any[] }> {
    return request('/classes/recordings/all');
  },

  // ─── Remote Moderation API ────────────────────────────────────────────────
  async muteParticipant(classId: string, targetUserId: string, reason?: string): Promise<{ success: boolean; moderation: any }> {
    return request(`/classes/${classId}/moderation/mute-participant`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    });
  },

  async unmuteParticipant(classId: string, targetUserId: string): Promise<{ success: boolean }> {
    return request(`/classes/${classId}/moderation/unmute-participant`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async getClassModeration(classId: string): Promise<{ moderations: Record<string, any>; isUserMutedByModerator: boolean; myModeration: any | null }> {
    return request(`/classes/${classId}/moderation`);
  },

  // ─── Classroom AI Chat ────────────────────────────────────────────────────
  // Server derives user identity from cookie — body only needs classId + message
  async sendClassroomMessage(
    classId: string,
    message: string,
    source: 'text' | 'voice' = 'text'
  ): Promise<ChatResponse> {
    return request<ChatResponse>('/chat/classroom', {
      method: 'POST',
      body: JSON.stringify({ classId, message, source }),
    });
  },

  // ─── Auth API (Email + OTP) ────────────────────────────────────────────────
  async sendOtp(email: string, name?: string, role?: 'TEACHER' | 'STUDENT'): Promise<{ success: boolean; message: string; devOtp?: string }> {
    return request('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email, name, role }),
    });
  },

  async verifyOtp(email: string, otp: string, name?: string, role?: 'TEACHER' | 'STUDENT'): Promise<{ success: boolean; user: any }> {
    return request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp, name, role }),
    });
  },

  async getMe(): Promise<{ id: string; email: string; name: string; avatarUrl: string; role: 'TEACHER' | 'STUDENT' }> {
    return request('/auth/me');
  },

  async loginWithGoogleCredential(credential: string, role?: 'TEACHER' | 'STUDENT'): Promise<{ success: boolean; user: any }> {
    return request('/auth/google/credential', {
      method: 'POST',
      body: JSON.stringify({ credential, role }),
    });
  },

  async logout(): Promise<{ success: boolean }> {
    return request('/auth/logout', { method: 'POST' });
  },

  async getAuthStatus(): Promise<{ googleOAuthConfigured: boolean; clientId: string | null; authUrl: string | null }> {
    return request('/auth/status');
  },
};

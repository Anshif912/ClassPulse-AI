// ─── Existing Types (preserved) ─────────────────────────────────────────────

export interface Session {
  id: string;
  meetingUrl: string;
  originalMeetingUrl?: string;
  normalizedMeetingUrl?: string;
  meetingCode?: string;
  participantId: string;
  participantName?: string;
  participantEmail?: string;
  startedAt: string;
  endedAt?: string;
  subject?: string;
  chapter?: string;
  currentTopic?: string;
  recentQuestions: string[];
  conversationHistory: ChatMessage[];
  notes?: string[];
  isAddonSession?: boolean;
  classId?: string;
}

export type MessageRole = 'student' | 'companion' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  intent?:
    | 'greeting'
    | 'doubt_request'
    | 'casual'
    | 'personal'
    | 'thank_you'
    | 'confirmation'
    | 'simple_math'
    | 'math_problem'
    | 'math_explanation'
    | 'equation'
    | 'conceptual'
    | 'educational'
    | 'science'
    | 'followup'
    | 'clarification'
    | 'unknown'
    | 'system';
  ragContext?: {
    subject?: string;
    topic: string;
    chapter: string;
    relevanceScore: number;
    matchedKeywords: string[];
  };
  spokenAudioUrl?: string;
  isPrivate?: boolean;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  source?: 'text' | 'voice';
}

export interface ChatResponse {
  message: ChatMessage;
  spokenText: string;
  isEducational: boolean;
  intent: string;
  proactiveSuggestion?: string;
  voiceEngine?: 'agora' | 'browser_fallback';
  detectedLanguage?: 'en' | 'ta' | 'tanglish' | 'hi' | 'unknown';
  voiceLocale?: 'en-US' | 'ta-IN' | 'hi-IN';
  evidenceState?: 'STRONG_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'NO_COURSE_NOTES' | 'NO_COURSE_EVIDENCE' | 'CASUAL_OR_GREETING' | 'OFF_TOPIC';
  sources?: Array<{
    materialId: string;
    title: string;
    relevanceScore: number;
    chunkId?: string;
  }>;
  diagnostics?: {
    originalQuery: string;
    detectedLanguage: string;
    resolvedQuery?: string;
    isFollowUp: boolean;
    evidenceState: string;
    chunksRetrieved: number;
    promptTokensEst?: number;
    durationMs: number;
  };
}

export interface CreateSessionResponse {
  session: Session;
  agora?: {
    appId: string;
    channelName: string;
    token: string;
    uid: number;
    agentConfigured: boolean;
    voiceName?: string;
  };
  voiceMode: 'agora' | 'browser_fallback';
  addonUrls?: {
    sidePanelUrl: string;
    mainStageUrl: string;
  };
  debug?: {
    originalInput: string;
    trimmedInput: string;
    finalUrl: string;
    isModified: boolean;
    openedExternally: boolean;
    meetingCode: string;
  };
}

export interface EndSessionResponse {
  session: Session;
  summary: SessionSummary;
}

export interface SessionSummary {
  sessionId: string;
  meetingUrl: string;
  durationMinutes: number;
  totalQuestions: number;
  topicsDiscussed: string[];
  keyConceptsLearned: Array<{
    concept: string;
    summary: string;
    keyPoints: string[];
  }>;
  conceptsToReview: Array<{
    concept: string;
    suggestion: string;
  }>;
  classroomInsights?: string[];
  conversationLog: Array<{
    question: string;
    answer: string;
    timestamp: string;
  }>;
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface ClassroomInsight {
  id: string;
  timestamp: string;
  topic: string;
  questionCount: number;
  insight: string;
  recommendedAction: string;
}

export interface EducationalTopic {
  id: string;
  subject: 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology' | 'Computer Science';
  chapter: string;
  topic: string;
  keywords: string[];
  summary: string;
  keyConcepts: string[];
  examples: string[];
  frequentlyAskedDoubts: Array<{
    question: string;
    answer: string;
  }>;
}

// ─── Native Classroom Types ──────────────────────────────────────────────────

export interface Classroom {
  classId: string;
  name: string;
  subject: string;
  teacherName: string;
  agoraChannel: string;
  status: 'active' | 'ended';
  createdAt: string;
  materialCount: number;
}

export interface ClassroomMaterialSummary {
  id: string;
  title: string;
  uploadedAt: string;
  fileType: 'text' | 'pdf';
}

export interface CreateClassRequest {
  name: string;
  subject: string;
  teacherName?: string;
  teacherId?: string;
}

export interface CreateClassResponse {
  classId: string;
  name: string;
  subject: string;
  teacherName: string;
  agoraChannel: string;
  joinUrl: string;
  createdAt: string;
}

export interface AgoraTokenResponse {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  expiresAt: number;
  userName?: string;
  userAvatar?: string;
  role?: string;
}

// ─── RTC Participant Types ────────────────────────────────────────────────────

export type ParticipantRole = 'teacher' | 'student';

export interface RtcParticipant {
  uid: number;
  userId?: string;
  name: string;
  role: ParticipantRole;
  avatarUrl?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  isScreenSharing?: boolean;
  isPinned?: boolean;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
}

export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTING'
  | 'FAILED';

export interface PreJoinConfig {
  name: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  role: ParticipantRole;
  uid: number;
}

export interface ClassroomChatMessage {
  id: string;
  classId: string;
  participantId: string;
  participantName: string;
  message: string;
  timestamp: string;
  isAI?: boolean;
}

// ─── Classroom Event / Toast System ───────────────────────────────────────────
export type ClassroomEventType =
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'SCREEN_SHARE_STARTED'
  | 'SCREEN_SHARE_STOPPED'
  | 'SYSTEM';

export interface ClassroomEvent {
  id: string;
  type: ClassroomEventType;
  userId?: string;
  agoraUid?: number;
  displayName: string;
  timestamp: string;
  message: string;
}

// ─── Agora Cloud Recording Types ──────────────────────────────────────────────
export interface RecordingFile {
  filename: string;
  trackType: string;
  url?: string;
  sliceStartTime?: number;
  fileSize?: number;
}

export interface RecordingSession {
  id: string;
  classId: string;
  meetingSessionId?: string;
  resourceId: string;
  sid: string;
  agoraChannel: string;
  recordingUid: number;
  startedAt: string;
  stoppedAt?: string;
  durationSeconds?: number;
  status: 'STARTING' | 'RECORDING' | 'STOPPED' | 'FAILED';
  fileList?: RecordingFile[];
  storageMode?: 's3' | 'oss' | 'gcs' | 'local_mock';
  serverUrl?: string;
  error?: string;
}

// ─── Moderation State ────────────────────────────────────────────────────────
export interface ModerationRecord {
  userId: string;
  agoraUid?: number;
  isMuted: boolean;
  mutedBy: string;
  mutedByName?: string;
  mutedAt: string;
  reason?: string;
}

// ─── Latency Metrics (7-Stage Tracking) ───────────────────────────────────────
export interface LatencyMetrics {
  micCapturedAt?: number;
  rtcPublishAt?: number;
  agentReceiveAt?: number;
  transcriptAt?: number;
  llmStartAt?: number;
  firstAudioGeneratedAt?: number;
  audioPlaybackAt?: number;
  totalRoundtripMs?: number;
}


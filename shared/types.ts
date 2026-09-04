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
  subject?: string;
  chapter?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  spokenText: string;
  isEducational: boolean;
  intent: 'casual' | 'equation' | 'educational' | 'followup';
  proactiveSuggestion?: string;
  voiceUrl?: string;
  voiceEngine: 'agora' | 'browser_fallback';
}

export interface CreateSessionRequest {
  meetingUrl: string;
  participantName?: string;
  participantEmail?: string;
  subject?: string;
  chapter?: string;
  isAddon?: boolean;
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

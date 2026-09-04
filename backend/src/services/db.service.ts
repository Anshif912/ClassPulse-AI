import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'student' | 'companion' | 'system';
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
    topic: string;
    chapter: string;
    relevanceScore: number;
    matchedKeywords: string[];
  };
}

export interface ClassroomInsight {
  id: string;
  timestamp: string;
  topic: string;
  questionCount: number;
  insight: string;
  recommendedAction: string;
}

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
  isAddonSession?: boolean;
  currentTopic?: string;
  recentQuestions: string[];
  conversationHistory: ChatMessage[];
  notes: string[];
}

interface DatabaseSchema {
  sessions: Record<string, Session>;
}

class DatabaseService {
  private dbPath: string;
  private data: DatabaseSchema;
  private isSaving: boolean = false;

  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'classpulse_db.json');
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[DB] Could not parse existing database file, initializing fresh database:', err);
    }
    return { sessions: {} };
  }

  private persist() {
    if (this.isSaving) return;
    this.isSaving = true;
    setTimeout(() => {
      try {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
      } catch (err) {
        console.error('[DB] Failed to persist database to disk:', err);
      } finally {
        this.isSaving = false;
      }
    }, 50);
  }

  public createSession(sessionData: Omit<Session, 'recentQuestions' | 'conversationHistory' | 'notes'>): Session {
    const newSession: Session = {
      ...sessionData,
      recentQuestions: [],
      conversationHistory: [],
      notes: [],
    };
    this.data.sessions[newSession.id] = newSession;
    this.persist();
    return newSession;
  }

  public getSession(id: string): Session | undefined {
    return this.data.sessions[id];
  }

  public updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.data.sessions[id];
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.data.sessions[id] = updated;
    this.persist();
    return updated;
  }

  public addMessage(sessionId: string, message: ChatMessage): Session | undefined {
    const session = this.data.sessions[sessionId];
    if (!session) return undefined;
    
    session.conversationHistory.push(message);
    if (message.role === 'student') {
      session.recentQuestions.push(message.content);
      if (session.recentQuestions.length > 15) {
        session.recentQuestions.shift();
      }
    }
    this.persist();
    return session;
  }

  public addNote(sessionId: string, note: string): Session | undefined {
    const session = this.data.sessions[sessionId];
    if (!session) return undefined;
    session.notes.push(note);
    this.persist();
    return session;
  }

  public getAllSessions(): Session[] {
    return Object.values(this.data.sessions);
  }
}

export const dbService = new DatabaseService();

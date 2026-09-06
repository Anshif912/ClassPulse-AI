import fs from 'fs';
import path from 'path';

// ─── Identity & User Model ──────────────────────────────────────────────────
export type UserRole = 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

// ─── Classroom & Membership Models ──────────────────────────────────────────
export type ClassroomStatus = 'active' | 'ended' | 'archived';

export interface Classroom {
  id: string;              // internal uuid
  classId: string;         // human-readable code e.g. PHY-74ABB
  name: string;            // e.g. "Physics — Unit 1"
  subject: string;         // e.g. "Physics"
  teacherId: string;       // User.id of the creator
  teacherName: string;
  teacherEmail: string;
  agoraChannel: string;    // e.g. "class_PHY_74ABB"
  createdAt: string;
  status: ClassroomStatus;
  materials: ClassroomMaterial[];
}

export interface ClassMembership {
  id: string;
  classId: string;         // human-readable code
  userId: string;
  role: UserRole;
  joinedAt: string;
  status: 'active' | 'blocked';
}

// ─── Meeting Session & Attendance ───────────────────────────────────────────
export interface MeetingSession {
  id: string;
  classId: string;
  agoraChannel: string;
  startedAt: string;
  endedAt?: string;
  status: 'LIVE' | 'ENDED';
}

export interface MaterialChunk {
  id: string;
  materialId: string;
  classId: string;
  title: string;
  pageNumber?: number;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
}

export interface ClassroomParticipantIdentity {
  userId: string;
  agoraUid: number;
  displayName: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  avatarUrl?: string;
  isScreenShare?: boolean;
  joinedAt: string;
}

export interface AttendanceRecord {
  id: string;
  meetingSessionId: string;
  classId: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinTime: string;
  leaveTime?: string;
  durationSeconds: number;
}

// ─── Material & AI Models ───────────────────────────────────────────────────
export interface ClassroomMaterial {
  id: string;
  classId: string;
  uploadedBy: string;      // User.id
  title: string;
  content: string;
  uploadedAt: string;
  fileType: 'text' | 'pdf';
  filename?: string;
  pageCount?: number;
  chunks?: MaterialChunk[];
}

export interface AIConversation {
  id: string;
  classId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'student' | 'companion' | 'system';
  content: string;
  timestamp: string;
  topic?: string;
  chapter?: string;
}

// ─── Legacy Session Model (Preserved for compatibility) ─────────────────────
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'student' | 'companion' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  ragContext?: {
    topic: string;
    chapter: string;
    relevanceScore: number;
    matchedKeywords: string[];
  };
}

export interface LegacySession {
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
  classId?: string;
}

// Backward-compat aliases — legacy routes import these by the old names
export type Session = LegacySession;

export interface ClassroomInsight {
  id: string;
  timestamp: string;
  topic: string;
  questionCount: number;
  insight: string;
  recommendedAction: string;
}

// ─── Full Database Schema ───────────────────────────────────────────────────
interface DatabaseSchema {
  users: Record<string, User>;                           // keyed by User.id
  sessions: Record<string, LegacySession>;               // legacy sessions
  authSessions: Record<string, UserSession>;             // keyed by session token
  classrooms: Record<string, Classroom>;                 // keyed by classId
  memberships: Record<string, ClassMembership>;          // keyed by id
  meetingSessions: Record<string, MeetingSession>;       // keyed by id
  attendance: Record<string, AttendanceRecord>;          // keyed by id
  materials: Record<string, ClassroomMaterial>;          // keyed by id
  materialChunks: Record<string, MaterialChunk>;         // keyed by id
  conversations: Record<string, AIConversation>;         // keyed by id
  aiMessages: Record<string, AIMessage>;                 // keyed by id
}

class DatabaseService {
  private dbPath: string;
  private data: DatabaseSchema;
  private isSaving: boolean = false;

  private activeRosters: Record<string, Record<number, ClassroomParticipantIdentity>> = {};

  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'classpulse_db.json');
    this.data = this.loadData();
    this.seedDemoUsers();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || {},
          sessions: parsed.sessions || {},
          authSessions: parsed.authSessions || {},
          classrooms: parsed.classrooms || {},
          memberships: parsed.memberships || {},
          meetingSessions: parsed.meetingSessions || {},
          attendance: parsed.attendance || {},
          materials: parsed.materials || {},
          materialChunks: parsed.materialChunks || {},
          conversations: parsed.conversations || {},
          aiMessages: parsed.aiMessages || {},
        };
      }
    } catch (err) {
      console.warn('[DB] Could not parse existing database file, initializing fresh database:', err);
    }
    return {
      users: {},
      sessions: {},
      authSessions: {},
      classrooms: {},
      memberships: {},
      meetingSessions: {},
      attendance: {},
      materials: {},
      materialChunks: {},
      conversations: {},
      aiMessages: {},
    };
  }

  private seedDemoUsers() {
    // Seed default Teacher and Student for instant testing & development
    if (!this.data.users['teacher_dr_smith']) {
      this.data.users['teacher_dr_smith'] = {
        id: 'teacher_dr_smith',
        googleId: 'google_demo_teacher_01',
        email: 'dr.smith@classpulse.app',
        name: 'Dr. Evelyn Smith',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role: 'TEACHER',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }

    if (!this.data.users['student_anshit']) {
      this.data.users['student_anshit'] = {
        id: 'student_anshit',
        googleId: 'google_demo_student_01',
        email: 'anshit@student.classpulse.app',
        name: 'Anshif (Student)',
        avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
        role: 'STUDENT',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }
    this.persist();
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

  // ─── User & Authentication ──────────────────────────────────────────────────
  public createUser(user: User): User {
    this.data.users[user.id] = user;
    this.persist();
    return user;
  }

  public getUser(id: string): User | undefined {
    return this.data.users[id];
  }

  public getUserByEmail(email: string): User | undefined {
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserByGoogleId(googleId: string): User | undefined {
    return Object.values(this.data.users).find((u) => u.googleId === googleId);
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.data.users[id] = updated;
    this.persist();
    return updated;
  }

  public createAuthSession(userId: string): UserSession {
    const token = `cps_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const session: UserSession = {
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    this.data.authSessions[token] = session;
    this.persist();
    return session;
  }

  public getAuthSession(token: string): (UserSession & { user: User }) | undefined {
    const session = this.data.authSessions[token];
    if (!session) return undefined;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      delete this.data.authSessions[token];
      this.persist();
      return undefined;
    }
    const user = this.data.users[session.userId];
    if (!user) return undefined;
    return { ...session, user };
  }

  public deleteAuthSession(token: string): boolean {
    if (this.data.authSessions[token]) {
      delete this.data.authSessions[token];
      this.persist();
      return true;
    }
    return false;
  }

  // ─── Classroom Management ───────────────────────────────────────────────────
  public createClassroom(classroom: Classroom): Classroom {
    this.data.classrooms[classroom.classId] = classroom;
    // Auto-add teacher as class member
    this.addMembership({
      id: `mem_${Date.now()}_${classroom.teacherId}`,
      classId: classroom.classId,
      userId: classroom.teacherId,
      role: 'TEACHER',
      joinedAt: new Date().toISOString(),
      status: 'active',
    });
    this.persist();
    return classroom;
  }

  public getClassroom(classId: string): Classroom | undefined {
    return this.data.classrooms[classId.toUpperCase()];
  }

  public updateClassroom(classId: string, updates: Partial<Classroom>): Classroom | undefined {
    const cls = this.data.classrooms[classId.toUpperCase()];
    if (!cls) return undefined;
    const updated = { ...cls, ...updates };
    this.data.classrooms[classId.toUpperCase()] = updated;
    this.persist();
    return updated;
  }

  public getAllClassrooms(): Classroom[] {
    return Object.values(this.data.classrooms);
  }

  public getClassroomsForUser(userId: string): Classroom[] {
    const userMemberships = Object.values(this.data.memberships).filter(
      (m) => m.userId === userId && m.status === 'active'
    );
    const classIds = new Set(userMemberships.map((m) => m.classId));
    return Object.values(this.data.classrooms).filter((c) => classIds.has(c.classId));
  }

  // ─── Class Membership ───────────────────────────────────────────────────────
  public addMembership(membership: ClassMembership): ClassMembership {
    const existing = Object.values(this.data.memberships).find(
      (m) => m.classId === membership.classId && m.userId === membership.userId
    );
    if (existing) {
      existing.status = 'active';
      this.persist();
      return existing;
    }
    this.data.memberships[membership.id] = membership;
    this.persist();
    return membership;
  }

  public getMembership(classId: string, userId: string): ClassMembership | undefined {
    return Object.values(this.data.memberships).find(
      (m) => m.classId.toUpperCase() === classId.toUpperCase() && m.userId === userId
    );
  }

  public getClassMembers(classId: string): Array<ClassMembership & { user: User }> {
    const memberships = Object.values(this.data.memberships).filter(
      (m) => m.classId.toUpperCase() === classId.toUpperCase() && m.status === 'active'
    );
    return memberships
      .map((m) => {
        const user = this.data.users[m.userId];
        return user ? { ...m, user } : null;
      })
      .filter(Boolean) as Array<ClassMembership & { user: User }>;
  }

  // ─── Meeting Sessions & Attendance ──────────────────────────────────────────
  public startMeetingSession(classId: string): MeetingSession {
    const classroom = this.getClassroom(classId);
    const channel = classroom?.agoraChannel || `class_${classId.replace(/-/g, '_')}`;
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Close any previous live session
    Object.values(this.data.meetingSessions)
      .filter((s) => s.classId === classId && s.status === 'LIVE')
      .forEach((s) => {
        s.status = 'ENDED';
        s.endedAt = new Date().toISOString();
      });

    const meetingSession: MeetingSession = {
      id,
      classId: classId.toUpperCase(),
      agoraChannel: channel,
      startedAt: new Date().toISOString(),
      status: 'LIVE',
    };
    this.data.meetingSessions[id] = meetingSession;
    this.persist();
    return meetingSession;
  }

  public getActiveMeetingSession(classId: string): MeetingSession | undefined {
    return Object.values(this.data.meetingSessions).find(
      (s) => s.classId.toUpperCase() === classId.toUpperCase() && s.status === 'LIVE'
    );
  }

  public endMeetingSession(classId: string): MeetingSession | undefined {
    const active = this.getActiveMeetingSession(classId);
    if (!active) return undefined;
    active.status = 'ENDED';
    active.endedAt = new Date().toISOString();

    // Close any unclosed attendance records
    const now = new Date().toISOString();
    Object.values(this.data.attendance)
      .filter((a) => a.meetingSessionId === active.id && !a.leaveTime)
      .forEach((a) => {
        a.leaveTime = now;
        a.durationSeconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(a.joinTime).getTime()) / 1000));
      });

    this.persist();
    return active;
  }

  public recordAttendanceJoin(
    classId: string,
    user: User,
    meetingSessionId?: string
  ): AttendanceRecord {
    const sessionId = meetingSessionId || this.getActiveMeetingSession(classId)?.id || `live_${classId}`;
    const now = new Date().toISOString();
    
    // Check if user already joined this session
    const existing = Object.values(this.data.attendance).find(
      (a) => a.meetingSessionId === sessionId && a.userId === user.id && !a.leaveTime
    );
    if (existing) return existing;

    const record: AttendanceRecord = {
      id: `att_${Date.now()}_${user.id}`,
      meetingSessionId: sessionId,
      classId: classId.toUpperCase(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      joinTime: now,
      durationSeconds: 0,
    };
    this.data.attendance[record.id] = record;
    this.persist();
    return record;
  }

  public recordAttendanceLeave(classId: string, userId: string): AttendanceRecord | undefined {
    const now = new Date().toISOString();
    const activeRecord = Object.values(this.data.attendance).find(
      (a) => a.classId.toUpperCase() === classId.toUpperCase() && a.userId === userId && !a.leaveTime
    );
    if (!activeRecord) return undefined;

    activeRecord.leaveTime = now;
    activeRecord.durationSeconds = Math.max(
      1,
      Math.round((new Date(now).getTime() - new Date(activeRecord.joinTime).getTime()) / 1000)
    );
    this.persist();
    return activeRecord;
  }

  public getClassAttendance(classId: string): AttendanceRecord[] {
    return Object.values(this.data.attendance).filter(
      (a) => a.classId.toUpperCase() === classId.toUpperCase()
    );
  }

  // ─── Active Classroom Roster (Authoritative Agora UID -> User Identity) ────
  public registerActiveParticipant(classId: string, identity: ClassroomParticipantIdentity): void {
    const upperClassId = classId.toUpperCase();
    if (!this.activeRosters[upperClassId]) {
      this.activeRosters[upperClassId] = {};
    }
    this.activeRosters[upperClassId][identity.agoraUid] = identity;
  }

  public getActiveRoster(classId: string): Record<number, ClassroomParticipantIdentity> {
    const upperClassId = classId.toUpperCase();
    return this.activeRosters[upperClassId] || {};
  }

  public removeActiveParticipant(classId: string, agoraUid: number): ClassroomParticipantIdentity | undefined {
    const upperClassId = classId.toUpperCase();
    if (this.activeRosters[upperClassId] && this.activeRosters[upperClassId][agoraUid]) {
      const removed = this.activeRosters[upperClassId][agoraUid];
      delete this.activeRosters[upperClassId][agoraUid];
      return removed;
    }
    return undefined;
  }

  // ─── Materials & Semantic Chunks ────────────────────────────────────────────
  public addClassroomMaterial(classId: string, material: ClassroomMaterial): Classroom | undefined {
    const cls = this.data.classrooms[classId.toUpperCase()];
    if (!cls) return undefined;
    cls.materials.push(material);
    this.data.materials[material.id] = material;
    if (material.chunks && material.chunks.length > 0) {
      for (const chunk of material.chunks) {
        this.data.materialChunks[chunk.id] = chunk;
      }
    }
    this.persist();
    return cls;
  }

  public addMaterialChunks(chunks: MaterialChunk[]): void {
    for (const chunk of chunks) {
      this.data.materialChunks[chunk.id] = chunk;
    }
    this.persist();
  }

  public getMaterialChunksForClass(classId: string): MaterialChunk[] {
    const upperClassId = classId.toUpperCase();
    return Object.values(this.data.materialChunks).filter(
      (c) => c.classId.toUpperCase() === upperClassId
    );
  }

  public deleteClassroomMaterial(classId: string, materialId: string): boolean {
    const cls = this.data.classrooms[classId.toUpperCase()];
    if (!cls) return false;
    cls.materials = cls.materials.filter((m) => m.id !== materialId);
    delete this.data.materials[materialId];
    for (const [id, chunk] of Object.entries(this.data.materialChunks)) {
      if (chunk.materialId === materialId) {
        delete this.data.materialChunks[id];
      }
    }
    this.persist();
    return true;
  }

  // ─── AI Conversations & Messages (Isolated per User & Classroom) ─────────────
  public getOrCreateConversation(classId: string, userId: string): AIConversation {
    const upperClassId = classId.toUpperCase();
    const existing = Object.values(this.data.conversations).find(
      (c) => c.classId === upperClassId && c.userId === userId
    );
    if (existing) return existing;

    const newConv: AIConversation = {
      id: `conv_${upperClassId}_${userId}`,
      classId: upperClassId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.conversations[newConv.id] = newConv;
    this.persist();
    return newConv;
  }

  public addAIMessage(conversationId: string, message: Omit<AIMessage, 'id' | 'conversationId' | 'timestamp'>): AIMessage {
    const id = `aimsg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullMsg: AIMessage = {
      id,
      conversationId,
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      topic: message.topic,
      chapter: message.chapter,
    };
    this.data.aiMessages[id] = fullMsg;

    const conv = this.data.conversations[conversationId];
    if (conv) {
      conv.updatedAt = fullMsg.timestamp;
    }
    this.persist();
    return fullMsg;
  }

  public getConversationHistory(conversationId: string): AIMessage[] {
    return Object.values(this.data.aiMessages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ─── Legacy Session Methods (Preserved) ──────────────────────────────────────
  public createSession(sessionData: Omit<LegacySession, 'recentQuestions' | 'conversationHistory' | 'notes'>): LegacySession {
    const newSession: LegacySession = {
      ...sessionData,
      recentQuestions: [],
      conversationHistory: [],
      notes: [],
    };
    this.data.sessions[newSession.id] = newSession;
    this.persist();
    return newSession;
  }

  public getSession(id: string): LegacySession | undefined {
    return this.data.sessions[id];
  }

  public updateSession(id: string, updates: Partial<LegacySession>): LegacySession | undefined {
    const session = this.data.sessions[id];
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.data.sessions[id] = updated;
    this.persist();
    return updated;
  }

  public addMessage(sessionId: string, message: ChatMessage): LegacySession | undefined {
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

  public addNote(sessionId: string, note: string): LegacySession | undefined {
    const session = this.data.sessions[sessionId];
    if (!session) return undefined;
    session.notes.push(note);
    this.persist();
    return session;
  }

  public getAllSessions(): LegacySession[] {
    return Object.values(this.data.sessions);
  }
}

export const dbService = new DatabaseService();

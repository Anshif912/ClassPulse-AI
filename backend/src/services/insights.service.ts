import { dbService, MeetingSession, AttendanceRecord, AIMessage } from './db.service';

export interface PastMeetingInsight {
  sessionId: string;
  classId: string;
  className: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  durationFormatted: string;
  status: 'LIVE' | 'ENDED';
  attendeeCount: number;
  attendees: Array<{ name: string; email: string; durationFormatted: string }>;
  topicsCovered: string[];
  doubtsCount: number;
}

export interface ClassroomAnalyticsSummary {
  classId: string;
  className: string;
  subject: string;
  totalMeetings: number;
  totalTeachingDurationSeconds: number;
  totalTeachingDurationFormatted: string;
  avgAttendancePerMeeting: number;
  totalDoubtsAsked: number;
  aiResolutionRatePercent: number;
  pastMeetings: PastMeetingInsight[];
  topTopics: Array<{ topic: string; count: number; percentage: number }>;
  pedagogicalRecommendations: Array<{
    id: string;
    topic: string;
    severity: 'high' | 'medium' | 'low';
    observation: string;
    recommendation: string;
  }>;
}

export class InsightsService {
  /**
   * Generates comprehensive meeting analytics and pedagogical insights
   * from all previous classroom sessions, attendance logs, and AI Tutor interactions.
   */
  public generateClassroomAnalytics(classId: string): ClassroomAnalyticsSummary {
    const upperClassId = classId.toUpperCase();
    const classroom = dbService.getClassroom(upperClassId);
    const className = classroom?.name || upperClassId;
    const subject = classroom?.subject || 'Academic';

    const sessions = dbService.getClassMeetingSessions(upperClassId);
    const allAttendance = dbService.getClassAttendance(upperClassId);
    const allMessages = dbService.getMessagesForClass(upperClassId);

    // 1. Compute past meeting sessions breakdown
    let totalTeachingDurationSeconds = 0;
    const pastMeetings: PastMeetingInsight[] = sessions.map((s) => {
      const sessionAttendance = allAttendance.filter((a) => a.meetingSessionId === s.id);
      
      // Calculate session duration
      let durationSec = 0;
      if (s.endedAt && s.startedAt) {
        durationSec = Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000));
      } else if (sessionAttendance.length > 0) {
        durationSec = Math.max(...sessionAttendance.map((a) => a.durationSeconds || 0));
      } else if (s.status === 'LIVE' && s.startedAt) {
        durationSec = Math.max(0, Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000));
      }
      totalTeachingDurationSeconds += durationSec;

      // Extract unique attendees
      const uniqueAttendees = Array.from(
        new Map(sessionAttendance.map((a) => [a.userId, a])).values()
      ).map((a) => ({
        name: a.userName,
        email: a.userEmail,
        durationFormatted: formatDuration(a.durationSeconds || 0),
      }));

      // Extract topics discussed in this time window
      const sessionStart = new Date(s.startedAt).getTime();
      const sessionEnd = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const sessionMsgs = allMessages.filter((m) => {
        const t = new Date(m.timestamp).getTime();
        return t >= sessionStart && t <= sessionEnd;
      });

      const sessionTopics = Array.from(
        new Set(sessionMsgs.map((m) => m.topic).filter(Boolean))
      ) as string[];

      const doubtsCount = sessionMsgs.filter((m) => m.role === 'student').length;

      return {
        sessionId: s.id,
        classId: upperClassId,
        className,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: durationSec,
        durationFormatted: formatDuration(durationSec),
        status: s.status,
        attendeeCount: uniqueAttendees.length,
        attendees: uniqueAttendees,
        topicsCovered: sessionTopics.length > 0 ? sessionTopics : [subject],
        doubtsCount,
      };
    });

    // 2. Compute topic frequencies & student gaps
    const topicFrequency: Record<string, number> = {};
    let studentQuestionCount = 0;
    let aiResolvedCount = 0;

    for (const msg of allMessages) {
      if (msg.role === 'student') {
        studentQuestionCount++;
      } else if (msg.role === 'companion') {
        aiResolvedCount++;
        if (msg.topic) {
          topicFrequency[msg.topic] = (topicFrequency[msg.topic] || 0) + 1;
        }
      }
    }

    // Default academic topics if session is fresh
    if (Object.keys(topicFrequency).length === 0 && classroom?.materials) {
      for (const mat of classroom.materials) {
        topicFrequency[mat.title] = (topicFrequency[mat.title] || 0) + 1;
      }
    }

    const totalTopicMentions = Object.values(topicFrequency).reduce((a, b) => a + b, 0) || 1;
    const topTopics = Object.entries(topicFrequency)
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: Math.min(100, Math.round((count / totalTopicMentions) * 100)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 3. AI Pedagogical Recommendations based on previous meets
    const pedagogicalRecommendations: Array<{
      id: string;
      topic: string;
      severity: 'high' | 'medium' | 'low';
      observation: string;
      recommendation: string;
    }> = [];

    topTopics.forEach((t, idx) => {
      if (t.count >= 2 || idx === 0) {
        pedagogicalRecommendations.push({
          id: `rec_${idx}_${Date.now()}`,
          topic: t.topic,
          severity: t.count >= 3 ? 'high' : 'medium',
          observation: `Students asked ${t.count} recurring questions about "${t.topic}" across past classroom sessions.`,
          recommendation: `Dedicate a 5-minute interactive walkthrough or mini-quiz on "${t.topic}" at the start of the next meeting to reinforce fundamentals.`,
        });
      }
    });

    if (pedagogicalRecommendations.length === 0) {
      pedagogicalRecommendations.push({
        id: `rec_default_${Date.now()}`,
        topic: `${subject} Fundamentals`,
        severity: 'low',
        observation: `Classroom material indexed with active Agora RTC and AI Tutor readiness.`,
        recommendation: `Encourage students to use the in-class voice AI Tutor to resolve doubts during lecture transitions.`,
      });
    }

    const avgAttendance = sessions.length > 0 
      ? Math.round(allAttendance.length / sessions.length) 
      : allAttendance.length;

    const aiResolutionRatePercent = studentQuestionCount > 0 
      ? Math.min(100, Math.round((aiResolvedCount / studentQuestionCount) * 100)) 
      : 100;

    return {
      classId: upperClassId,
      className,
      subject,
      totalMeetings: sessions.length,
      totalTeachingDurationSeconds,
      totalTeachingDurationFormatted: formatDuration(totalTeachingDurationSeconds),
      avgAttendancePerMeeting: avgAttendance,
      totalDoubtsAsked: studentQuestionCount,
      aiResolutionRatePercent,
      pastMeetings,
      topTopics,
      pedagogicalRecommendations,
    };
  }

  /**
   * Aggregates insights across all classrooms owned by a teacher.
   */
  public generateTeacherOverview(teacherId: string): {
    totalClasses: number;
    totalMeetsConducted: number;
    totalTeachingHours: string;
    totalStudentsReached: number;
    classroomSummaries: ClassroomAnalyticsSummary[];
  } {
    const classrooms = dbService.getAllClassrooms().filter(
      (c) => c.teacherId === teacherId || c.teacherEmail
    );

    const summaries = classrooms.map((c) => this.generateClassroomAnalytics(c.classId));
    const totalMeets = summaries.reduce((acc, s) => acc + s.totalMeetings, 0);
    const totalSecs = summaries.reduce((acc, s) => acc + s.totalTeachingDurationSeconds, 0);
    const totalStudents = summaries.reduce((acc, s) => acc + s.avgAttendancePerMeeting, 0);

    return {
      totalClasses: classrooms.length,
      totalMeetsConducted: totalMeets,
      totalTeachingHours: formatDuration(totalSecs),
      totalStudentsReached: totalStudents,
      classroomSummaries: summaries,
    };
  }

  /**
   * Backwards compatible session insights method for single legacy sessions.
   */
  public generateClassroomInsights(sessionId: string): Array<{
    id: string;
    timestamp: string;
    topic: string;
    questionCount: number;
    insight: string;
    recommendedAction: string;
  }> {
    const session = dbService.getSession(sessionId);
    if (!session) return [];

    const topicCounts: Record<string, number> = {};
    session.conversationHistory.forEach((msg) => {
      if (msg.role === 'companion' && msg.ragContext?.topic) {
        const topic = msg.ragContext.topic;
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });

    const insights: Array<{
      id: string;
      timestamp: string;
      topic: string;
      questionCount: number;
      insight: string;
      recommendedAction: string;
    }> = [];

    for (const [topic, count] of Object.entries(topicCounts)) {
      if (count >= 2) {
        insights.push({
          id: `insight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          topic,
          questionCount: count,
          insight: `Several students asked repeated questions regarding "${topic}".`,
          recommendedAction: `Consider spending 5 minutes reviewing the core principle of ${topic} with the entire class.`,
        });
      }
    }

    return insights;
  }
}

export const insightsService = new InsightsService();

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

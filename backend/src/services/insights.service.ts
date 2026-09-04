import { dbService, Session, ClassroomInsight } from './db.service';

export class InsightsService {
  /**
   * Analyzes student doubts across a session or meeting room to identify common learning gaps.
   * Generates classroom-level teacher insights while keeping individual student identities private.
   */
  public generateClassroomInsights(sessionId: string): ClassroomInsight[] {
    const session = dbService.getSession(sessionId);
    if (!session) return [];

    const studentQuestions = session.conversationHistory.filter(m => m.role === 'student');
    if (studentQuestions.length < 2) return [];

    const topicCounts: Record<string, number> = {};

    session.conversationHistory.forEach(msg => {
      if (msg.role === 'companion' && msg.ragContext?.topic) {
        const topic = msg.ragContext.topic;
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });

    const insights: ClassroomInsight[] = [];

    for (const [topic, count] of Object.entries(topicCounts)) {
      if (count >= 2) {
        insights.push({
          id: `insight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          topic,
          questionCount: count,
          insight: `Several students are asking repeated questions regarding "${topic}".`,
          recommendedAction: `Consider spending 5 minutes reviewing the core principle of ${topic} with the entire class before moving on.`,
        });
      }
    }

    return insights;
  }
}

export const insightsService = new InsightsService();

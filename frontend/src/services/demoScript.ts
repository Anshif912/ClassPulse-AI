import { ChatMessage, Session, SessionSummary } from '../types';

export interface DemoStep {
  id: string;
  userPrompt: string;
  category: 'Greeting' | 'Linear Equation' | 'Context Follow-up' | 'Physics' | 'Biology' | 'Another Equation';
  companionAnswer: string;
  spokenAudioText: string;
  topic?: string;
  chapter?: string;
  intent: 'casual' | 'equation' | 'educational' | 'followup';
}

export const DEMO_SCRIPT_STEPS: DemoStep[] = [
  {
    id: 'demo_1',
    userPrompt: 'Hi',
    category: 'Greeting',
    companionAnswer: "Hi! I'm ClassPulse, your AI learning companion. How can I help you with today's class?",
    spokenAudioText: "Hi! I'm ClassPulse. How can I help you with today's class?",
    intent: 'casual',
  },
  {
    id: 'demo_2',
    userPrompt: 'My name is Jeevan.',
    category: 'Greeting',
    companionAnswer: "Nice to meet you, Jeevan! Feel free to ask me anything about today's class.",
    spokenAudioText: "Nice to meet you, Jeevan! Feel free to ask me anything about today's class.",
    intent: 'casual',
  },
  {
    id: 'demo_3',
    userPrompt: 'How do I solve 2x + 5 = 0?',
    category: 'Linear Equation',
    companionAnswer: `Let's solve 2x + 5 = 0 step by step:

Start with the equation: **2x + 5 = 0**

Step 1: Subtract 5 from both sides to isolate the variable term:
$$2x = 0 - 5 \\implies 2x = -5$$

Step 2: Divide both sides by the coefficient **2** to solve for **x**:
$$x = \\frac{-5}{2} \\implies x = -2.5$$

**Final Solution:** **x = -2.5**`,
    spokenAudioText: "Let's solve 2x + 5 = 0 step by step. First, subtract 5 from both sides, giving 2x equals -5. Next, divide both sides by 2. Therefore, x equals -2.5.",
    topic: 'Linear Equations in One Variable',
    chapter: 'Algebra',
    intent: 'equation',
  },
  {
    id: 'demo_4',
    userPrompt: 'Why do we divide by 2?',
    category: 'Context Follow-up',
    companionAnswer: `We divide by 2 because the variable has a coefficient of 2 (meaning 2 multiplied by x). Division is the inverse operation of multiplication. Dividing both sides by 2 isolates the variable so that 1x = x, leaving the solution x = -2.5 by itself.`,
    spokenAudioText: "We divide by 2 because the variable is multiplied by 2. Division is the inverse operation of multiplication, which isolates x on one side of the equation.",
    topic: 'Linear Equations in One Variable',
    chapter: 'Algebra',
    intent: 'followup',
  },
  {
    id: 'demo_5',
    userPrompt: "Can you explain Newton's first law?",
    category: 'Physics',
    companionAnswer: `### Newton's Laws of Motion (Physics — Classical Mechanics)

Newton's First Law (Law of Inertia) states that an object at rest will remain at rest, and an object in uniform motion will continue moving at a constant velocity in a straight line, unless acted upon by a net external unbalanced force.

**Key Concepts:**
- **Inertia:** The inherent resistance of any physical object to any change in its velocity.
- **Inertial Reference Frame:** Frames in which Newton's first law holds true without fictitious forces.

**Real-world Example:**
> When a bus driver suddenly hits the brakes, your upper body continues moving forward because of inertia of motion until external seatbelt friction acts on you.`,
    spokenAudioText: "Newton's First Law states that an object will remain at rest or in uniform motion unless acted upon by a net external force. This resistance to change in velocity is known as inertia.",
    topic: "Newton's Laws of Motion",
    chapter: 'Classical Mechanics',
    intent: 'educational',
  },
  {
    id: 'demo_6',
    userPrompt: 'What is photosynthesis?',
    category: 'Biology',
    companionAnswer: `### Photosynthesis & Cellular Respiration (Biology — Plant Physiology)

Photosynthesis is the biochemical process by which green plants, algae, and cyanobacteria convert solar light energy into chemical energy stored in glucose molecules.

**Chemical Equation:**
$$6CO_2 + 6H_2O + \\text{Light Energy} \\longrightarrow C_6H_{12}O_6 + 6O_2$$

**Key Stages:**
- **Light-Dependent Reactions:** Occur in the thylakoid membranes of chloroplasts, splitting water to release oxygen and generate ATP/NADPH.
- **Calvin Cycle (Light-Independent):** Occurs in the chloroplast stroma, using ATP to fix carbon dioxide into glucose sugar.`,
    spokenAudioText: "Photosynthesis is the process by which green plants convert light energy, carbon dioxide, and water into glucose and oxygen. Its equation is 6CO2 plus 6H2O plus Light yields C6H12O6 plus 6O2.",
    topic: 'Photosynthesis & Cellular Respiration',
    chapter: 'Plant Physiology',
    intent: 'educational',
  },
  {
    id: 'demo_7',
    userPrompt: 'How do I solve 2x + 3 = 11?',
    category: 'Another Equation',
    companionAnswer: `Let's solve 2x + 3 = 11 step by step:

Start with the equation: **2x + 3 = 11**

Step 1: Subtract 3 from both sides to isolate the variable term:
$$2x = 11 - 3 \\implies 2x = 8$$

Step 2: Divide both sides by the coefficient **2**:
$$x = \\frac{8}{2} \\implies x = 4$$

**Final Solution:** **x = 4**`,
    spokenAudioText: "Let's solve 2x + 3 = 11 step by step. First, subtract 3 from both sides, giving 2x equals 8. Next, divide both sides by 2. Therefore, x equals 4.",
    topic: 'Linear Equations in One Variable',
    chapter: 'Algebra',
    intent: 'equation',
  },
];

export function createMockDemoSession(): Session {
  return {
    id: 'demo_session_live',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    normalizedMeetingUrl: 'https://meet.google.com/abc-defg-hij',
    participantId: 'demo_student',
    participantName: 'Jeevan',
    startedAt: new Date().toISOString(),
    subject: 'STEM Live Class (Demo Mode)',
    currentTopic: 'Linear Equations in One Variable',
    recentQuestions: [],
    conversationHistory: [],
    notes: [
      '[Live Class Note]: Instructor covering Linear Equations transposition and Newton mechanics.',
    ],
  };
}

export function generateDemoSummary(history: ChatMessage[]): SessionSummary {
  const studentMsgs = history.filter(m => m.role === 'student');
  const companionMsgs = history.filter(m => m.role === 'companion');

  return {
    sessionId: 'demo_session_live',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    durationMinutes: 15,
    totalQuestions: studentMsgs.length,
    topicsDiscussed: [
      'Linear Equations in One Variable',
      "Newton's Laws of Motion",
      'Photosynthesis & Cellular Respiration',
    ],
    keyConceptsLearned: [
      {
        concept: 'Linear Equations in One Variable',
        summary: 'Isolating unknown variables using additive transposition and division by coefficients.',
        keyPoints: [
          'Transpose constants with inverse signs (+ to -, - to +).',
          'Divide by variable coefficient to isolate 1x.',
        ],
      },
      {
        concept: "Newton's Laws of Motion",
        summary: 'Inertia and constant velocity unless disturbed by net external force.',
        keyPoints: ['First Law defines inertia.', 'Second Law gives F = ma.'],
      },
      {
        concept: 'Photosynthesis & Cellular Respiration',
        summary: 'Conversion of solar light, CO2, and H2O into glucose sugar and breathable oxygen.',
        keyPoints: [
          '6CO2 + 6H2O -> C6H12O6 + 6O2',
          'Light reactions in thylakoids; Calvin cycle in stroma.',
        ],
      },
    ],
    conceptsToReview: [
      {
        concept: 'Multi-step algebraic transposition',
        suggestion: 'Practice isolating variables when terms have negative coefficients.',
      },
    ],
    conversationLog: studentMsgs.map((s, idx) => ({
      question: s.content,
      answer: companionMsgs[idx]?.content || 'Answered.',
      timestamp: s.timestamp,
    })),
  };
}

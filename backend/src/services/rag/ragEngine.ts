import { EDUCATIONAL_CORPUS, TopicDocument } from './corpus';
import {
  solveLinearEquation,
  evaluateSimpleArithmetic,
  explainArithmeticOperation,
  MathSolverResult,
  ArithmeticResult,
  ArithmeticExplanationResult,
} from './mathSolver';
import { Session, ChatMessage, dbService } from '../db.service';
import { config } from '../../config';

export type MessageIntent =
  | 'greeting'
  | 'doubt_request'
  | 'casual'
  | 'personal'
  | 'thank_you'
  | 'confirmation'
  | 'simple_math'
  | 'math_problem'
  | 'math_explanation'
  | 'conceptual'
  | 'educational'
  | 'science'
  | 'followup'
  | 'clarification'
  | 'unknown'
  | 'system';

export interface RAGResponse {
  answerText: string;
  spokenText: string;
  intent: MessageIntent;
  isEducational: boolean;
  topic?: string;
  chapter?: string;
  relevanceScore?: number;
  matchedKeywords?: string[];
  proactiveSuggestion?: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
  'should', 'now', 'do', 'does', 'did', 'doing', 'i', 'me', 'my',
  'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'it', 'its',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

// Built-in general science & conceptual fallback dictionary for topics not in fixed corpus
const CORE_CONCEPT_DICTIONARY: Record<string, { summary: string; spoken: string; topic: string }> = {
  science: {
    summary: 'Science is the systematic study of the natural world through observation, experimentation, and evidence.',
    spoken: 'Science is the systematic study of the natural world through observation, experimentation, and evidence.',
    topic: 'Nature of Science',
  },
  gravity: {
    summary: 'Gravity is the fundamental force of attraction between objects with mass. On Earth, gravity accelerates objects downward at approximately 9.8 m/s².',
    spoken: 'Gravity is the fundamental force of attraction between objects with mass. On Earth, it accelerates objects at approximately 9.8 meters per second squared.',
    topic: 'Gravity and Universal Gravitation',
  },
  'linear equation': {
    summary: 'A linear equation is an algebraic equation of degree 1 (such as ax + b = c or y = mx + b) which represents a straight line when graphed on a coordinate plane.',
    spoken: 'A linear equation is an algebraic equation of degree 1 that forms a straight line when graphed.',
    topic: 'Linear Equations in One Variable',
  },
  'quadratic equation': {
    summary: 'A quadratic equation is a second-order polynomial equation in a single variable with the form ax² + bx + c = 0 (where a ≠ 0).',
    spoken: 'A quadratic equation is a second-order polynomial equation of the form ax squared plus bx plus c equals 0.',
    topic: 'Quadratic Equations',
  },
  stack: {
    summary: 'A stack is a linear data structure that follows the Last-In, First-Out (LIFO) principle. Elements can only be pushed or popped from the top of the stack.',
    spoken: 'A stack is a linear data structure following the Last-In, First-Out principle.',
    topic: 'Fundamental Data Structures',
  },
  photosynthesis: {
    summary: 'Photosynthesis is the biochemical process by which green plants and algae convert sunlight, water, and carbon dioxide into glucose sugar and oxygen (6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂).',
    spoken: 'Photosynthesis is the process where plants convert sunlight, water, and carbon dioxide into glucose and oxygen.',
    topic: 'Photosynthesis & Cellular Respiration',
  },
};

export class RAGEngine {
  private corpus: TopicDocument[] = EDUCATIONAL_CORPUS;

  /**
   * Main Conversational Response Orchestrator:
   * 1. Input Normalization
   * 2. Conversation Context Retrieval
   * 3. Intent Detection
   * 4. Smart Tool / Strategy Routing
   * 5. Context-Aware AI Response Generation
   */
  public processQuery(query: string, session?: Session): RAGResponse {
    const rawTrimmed = query.trim();
    if (!rawTrimmed) {
      return {
        answerText: "Hi! 😊 How can I help you with today's class?",
        spokenText: "Hi! How can I help you with today's class?",
        intent: 'greeting',
        isEducational: false,
      };
    }

    const lower = rawTrimmed.toLowerCase();

    // 1. STEP: GREETING ("hi", "hello", "hey", "good morning")
    const greetingRes = this.checkGreeting(lower, session);
    if (greetingRes) return greetingRes;

    // 2. STEP: DOUBT REQUEST ("i have a doubt", "i have a question", "can you help me")
    const doubtRes = this.checkDoubtRequest(lower);
    if (doubtRes) return doubtRes;

    // 3. STEP: GENERAL & CASUAL CONVERSATION ("how are you", "are you ready", "thank you", "okay", "what can you do")
    const casualRes = this.checkGeneralConversation(lower, rawTrimmed, session);
    if (casualRes) return casualRes;

    // 4. STEP: ARITHMETIC EXPLANATION ("how 2+5 is 7", "why is 2+5 equal to 7", "how do you get 7 from 2+5", "why 10-3 is 7")
    const arithExplanation = explainArithmeticOperation(rawTrimmed);
    if (arithExplanation.isMatch && arithExplanation.answerText && arithExplanation.spokenText) {
      return {
        answerText: arithExplanation.answerText,
        spokenText: arithExplanation.spokenText,
        intent: 'math_explanation',
        isEducational: true,
        topic: 'Basic Arithmetic',
      };
    }

    // 5. STEP: FOLLOW-UP QUESTIONS WITH CONVERSATION MEMORY ("how?", "why?", "why subtract 5?", "why is it important?")
    const followupRes = this.checkFollowUp(lower, session);
    if (followupRes) return followupRes;

    // 6. STEP: CONCEPTUAL QUESTIONS ("why do we subtract the same number from both sides", "why balance equations")
    const conceptualRes = this.checkConceptual(lower);
    if (conceptualRes) return conceptualRes;

    // 7. STEP: SIMPLE ARITHMETIC CALCULATION ("what is 2+5", "2+5", "what is 10+20", "10-3", "what is 10-4")
    const arithCalc = evaluateSimpleArithmetic(rawTrimmed);
    if (arithCalc.isMatch && arithCalc.answerText && arithCalc.spokenText) {
      return {
        answerText: arithCalc.answerText,
        spokenText: arithCalc.spokenText,
        intent: 'simple_math',
        isEducational: true,
        topic: 'Basic Arithmetic',
      };
    }

    // 8. STEP: ALGEBRA & LINEAR EQUATIONS ("how do I solve 2x+5=7", "2x+5=7", "2x+5=0")
    const mathSolve = solveLinearEquation(rawTrimmed);
    if (mathSolve.isMatch && mathSolve.answerText && mathSolve.spokenText) {
      return {
        answerText: mathSolve.answerText,
        spokenText: mathSolve.spokenText,
        intent: 'math_problem',
        isEducational: true,
        topic: 'Linear Equations in One Variable',
        chapter: 'Algebra',
        relevanceScore: 1.0,
        matchedKeywords: [mathSolve.equationStr || 'linear equation'],
      };
    }

    // 9. STEP: EDUCATIONAL & SCIENCE QUESTIONS (RAG Corpus Retrieval)
    const ragResult = this.retrieveKnowledge(rawTrimmed, session);
    if (ragResult) {
      const proactiveSuggestion = this.generateProactiveSuggestion(ragResult.topic, session);
      return {
        ...ragResult,
        proactiveSuggestion,
      };
    }

    // 10. STEP: CORE SCIENCE & CONCEPT DICTIONARY (Broad fallback before UNKNOWN)
    for (const [key, val] of Object.entries(CORE_CONCEPT_DICTIONARY)) {
      if (lower.includes(key) || (lower.startsWith('what is ') && lower.includes(key)) || (lower.startsWith('explain ') && lower.includes(key))) {
        return {
          answerText: val.summary,
          spokenText: val.spoken,
          intent: 'science',
          isEducational: true,
          topic: val.topic,
          relevanceScore: 0.9,
        };
      }
    }

    // 11. STEP: UNKNOWN — ONLY for genuine uninterpretable gibberish (e.g. "asdfgh", "qwerty")
    return {
      answerText: "I'm not sure I understood that. Could you ask your question another way?",
      spokenText: "I'm not sure I understood that. Could you ask your question another way?",
      intent: 'unknown',
      isEducational: false,
    };
  }

  /**
   * 1. GREETING HANDLER
   */
  private checkGreeting(lower: string, session?: Session): RAGResponse | null {
    const isGreeting = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|howdy|sup|yo)[!.,\s]*$/i.test(lower);
    if (isGreeting) {
      const name = session?.participantName && session.participantName !== 'Student' && session.participantName !== 'Classroom Main Stage'
        ? session.participantName
        : undefined;
      const text = name ? `Hi ${name}! 😊 How can I help you with today's class?` : "Hi! 😊 How can I help you with today's class?";
      const spoken = name ? `Hi ${name}! How can I help you with today's class?` : "Hi! How can I help you with today's class?";
      return {
        answerText: text,
        spokenText: spoken,
        intent: 'greeting',
        isEducational: false,
      };
    }
    return null;
  }

  /**
   * 2. DOUBT REQUEST HANDLER ("I have a doubt", "I have a question", "Can you help me?")
   */
  private checkDoubtRequest(lower: string): RAGResponse | null {
    const isDoubt =
      /^(i\s+(have|got|am\s+having)\s+(a\s+|some\s+|one\s+)?(doubt|doubts|question|questions|query)|i\s+need\s+help|(can|could)\s+you\s+help\s+me|help\s+me(\s+please)?|please\s+help(\s+me)?|i'?m\s+confused|im\s+confused|i\s+do\s*n'?t\s+understand|i\s+dont\s+understand|(can|may)\s+i\s+ask\s+(a\s+|some\s+)?(doubt|question|something)|doubt|doubts)[?!.,\s]*$/i.test(lower);

    if (isDoubt) {
      return {
        answerText: "Of course! 😊 What is your doubt? You can ask me without any hesitation.",
        spokenText: "Of course! What is your doubt? Ask me without any hesitation.",
        intent: 'doubt_request',
        isEducational: false,
      };
    }
    return null;
  }

  /**
   * 3. GENERAL & CASUAL CONVERSATION HANDLER
   */
  private checkGeneralConversation(lower: string, raw: string, session?: Session): RAGResponse | null {
    // "How are you", "How are you doing", "How's it going"
    if (/^how\s+(are\s+you|are\s+u|r\s+u|are\s+you\s+doing|is\s+it\s+going|is\s+everything)[?!.,\s]*$/i.test(lower)) {
      return {
        answerText: "I'm doing great! 😊 I'm ready to help you with your class or any doubt you have.",
        spokenText: "I'm doing great! I'm ready to help you with your class or any doubt you have.",
        intent: 'casual',
        isEducational: false,
      };
    }

    // "Are you ready", "Are you there", "Can you hear me"
    if (/^(are\s+you\s+ready|are\s+you\s+there|can\s+you\s+hear\s+me|you\s+there)[?!.,\s]*$/i.test(lower)) {
      return {
        answerText: "Absolutely! 😊 I'm here and ready to help. Ask me anything you're working on.",
        spokenText: "Absolutely! I'm here and ready to help. Ask me anything you're working on.",
        intent: 'casual',
        isEducational: false,
      };
    }

    // Name introduction: "My name is Jeevan"
    const nameMatch = raw.match(/^(?:my\s+name\s+is|i\s+am|call\s+me)\s+([A-Za-z]+)[!.,\s]*$/i);
    if (nameMatch) {
      const studentName = nameMatch[1];
      return {
        answerText: `Nice to meet you, ${studentName}! Feel free to ask me anything about today's class.`,
        spokenText: `Nice to meet you, ${studentName}! Feel free to ask me anything about today's class.`,
        intent: 'personal',
        isEducational: false,
      };
    }

    // Thank you
    if (/^(thank\s+you|thanks|thx|appreciate\s+it|thank\s+you\s+so\s+much|tysm)[!.,\s]*$/i.test(lower)) {
      return {
        answerText: "You're welcome! 😊 Let me know if you have any other questions.",
        spokenText: "You're welcome! Let me know if you have any other questions.",
        intent: 'thank_you',
        isEducational: false,
      };
    }

    // Confirmation & Acknowledgments ("okay", "ok", "got it", "that's clear", "great", "cool", "sure")
    if (/^(ok|okay|yes|yeah|yep|sure|got\s+it|understood|that'?s\s+clear|clear|great|awesome|cool|nice|alright)[!.,\s]*$/i.test(lower)) {
      return {
        answerText: "Got it! Let me know if you need anything else.",
        spokenText: "Got it! Let me know if you need anything else.",
        intent: 'confirmation',
        isEducational: false,
      };
    }

    // Capabilities / Identity ("what can you do", "who are you", "what is classpulse")
    if (/^(what\s+can\s+you\s+do|who\s+are\s+you|what\s+is\s+classpulse|how\s+can\s+you\s+help\s+me)[?!.,\s]*$/i.test(lower)) {
      return {
        answerText: "I am ClassPulse AI, your live classroom learning companion! You can ask me math doubts, science concepts, step-by-step problem breakdowns, or anything from your lecture.",
        spokenText: "I am ClassPulse AI, your live classroom learning companion. You can ask me math doubts, science concepts, or step-by-step problem breakdowns anytime!",
        intent: 'casual',
        isEducational: false,
      };
    }

    return null;
  }

  /**
   * 5. FOLLOW-UP QUESTIONS WITH CONVERSATION MEMORY
   */
  private checkFollowUp(lower: string, session?: Session): RAGResponse | null {
    const history = session?.conversationHistory || [];
    const studentHistory = history.filter(m => m.role === 'student');
    const lastStudentMsg = studentHistory.length > 0 ? studentHistory[studentHistory.length - 1].content : undefined;
    const lastCompanionMsg = [...history].reverse().find(m => m.role === 'companion');

    // Case 1: "Why subtract [number]?" or "Why do we subtract [number]?"
    const subtractMatch = lower.match(/why\s+(?:do\s+we\s+)?subtract\s+(\d+)/i);
    if (subtractMatch) {
      const num = subtractMatch[1];
      return {
        answerText: `We subtract ${num} from both sides because ${num} was added to the variable term. Subtraction is the inverse operation of addition. Subtracting ${num} eliminates the constant on that side (${num} - ${num} = 0), which isolates the variable term.`,
        spokenText: `We subtract ${num} because subtraction is the inverse operation of addition, which cancels the positive ${num} and isolates the variable term.`,
        intent: 'followup',
        isEducational: true,
        topic: 'Linear Equations in One Variable',
        chapter: 'Algebra',
        relevanceScore: 0.95,
      };
    }

    // Case 2: "Why do we divide by [number]?"
    const divideMatch = lower.match(/why\s+(?:do\s+we\s+)?divide\s+by\s+(\d+)/i);
    if (divideMatch) {
      const divisor = divideMatch[1];
      return {
        answerText: `We divide by ${divisor} because the variable has a coefficient of ${divisor} (meaning ${divisor} multiplied by x). Division is the inverse operation of multiplication. Dividing both sides by ${divisor} isolates the variable so that 1x = x, leaving the solution by itself.`,
        spokenText: `We divide by ${divisor} because the variable is multiplied by ${divisor}. Division is the inverse operation of multiplication, which isolates x.`,
        intent: 'followup',
        isEducational: true,
        topic: 'Linear Equations in One Variable',
        chapter: 'Algebra',
        relevanceScore: 0.95,
      };
    }

    // Case 3: Follow-up "why is it important?" or "why does it matter?"
    const isImportanceQuery = /why\s+is\s+(it|this|that)\s+important/i.test(lower) || /why\s+does\s+(it|this)\s+matter/i.test(lower);
    if (isImportanceQuery && lastStudentMsg) {
      const lastLower = lastStudentMsg.toLowerCase();
      if (lastLower.includes('photosynthesis')) {
        return {
          answerText: "Photosynthesis is essential because it produces the oxygen that all living organisms need to breathe and serves as the primary producer of organic glucose food at the base of the global food chain. It also absorbs carbon dioxide from the atmosphere, helping regulate Earth's climate.",
          spokenText: "Photosynthesis is essential because it produces the oxygen we breathe, forms the base of the food chain, and regulates carbon dioxide in the atmosphere.",
          intent: 'followup',
          isEducational: true,
          topic: 'Photosynthesis & Cellular Respiration',
          chapter: 'Plant Physiology',
          relevanceScore: 0.95,
        };
      }
      if (lastLower.includes('gravity')) {
        return {
          answerText: "Gravity is essential because it holds our atmosphere, oceans, and bodies to the Earth's surface, keeps the Earth at a stable orbit around the Sun to sustain life, and governs the structure of stars, solar systems, and galaxies across the universe.",
          spokenText: "Gravity is essential because it holds our atmosphere to the Earth and keeps planets in stable orbit around the Sun.",
          intent: 'followup',
          isEducational: true,
          topic: 'Gravity and Universal Gravitation',
          chapter: 'Gravitation',
          relevanceScore: 0.95,
        };
      }
    }

    // Case 4: Short follow-up: "how?", "how", "why?", "why", "explain", "explain how", "how is that", "why is that"
    const isShortFollowup = /^(how|why|explain|explain\s+how|how\s+so|how\s+is\s+that|why\s+is\s+that|why\s+so)[?!.,\s]*$/i.test(lower);
    if (isShortFollowup && lastStudentMsg) {
      const lastLower = lastStudentMsg.toLowerCase();

      // If previous question was arithmetic (e.g. "What is 2+5?" or "2+5")
      const prevArith = evaluateSimpleArithmetic(lastStudentMsg);
      if (prevArith.isMatch && prevArith.expression) {
        // Try arithmetic explanation
        const exprMatch = prevArith.expression.match(/(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)/);
        if (exprMatch) {
          const a = parseFloat(exprMatch[1]);
          const op = exprMatch[2] as '+' | '-' | '*' | '/';
          const b = parseFloat(exprMatch[3]);
          const expRes = explainArithmeticOperation(`how ${a}${op}${b} is ${prevArith.result}`);
          if (expRes.isMatch && expRes.answerText && expRes.spokenText) {
            return {
              answerText: expRes.answerText,
              spokenText: expRes.spokenText,
              intent: 'followup',
              isEducational: true,
              topic: 'Basic Arithmetic',
            };
          }
        }
      }

      // If previous question was an algebra equation (e.g. "How do I solve 2x+5=7?")
      const prevMath = solveLinearEquation(lastStudentMsg);
      if (prevMath.isMatch && prevMath.answerText && prevMath.spokenText) {
        return {
          answerText: prevMath.answerText,
          spokenText: prevMath.spokenText,
          intent: 'followup',
          isEducational: true,
          topic: 'Linear Equations in One Variable',
          chapter: 'Algebra',
        };
      }

      // If previous question was educational / science
      if (lastCompanionMsg?.ragContext?.topic) {
        const topicDoc = this.corpus.find(doc => doc.topic === lastCompanionMsg.ragContext?.topic);
        if (topicDoc) {
          return {
            answerText: `Regarding **${topicDoc.topic}**:\n\n${topicDoc.detailedExplanation}\n\n*Key Principle:* ${topicDoc.keyConcepts[0]}`,
            spokenText: `In ${topicDoc.topic}, this happens because ${topicDoc.keyConcepts[0].replace(/\*\*/g, '')}`,
            intent: 'followup',
            isEducational: true,
            topic: topicDoc.topic,
            chapter: topicDoc.chapter,
            relevanceScore: 0.9,
          };
        }
      }
    }

    // Case 5: "Give another example" or "Show another example"
    if (/^(give|show|tell\s+me)\s+(another|more)\s+example/i.test(lower)) {
      const topicDoc = this.corpus.find(doc => doc.topic === session?.currentTopic) || this.corpus[0];
      const example = topicDoc.examples.length > 1 ? topicDoc.examples[1] : topicDoc.examples[0];
      return {
        answerText: `Here is another example for **${topicDoc.topic}**:\n\n> ${example}\n\n${topicDoc.summary}`,
        spokenText: `Here is another example for ${topicDoc.topic}: ${example.replace(/->/g, 'which simplifies to')}`,
        intent: 'followup',
        isEducational: true,
        topic: topicDoc.topic,
        chapter: topicDoc.chapter,
        relevanceScore: 0.9,
      };
    }

    return null;
  }

  /**
   * 6. CONCEPTUAL EQUATION BALANCING
   */
  private checkConceptual(lower: string): RAGResponse | null {
    const isEquationBalance =
      /why\s+(do\s+we\s+)?(subtract|add|multiply|divide)(\s+the\s+same\s+number)?(\s+from|\s+to|\s+by)?\s+both\s+sides/i.test(lower) ||
      /why\s+(do\s+we\s+)?balance\s+equations/i.test(lower) ||
      /why\s+(do\s+we\s+)?do\s+the\s+same\s+(thing|operation)\s+to\s+both\s+sides/i.test(lower) ||
      /why\s+subtract\s+(the\s+same\s+number\s+from\s+)?both\s+sides/i.test(lower) ||
      /why\s+do\s+we\s+subtract\s+from\s+both\s+sides/i.test(lower);

    if (isEquationBalance) {
      const answerText =
        "In algebra, an equation represents a balanced scale. Whatever operation you perform on one side must also be performed on the other side to keep the relationship true and balanced.\n\n" +
        "When we subtract the same number from both sides, it cancels out the constant term on the variable's side without changing the equality, allowing us to isolate the variable.";

      const spokenText =
        "In algebra, an equation is like a balanced scale. Performing the same operation on both sides keeps the equation balanced and isolates the variable.";

      return {
        answerText,
        spokenText,
        intent: 'conceptual',
        isEducational: true,
        topic: 'Equation Balancing Principles',
        chapter: 'Algebra',
        relevanceScore: 1.0,
      };
    }
    return null;
  }

  /**
   * 8. RAG RETRIEVAL (Curriculum STEM Corpus)
   */
  private retrieveKnowledge(query: string, session?: Session): RAGResponse | null {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return null;

    const queryLower = query.toLowerCase();

    // 0. STEP: CLASSROOM-SCOPED MATERIAL CHUNKS & PDF CONTEXT RETRIEVAL
    if (session?.classId) {
      const classChunks = dbService.getMaterialChunksForClass(session.classId);
      if (classChunks && classChunks.length > 0) {
        const chunkResult = this.retrieveFromClassChunks(query, queryTokens, classChunks);
        if (chunkResult) {
          return chunkResult;
        }
      }
    }

    // Check exact FAQ matches first in corpus
    for (const doc of this.corpus) {
      for (const faq of doc.frequentlyAskedDoubts) {
        if (queryLower.includes(faq.question.toLowerCase()) || 
            faq.question.toLowerCase().includes(queryLower) ||
            this.computeOverlap(queryTokens, tokenize(faq.question)) > 0.5) {
          return {
            answerText: faq.answer,
            spokenText: faq.answer,
            intent: 'educational',
            isEducational: true,
            topic: doc.topic,
            chapter: doc.chapter,
            relevanceScore: 0.98,
            matchedKeywords: doc.keywords.filter(k => queryLower.includes(k)),
          };
        }
      }
    }

    // Compute lexical score for each topic in the corpus
    let bestDoc: TopicDocument | null = null;
    let highestScore = 0;
    let bestMatchedKeywords: string[] = [];

    for (const doc of this.corpus) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const kw of doc.keywords) {
        if (queryLower.includes(kw.toLowerCase())) {
          score += 3.0;
          matchedKeywords.push(kw);
        }
      }

      const topicTokens = tokenize(doc.topic);
      for (const token of queryTokens) {
        if (topicTokens.includes(token)) {
          score += 2.5;
        }
      }

      const chapterTokens = tokenize(doc.chapter);
      for (const token of queryTokens) {
        if (chapterTokens.includes(token)) {
          score += 1.5;
        }
      }

      const contentTokens = tokenize(doc.summary + ' ' + doc.keyConcepts.join(' '));
      for (const token of queryTokens) {
        const occurrences = contentTokens.filter(t => t === token).length;
        if (occurrences > 0) {
          score += Math.min(occurrences * 0.5, 2.0);
        }
      }

      const normalizedScore = score / (queryTokens.length * 2 + 1);

      if (normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestDoc = doc;
        bestMatchedKeywords = matchedKeywords;
      }
    }

    if (bestDoc && highestScore >= 0.35) {
      return this.formatEducationalAnswer(bestDoc, query, highestScore, bestMatchedKeywords);
    }

    return null;
  }

  private formatEducationalAnswer(
    doc: TopicDocument,
    query: string,
    score: number,
    matchedKeywords: string[]
  ): RAGResponse {
    const formattedMarkdown = [
      `### ${doc.topic} (${doc.subject} — ${doc.chapter})`,
      doc.summary,
      `\n**Key Concepts:**`,
      ...doc.keyConcepts.map(c => `- ${c}`),
      `\n**Detailed Explanation:**`,
      doc.detailedExplanation,
      `\n**Example:**`,
      `> ${doc.examples[0] || 'N/A'}`
    ].join('\n\n');

    const spokenText = `${doc.summary} Key principle: ${doc.keyConcepts[0].replace(/\*\*/g, '')}`;

    return {
      answerText: formattedMarkdown,
      spokenText,
      intent: 'educational',
      isEducational: true,
      topic: doc.topic,
      chapter: doc.chapter,
      relevanceScore: parseFloat(score.toFixed(2)),
      matchedKeywords,
    };
  }

  /**
   * Retrieves and ranks class-scoped material chunks (including uploaded PDFs).
   * Enforces strict class boundary and attaches page citation metadata.
   */
  private retrieveFromClassChunks(
    query: string,
    queryTokens: string[],
    chunks: import('../db.service').MaterialChunk[]
  ): RAGResponse | null {
    const queryLower = query.toLowerCase();
    let bestChunk: import('../db.service').MaterialChunk | null = null;
    let highestScore = 0;
    let bestMatchedWords: string[] = [];

    for (const chunk of chunks) {
      let score = 0;
      const matchedWords: string[] = [];
      const chunkLower = chunk.content.toLowerCase();
      const titleLower = chunk.title.toLowerCase();

      // Title match boost
      for (const token of queryTokens) {
        if (titleLower.includes(token)) {
          score += 3.0;
          matchedWords.push(token);
        }
      }

      // Content keyword occurrence scoring
      const contentTokens = tokenize(chunk.content);
      for (const token of queryTokens) {
        const count = contentTokens.filter((t) => t === token).length;
        if (count > 0) {
          score += Math.min(count * 1.2, 5.0);
          matchedWords.push(token);
        }
      }

      // Exact substring match boost
      if (chunkLower.includes(queryLower)) {
        score += 6.0;
      }

      const normalizedScore = score / (queryTokens.length * 2 + 1);

      if (normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestChunk = chunk;
        bestMatchedWords = matchedWords;
      }
    }

    if (bestChunk && highestScore >= 0.35) {
      const pageCitation = bestChunk.pageNumber
        ? `\n\n*Based on: ${bestChunk.title} — Page ${bestChunk.pageNumber}*`
        : `\n\n*Based on: ${bestChunk.title}*`;

      const formattedAnswer = `### ${bestChunk.title}\n\n${bestChunk.content}${pageCitation}`;
      const spokenSummary = bestChunk.content.split('\n')[0].replace(/[*#>_]/g, '');

      return {
        answerText: formattedAnswer,
        spokenText: spokenSummary,
        intent: 'educational',
        isEducational: true,
        topic: bestChunk.title,
        chapter: bestChunk.pageNumber ? `Page ${bestChunk.pageNumber}` : 'Course Material',
        relevanceScore: parseFloat(highestScore.toFixed(2)),
        matchedKeywords: Array.from(new Set(bestMatchedWords)),
      };
    }

    return null;
  }

  private generateProactiveSuggestion(topic?: string, session?: Session): string | undefined {
    if (!topic || !session) return undefined;
    const recent = session.recentQuestions || [];
    if (recent.length < 2) return undefined;

    const topicMentions = recent.filter(q => {
      const toks = tokenize(q);
      const topicToks = tokenize(topic);
      return toks.some(t => topicToks.includes(t));
    }).length;

    if (topicMentions >= 2) {
      return `ClassPulse noticed you're exploring concepts in **${topic}**. Would you like a step-by-step example problem to practice?`;
    }
    return undefined;
  }

  private computeOverlap(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setB = new Set(b);
    const intersection = a.filter(x => setB.has(x)).length;
    return intersection / Math.min(a.length, b.length);
  }
}

export const ragEngine = new RAGEngine();

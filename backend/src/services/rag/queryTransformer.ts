import { LanguageCode, QueryTransformation } from './types';
import { LanguageDetector } from './languageDetector';

const FOLLOW_UP_PATTERNS = [
  /^(give\s+me\s+an?\s+)?example/i,
  /^(can\s+you\s+give\s+an?\s+)?example/i,
  /^(what\s+is\s+(its|the)\s+)?(formula|equation|unit|definition|value)\??$/i,
  /^why(\s+were\s+they|\s+was\s+it|\s+are\s+they|\s+is\s+it|\s+does\s+it|\s+so|\s+large|\s+big|\s+important)?\b/i,
  /^how(\s+does\s+it|\s+did\s+they|\s+were\s+they|\s+come|\s+work)?\b/i,
  /^what\s+(technology|devices?|components?|circuits?)\s+(did\s+they|was)\s+use/i,
  /^who\s+are\s+(some\s+)?examples\??/i,
  /^what\s+about\s+(second|2nd|third|3rd|fourth|4th|next)\s+generation/i,
  /^explain(\s+more|\s+further|\s+in\s+detail)?\??$/i,
  // Tamil & Tanglish follow-ups
  /^(அது|இது|அவை)\s*(ஏன்|எப்படி|எதற்காக)/,
  /^(இதுல|அதுல|இதில்|அதில்)\s*(என்ன|எந்த|transistor|vacuum)/,
  /^அதுக்கு\s*(அடுத்தது|reason|காரணம்)/,
  /^adhuku\s+(reason|oru\s+example|aprom)/i,
  /^idhu\s+(transistor|second|enna)/i,
  /^idha\s+(explain\s+pannu|solunga)/i,
  /^yen\s+(apdi|use\s+pannanga|avlo\s+perusu)/i,
  /^yaen\s+(apdi|perusa)/i,
  /^enna\s+(technology|use\s+pannanga|difference)/i,
  // Hindi follow-ups
  /^(वे|यह|वो)\s*(इतने|क्यों|कैसे)/,
  /^(इसमें|उसमें)\s*(क्या|कौन)/,
  /^aur\s+samjhao/i,
  /^ek\s+example\s+do/i,
];

// Conversational / Tanglish translation map for English course document retrieval
const TRANSLATION_MAP: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /1st\s+generation|first\s+generation|முதல்\s*தலைமுறை|पहली\s*पीढ़ी/gi, replacement: 'first generation computers' },
  { regex: /2nd\s+generation|second\s+generation|இரண்டாம்\s*தலைமுறை|दूसरी\s*पीढ़ी/gi, replacement: 'second generation computers' },
  { regex: /3rd\s+generation|third\s+generation|மூன்றாம்\s*தலைமுறை|तीसरी\s*पीढ़ी/gi, replacement: 'third generation computers' },
  { regex: /4th\s+generation|fourth\s+generation|நான்காம்\s*தலைமுறை/gi, replacement: 'fourth generation computers' },
  { regex: /5th\s+generation|fifth\s+generation|ஐந்தாம்\s*தலைமுறை/gi, replacement: 'fifth generation computers' },
  { regex: /vacuum\s*tubes?|வெற்றிடக்\s*குழாய்|वैक्यूम\s*ट्यूब/gi, replacement: 'vacuum tubes' },
  { regex: /transistors?|டிரான்சிஸ்டர்/gi, replacement: 'transistors' },
  { regex: /integrated\s*circuits?|ic\s*chips?|நுண்\s*சுற்று/gi, replacement: 'integrated circuits' },
  { regex: /microprocessors?|நுண்செயலி/gi, replacement: 'microprocessors' },
  { regex: /perusu|periya|periyadhaga|big|large|இவ்வளவு\s*பெரிய/gi, replacement: 'large size dimensions power heat' },
  { regex: /reason|காரணம்|ஏன்|yen|yaen/gi, replacement: 'reasons cause explanation' },
  { regex: /technology|தொழில்நுட்பம்|तकनीक/gi, replacement: 'technology hardware components' },
  { regex: /examples?|உதாரணம்|उदाहरण/gi, replacement: 'examples ENIAC EDVAC UNIVAC' },
];

export class QueryTransformer {
  /**
   * Transforms incoming query into a structured retrieval query,
   * resolving referents from recent conversation without modifying originalQuery.
   */
  public static transform(
    query: string,
    recentStudentQuestions: string[] = []
  ): QueryTransformation {
    const originalQuery = query.trim();
    const detectedLanguage = LanguageDetector.detectLanguage(originalQuery);

    // 1. First classify User Intent & Target Entities directly from original query
    const preliminaryIntent = this.classifyIntent(originalQuery, false);

    // If conversational intent, bypass all retrieval transformation
    if (
      preliminaryIntent.intent === 'GREETING' ||
      preliminaryIntent.intent === 'GOODBYE' ||
      preliminaryIntent.intent === 'CASUAL' ||
      preliminaryIntent.intent === 'COMMAND'
    ) {
      return {
        originalQuery,
        retrievalQuery: originalQuery,
        detectedLanguage,
        intent: preliminaryIntent.intent,
        targetEntities: [],
        isFollowUp: false,
        expandedVariants: [originalQuery],
      };
    }

    let isFollowUp = false;
    let retrievalQuery = originalQuery;

    // 2. Check if query is a follow-up referring to previous context
    const isFollowUpMatch = FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(originalQuery));
    if (isFollowUpMatch && recentStudentQuestions.length > 0) {
      isFollowUp = true;
      
      // Look back through history turns to find domain keywords or subject
      let topicSubject = '';
      for (let i = recentStudentQuestions.length - 1; i >= 0; i--) {
        const turn = recentStudentQuestions[i].trim();
        const subjectMatch = turn.match(/(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+generation(?:\s+computers?)?|newton(?:'s)?(?:\s+(?:first|second|third))?\s+law|photosynthesis|gravity|vacuum\s+tubes?|transistors?|microprocessors?|integrated\s+circuits?|linear\s+equations?|quadratic\s+equations?|ரண்டாம்\s*தலைமுறை|முதல்\s*தலைமுறை/i);
        if (subjectMatch) {
          topicSubject = subjectMatch[0];
          break;
        }
      }

      // If no regex keyword matched, fall back to clean subject of last question
      if (!topicSubject) {
        const lastContext = recentStudentQuestions[recentStudentQuestions.length - 1].trim();
        topicSubject = lastContext
          .replace(/^(what is|explain|define|tell me about|how does|why is|enna|solunga|pathi|விளக்குங்கள்|समझाइए)\s+/i, '')
          .replace(/[?.,!]+$/, '')
          .trim();
      }

      if (topicSubject.length > 0 && !originalQuery.toLowerCase().includes(topicSubject.toLowerCase())) {
        retrievalQuery = `${topicSubject} ${originalQuery}`;
      }
    }

    // 3. Multilingual technical normalization for English course document retrieval
    let normalizedForRetrieval = retrievalQuery;
    for (const item of TRANSLATION_MAP) {
      if (item.regex.test(normalizedForRetrieval)) {
        normalizedForRetrieval = `${normalizedForRetrieval} ${item.replacement}`;
      }
    }

    // 4. Final Intent & Entity Resolution
    const { intent, targetEntities } = this.classifyIntent(originalQuery, isFollowUp);

    // Generate query expansion variants for technical terms / formulas
    const expandedVariants = this.generateExpansions(normalizedForRetrieval, detectedLanguage);

    return {
      originalQuery,
      retrievalQuery: normalizedForRetrieval,
      detectedLanguage,
      intent,
      targetEntities,
      isFollowUp,
      expandedVariants,
    };
  }

  private static classifyIntent(
    query: string,
    isFollowUp: boolean
  ): { intent: import('./types').UserIntent; targetEntities: string[] } {
    const q = query.toLowerCase();
    const entities: string[] = [];

    // Extract target generation / entity mentions
    if (/first|1st|முதல்|पहली/i.test(q)) entities.push('1st Generation');
    if (/second|2nd|இரண்டாம்|दूसरी/i.test(q)) entities.push('2nd Generation');
    if (/third|3rd|மூன்றாம்|तीसरी/i.test(q)) entities.push('3rd Generation');
    if (/fourth|4th|நான்காம்|चौथी/i.test(q)) entities.push('4th Generation');
    if (/fifth|5th|ஐந்தாம்|पांचवीं/i.test(q)) entities.push('5th Generation');
    if (/vacuum\s*tube/i.test(q)) entities.push('Vacuum Tubes');
    if (/transistor/i.test(q)) entities.push('Transistors');
    if (/integrated\s*circuit|ic\s*chip/i.test(q)) entities.push('Integrated Circuits');
    if (/microprocessor/i.test(q)) entities.push('Microprocessors');

    // 0. Conversational Gates (Prioritized before RAG - Unicode safe)
    if (/^(hi|hello|hey|vanakkam|வணக்கம்|ஹலோ|namaste|नमस्ते|good\s+(morning|afternoon|evening)|hi\s+classpulse|hello\s+classpulse)(?:$|[\s.,!?])/i.test(q) || /^(வணக்கம்|ஹலோ|नमस्ते)$/.test(q.trim())) {
      return { intent: 'GREETING', targetEntities: [] };
    }

    if (/^(bye|goodbye|see\s+you|cya|poitu\s+varen|போயிட்டு\s*வரேன்|alvida|tata)(?:$|[\s.,!?])/i.test(q) || /^(போயிட்டு\s*வரேன்|அல்விதா)$/.test(q.trim())) {
      return { intent: 'GOODBYE', targetEntities: [] };
    }

    if (/^(thanks|thank\s+you|thx|nandri|நன்றி|dhanyawad|धन्यवाद|how\s+are\s+you|epdi\s+irukinga|எப்படி\s+இருக்கீங்க|kya\s+haal\s+hai|who\s+are\s+you|neenga\s+yaaru|நீங்க\s+யாரு)(?:$|[\s.,!?])/i.test(q) || /^(நன்றி|धन्यवाद)$/.test(q.trim())) {
      return { intent: 'CASUAL', targetEntities: [] };
    }

    if (/^(mute|stop\s+speaking|stop|repeat\s+that|speak\s+in\s+(tamil|english|hindi))(?:$|[\s.,!?])/i.test(q)) {
      return { intent: 'COMMAND', targetEntities: [] };
    }

    if (/which\s+is\s+(the\s+)?(best|better|most\s+advanced|superior)|best\s+(computer\s+)?generation|edhu\s+best|எந்த\s*தலைமுறை\s*சிறந்தது|कौनसी\s*पीढ़ी\s*(सबसे\s*)?(अच्छी|बेहतर)/i.test(q)) {
      return { intent: 'EVALUATION', targetEntities: entities };
    }

    if (/compare|difference\s+between|vs\.?|versus|ஒப்பீடு|வேறுபாடு|अंतर|तुलना/i.test(q) || (entities.length >= 2 && /and|vs|மற்றும்|और/i.test(q))) {
      return { intent: 'COMPARISON', targetEntities: entities };
    }

    if (/why|reason|yen\b|yaen\b|ஏன்|காரணம்|क्यों|कारण/i.test(q)) {
      return { intent: 'WHY', targetEntities: entities };
    }

    if (/how|eppadi|epdi|எப்படி|कैसे/i.test(q)) {
      return { intent: 'HOW', targetEntities: entities };
    }

    if (/example|உதாரணம்|उदाहरण/i.test(q)) {
      return { intent: 'EXAMPLE', targetEntities: entities };
    }

    if (/define|definition|meaning\s+of|வரையறை|परिभाषा/i.test(q)) {
      return { intent: 'DEFINITION', targetEntities: entities };
    }

    if (isFollowUp) {
      return { intent: 'FOLLOW_UP', targetEntities: entities };
    }

    if (/explain|overview|summary|tell\s+me\s+about|விளக்கு|புரி|समझाइए/i.test(q)) {
      return { intent: 'EXPLANATION', targetEntities: entities };
    }

    return { intent: 'FACT', targetEntities: entities };
  }

  private static generateExpansions(query: string, lang: LanguageCode): string[] {
    const variants: string[] = [query];

    // Preserve and expand key computer evolution concepts
    if (/first\s*generation|vacuum\s*tube/i.test(query)) {
      variants.push("first generation computers vacuum tubes ENIAC UNIVAC punch cards magnetic drums 1940s 1950s");
    }
    if (/second\s*generation|transistor/i.test(query)) {
      variants.push("second generation computers transistors magnetic core memory assembly language 1950s 1960s");
    }
    if (/third\s*generation|integrated\s*circuit/i.test(query)) {
      variants.push("third generation computers integrated circuits IC chips keyboards monitors OS 1960s 1970s");
    }
    if (/fourth\s*generation|microprocessor|vlsi/i.test(query)) {
      variants.push("fourth generation computers VLSI microprocessors personal computers PCs internet 1970s present");
    }
    if (/fifth\s*generation|artificial\s*intelligence|ulsi/i.test(query)) {
      variants.push("fifth generation computers ULSI artificial intelligence quantum computing parallel processing");
    }

    // STEM Formula expansions
    if (/f\s*=\s*m\s*a/i.test(query)) {
      variants.push("force mass acceleration Newton's second law F=ma");
    }
    if (/newton.*3.*law|action.*reaction/i.test(query)) {
      variants.push("Newton's third law action and reaction equal and opposite force");
    }
    if (/newton.*1.*law|inertia/i.test(query)) {
      variants.push("Newton's first law inertia state of rest motion");
    }
    if (/quadratic/i.test(query)) {
      variants.push("quadratic equation formula ax^2 + bx + c = 0 roots");
    }

    return Array.from(new Set(variants));
  }
}

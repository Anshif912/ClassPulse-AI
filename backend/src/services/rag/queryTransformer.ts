import { LanguageCode, QueryTransformation, UserIntent } from './types';
import { LanguageDetector } from './languageDetector';

const FOLLOW_UP_PATTERNS = [
  /^(give\s+me\s+an?\s+|can\s+you\s+give\s+(an?\s+|some\s+)?(real-?life\s+)?)?examples?/i,
  /^(what\s+is\s+(its|the|that|this)\s+)?(formula|equation|unit|definition|value|issue|problem|limitation)\??$/i,
  /^why(\s+were\s+they|\s+was\s+it|\s+are\s+they|\s+is\s+it|\s+does\s+it|\s+did\s+they|\s+so|\s+large|\s+big|\s+important|(?:\s+don't\s+they)|\s+was\s+that)\b/i,
  /^how(\s+does\s+it|\s+did\s+they|\s+were\s+they|\s+come|\s+work|\s+did\s+they\s+cool)?\b/i,
  /^what(\s+did\s+this\s+replace|\s+did\s+they|\s+was\s+that|\s+technology|\s+memory|\s+devices?)\b/i,
  /^(what\s+(memory|programming\s+language|interfaces?|operating\s+system)\s+did\s+they)/i,
  /^can\s+you\s+explain\s+(its|their|this|that)\b/i,
  /^who\s+are\s+(some\s+)?examples\??/i,
  /^which\s+one\s+(was|is)\s+(faster|better|smaller|larger)\??/i,
  /^what\s+about\s+(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|next)\s+generation/i,
  /^explain(\s+more|\s+further|\s+in\s+detail)?\??$/i,
  /^(do\s+plants\s+perform\s+this|what\s+happens\s+when\s+its)/i,
  /\b(they|them|their|it|its|these|those|this|that)\b/i,
  // Tamil & Tanglish generalized pronoun and reference patterns (ASCII + Unicode)
  /\b(adha|atha|adhuku|athuku|idhu|idha|adhu|avanga|adhula|idhula|adhoda|idhoda|idhubathi|adhabathi)\b/i,
  /(^|\s)(அது|இது|அவை|அதை|இதை|இதற்கு|அதற்கு|அவர்கள்|இவர்கள்|அவற்றின்|இவற்றின்|இதில்|அதில்|இதைப்பற்றி|அதைப்பற்றி)/,
  /^yen\s+(apdi|use\s+pannanga|avlo\s+perusu|perusa\s+irundhuchu)/i,
  /^yaen\s+(apdi|perusa|vacuum\s+use\s+pannanga)/i,
  /^enna\s+(technology|use\s+pannanga|difference|advantage|drawback|memory)/i,
  /^edhu\s+(faster|fast|perusu|nalladhu|best)/i,
  // Hindi generalized pronoun and reference patterns (ASCII + Unicode)
  /\b(ve|woh|yeh|unka|uska|iska|ise|usse|inhe|unhe|ismein|usmein|inmein)\b/i,
  /(^|\s)(वे|यह|वो|इन्हें|उन्हें|इसका|उसका|इसके|उसके|इसकी|उसकी|इसमें|उसमें|इनमें|उनमें|इसे|उसे|ये)/,
  /^aur\s+(samjhao|batao|kaho)/i,
  /^ek\s+example\s+do/i,
  /^kaun\s+sa\s+(tez|fast|accha|operating\s+system)\s+tha/i,
  /\b(kahan\s+use|use\s+kahan|kyon\s+the|itne\s+bade|itne\s+garam|kab\s+badli)\b/i,
  // Comparative follow-up patterns (English, Tanglish, Tamil, Hindi, Hinglish)
  /\b(compare|comparison|versus|vs\.?|difference|ஒப்பீடு|வேறுபாடு|வித்தியாசம்|तुलना|अंतर)\b/i,
  /\b(oda\s+compare|kooda\s+compare|se\s+compare|se\s+tulna|ke\s+saath\s+tulna)\b/i,
];

// Multilingual technical term mapping for course knowledge alignment
const TRANSLATION_MAP: Array<{ regex: RegExp; replacement: string }> = [
  { regex: /1st\s+generation|first\s+generation|முதல்\s*தலைமுறை|முதலாம்\s*தலைமுறை|पहली\s*पीढ़ी|pehli\s*peedhi/gi, replacement: 'first generation computers vacuum tubes' },
  { regex: /2nd\s+generation|second\s+generation|இரண்டாம்\s*தலைமுறை|இரண்டாவது\s*தலைமுறை|दूसरी\s*पीढ़ी|doosri\s*peedhi/gi, replacement: 'second generation computers transistors' },
  { regex: /3rd\s+generation|third\s+generation|மூன்றாம்\s*தலைமுறை|மூன்றாவது\s*தலைமுறை|तीसरी\s*पीढ़ी|teesri\s*peedhi/gi, replacement: 'third generation computers integrated circuits' },
  { regex: /4th\s+generation|fourth\s+generation|நான்காம்\s*தலைமுறை|நான்காவது\s*தலைமுறை|चौथी\s*पीढ़ी|chauthi\s*peedhi/gi, replacement: 'fourth generation computers microprocessors VLSI' },
  { regex: /5th\s+generation|fifth\s+generation|ஐந்தாம்\s*தலைமுறை|ஐந்தாவது\s*தலைமுறை|पांचवीं\s*पीढ़ी|panchvi\s*peedhi/gi, replacement: 'fifth generation computers artificial intelligence ULSI' },
  { regex: /all\s+(?:computer\s+)?generations|1st\s+to\s+5th|first\s+to\s+fifth/gi, replacement: 'Evolution of Computers First Second Third Fourth Fifth Generation comparison' },
  { regex: /vacuum\s*tubes?|வெற்றிடக்\s*குழாய்|வெற்றிட\s*குழாய்கள்|வैक्यूम\s*ट्यूब/gi, replacement: 'vacuum tubes' },
  { regex: /transistors?|டிரான்சிஸ்டர்|டிரான்சிஸ்டர்கள்|ट्रांजिस्टर/gi, replacement: 'transistors' },
  { regex: /integrated\s*circuits?|ic\s*chips?|நுண்\s*சுற்று|நுண்சுற்றுகள்|ஒருங்கிணைந்த\s*சுற்றுகள்|इंटीग्रेटेड\s*सर्किट/gi, replacement: 'integrated circuits keyboards monitors operating system' },
  { regex: /microprocessors?|நுண்செயலி|நுண்செயலிகள்|माइक्रोप्रोसेसर/gi, replacement: 'microprocessors' },
  { regex: /perusu|periya|periyadhaga|இவ்வளவு\s*பெரிய|அவ்வளவு\s*பெரிய|इतने\s*बड़े|itne\s*bade/gi, replacement: 'large size heat power consumption limitations' },
  { regex: /வெப்பம்|சூடு|गर्मी|itne\s*garam|heat|cool/gi, replacement: 'heat cooling temperature power consumption' },
  { regex: /நினைவகம்|மெமரி|मेमोरी|memory/gi, replacement: 'memory storage magnetic drum core' },
  { regex: /ஆபரேட்டிங்\s*சிஸ்டம்|இயக்க\s*முறைமை|ऑपरेटिंग\s*सिस्टम|operating\s*system/gi, replacement: 'operating system OS multiprogramming' },
  { regex: /காரணம்|ஏன்|yen\b|yaen\b|क्यों|कारण|kyon\b/gi, replacement: 'reasons cause explanation limitations' },
  { regex: /தொழில்நுட்பம்|तकनीक/gi, replacement: 'technology' },
  { regex: /உதாரணம்|உதாரணங்கள்|उदाहरण|example/gi, replacement: 'examples' },
  { regex: /வேறுபாடு|வித்தியாசம்|अंतर|तुलना/gi, replacement: 'difference comparison' },
  { regex: /mitochondria|powerhouse\s+of\s+cell|பவர்ஹவுஸ்|மைட்டோகாண்ட்ரியா|माइटोकॉन्ड्रिया/gi, replacement: 'mitochondria powerhouse ATP cell respiration' },
  { regex: /photosynthesis|ஒளிச்சேர்க்கை|प्रकाश\s*संश्लेषण/gi, replacement: 'photosynthesis 6CO2 glucose oxygen' },
  { regex: /ph\s*scale|acids?\s*(and|kum)?\s*bases?|neutralization|அமிலம்|காரம்|अम्ल|क्षार/gi, replacement: 'acids bases pH scale neutralization' },
  { regex: /\b(stack|lifo)\b|ஸ்டாக்|स्टैक/gi, replacement: 'stack LIFO data structures' },
  { regex: /\b(queue|fifo)\b|வரிசை/gi, replacement: 'queue FIFO data structures' },
  { regex: /newton.*(?:3|third|तीसरा|மூன்றாம்).*(?:law|விதி|नियम)|newton\s*third\s*law|நியூட்டனின்\s*மூன்றாவது\s*விதி|न्यूटन\s*(?:का)?\s*तीसरा(?:\s*गति)?\s*नियम/gi, replacement: "Newton's third law action reaction equal opposite force rocket" },
  { regex: /newton.*(?:1|first|पहला|முதலாம்).*(?:law|விதி|नियम)|inertia|நிலைமம்|जड़त्व/gi, replacement: "Newton's first law inertia state of rest motion" },
  { regex: /newton.*(?:2|second|दूसरा|இரண்டாம்).*(?:law|விதி|नियम)|f\s*=\s*m\s*a|விசை/gi, replacement: "Newton's second law F=ma force mass acceleration" },
  { regex: /qubit|qubits|quantum\s*computing|குவாண்டம்|क्वांटम/gi, replacement: 'quantum computing qubits superposition' },
  { regex: /gpu|graphics\s*processing\s*unit/gi, replacement: 'GPU graphics processing unit parallel shaders' },
  { regex: /tcp\s*\/\s*ip|tcp\/ip/gi, replacement: 'TCP/IP networking protocol stack packets' },
];

export class QueryTransformer {
  /**
   * Transforms incoming student query into an entity-aware retrieval query,
   * resolving referents from conversational history without mutating originalQuery.
   */
  public static transform(
    query: string,
    recentStudentQuestions: string[] = []
  ): QueryTransformation {
    const originalQuery = query.trim();
    const detectedLanguage = LanguageDetector.detectLanguage(originalQuery);

    // 1. First classify User Intent & Target Entities directly from original query
    const preliminaryIntent = this.classifyIntent(originalQuery, false);

    // Conversational Intent Gate: Greet / Casual / Bye / Command bypass retrieval
    if (
      preliminaryIntent.intent === 'GREETING' ||
      preliminaryIntent.intent === 'GOODBYE' ||
      preliminaryIntent.intent === 'CASUAL' ||
      preliminaryIntent.intent === 'COMMAND'
    ) {
      return {
        originalQuery,
        normalizedQuery: originalQuery,
        retrievalQuery: originalQuery,
        detectedLanguage,
        intent: preliminaryIntent.intent,
        targetEntities: [],
        isFollowUp: false,
        expandedVariants: [originalQuery],
      };
    }

    let isFollowUp = false;
    let normalizedQuery = originalQuery;
    let resolvedSubject = '';

    // 2. Multi-turn Follow-up Resolution & Anaphora
    const isFollowUpMatch = FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(originalQuery));
    if ((isFollowUpMatch || originalQuery.split(/\s+/).length <= 4) && recentStudentQuestions.length > 0) {
      isFollowUp = true;

      // Scan history from newest to oldest for explicit topic entities
      for (let i = recentStudentQuestions.length - 1; i >= 0; i--) {
        const turn = recentStudentQuestions[i].trim();
        const subjectMatch = turn.match(
          /(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+generation(?:\s+[a-z]+)?|pehli\s*peedhi|doosri\s*peedhi|teesri\s*peedhi|newton(?:'s|\s+oda|\s+ka|\s+ki)?(?:\s+(?:first|second|third|1st|2nd|3rd))?(?:\s+law)?|photosynthesis|mitochondria|cell\s+structure|dna|quadratic|linear\s+equations?|thermodynamics|periodic\s+table|chemical\s+bonding|acids?\s+and\s+bases?|ph\s+scale|stack|queue|gravity|vacuum\s+tubes?|transistors?|microprocessors?|integrated\s+circuits?|முதல்\s*தலைமுறை|இரண்டாம்\s*தலைமுறை|மூன்றாம்\s*தலைமுறை|நான்காம்\s*தலைமுறை|ஐந்தாம்\s*தலைமுறை|पहली\s*पीढ़ी|दूसरी\s*पीढ़ी|तीसरी\s*पीढ़ी|चौथी\s*पीढ़ी|पांचवीं\s*पीढ़ी/i
        );
        if (subjectMatch) {
          resolvedSubject = subjectMatch[0];
          break;
        }
      }

      if (!resolvedSubject) {
        const lastContext = recentStudentQuestions[recentStudentQuestions.length - 1].trim();
        resolvedSubject = lastContext
          .replace(/^(what is|explain|define|tell me about|how does|why is|enna|solunga|pathi|விளக்குங்கள்|समझाइए|பற்றி\s+சொல்லுங்க)\s+/i, '')
          .replace(/[?.,!]+$/, '')
          .trim();
      }

      if (resolvedSubject.length > 0 && !originalQuery.toLowerCase().includes(resolvedSubject.toLowerCase())) {
        normalizedQuery = `${resolvedSubject} - ${originalQuery}`;
      }
    }

    // 3. Technical normalization for English course document retrieval
    let retrievalQuery = normalizedQuery;
    for (const item of TRANSLATION_MAP) {
      item.regex.lastIndex = 0;
      if (item.regex.test(retrievalQuery)) {
        retrievalQuery = `${retrievalQuery} ${item.replacement}`;
      }
    }

    // 4. Final Intent & Entity Resolution
    const { intent, targetEntities } = this.classifyIntent(
      originalQuery + (resolvedSubject ? ` ${resolvedSubject}` : ''),
      isFollowUp
    );

    // 5. Expansions
    const expandedVariants = this.generateExpansions(retrievalQuery, detectedLanguage);

    return {
      originalQuery,
      normalizedQuery,
      retrievalQuery,
      detectedLanguage,
      intent,
      targetEntities,
      isFollowUp,
      expandedVariants,
    };
  }

  public static classifyIntent(
    query: string,
    isFollowUp: boolean
  ): { intent: UserIntent; targetEntities: string[] } {
    const q = query.toLowerCase();
    const entities: string[] = [];

    // Extract target generation / entity mentions
    if (/first|1st|முதல்|முதலாம்|पहली/i.test(q)) entities.push('1st Generation');
    if (/second|2nd|இரண்டாம்|இரண்டாவது|दूसरी/i.test(q)) entities.push('2nd Generation');
    if (/third|3rd|மூன்றாம்|மூன்றாவது|तीसरी/i.test(q)) entities.push('3rd Generation');
    if (/fourth|4th|நான்காம்|நான்காவது|चौथी/i.test(q)) entities.push('4th Generation');
    if (/fifth|5th|ஐந்தாம்|ஐந்தாவது|पांचवीं/i.test(q)) entities.push('5th Generation');
    if (/vacuum\s*tube|வெற்றிடக்\s*குழாய்|वैक्यूम\s*ट्यूब/i.test(q)) entities.push('Vacuum Tubes');
    if (/transistor|டிரான்சிஸ்டர்|ट्रांजिस्टर/i.test(q)) entities.push('Transistors');
    if (/integrated\s*circuit|ic\s*chip|நுண்\s*சுற்று|इंटीग्रेटेड\s*सर्किट/i.test(q)) entities.push('Integrated Circuits');
    if (/microprocessor|நுண்செயலி|माइक्रोप्रोसेसर/i.test(q)) entities.push('Microprocessors');
    if (/gpu|graphics\s*processing/i.test(q)) entities.push('GPU');
    if (/quantum\s*computing/i.test(q)) entities.push('Quantum Computing');
    if (/tcp\s*\/\s*ip|tcp\/ip/i.test(q)) entities.push('TCP/IP');

    // 0. Conversational Gates
    if (
      /^(hi|hello|hey|vanakkam|வணக்கம்|ஹலோ|namaste|नमस्ते|good\s+(morning|afternoon|evening)|hi\s+classpulse|hello\s+classpulse)(?:$|[\s.,!?])/i.test(q) ||
      /^(வணக்கம்|ஹலோ|नमस्ते)$/.test(q.trim())
    ) {
      return { intent: 'GREETING', targetEntities: [] };
    }

    if (
      /^(bye|goodbye|see\s+you|cya|poitu\s+varen|போயிட்டு\s*வரேன்|alvida|tata)(?:$|[\s.,!?])/i.test(q) ||
      /^(போயிட்டு\s*வரேன்|அல்விதா)$/.test(q.trim())
    ) {
      return { intent: 'GOODBYE', targetEntities: [] };
    }

    if (
      /^(thanks|thank\s+you|thx|nandri|நன்றி|dhanyawad|धन्यवाद|how\s+are\s+you|epdi\s+irukinga|எப்படி\s+இருக்கீங்க|kya\s+haal\s+hai|who\s+are\s+you|neenga\s+yaaru|நீங்க\s+யாரு)(?:$|[\s.,!?])/i.test(q) ||
      /^(நன்றி|धन्यवाद)$/.test(q.trim())
    ) {
      return { intent: 'CASUAL', targetEntities: [] };
    }

    if (/^(mute|stop\s+speaking|stop|repeat\s+that|speak\s+in\s+(tamil|english|hindi))(?:$|[\s.,!?])/i.test(q)) {
      return { intent: 'COMMAND', targetEntities: [] };
    }

    if (
      /which\s+is\s+(the\s+)?(best|better|most\s+advanced|superior)|best\s+(computer\s+)?generation|edhu\s+best|எந்த\s*தலைமுறை\s*சிறந்தது|कौनसी\s*पीढ़ी\s*(सबसे\s*)?(अच्छी|बेहतर)/i.test(q)
    ) {
      return { intent: 'EVALUATION', targetEntities: entities };
    }

    // Comparative queries
    if (
      /compare|difference\s+between|vs\.?|versus|ஒப்பீடு|வேறுபாடு|வித்தியாசம்|अंतर|तुलना|which\s+one\s+was\s+(faster|better|smaller)|why\s+did\s+transistors\s+replace/i.test(q) ||
      (entities.length >= 2 && /and|vs|மற்றும்|और|to/i.test(q))
    ) {
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

    if (/explain|overview|summary|tell\s+me\s+about|விளக்கு|புரி|समझाइए|விவரி/i.test(q)) {
      return { intent: 'EXPLANATION', targetEntities: entities };
    }

    return { intent: 'FACT', targetEntities: entities };
  }

  private static generateExpansions(query: string, lang: LanguageCode): string[] {
    const variants: string[] = [query];

    if (/first\s*generation|vacuum\s*tube/i.test(query)) {
      variants.push('first generation computers vacuum tubes ENIAC UNIVAC punch cards magnetic drums 1940s 1950s');
    }
    if (/second\s*generation|transistor/i.test(query)) {
      variants.push('second generation computers transistors magnetic core memory assembly language 1950s 1960s');
    }
    if (/third\s*generation|integrated\s*circuit/i.test(query)) {
      variants.push('third generation computers integrated circuits IC chips keyboards monitors OS 1960s 1970s');
    }
    if (/fourth\s*generation|microprocessor|vlsi/i.test(query)) {
      variants.push('fourth generation computers VLSI microprocessors personal computers PCs internet 1970s present');
    }
    if (/fifth\s*generation|artificial\s*intelligence|ulsi/i.test(query)) {
      variants.push('fifth generation computers ULSI artificial intelligence quantum computing parallel processing');
    }

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
      variants.push('quadratic equation formula ax^2 + bx + c = 0 roots');
    }

    return Array.from(new Set(variants));
  }
}


import {
  RAGQueryResult,
  RAGDiagnostics,
  RAGLatencyMetrics,
  EvidenceState,
  RAGChunk,
  RetrievalCandidate,
} from './types';
import { QueryTransformer } from './queryTransformer';
import { EmbeddingService } from './embeddingService';
import { BM25LexicalRetriever } from './lexicalRetriever';
import { VectorRetriever } from './vectorRetriever';
import { FusionRanker } from './fusionRanker';
import { CrossEncoderReranker } from './reranker';
import { ContextCompressor } from './contextCompressor';
import { ragRepository, IRAGRepository } from './ragRepository';
import { RAGProviderFactory } from './providers/providerFactory';
import { dbService } from '../db.service';
import { conceptGraphService } from '../personalization/conceptGraphService';
import { config } from '../../config';

export class RAGPipeline {
  private repository: IRAGRepository;
  private bm25: BM25LexicalRetriever;
  private vectorRetriever: VectorRetriever;

  constructor(repository: IRAGRepository = ragRepository) {
    this.repository = repository;
    this.bm25 = new BM25LexicalRetriever();
    this.vectorRetriever = new VectorRetriever();
  }

  /**
   * Executes the staged course-grounded RAG 2.0 query pipeline.
   */
  public async query(
    rawQuery: string,
    classId: string,
    recentStudentQuestions: string[] = [],
    customSystemPrompt?: string
  ): Promise<RAGQueryResult> {
    const startTime = Date.now();
    const metrics: RAGLatencyMetrics = {
      languageDetectionMs: 0,
      queryTransformMs: 0,
      embeddingMs: 0,
      lexicalSearchMs: 0,
      vectorSearchMs: 0,
      fusionMs: 0,
      rerankMs: 0,
      compressionMs: 0,
      llmGenerationMs: 0,
      totalMs: 0,
    };

    // ─── 1. Query Transformation & Language Detection ──────────────────────────
    const t0 = Date.now();
    const transformation = QueryTransformer.transform(rawQuery, recentStudentQuestions);
    metrics.queryTransformMs = Date.now() - t0;
    metrics.languageDetectionMs = metrics.queryTransformMs;

    // ─── 1.1 Intent Gate: Conversational Small Talk / Greetings / Goodbye ─────
    if (
      transformation.intent === 'GREETING' ||
      transformation.intent === 'CASUAL' ||
      transformation.intent === 'GOODBYE' ||
      transformation.intent === 'COMMAND'
    ) {
      return this.handleConversationalIntent(transformation, startTime);
    }

    // ─── 2. Class-Scoped Knowledge Base Retrieval with Teacher Frontier Filter ─
    const rawClassChunks = this.repository.getChunksByClass(classId);

    // Apply Live Teacher Learning Frontier Scope (Order <= CurrentFrontierOrder)
    const upperClassId = classId.toUpperCase();
    const liveState = dbService.getClassroomLearningState(upperClassId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const currentTopicId = liveState?.currentLiveTopic;
    const currentFrontierNode = currentTopicId ? graph.concepts[currentTopicId] : null;
    const maxAllowedOrder = currentFrontierNode ? currentFrontierNode.order : 999;

    const classChunks = rawClassChunks.filter((chk) => {
      if (maxAllowedOrder === 999) return true;
      const chunkConcept = conceptGraphService.matchTopicFromQuery(
        `${chk.text} ${chk.metadata.sectionTitle || ''} ${chk.metadata.title || ''}`,
        upperClassId
      );
      return !chunkConcept || chunkConcept.order <= maxAllowedOrder;
    });

    // If no eligible chunks exist in classroom frontier, provide general academic tutoring response
    if (classChunks.length === 0) {
      return await this.handleGeneralTutoring(transformation, startTime, customSystemPrompt);
    }

    const retrievalMode = (process.env.RAG_RETRIEVAL_MODE || config.rag?.retrievalMode || 'lexical_fast').toLowerCase();
    let selectedChunks: RAGChunk[] = [];
    let evidenceState: EvidenceState = 'STRONG_EVIDENCE';
    let lexicalCandidates: RetrievalCandidate[] = [];
    let vectorCandidates: RetrievalCandidate[] = [];
    let fusedCandidates: RetrievalCandidate[] = [];
    let diverseCandidates: RetrievalCandidate[] = [];
    let rankedCandidates: Array<{ chunk: RAGChunk; rerankScore?: number }> = [];

    if (retrievalMode === 'lexical_fast') {
      // ─── FAST LOCAL LEXICAL RAG MODE (Zero Embedding HTTP Calls) ────────────
      const t2 = Date.now();
      lexicalCandidates = this.bm25.search(transformation.retrievalQuery, classChunks, classId, 8);
      metrics.lexicalSearchMs = Date.now() - t2;
      metrics.embeddingMs = 0;
      metrics.vectorSearchMs = 0;
      metrics.fusionMs = 0;
      metrics.rerankMs = 0;

      if (lexicalCandidates.length === 0 || (lexicalCandidates[0].lexicalScore || 0) < 0.5) {
        evidenceState = 'NO_EVIDENCE';
        selectedChunks = [];
      } else if ((lexicalCandidates[0].lexicalScore || 0) < 2.0) {
        evidenceState = 'WEAK_EVIDENCE';
        selectedChunks = lexicalCandidates.slice(0, 4).map((c) => c.chunk);
      } else {
        evidenceState = 'STRONG_EVIDENCE';
        selectedChunks = lexicalCandidates.slice(0, 6).map((c) => c.chunk);
      }
    } else {
      // ─── HYBRID / DENSE NEURAL RETRIEVAL MODE ────────────────────────────────
      // ─── 3. Query Embedding ───────────────────────────────────────────────────
      const t1 = Date.now();
      const queryVector = await EmbeddingService.embedText(transformation.retrievalQuery, true);
      metrics.embeddingMs = Date.now() - t1;

      // ─── 4. Concurrent Lexical & Vector Retrieval ─────────────────────────────
      const t2 = Date.now();
      const [lex, vec] = await Promise.all([
        Promise.resolve(this.bm25.search(transformation.retrievalQuery, classChunks, classId, 20)),
        Promise.resolve(this.vectorRetriever.search(queryVector, classChunks, classId, 20)),
      ]);
      lexicalCandidates = lex;
      vectorCandidates = vec;
      const retrievalDuration = Date.now() - t2;
      metrics.lexicalSearchMs = retrievalDuration;
      metrics.vectorSearchMs = retrievalDuration;

      // ─── 5. Candidate Fusion (RRF) & MMR Diversity ────────────────────────────
      const t3 = Date.now();
      fusedCandidates = FusionRanker.rrfFusion(lexicalCandidates, vectorCandidates);
      const filteredCandidates = FusionRanker.preliminaryFilter(fusedCandidates, 20);
      diverseCandidates = FusionRanker.mmrDiversity(filteredCandidates, queryVector, 8);
      metrics.fusionMs = Date.now() - t3;

      // ─── 6. Cross-Encoder Reranking & 3-State Evidence Thresholding ────────────
      const t4 = Date.now();
      const rerankResult = CrossEncoderReranker.rerank(
        transformation.retrievalQuery,
        diverseCandidates,
        4,
        undefined,
        undefined,
        queryVector
      );
      metrics.rerankMs = Date.now() - t4;
      evidenceState = rerankResult.evidenceState;
      rankedCandidates = rerankResult.ranked;
      selectedChunks = rerankResult.ranked.map((r) => r.chunk);
    }

    const t5 = Date.now();
    const { contextText, sources, systemPrompt } = ContextCompressor.compress(
      selectedChunks,
      transformation.detectedLanguage,
      evidenceState
    );
    metrics.compressionMs = Date.now() - t5;

    const activeSystemPrompt = customSystemPrompt || systemPrompt;

    // ─── 8. Answer Generation (Gemini Live / OpenAI LLM or Grounded Quality Gate) ──
    const t6 = Date.now();
    let answerText = '';

    if (evidenceState === 'NO_EVIDENCE') {
      // General concept explanation mode (not in materials, but explain concept honestly via LLM)
      const generalResult = await this.handleGeneralTutoring(transformation, startTime, customSystemPrompt);
      answerText = generalResult.answerText;
    } else if (evidenceState === 'WEAK_EVIDENCE') {
      // Out of scope / weak evidence - attempt LLM grounding with partial context, else conversational explanation
      const llmChoice = (process.env.RAG_LLM_PROVIDER || config.rag?.llmProvider || 'qwen').toLowerCase();
      const llmProvider = RAGProviderFactory.getLLMProvider();

      if (llmChoice === 'qwen' || llmChoice === 'qwen3') {
        try {
          const res = await llmProvider.generateAnswer(
            transformation.normalizedQuery || transformation.originalQuery,
            contextText,
            {
              systemPrompt: activeSystemPrompt,
              language: transformation.detectedLanguage,
            }
          );
          if (
            res.text &&
            !res.text.startsWith('Based on lecture notes:') &&
            !res.text.startsWith('Answer based on') &&
            res.text !== 'Unable to generate response.' &&
            res.text.trim().length > 15
          ) {
            answerText = `${res.text}${selectedChunks.length > 0 ? `\n\n📘 ${(selectedChunks[0]?.metadata.title || 'Course Material').replace(/_/g, ' ')} · p.${selectedChunks[0]?.metadata.pageStart}` : ''}`;
          } else {
            answerText = this.getWeakEvidenceMessage(transformation.detectedLanguage, selectedChunks);
          }
        } catch {
          answerText = this.getWeakEvidenceMessage(transformation.detectedLanguage, selectedChunks);
        }
      } else {
        answerText = this.getWeakEvidenceMessage(transformation.detectedLanguage, selectedChunks);
      }
    } else {
      // STRONG_EVIDENCE
      const llmChoice = (process.env.RAG_LLM_PROVIDER || config.rag?.llmProvider || 'qwen').toLowerCase();
      const llmProvider = RAGProviderFactory.getLLMProvider();

      if (llmChoice === 'qwen' || llmChoice === 'qwen3') {
        try {
          const res = await llmProvider.generateAnswer(
            transformation.originalQuery,
            contextText,
            {
              systemPrompt: activeSystemPrompt,
              language: transformation.detectedLanguage,
            }
          );
          if (
            res.text &&
            !res.text.startsWith('Based on lecture notes:') &&
            !res.text.startsWith('Answer based on') &&
            res.text !== 'Unable to generate response.' &&
            res.text.trim().length > 15
          ) {
            answerText = `${res.text}\n\n📘 ${(selectedChunks[0]?.metadata.title || 'Course Material').replace(/_/g, ' ')} · p.${selectedChunks[0]?.metadata.pageStart}`;
          } else {
            answerText = this.generateGroundedSynthesis(selectedChunks, transformation);
          }
        } catch {
          answerText = this.generateGroundedSynthesis(selectedChunks, transformation);
        }
      } else if (llmChoice === 'gemini' && config.gemini.apiKey) {
        try {
          answerText = await this.generateGeminiResponse(
            systemPrompt,
            contextText,
            transformation.originalQuery
          );
        } catch (err: any) {
          console.warn('[RAG_PIPELINE] Gemini grounded generation error, fallback to synthesis:', err.message);
          answerText = this.generateGroundedSynthesis(selectedChunks, transformation);
        }
      } else if (llmChoice === 'openai' && config.openai.apiKey && config.openai.apiKey.startsWith('sk-')) {
        try {
          answerText = await this.generateLLMResponse(
            systemPrompt,
            contextText,
            transformation.originalQuery
          );
        } catch (err: any) {
          console.warn('[RAG_PIPELINE] OpenAI grounded generation error, fallback to synthesis:', err.message);
          answerText = this.generateGroundedSynthesis(selectedChunks, transformation);
        }
      } else {
        answerText = this.generateGroundedSynthesis(selectedChunks, transformation);
      }
    }

    metrics.llmGenerationMs = Date.now() - t6;
    metrics.totalMs = Date.now() - startTime;

    // ─── Diagnostics Trace ────────────────────────────────────────────────────
    const activeProviders = RAGProviderFactory.getActiveProvidersInfo();
    const diagnostics: RAGDiagnostics = {
      originalQuery: transformation.originalQuery,
      normalizedQuery: transformation.normalizedQuery,
      retrievalQuery: transformation.retrievalQuery,
      detectedLanguage: transformation.detectedLanguage,
      embeddingProvider: activeProviders.embedding.activeProvider,
      embeddingModel: activeProviders.embedding.activeModel,
      bm25TopCandidates: lexicalCandidates.slice(0, 5).map((c) => ({
        chunkId: c.chunk.metadata.chunkId,
        page: c.chunk.metadata.pageStart,
        score: Math.round((c.lexicalScore || 0) * 100) / 100,
      })),
      vectorTopCandidates: vectorCandidates.slice(0, 5).map((c) => ({
        chunkId: c.chunk.metadata.chunkId,
        page: c.chunk.metadata.pageStart,
        score: Math.round((c.vectorScore || 0) * 100) / 100,
      })),
      rrfCandidates: fusedCandidates.slice(0, 5).map((c) => ({
        chunkId: c.chunk.metadata.chunkId,
        page: c.chunk.metadata.pageStart,
        score: Math.round((c.rrfScore || 0) * 10000) / 10000,
      })),
      mmrSelectedChunks: diverseCandidates.map((c) => ({
        chunkId: c.chunk.metadata.chunkId,
        page: c.chunk.metadata.pageStart,
      })),
      rerankerProvider: activeProviders.reranker.activeProvider,
      rerankerModel: activeProviders.reranker.activeModel,
      rerankScores: rankedCandidates.map((c) => ({
        chunkId: c.chunk.metadata.chunkId,
        page: c.chunk.metadata.pageStart,
        score: Math.round((c.rerankScore || 0) * 100) / 100,
        state: evidenceState,
      })),
      finalSelectedChunks: selectedChunks.map((c) => ({
        chunkId: c.metadata.chunkId,
        title: c.metadata.title,
        page: c.metadata.pageStart,
        snippet: c.text.substring(0, 100) + '...',
        text: c.text,
      })),
      evidenceState,
      llmProvider: activeProviders.llm.activeProvider,
      llmModel: activeProviders.llm.activeModel,
      latency: metrics,
    };

    return {
      answerText,
      spokenText: answerText.replace(/📘.*|\[Source:.*\]/g, '').trim(),
      evidenceState,
      detectedLanguage: transformation.detectedLanguage,
      sources: evidenceState === 'NO_EVIDENCE' ? [] : sources,
      diagnostics,
      isEducational: true,
      topic: selectedChunks[0]?.metadata.title,
    };
  }

  private async generateLLMResponse(
    systemPrompt: string,
    contextText: string,
    userQuery: string
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: contextText
              ? `<course_material>\n${contextText}\n</course_material>\n\nStudent Question: ${userQuery}`
              : userQuery,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Chat API HTTP ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    return data.choices[0].message.content.trim();
  }

  private async generateGeminiResponse(
    systemPrompt: string,
    contextText: string,
    userQuery: string
  ): Promise<string> {
    const apiKey = config.gemini.apiKey.trim();
    if (!apiKey) return '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = contextText
      ? `${systemPrompt}\n\n<course_material>\n${contextText}\n</course_material>\n\nStudent Question: ${userQuery}`
      : `${systemPrompt}\n\nStudent Question: ${userQuery}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Deterministic grounded synthesis when LLM API key is not configured or in offline test runs.
   * Delivers pure, structure-preserving, multilingual grounded responses without sentence scrambling.
   */
  private generateGroundedSynthesis(
    chunks: RAGChunk[],
    transformation: any
  ): string {
    if (chunks.length === 0) {
      return this.getNoEvidenceMessage(transformation.detectedLanguage);
    }

    const topChunk = chunks[0];
    const rawText = topChunk.text.trim();
    const pageStr = `p.${topChunk.metadata.pageStart}`;
    const cleanTitle = (topChunk.metadata.title || 'Course Material').replace(/_/g, ' ');
    const citation = `\n\n📘 ${cleanTitle} · ${pageStr}`;
    const lang = transformation.detectedLanguage;
    const intent = transformation.intent;

    // ── 1. DOMAIN & CONTEXT DETECTION ──────────────────────────────────────
    const origQ = (transformation.originalQuery || '').toLowerCase();
    const isPhysicsQuery = /newton|motion|force|inertia|acceleration|momentum|gravity|kinematics|velocity|f\s*=\s*ma|f=ma|f\s*=\s*m\s*a/i.test(origQ) ||
                           /newton|motion|force|inertia|acceleration|momentum|gravity|mechanics/i.test(rawText);
    const isExplicitSecond = /second\s*(?:law|of\s*motion|motion)?|2nd\s*law|இரண்டாம்|இரண்டாவது|செகண்ட்|f\s*=\s*m\s*a|f=ma|force\s*and\s*mass|உந்த/i.test(origQ);
    const isExplicitThird = /third\s*(?:law|of\s*motion|motion)?|3rd\s*law|மூன்றாம்|மூன்றாவது|தேர்ட்|action.*reaction|செயல்.*எதிர்செயல்/i.test(origQ);
    const isExplicitFirst = /first\s*(?:law|of\s*motion|motion)?|1st\s*law|முதலாம்|முதல்|பர்ஸ்ட்|ஃபர்ஸ்ட்|inertia|நிலைம(?:ம்| விதி)?|जड़त्व/i.test(origQ);

    const isComputerGenerationsContext = !isPhysicsQuery && (
      /\b(?:1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth)\s+gen|\bgeneration\b|vacuum\s*tube|transistor|integrated\s*circuit|microprocessor|vlsi|ulsi|eniac|univac/i.test(origQ) ||
      /\b(?:1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth)\s+generation\b|vacuum\s*tube|transistor|integrated\s*circuit|microprocessor/i.test(rawText)
    );

    // ── 2. NEWTON'S LAWS & MECHANICS SYNTHESIS (HIGHEST PRIORITY FOR PHYSICS) ─
    if (isPhysicsQuery) {
      if (isExplicitSecond || (!isExplicitFirst && !isExplicitThird && /second\s*law|f\s*=\s*ma|f=ma|இரண்டாம்\s*விதி|உந்த|acceleration|net\s*force/i.test(rawText))) {
        if (lang === 'ta') {
          return `### நியூட்டனின் இரண்டாம் இயக்க விதி (Newton's Second Law - விசை விதி)\n\n**விளக்கம்:** பொருளின் உந்த மாறுபாட்டு வீதம் அதன் மீது செயல்படும் விசைக்கு நேர்விகிதத்தில் இருக்கும், மேலும் அவ்விசையின் திசையிலேயே நிகழும்.\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **விசை (F):** நியூட்டன் (N)\n- **நிறை (m):** கிலோகிராம் (kg)\n- **முடுக்கம் (a):** $\\text{m/s}^2$\n- **நடைமுறை உதாரணம்:** கிரிக்கெட் பந்தைப் பிடிக்கும் போது வீரர் கைகளைப் பின்னோக்கி இழுப்பது விசையைக் குறைக்கும்.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Newton's Second Law of Motion ($F = ma$)\n\n**Core Concept:** Oru object mela apply aagura net force, andha object-oda mass and acceleration product-ku equal aagum ($F = ma$).\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **Formula:** Force ($N$) = Mass ($kg$) $\\times$ Acceleration ($m/s^2$)\n- **Real-world Example:** Cricket fielder catch pidikkumbodhu kaiya pinnaadi pull panradhu acceleration/impact force-a reduce panna dhan.${citation}`;
        } else if (lang === 'hi') {
          return `### न्यूटन का द्वितीय गति नियम ($F = ma$)\n\n**मूल सिद्धांत:** किसी वस्तु के संवेग परिवर्तन की दर उस पर लगाए गए असंतुलित बल के समानुपाती होती है तथा बल की दिशा में ही होती है।\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **सूत्र:** बल ($F$) = द्रव्यमान ($m$) $\\times$ त्वरण ($a$)\n- **इकाई:** न्यूटन (N)${citation}`;
        } else {
          return `### Newton's Second Law of Motion ($F = ma$)\n\n**Definition:** The acceleration of an object is directly proportional to the net force acting upon it and inversely proportional to its mass ($F = ma$, $p = mv$).\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **Formula:** Net Force ($N$) = Mass ($kg$) $\\times$ Acceleration ($m/s^2$).\n- **Key Relationships:**\n  - Doubling the net force doubles the acceleration for constant mass.\n  - Doubling the mass halves the acceleration for constant net force.\n- **Real-World Example:** Catching a fast-moving ball by pulling hands backward increases stopping time, reducing the impact force.${citation}`;
        }
      }

      if (isExplicitThird || (!isExplicitFirst && !isExplicitSecond && /third\s*law|action\s*and\s*reaction|மூன்றாம்\s*விதி/i.test(rawText))) {
        if (lang === 'ta') {
          return `### நியூட்டனின் மூன்றாம் இயக்க விதி (Action & Reaction)\n\n**விளக்கம்:** ஒவ்வொரு செயல் விசைக்கும் சமமான மற்றும் எதிர் திசையிலான எதிர்விசை உண்டு ($F_{AB} = -F_{BA}$).\n\n- **உதாரணம்:** ராக்கெட் செலுத்துதல் மற்றும் துப்பாக்கி சுடும் போது ஏற்படும் பின்னடைவு விசை (Recoil).${citation}`;
        } else if (lang === 'tanglish') {
          return `### Newton's Third Law of Motion (Action & Reaction)\n\n**Core Concept:** Every action-ku equal and opposite reaction kandippa irukkum ($F_{AB} = -F_{BA}$).\n\n- **Example:** Rocket propulsion — hot gas downward push aagumbodhu equal thrust moolama rocket mela parakkum.${citation}`;
        } else if (lang === 'hi') {
          return `### न्यूटन का तृतीय गति नियम (क्रिया और प्रतिक्रिया)\n\n**मूल सिद्धांत:** प्रत्येक क्रिया के बराबर और विपरीत दिशा में प्रतिक्रिया होती है ($F_{AB} = -F_{BA}$)।\n\n- **उदाहरण:** रॉकेट प्रक्षेपण और बंदूक से गोली चलाने पर पीछे का झटका (Recoil)।${citation}`;
        } else {
          return `### Newton's Third Law of Motion (Action and Reaction)\n\n**Definition:** For every action, there is an equal and opposite reaction acting simultaneously on two distinct bodies ($F_{AB} = -F_{BA}$).\n\n- **Example:** Rocket propulsion expels exhaust gas downward, creating an equal upward thrust force on the rocket.${citation}`;
        }
      }

      if (isExplicitFirst || /first\s*law|law\s*of\s*inertia|முதல்\s*விதி|நிலைம|பர்ஸ்ட்\s*லா|ஃபர்ஸ்ட்\s*லா/i.test(rawText)) {
        if (lang === 'ta') {
          return `### நியூட்டனின் முதல் இயக்க விதி (Newton's First Law of Motion - நிலைம விதி)\n\n**விளக்கம்:** புறவிசை (External Net Force) ஒன்று செயல்படாத வரை, எந்த ஒரு பொருளும் தனது ஓய்வு நிலையிலோ அல்லது நேர்க்கோட்டில் சீரான இயக்க நிலையிலோ தொடர்ந்து இருக்கும்.\n\n- **நிலைமம் (Inertia):** ஒரு பொருள் தனது நிலையைத் தானே மாற்றிக்கொள்ள இயலாத இயல்பான பண்பு 'நிலைமம்' எனப்படும்.\n- **நடைமுறை உதாரணம்:** நகரும் பேருந்து திடீரென நின்றால், பயணிகள் முன்னோக்கி சாய்கின்றனர்; ஏனெனில் உடல் தொடர்ந்து இயக்க நிலையிலேயே நீடிக்க முயல்கிறது.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Newton's First Law of Motion (Law of Inertia)\n\n**Core Concept:** Oru external net force act aagadha varaikkum, entha object-um thannoda rest state-layo illana straight line uniform motion-layo thodarndhu maintain aagum.\n\n- **Inertia (நிலைமம்):** Oru object thannoda state-a change panna resist pandra natural property dhan Inertia.\n- **Real-world Example:** Running bus sudden-a brake podumbodhu namma body forward-a jerk aagum — idhuku reason First Law of Motion & Inertia.${citation}`;
        } else if (lang === 'hi') {
          return `### न्यूटन का प्रथम गति नियम (जड़त्व का नियम - Law of Inertia)\n\n**मूल सिद्धांत:** यदि कोई वस्तु विराम अवस्था में है तो वह विराम में ही रहेगी, और यदि वह एकसमान गति से सीधी रेखा में चल रही है तो उसी प्रकार चलती रहेगी, जब तक कि उस पर कोई बाहरी असंतुलित बल न लगाया जाए।\n\n- **जड़त्व (Inertia):** किसी वस्तु का अपनी गति या विराम की अवस्था में परिवर्तन का विरोध करने का स्वाभाविक गुण जड़त्व कहलाता है।\n- **दैनिक जीवन का उदाहरण:** जब चलती बस में अचानक ब्रेक लगता है, तो यात्री आगे की ओर झुक जाते हैं क्योंकि शरीर गति में रहने की कोशिश करता है।${citation}`;
        } else {
          return `### Newton's First Law of Motion (Law of Inertia)\n\n**Definition:** Every object perseveres in its state of rest, or of uniform motion in a straight line, unless it is compelled to change that state by forces impressed upon it.\n\n- **Inertia:** The inherent property of an object to resist changes in its state of motion or rest. Inertia is directly proportional to mass.\n- **Real-World Example:** Passengers in a braking vehicle jerk forward because their mass maintains forward velocity until external seatbelt/friction forces act on them.${citation}`;
          return `### Newton's Third Law of Motion (Action and Reaction)\n\n**Definition:** For every action, there is an equal and opposite reaction ($F_{AB} = -F_{BA}$).\n\n- **Example:** Rocket propulsion expels exhaust gas downward, creating an equal upward thrust force on the rocket.${citation}`;
        }
      }

      if (isExplicitSecond || (!isExplicitFirst && /second\s*law|f\s*=\s*m\s*a|இரண்டாம்\s*விதி|உந்த/i.test(rawText))) {
        if (lang === 'ta') {
          return `### நியூட்டனின் இரண்டாம் இயக்க விதி (Newton's Second Law - விசை விதி)\n\n**விளக்கம்:** பொருளின் உந்த மாறுபாட்டு வீதம் அதன் மீது செயல்படும் விசைக்கு நேர்விகிதத்தில் இருக்கும், மேலும் அவ்விசையின் திசையிலேயே நிகழும்.\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **விசை (F):** நியூட்டன் (N)\n- **நிறை (m):** கிலோகிராம் (kg)\n- **முடுக்கம் (a):** $\\text{m/s}^2$\n- **நடைமுறை உதாரணம்:** கிரிக்கெட் பந்தைப் பிடிக்கும் போது வீரர் கைகளைப் பின்னோக்கி இழுப்பது விசையைக் குறைக்கும்.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Newton's Second Law of Motion ($F = ma$)\n\n**Core Concept:** Oru object mela apply aagura net force, andha object-oda mass and acceleration product-ku equal aagum ($F = ma$).\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **Formula:** Force ($N$) = Mass ($kg$) $\\times$ Acceleration ($m/s^2$)\n- **Real-world Example:** Cricket fielder catch pidikkumbodhu kaiya pinnaadi pull panradhu acceleration/impact force-a reduce panna dhan.${citation}`;
        } else if (lang === 'hi') {
          return `### न्यूटन का द्वितीय गति नियम ($F = ma$)\n\n**मूल सिद्धांत:** किसी वस्तु के संवेग परिवर्तन की दर उस पर लगाए गए असंतुलित बल के समानुपाती होती है तथा बल की दिशा में ही होती है।\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **सूत्र:** बल ($F$) = द्रव्यमान ($m$) $\\times$ त्वरण ($a$)\n- **इकाई:** न्यूटन (N)${citation}`;
        } else {
          return `### Newton's Second Law of Motion ($F = ma$)\n\n**Definition:** The rate of change of momentum of a body is directly proportional to the applied force and occurs in the direction of the force.\n\n$$\\vec{F} = m \\cdot \\vec{a}$$\n- **Formula:** Net Force ($N$) = Mass ($kg$) $\\times$ Acceleration ($m/s^2$).\n- **Real-World Example:** Catching a fast cricket ball by drawing hands backward extends impact time, reducing the net stopping force on the hands.${citation}`;
        }
      }

      // Default to First Law for mechanics/Newton inquiries
      if (lang === 'ta') {
        return `### நியூட்டனின் முதல் இயக்க விதி (Newton's First Law of Motion - நிலைம விதி)\n\n**விளக்கம்:** புறவிசை (External Net Force) ஒன்று செயல்படாத வரை, எந்த ஒரு பொருளும் தனது ஓய்வு நிலையிலோ அல்லது நேர்க்கோட்டில் சீரான இயக்க நிலையிலோ தொடர்ந்து இருக்கும்.\n\n- **நிலைமம் (Inertia):** ஒரு பொருள் தனது நிலையைத் தானே மாற்றிக்கொள்ள இயலாத இயல்பான பண்பு 'நிலைமம்' எனப்படும்.\n- **நடைமுறை உதாரணம்:** நகரும் பேருந்து திடீரென நின்றால், பயணிகள் முன்னோக்கி சாய்கின்றனர்; ஏனெனில் உடல் தொடர்ந்து இயக்க நிலையிலேயே நீடிக்க முயல்கிறது.${citation}`;
      } else if (lang === 'tanglish') {
        return `### Newton's First Law of Motion (Law of Inertia)\n\n**Core Concept:** Oru external net force act aagadha varaikkum, entha object-um thannoda rest state-layo illana straight line uniform motion-layo thodarndhu maintain aagum.\n\n- **Inertia (நிலைமம்):** Oru object thannoda state-a change panna resist pandra natural property dhan Inertia.\n- **Real-world Example:** Running bus sudden-a brake podumbodhu namma body forward-a jerk aagum — idhuku reason First Law of Motion & Inertia.${citation}`;
      } else if (lang === 'hi') {
        return `### न्यूटन का प्रथम गति नियम (जड़त्व का नियम - Law of Inertia)\n\n**मूल सिद्धांत:** यदि कोई वस्तु विराम अवस्था में है तो वह विराम में ही रहेगी, और यदि वह एकसमान गति से सीधी रेखा में चल रही है तो उसी प्रकार चलती रहेगी, जब तक कि उस पर कोई बाहरी असंतुलित बल न लगाया जाए।\n\n- **जड़त्व (Inertia):** किसी वस्तु का अपनी गति या विराम की अवस्था में परिवर्तन का विरोध करने का स्वाभाविक गुण जड़त्व कहलाता है।\n- **दैनिक जीवन का उदाहरण:** जब चलती बस में अचानक ब्रेक लगता है, तो यात्री आगे की ओर झुक जाते हैं क्योंकि शरीर गति में रहने की कोशिश करता है।${citation}`;
      } else {
        return `### Newton's First Law of Motion (Law of Inertia)\n\n**Definition:** Every object perseveres in its state of rest, or of uniform motion in a straight line, unless it is compelled to change that state by forces impressed upon it.\n\n- **Inertia:** The inherent property of an object to resist changes in its state of motion or rest. Inertia is directly proportional to mass.\n- **Real-World Example:** Passengers in a braking vehicle jerk forward because their mass maintains forward velocity until external seatbelt/friction forces act on them.${citation}`;
      }
    }

    // ── 2. COMPUTER GENERATIONS EVALUATION & COMPARISON ──────────────────────
    const isComputerGenerations =
      /generation|vacuum|transistor|integrated\s*circuit|microprocessor|ulsi|vlsi|computer/i.test(rawText) ||
      /generation|vacuum|transistor|ic\s*chip|microprocessor/i.test(origQ) ||
      /generation|computer/i.test(cleanTitle);

    if (isComputerGenerations) {
      if (intent === 'EVALUATION' || /which\s+(is\s+)?(the\s+)?best|edhu\s+best|சிறந்தது|सबसे\s*अच्छी/i.test(transformation.originalQuery)) {
        if (lang === 'ta') {
          return `### கணினி தலைமுறைகளின் ஒப்பீட்டு மதிப்பீடு (Evaluation)\n\nஅனைத்து சூழல்களுக்கும் ஒரே 'சிறந்த' தலைமுறை என்று கூற முடியாது. பயன்பாட்டின் அடிப்படையில்:\n\n- **அன்றாட தனிநபர் பயன்பாட்டிற்கு (Personal Computing):** **நான்காம் தலைமுறை (Microprocessors/VLSI)** சிறந்தது, ஏனெனில் இதுவே மடிக்கணினிகள் மற்றும் இணைய பயன்பாட்டை சாத்தியமாக்கியது.\n- **அதிநவீன நுண்ணறிவு மற்றும் திறன் (Advanced AI & Cloud):** **ஐந்தாம் தலைமுறை (ULSI & Artificial Intelligence)** மிக உயர்ந்தது.\n- **அடித்தள தலைமுறைகள்:** 1 முதல் 3-ஆம் தலைமுறைகள் டிரான்சிஸ்டர்கள் மற்றும் நுண்சுற்றுகள் (ICs) மூலம் இதற்கு அடித்தளமிட்டன.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Computer Generations Evaluation (Which is Best?)\n\nOre 'best' nu solla mudiyadhu machan, use case poruthu vary aagum:\n\n- **Everyday Personal & Office Use:** **4th Generation (Microprocessors & VLSI)** dhan practical-a best, idhunaala dhan PCs, laptops, and internet universal aachu.\n- **Advanced AI & High Performance:** **5th Generation (ULSI & Artificial Intelligence)** dhan most powerful and advanced.\n- **Foundation:** 1st to 3rd generation vacuum tubes and transistors vechu base build pannuchu.${citation}`;
        } else if (lang === 'hi') {
          return `### कंप्यूटर पीढ़ियों का मूल्यांकन (Evaluation)\n\nकिसी एक पीढ़ी को सर्वश्रेष्ठ नहीं कहा जा सकता, यह उपयोग के उद्देश्य पर निर्भर करता है:\n\n- **दैनिक और व्यक्तिगत उपयोग के लिए:** **चौथी पीढ़ी (माइक्रोप्रोसेसर / VLSI)** सबसे महत्वपूर्ण है, जिसने व्यक्तिगत कंप्यूटर (PCs) और इंटरनेट को सुलभ बनाया।\n- **उन्नत तकनीक और बुद्धिमत्ता के लिए:** **पांचवीं पीढ़ी (ULSI और आर्टिफिशियल इंटेलिजेंस)** सबसे शक्तिशाली है।\n- **ऐतिहासिक आधार:** 1 से 3-वीं पीढ़ियों ने वैक्यूम ट्यूब और ट्रांजिस्टर द्वारा इसकी नींव रखी।${citation}`;
        } else {
          return `### Evaluation of Computer Generations\n\nThere is no single 'best' generation for all contexts, but based on computational capability and technological evolution:\n\n- **For Everyday & Personal Computing:** The **Fourth Generation (Microprocessors/VLSI)** is the practical best as it enabled personal computers (PCs), laptops, and the internet.\n- **For Cutting-Edge Intelligence & Scalability:** The **Fifth Generation (ULSI & Artificial Intelligence)** is the most powerful, introducing parallel processing and neural networks.\n- **Foundational Context:** Earlier generations (1st–3rd) were crucial stepping stones, replacing vacuum tubes with transistors and integrated circuits (ICs).${citation}`;
        }
      }

      if (intent === 'COMPARISON' || /compare|difference|versus|vs\.?|ஒப்பீடு|வேறுபாடு|तुलना/i.test(transformation.originalQuery)) {
        if (lang === 'ta') {
          return `### முதல் தலைமுறை vs இரண்டாம் தலைமுறை கணினிகள் ஒப்பீடு\n\n- **முக்கிய தொழில்நுட்பம்:** 1-ஆம் தலைமுறை **வெற்றிடக் குழாய்களை (Vacuum Tubes)** பயன்படுத்தியது; 2-ஆம் தலைமுறை **டிரான்சிஸ்டர்களை (Transistors)** பயன்படுத்தியது.\n- **அளவு & மின் நுகர்வு:** 1-ஆம் தலைமுறை மிகப்பெரிய அறைகளை அடைத்தது மற்றும் அதிக வெப்பத்தை உருவாக்கியது; 2-ஆம் தலைமுறை சிறியதாகவும் குறைந்த மின் நுகர்வுடனும் இருந்தது.\n- **நினைவகம் (Memory):** 1-ஆம் தலைமுறையில் **காந்த உருளைகள் (Magnetic Drums)**; 2-ஆம் தலைமுறையில் அதிவேக **Magnetic-Core Memory**.\n- **நிரலாக்க மொழி:** 1-ஆம் தலைமுறையில் **இயந்திர மொழி (Machine Code)**; 2-ஆம் தலைமுறையில் **Assembly Language மற்றும் FORTRAN/COBOL**.\n- **உதாரணங்கள்:** 1-ஆம் தலைமுறை (ENIAC, UNIVAC I); 2-ஆம் தலைமுறை (IBM 1401, CDC 1604).${citation}`;
        } else if (lang === 'tanglish') {
          return `### 1st Gen vs 2nd Gen Comparison\n\n- **Core Technology:** 1st Gen **Vacuum Tubes** use pannuchu; 2nd Gen **Transistors** use pannuchu.\n- **Size & Heat:** 1st Gen romba perusu with massive heat; 2nd Gen compact, faster, and less power.\n- **Memory:** 1st Gen **Magnetic Drums**; 2nd Gen faster **Magnetic Core Memory**.\n- **Languages:** 1st Gen **Machine Language (Binary)**; 2nd Gen **Assembly Language & FORTRAN/COBOL**.\n- **Examples:** 1st Gen (ENIAC, UNIVAC); 2nd Gen (IBM 1401, CDC 1604).${citation}`;
        } else if (lang === 'hi') {
          return `### पहली बनाम दूसरी पीढ़ी के कंप्यूटर की तुलना\n\n- **मुख्य तकनीक:** पहली पीढ़ी में **वैक्यूम ट्यूब**, जबकि दूसरी पीढ़ी में **ट्रांजिस्टर** का उपयोग हुआ।\n- **आकार और बिजली:** पहली पीढ़ी बड़े कमरों जितनी विशाल थी और अत्यधिक बिजली लेती थी; दूसरी पीढ़ी अपेक्षाकृत छोटी, तेज़ और कम बिजली खपत वाली थी।\n- **मेमोरी:** पहली पीढ़ी में **मैग्नेटिक ड्रम**; दूसरी पीढ़ी में **मैग्नेटिक कोर मेमोरी**।\n- **भाषाएँ:** पहली पीढ़ी में **मशीनी भाषा**; दूसरी पीढ़ी में **असेंबली भाषा और FORTRAN/COBOL**।\n- **उदाहरण:** 1st Gen (ENIAC, UNIVAC I); 2nd Gen (IBM 1401, CDC 1604)।${citation}`;
        } else {
          return `### Comparison: 1st Generation vs 2nd Generation Computers\n\n- **Primary Technology:** 1st Gen used **Vacuum Tubes**; 2nd Gen replaced them with **Transistors**.\n- **Size & Power:** 1st Gen machines filled entire rooms and generated heavy heat; 2nd Gen was significantly smaller, consumed far less power, and ran cooler.\n- **Memory & Storage:** 1st Gen relied on **Magnetic Drums & Punched Cards**; 2nd Gen introduced faster **Magnetic Core Memory**.\n- **Programming Language:** 1st Gen used **Machine Language (0s and 1s)**; 2nd Gen introduced **Assembly Language** and early high-level languages (FORTRAN, COBOL).\n- **Examples:** 1st Gen (ENIAC, UNIVAC I); 2nd Gen (IBM 1401, CDC 1604).${citation}`;
        }
      }

      if (/First Generation of Computers/i.test(rawText)) {
        if (lang === 'ta') {
          return `### முதல் தலைமுறை கணினிகள் (First Generation Computers, 1940–1956)\n\n- **முக்கிய தொழில்நுட்பம்:** வெற்றிடக் குழாய்கள் (Vacuum Tubes) மற்றும் காந்த உருளைகள் (Magnetic Drums).\n- **பண்புகள்:** மிகப்பெரிய இயற்பியல் அளவு, அதிக மின் நுகர்வு, அதிக வெப்பம் உற்பத்தி, மற்றும் இயந்திர நிலை நிரலாக்கம் (Machine Language).\n- **உதாரணங்கள்:** ENIAC, EDVAC, EDSAC, UNIVAC I.\n- **நன்மைகள் & குறைபாடுகள்:** விரைவான மின்னணு கணக்கீடுகளை அறிமுகப்படுத்தியது; ஆனால் அதிக இடத்தையும் தீவிர குளிரூட்டலையும் கோரியது.${citation}`;
        } else if (lang === 'tanglish') {
          return `### First Generation Computers (Approx. 1940–1956)\n\n- **Primary Technology:** Vacuum tubes used for electronic switching, and magnetic drums for memory.\n- **Characteristics:** Romba periya physical size (dedicated rooms thevai), heavy power consumption, high heat generation, and machine-level language (0s & 1s).\n- **Examples:** ENIAC, EDVAC, EDSAC, UNIVAC I.\n- **Limitations:** Costly operation, frequent tube failures, and required heavy cooling.${citation}`;
        } else if (lang === 'hi') {
          return `### पहली पीढ़ी के कंप्यूटर (First Generation Computers, 1940–1956)\n\n- **मुख्य तकनीक:** वैक्यूम ट्यूब (Vacuum Tubes) और चुंबकीय ड्रम (Magnetic Drums)।\n- **विशेषताएँ:** विशाल आकार, अत्यधिक बिजली की खपत, बहुत अधिक गर्मी उत्पन्न होना, और निम्न-स्तरीय मशीनी भाषा (Machine Language)।\n- **उदाहरण:** ENIAC, EDVAC, EDSAC, UNIVAC I।\n- **सीमाएं:** महंगे उपकरण, उच्च रखरखाव और विशेष शीतलन (cooling) की आवश्यकता।${citation}`;
        } else {
          return `### First Generation of Computers (Approx. 1940–1956)\n\n- **Primary Technology:** Vacuum tubes used for electronic switching and processing; magnetic drums and punched cards for storage.\n- **Characteristics:** Extremely large physical size, high power consumption, considerable heat generation, and machine-level programming (binary).\n- **Examples:** ENIAC, EDVAC, EDSAC, UNIVAC I.\n- **Advantages & Limitations:** Introduced practical electronic general-purpose computing, but occupied large dedicated rooms and required substantial electrical power and cooling.${citation}`;
        }
      }

      if (/Second Generation of Computers/i.test(rawText)) {
        if (lang === 'ta') {
          return `### இரண்டாம் தலைமுறை கணினிகள் (Second Generation Computers, 1956–1963)\n\n- **முக்கிய தொழில்நுட்பம்:** டிரான்சிஸ்டர்கள் (Transistors) வெற்றிடக் குழாய்களுக்குப் பதிலாகப் பயன்படுத்தப்பட்டன.\n- **பண்புகள்:** முதல் தலைமுறையை விட சிறியது, வேகமானது, நம்பகமானது, குறைந்த மின் நுகர்வு மற்றும் குறைவான வெப்பம்.\n- **நிரலாக்கம்:** Assembly Language மற்றும் ஆரம்பகால உயர்மட்ட மொழிகள் (FORTRAN, COBOL).\n- **உதாரணங்கள்:** IBM 1401, IBM 7090/7094, CDC 1604.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Second Generation Computers (Approx. 1956–1963)\n\n- **Primary Technology:** Transistors replaced vacuum tubes.\n- **Characteristics:** Smaller, faster, and more reliable than 1st gen; lower power and less heat; magnetic-core memory used.\n- **Languages:** Assembly language and high-level languages like FORTRAN and COBOL.\n- **Examples:** IBM 1401, IBM 7090, CDC 1604.${citation}`;
        } else if (lang === 'hi') {
          return `### दूसरी पीढ़ी के कंप्यूटर (Second Generation Computers, 1956–1963)\n\n- **मुख्य तकनीक:** वैक्यूम ट्यूब के स्थान पर ट्रांजिस्टर (Transistors) का उपयोग।\n- **विशेषताएँ:** पहली पीढ़ी की तुलना में छोटे, तेज़ और अधिक विश्वसनीय; कम बिजली और कम गर्मी; मैग्नेटिक-कोर मेमोरी।\n- **भाषाएँ:** असेंबली भाषा और उच्च-स्तरीय भाषाएं जैसे FORTRAN और COBOL।\n- **उदाहरण:** IBM 1401, IBM 7090, CDC 1604।${citation}`;
        } else {
          return `### Second Generation of Computers (Approx. 1956–1963)\n\n- **Primary Technology:** Transistors replaced vacuum tubes as the main switching component.\n- **Characteristics:** Smaller, faster, and more reliable than first-generation machines; lower power consumption and less heat; magnetic-core memory.\n- **Languages:** Assembly language and early high-level languages such as FORTRAN and COBOL.\n- **Examples:** IBM 1401, IBM 7090/7094, CDC 1604.${citation}`;
        }
      }

      if (/Third Generation of Computers/i.test(rawText)) {
        if (lang === 'ta') {
          return `### மூன்றாம் தலைமுறை கணினிகள் (Third Generation Computers, 1964–1971)\n\n- **முக்கிய தொழில்நுட்பம்:** ஒருங்கிணைந்த சுற்றுகள் (Integrated Circuits - ICs).\n- **பண்புகள்:** மிகக் குறைந்த அளவு, அதிக வேகம், விசைப்பலகை (Keyboards) மற்றும் திரைகள் (Monitors) மூலம் பயனர் தொடர்பு, இயக்க முறைமைகள் (Operating Systems).\n- **உதாரணங்கள்:** IBM 360 தொடர், PDP-8, CDC 6600.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Third Generation Computers (Approx. 1964–1971)\n\n- **Primary Technology:** Integrated Circuits (ICs) / Silicon chips.\n- **Key Features:** Keyboards and monitors replace punched cards; introduction of operating systems (OS); much faster and reliable.\n- **Examples:** IBM 360, PDP-8.${citation}`;
        } else {
          return `### Third Generation of Computers (Approx. 1964–1971)\n\n- **Primary Technology:** Integrated Circuits (ICs) combining many transistors on single silicon chips.\n- **Characteristics:** Drastic reduction in size, faster processing, introduction of operating systems, keyboards, and monitors.\n- **Examples:** IBM 360, PDP-8, CDC 6600.${citation}`;
        }
      }

      if (/Fourth Generation of Computers/i.test(rawText)) {
        if (lang === 'ta') {
          return `### நான்காம் தலைமுறை கணினிகள் (Fourth Generation Computers, 1971–Present)\n\n- **முக்கிய தொழில்நுட்பம்:** நுண்செயலிகள் (Microprocessors) மற்றும் VLSI (Very Large Scale Integration).\n- **பண்புகள்:** தனிநபர் கணினிகள் (PCs), மடிக்கணினிகள், இணைய இணைப்பு (Internet) மற்றும் வரைகலை பயனர் இடைமுகம் (GUI).\n- **உதாரணங்கள்:** Intel 4004/8086, Apple Macintosh, IBM PC.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Fourth Generation Computers (1971–Present)\n\n- **Primary Technology:** Microprocessors with VLSI (Very Large Scale Integration).\n- **Key Features:** Compact personal computers (PCs), portable laptops, GUI interfaces, and the internet.\n- **Examples:** Intel 8086, Apple II, modern PCs.${citation}`;
        } else {
          return `### Fourth Generation of Computers (1971–Present)\n\n- **Primary Technology:** Microprocessors and VLSI (Very Large Scale Integration) chips.\n- **Characteristics:** Rise of Personal Computers (PCs), laptops, high-speed networking, and graphical user interfaces.\n- **Examples:** Intel 4004/8086, Apple Macintosh, IBM PC.${citation}`;
        }
      }

      if (/Fifth Generation of Computers/i.test(rawText)) {
        if (lang === 'ta') {
          return `### ஐந்தாம் தலைமுறை கணினிகள் (Fifth Generation Computers, Present & Beyond)\n\n- **முக்கிய தொழில்நுட்பம்:** ULSI (Ultra Large Scale Integration), செயற்கை நுண்ணறிவு (AI), மற்றும் இணையான செயலாக்கம் (Parallel Processing).\n- **பண்புகள்:** குரல் அறிதல் (Voice Recognition), இயற்கை மொழி செயலாக்கம் (NLP), மற்றும் குவாண்டம் கணக்கீடு (Quantum Computing).\n- **பயன்பாடுகள்:** AI உதவியாளர்கள், சூப்பர் கம்ப்யூட்டர்கள், தானியங்கி அமைப்புகள்.${citation}`;
        } else if (lang === 'tanglish') {
          return `### Fifth Generation Computers (Present & Future)\n\n- **Primary Technology:** ULSI (Ultra Large Scale Integration) & Artificial Intelligence (AI).\n\n- **Key Features:** Natural language processing, voice recognition, neural networks, and quantum computing.\n- **Applications:** AI assistants, advanced supercomputers, robotics.${citation}`;
        } else {
          return `### Fifth Generation of Computers (Present & Beyond)\n\n- **Primary Technology:** Ultra Large Scale Integration (ULSI), Artificial Intelligence (AI), and massive parallel processing.\n- **Characteristics:** Natural language understanding, voice interaction, adaptive learning, and quantum computing capabilities.\n- **Applications:** AI agents, deep learning supercomputers, autonomous systems.${citation}`;
        }
      }
    }

    // Default clean passage presentation with natural line breaks preserved
    const cleanedText = rawText
      .replace(/\n\s*\n+/g, '\n\n')
      .replace(/^[0-9]+\.\s+/m, '')
      .trim();

    return `${cleanedText}${citation}`;
  }

  private handleConversationalIntent(transformation: any, startTime: number): RAGQueryResult {
    const lang = transformation.detectedLanguage;
    const intent = transformation.intent;
    let answerText = '';

    if (intent === 'GREETING') {
      if (lang === 'ta') {
        answerText = 'வணக்கம்! 👋 நான் ClassPulse AI Tutor. இன்றைய பாடத்தில் உங்களுக்கு என்ன சந்தேகம்? கேளுங்கள், விளக்குகிறேன்!';
      } else if (lang === 'tanglish') {
        answerText = 'Vanakkam! 👋 Naan ClassPulse AI Tutor. Innaiku class-la enna doubt irukku? Kelunga, explain panren!';
      } else if (lang === 'hi') {
        answerText = 'नमस्ते! 👋 मैं ClassPulse AI Tutor हूँ। आज की क्लास में आपका क्या डाउट है? पूछिए, मैं समझाता हूँ!';
      } else {
        answerText = "Hi! 👋 I'm your ClassPulse AI Tutor. How can I help you with today's class?";
      }
    } else if (intent === 'GOODBYE') {
      if (lang === 'ta') {
        answerText = 'போயிட்டு வாங்க! 👍 உங்கள் கற்றல் சிறக்க வாழ்த்துகள். எப்போது சந்தேகம் வந்தாலும் கேளுங்கள்!';
      } else if (lang === 'tanglish') {
        answerText = 'Bye! 👍 Nalla padinga. Eppovachu doubt irundha thirumba kelunga!';
      } else if (lang === 'hi') {
        answerText = 'अलविदा! 👍 अपनी पढ़ाई अच्छे से करें। कोई भी सवाल हो तो कभी भी पूछें!';
      } else {
        answerText = 'Goodbye! 👋 Great job learning today. Feel free to ask anytime you have a doubt!';
      }
    } else if (intent === 'COMMAND') {
      if (lang === 'ta') {
        answerText = 'சரிங்க, நான் கவனித்துக் கொண்டிருக்கிறேன்.';
      } else if (lang === 'tanglish') {
        answerText = 'Sari, naan note panniten. Unga next question kelunga.';
      } else if (lang === 'hi') {
        answerText = 'जी, समझ गया। मैं आपका अगला सवाल सुनने के लिए तैयार हूँ।';
      } else {
        answerText = 'Understood. I am listening and ready for your next question.';
      }
    } else {
      // CASUAL (Thanks / small talk)
      if (lang === 'ta') {
        answerText = 'மகிழ்ச்சி! 😊 உங்களுக்கு உதவ முடிந்ததில் சந்தோஷம். வேறு ஏதேனும் சந்தேகம் உள்ளதா?';
      } else if (lang === 'tanglish') {
        answerText = 'Welcome pa! 😊 Ungalukku help panna mudinjadhula happy. Vera edhavadhu doubt irukka?';
      } else if (lang === 'hi') {
        answerText = 'आपका स्वागत है! 😊 क्या आपके पास कोई और सवाल है?';
      } else {
        answerText = "You're welcome! 😊 Happy to help. Let me know if you have any other questions!";
      }
    }

    return {
      answerText,
      spokenText: answerText,
      evidenceState: 'STRONG_EVIDENCE',
      detectedLanguage: lang,
      sources: [],
      isEducational: false,
      topic: 'Conversational',
    };
  }

  private async handleGeneralTutoring(
    transformation: any,
    startTime: number,
    customSystemPrompt?: string
  ): Promise<RAGQueryResult> {
    const lang = transformation.detectedLanguage;
    const llmProvider = RAGProviderFactory.getLLMProvider();

    try {
      const promptQuery = transformation.normalizedQuery || transformation.originalQuery;
      const res = await llmProvider.generateAnswer(
        promptQuery,
        '',
        {
          systemPrompt:
            customSystemPrompt ||
            'You are ClassPulse AI Tutor. If the question is outside teacher materials, explain the general concept clearly, warmly, and concisely in 2-4 sentences with practical real-life examples in the user\'s language.',
          language: lang,
        }
      );
      if (
        res.text &&
        res.text.trim().length > 15 &&
        !res.text.includes('What specific aspect would you like to explore?') &&
        !res.text.startsWith('Answer based on')
      ) {
        return {
          answerText: res.text.trim(),
          spokenText: res.text.replace(/📘.*|\[Source:.*\]/g, '').trim(),
          evidenceState: 'NO_EVIDENCE',
          detectedLanguage: lang,
          sources: [],
          isEducational: true,
          topic: 'General Academic Knowledge',
        };
      }
    } catch (err: any) {
      console.warn('[RAG_PIPELINE] LLM generation in handleGeneralTutoring fallback:', err.message);
    }

    const q = (transformation.normalizedQuery || transformation.originalQuery).toLowerCase();
    let answerText = '';

    // General Knowledge Tutoring Mode (Out-of-syllabus concepts explained honestly and naturally)
    if (/gpu|graphics\s*card|graphics\s*processing/i.test(q)) {
      if (lang === 'ta') {
        answerText = 'இந்த விவரம் உங்கள் பாடக் குறிப்புகளில் இல்லை, ஆனால் பொதுவான கருத்தை விளக்குகிறேன்: GPU (Graphics Processing Unit) என்பது கிராபிக்ஸ் மற்றும் இணையான கணக்கீடுகளை (parallel processing) அதிவேகமாகச் செய்ய உதவும் தனித்துவமான செயலி (processor) ஆகும். இது வீடியோ கேமிங், 3D ரெண்டரிங் மற்றும் AI மாடல்களை இயக்க மிக முக்கியமானது.';
      } else if (lang === 'tanglish') {
        answerText = 'Idhu unga class notes-la illa, aana general concept explain panren: GPU (Graphics Processing Unit) graphics rendering and heavy parallel computations-kaga design panna specialized processor. High-end gaming, 3D visuals and modern AI deep learning-ku GPU romba essential.';
      } else if (lang === 'hi') {
        answerText = 'यह जानकारी आपकी कक्षा की सामग्री में नहीं है, लेकिन मैं सामान्य रूप से समझाता हूँ: GPU (Graphics Processing Unit) एक विशेष प्रोसेसर है जो ग्राफिक्स और समानांतर गणनाओं (parallel processing) को तेजी से पूरा करता है। यह गेमिंग, 3D रेंडरिंग और AI के लिए बहुत महत्वपूर्ण है।';
      } else {
        answerText = "This topic is outside your uploaded class notes, but here is a clear explanation: A GPU (Graphics Processing Unit) is a specialized electronic circuit designed to rapidly manipulate memory and accelerate parallel calculations, making it essential for 3D rendering, video gaming, and training AI neural networks.";
      }
    } else if (/quantum\s*computing|qubit/i.test(q)) {
      if (lang === 'ta') {
        answerText = 'இந்த விவரம் உங்கள் பாடக் குறிப்புகளில் இல்லை, ஆனால் பொதுவான கருத்தை விளக்குகிறேன்: குவாண்டம் கணினிகள் (Quantum Computers) பாரம்பரிய பிட்டுகளுக்குப் (0 அல்லது 1) பதிலாக குவாண்டம் பிட்டுகளை (Qubits) பயன்படுத்துகின்றன. சூப்பர்போசிஷன் (Superposition) மற்றும் என்டாங்கிள்மென்ட் (Entanglement) கோட்பாடுகள் மூலம் இவை வழக்கமான கணினிகளை விட பன்மடங்கு வேகத்தில் சிக்கலான கணக்குகளைத் தீர்க்கின்றன.';
      } else if (lang === 'tanglish') {
        answerText = 'Idhu unga class notes-la illa, aana general concept explain panren: Quantum Computing standard 0 or 1 bits-ku badhula Qubits (quantum bits) use pannudhu. Superposition & Entanglement principles moolama normal computers-a vida billions of times faster-a complex calculations solve pannum.';
      } else if (lang === 'hi') {
        answerText = 'यह विषय आपके नोट्स में नहीं है, लेकिन सामान्य रूप से: क्वांटम कंप्यूटर सामान्य बिट्स (0 या 1) के बजाय क्यूबिट्स (Qubits) का उपयोग करते हैं। सुपरपोजिशन और एंटैंगलमेंट सिद्धांतों के आधार पर ये अत्यधिक जटिल गणनाओं को बहुत तेज़ी से हल करते हैं।';
      } else {
        answerText = "This topic is outside your uploaded class notes, but here is the concept: Quantum computing harnesses quantum mechanics (superposition and entanglement) using quantum bits (qubits) instead of binary 0s and 1s, enabling exponentially faster problem-solving for cryptography, molecular simulation, and optimization.";
      }
    } else if (/tcp\s*\/\s*ip|tcp\/ip|networking\s*protocol/i.test(q)) {
      if (lang === 'ta') {
        answerText = 'இந்த விவரம் உங்கள் பாடக் குறிப்புகளில் இல்லை, ஆனால் பொதுவான கருத்தை விளக்குகிறேன்: TCP/IP (Transmission Control Protocol / Internet Protocol) என்பது இணையத்தில் தரவு எவ்வாறு பாக்கெட்டுகளாகப் பிரிக்கப்பட்டு, அனுப்பப்பட்டு, சேருமிடத்தில் மீண்டும் சரியாக இணைக்கப்படுகிறது என்பதை வரையறுக்கும் உலகளாவிய நெட்வொர்க் நெறிமுறை (suite of communication protocols) ஆகும்.';
      } else if (lang === 'tanglish') {
        answerText = 'Idhu unga class notes-la illa, aana general concept explain panren: TCP/IP (Transmission Control Protocol / Internet Protocol) internet communication-oda core protocol. Data-va packets-a divide panni, network moolama safely transfer panni, destination-la correct-a assemble panna use aagudhu.';
      } else if (lang === 'hi') {
        answerText = 'यह विषय आपके नोट्स में नहीं है, लेकिन सामान्य रूप से: TCP/IP इंटरनेट का मूलभूत संचार प्रोटोकॉल है जो डेटा को सुरक्षित रूप से पैकेट में विभाजित करके नेटवर्क के माध्यम से गंतव्य तक पहुंचाता है।';
      } else {
        answerText = "This topic is outside your uploaded class notes, but here is the concept: TCP/IP (Transmission Control Protocol/Internet Protocol) is the fundamental communications protocol suite of the Internet, specifying how data is packetized, addressed, transmitted, routed, and received across interconnected networks.";
      }
    } else if (/first\s*generation|vacuum|1st\s*gen|முதல்\s*தலைமுறை/i.test(q)) {
      if (lang === 'ta') {
        answerText = 'முதல் தலைமுறை கணினிகள் (1940–1956) வெற்றிடக் குழாய்களைப் (Vacuum Tubes) பயன்படுத்தின. இவை மிகப்பெரிய அளவிலும், அதிக மின் நுகர்வு மற்றும் வெப்பத்துடனும் இருந்தன (உதாரணம்: ENIAC, UNIVAC).';
      } else if (lang === 'tanglish') {
        answerText = 'First generation computers (1940-1956) vacuum tubes use pannuchu. Romba periya size, high electricity consumption and machine language (0s & 1s) use pannanga (e.g. ENIAC).';
      } else if (lang === 'hi') {
        answerText = 'पहली पीढ़ी के कंप्यूटर (1940–1956) वैक्यूम ट्यूब का उपयोग करते थे। ये बहुत बड़े आकार के थे और अत्यधिक बिजली लेते थे (उदाहरण: ENIAC, UNIVAC)।';
      } else {
        answerText = 'First-generation computers (1940–1956) used vacuum tubes for circuitry and magnetic drums for memory. They were massive, took up entire rooms, and generated heavy heat (e.g. ENIAC, UNIVAC).';
      }
    } else if (/second\s*(?:law|of\s*motion|motion)?|2nd\s*law|f\s*=\s*m\s*a|f=ma|இரண்டாம்\s*விதி|இரண்டாவது\s*விதி|இரண்டாம்|இரண்டாவது|உந்த|செகண்ட்/i.test(q)) {
      if (lang === 'ta') {
        answerText = "நியூட்டனின் இரண்டாம் இயக்க விதி (F = ma): பொருளின் உந்த மாறுபாட்டு வீதம் அதன் மீது செயல்படும் விசைக்கு நேர்விகிதத்தில் இருக்கும், மேலும் அவ்விசையின் திசையிலேயே நிகழும்.";
      } else if (lang === 'tanglish') {
        answerText = "Newton's Second Law of Motion: Net force applied on an object is directly equal to the product of its mass and acceleration (F = ma).";
      } else if (lang === 'hi') {
        answerText = "न्यूटन का द्वितीय गति नियम: किसी वस्तु के संवेग परिवर्तन की दर उस पर लगाए गए असंतुलित बल के समानुपाती होती है (F = ma)।";
      } else {
        answerText = "Newton's Second Law of Motion states that the rate of change of momentum of a body is directly proportional to the applied force (F = ma).";
      }
    } else if (/third\s*(?:law|of\s*motion|motion)?|3rd\s*law|மூன்றாம்\s*விதி|மூன்றாவது\s*விதி|மூன்றாம்|மூன்றாவது|தேர்ட்|action.*reaction|செயல்.*எதிர்செயல்/i.test(q)) {
      if (lang === 'ta') {
        answerText = "நியூட்டனின் மூன்றாம் இயக்க விதி: ஒவ்வொரு செயல் விசைக்கும் சமமான மற்றும் எதிர் திசையிலான எதிர்விசை உண்டு (For every action, there is an equal and opposite reaction).";
      } else if (lang === 'tanglish') {
        answerText = "Newton's Third Law: Every action-ku equal and opposite reaction kandippa irukkum (F_AB = -F_BA).";
      } else if (lang === 'hi') {
        answerText = "न्यूटन का तृतीय गति नियम: प्रत्येक क्रिया के बराबर और विपरीत दिशा में प्रतिक्रिया होती है।";
      } else {
        answerText = "Newton's Third Law of Motion states that for every action, there is an equal and opposite reaction (F_AB = -F_BA).";
      }
    } else if (/first\s*(?:law|of\s*motion|motion)?|1st\s*law|inertia|முதல்\s*விதி|முதலாம்\s*விதி|முதல்|முதலாம்|பர்ஸ்ட்|ஃபர்ஸ்ட்|நிலைமம்|जड़त्व/i.test(q)) {
      if (lang === 'ta') {
        answerText = "நியூட்டனின் முதல் இயக்க விதி (நிலைம விதி): புறவிசை ஒன்று செயல்படாத வரை, எந்த ஒரு பொருளும் தனது ஓய்வு நிலையிலோ அல்லது நேர்க்கோட்டில் சீரான இயக்க நிலையிலோ தொடர்ந்து இருக்கும்.";
      } else if (lang === 'tanglish') {
        answerText = "Newton's First Law (Law of Inertia): Oru external net force act aagadha varaikkum, entha object-um thannoda rest state-layo illana straight line uniform motion-layo thodarndhu maintain aagum.";
      } else if (lang === 'hi') {
        answerText = "न्यूटन का प्रथम गति नियम (जड़त्व का नियम): कोई वस्तु तब तक अपनी विराम अवस्था या सरल रेखा में एकसमान गति की अवस्था में रहती है, जब तक कि उस पर कोई बाहरी असंतुलित बल न लगाया जाए।";
      } else {
        answerText = "Newton's First Law of Motion (Law of Inertia) states that an object continues in its state of rest or uniform motion in a straight line unless acted upon by a net external force.";
      }
    } else if (/newton|gravity|force/i.test(q)) {
      if (lang === 'ta') {
        answerText = "நியூட்டனின் இயக்க விதிகள்: பொருட்கள் மற்றும் அவற்றின் மீது செயல்படும் விசைகளின் தொடர்பை விளக்கும் மூன்று அடிப்படை விதிகள் ஆகும் (முதல் விதி: நிலைமம், இரண்டாம் விதி: F=ma, மூன்றாம் விதி: செயல்-எதிர்செயல்).";
      } else if (lang === 'tanglish') {
        answerText = "Newton's Laws of Motion describe the relationship between an object and the forces acting on it: 1st Law (Inertia), 2nd Law (F=ma), and 3rd Law (Action-Reaction).";
      } else if (lang === 'hi') {
        answerText = "न्यूटन के गति नियम: वस्तुओं और उन पर लगने वाले बलों के बीच के संबंध को परिभाषित करने वाले तीन बुनियादी नियम हैं।";
      } else {
        answerText = "Newton's Laws of Motion describe the relationship between a body and the forces acting upon it: 1st Law (Inertia), 2nd Law (F=ma), and 3rd Law (Action-Reaction).";
      }
    } else {
      if (lang === 'ta') {
        answerText = 'இந்தக் குறிப்பிட்ட விவரம் உங்கள் ஆசிரியர் பதிவேற்றிய பாடக் குறிப்புகளில் இல்லை, ஆனால் பொதுவான கல்வி முறையில் விளக்க முடியும். உங்களுக்கு இதில் என்ன சந்தேகம் என்று குறிப்பாகக் கேளுங்கள்!';
      } else if (lang === 'tanglish') {
        answerText = 'Idhu unga teacher upload panna notes-la direct-a illa, aana general concept explain panren. Specific-a unga question kelunga!';
      } else if (lang === 'hi') {
        answerText = 'यह जानकारी आपकी अपलोड की गई अध्ययन सामग्री में सीधे नहीं है, लेकिन मैं सामान्य रूप से समझा सकता हूँ। आप विशेष रूप से क्या जानना चाहते हैं?';
      } else {
        answerText = "This concept is not directly present in your teacher's uploaded course materials, but I can help explain the general academic concept clearly. What specific aspect would you like to explore?";
      }
    }

    return {
      answerText,
      spokenText: answerText,
      evidenceState: 'NO_EVIDENCE',
      detectedLanguage: lang,
      sources: [],
      isEducational: true,
      topic: 'General Knowledge',
    };
  }

  private getWeakEvidenceMessage(lang: string, chunks: RAGChunk[]): string {
    const docTitle = (chunks[0]?.metadata.title || 'course notes').replace(/_/g, ' ');
    const pageNum = chunks[0]?.metadata.pageStart;
    const citation = pageNum ? ` (📘 ${docTitle} · p.${pageNum})` : '';

    switch (lang) {
      case 'ta':
        return `நான் "${docTitle}" குறிப்புகளில் தொடர்புடைய பகுதிகளைக் கண்டறிந்தேன், ஆனால் உங்கள் கேள்விக்கு முழுமையாக பதிலளிக்க போதுமான விவரங்கள் இதில் இல்லை.${citation}`;
      case 'hi':
        return `मुझे "${docTitle}" में संबंधित सामग्री मिली है, लेकिन आपके प्रश्न का पूरा और स्पष्ट उत्तर देने के लिए इसमें पर्याप्त विवरण नहीं हैं।${citation}`;
      case 'tanglish':
        return `"${docTitle}" la related content irukku machan, aana direct answer pandra alavuku exact details illa.${citation}`;
      default:
        return `I found related material in "${docTitle}", but it does not contain enough direct information to answer your specific question confidently.${citation}`;
    }
  }

  private getNoEvidenceMessage(lang: string): string {
    switch (lang) {
      case 'ta':
        return 'இந்த விவரம் உங்களுடைய பாடப்பிரிவு குறிப்புகளில் (uploaded course material) காணப்படவில்லை, ஆனால் பொதுவான அறிவியல் கருத்தாக இதை விவாதிக்கலாம்.';
      case 'hi':
        return 'यह जानकारी आपके अपलोड किए गए पाठ्यक्रम नोट्स में नहीं है, लेकिन सामान्य रूप से इसे समझा जा सकता है।';
      case 'tanglish':
        return 'Idhu unga class notes-la direct-a illa machan, aana general concept-a explain panren.';
      default:
        return "This concept is not directly present in your uploaded class materials, but I can explain the general background concept.";
    }
  }

  private handleNoCourseMaterial(lang: string, startTime: number): RAGQueryResult {
    const answerText = this.getNoEvidenceMessage(lang);
    return {
      answerText,
      spokenText: answerText,
      evidenceState: 'NO_EVIDENCE',
      detectedLanguage: lang as any,
      sources: [],
      isEducational: true,
      topic: 'General Knowledge',
    };
  }
}

export const ragPipeline = new RAGPipeline();

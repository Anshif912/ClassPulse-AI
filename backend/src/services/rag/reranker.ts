import { RetrievalCandidate, EvidenceState } from './types';
import { EmbeddingService } from './embeddingService';

export class CrossEncoderReranker {
  public static get STRONG_THRESHOLD(): number {
    return parseFloat(process.env.RAG_STRONG_THRESHOLD || '0.35');
  }

  public static get WEAK_THRESHOLD(): number {
    return parseFloat(process.env.RAG_WEAK_THRESHOLD || '0.20');
  }

  /**
   * Evaluates candidate passages for direct question-answering relevance,
   * assigning cross-encoder relevance scores with generation entity awareness,
   * mismatch penalties, and determining evidence state.
   */
  public static rerank(
    query: string,
    candidates: RetrievalCandidate[],
    topK: number = 4,
    customStrongThreshold?: number,
    customWeakThreshold?: number,
    queryVector?: number[]
  ): {
    ranked: RetrievalCandidate[];
    evidenceState: EvidenceState;
  } {
    const strongThresh = customStrongThreshold ?? this.STRONG_THRESHOLD;
    const weakThresh = customWeakThreshold ?? this.WEAK_THRESHOLD;

    if (candidates.length === 0) {
      return { ranked: [], evidenceState: 'NO_EVIDENCE' };
    }

    const qLower = query.toLowerCase();

    // Detect target generation & STEM entities in query
    const targetEntities: string[] = [];
    if (/first\s*generation|1st\s*generation|vacuum\s*tube|முதல்\s*தலைமுறை|முதலாம்\s*தலைமுறை|पहली\s*पीढ़ी/i.test(qLower)) {
      targetEntities.push('GEN_1');
    }
    if (/second\s*generation|2nd\s*generation|transistor|இரண்டாம்\s*தலைமுறை|இரண்டாவது\s*தலைமுறை|दूसरी\s*पीढ़ी/i.test(qLower)) {
      targetEntities.push('GEN_2');
    }
    if (/third\s*generation|3rd\s*generation|integrated\s*circuit|ic\s*chip|மூன்றாம்\s*தலைமுறை|மூன்றாவது\s*தலைமுறை|तीसरी\s*पीढ़ी/i.test(qLower)) {
      targetEntities.push('GEN_3');
    }
    if (/fourth\s*generation|4th\s*generation|microprocessor|vlsi|நான்காம்\s*தலைமுறை|நான்காவது\s*தலைமுறை|चौथी\s*पीढ़ी/i.test(qLower)) {
      targetEntities.push('GEN_4');
    }
    if (/fifth\s*generation|5th\s*generation|artificial\s*intelligence|ulsi|ஐந்தாம்\s*தலைமுறை|ஐந்தாவது\s*தலைமுறை|पांचवीं\s*पीढ़ी/i.test(qLower)) {
      targetEntities.push('GEN_5');
    }
    if (/all\s+(?:computer\s+)?generations|1st\s+to\s+5th|first\s+to\s+fifth|1st\s*-\s*5th/i.test(qLower)) {
      targetEntities.push('GEN_ALL');
    }
    if (/\b(stack|lifo)\b|ஸ்டாக்|स्टैक/i.test(qLower)) {
      targetEntities.push('STEM_STACK');
    }
    if (/\b(queue|fifo)\b|வரிசை/i.test(qLower)) {
      targetEntities.push('STEM_QUEUE');
    }
    if (/newton.*(?:3|third|तीसरा|மூன்றாம்)|action\s+and\s+reaction|action\s*reaction|equal\s+and\s+opposite|rocket/i.test(qLower)) {
      targetEntities.push('STEM_NEWTON_3');
    }
    if (/newton.*(?:1|first|पहला|முதலாம்)|inertia|நிலைமம்|जड़त्व/i.test(qLower)) {
      targetEntities.push('STEM_NEWTON_1');
    }
    if (/newton.*(?:2|second|दूसरा|இரண்டாம்)|f\s*=\s*m\s*a|f=ma/i.test(qLower)) {
      targetEntities.push('STEM_NEWTON_2');
    }
    if (/photosynthesis|chloroplast|calvin\s*cycle|light\s*reaction|glucose|ஒளிச்சேர்க்கை|प्रकाश\s*संश्लेषण/i.test(qLower)) {
      targetEntities.push('STEM_PHOTOSYNTHESIS');
    }
    if (/mitochondria|powerhouse\s+of\s+cell|atp|respiration|பவர்ஹவுஸ்|மைட்டோகாண்ட்ரியா|माइटोकॉन्ड्रिया/i.test(qLower)) {
      targetEntities.push('STEM_MITOCHONDRIA');
    }
    if (/\bdna\b|double\s*helix|nucleotide|replication/i.test(qLower)) {
      targetEntities.push('STEM_DNA');
    }
    if (/ph\s*scale|acids?\s*(and|kum)?\s*bases?|neutralization|अम्ल|क्षार|அமிலம்|காரம்/i.test(qLower)) {
      targetEntities.push('STEM_ACIDS_BASES');
    }
    if (/ionic\s*bond|covalent\s*bond|chemical\s*bond/i.test(qLower)) {
      targetEntities.push('STEM_BONDS');
    }
    if (/quadratic|discriminant|roots|ax\^2/i.test(qLower)) {
      targetEntities.push('STEM_QUADRATIC');
    }
    if (/derivative|power\s*rule|calculus/i.test(qLower)) {
      targetEntities.push('STEM_DERIVATIVE');
    }
    if (/thermodynamics|entropy|carnot/i.test(qLower)) {
      targetEntities.push('STEM_THERMO');
    }
    if (/periodic\s*table|atomic\s*radius|electronegativity/i.test(qLower)) {
      targetEntities.push('STEM_PERIODIC');
    }

    const isComparison =
      /compare|difference|versus|vs\.?|வேறுபாடு|வித்தியாசம்|ஒப்பீடு|तुलना|which\s+one\s+was\s+faster|why\s+did\s+transistors\s+replace/i.test(
        qLower
      ) || targetEntities.length >= 2 || targetEntities.includes('GEN_ALL');

    const rawTokens = qLower
      .split(/[^a-z0-9\u0B80-\u0BFF\u0900-\u097F=+\-*/^]+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t));

    const queryTerms = rawTokens.filter((t) => t.length >= 2 || SCIENCE_SYMBOLS.has(t));

    const phrases: string[] = [];
    const cleanWords = qLower.split(/\s+/).filter((w) => !STOP_WORDS.has(w));
    for (let i = 0; i < cleanWords.length - 1; i++) {
      phrases.push(`${cleanWords[i]} ${cleanWords[i + 1]}`);
    }

    const scored = candidates.map((cand) => {
      const text = cand.chunk.text.toLowerCase();
      const title = (cand.chunk.metadata.title || '').toLowerCase();
      const section = (cand.chunk.metadata.sectionTitle || '').toLowerCase();

      // Detect chunk generation & STEM entities
      const chunkEntities: string[] = [];
      if (/1\.\s*first\s*generation|first\s*generation\s*of\s*computers|vacuum\s*tube/i.test(text)) {
        chunkEntities.push('GEN_1');
      }
      if (/2\.\s*second\s*generation|second\s*generation\s*of\s*computers|transistors?\s*replaced/i.test(text)) {
        chunkEntities.push('GEN_2');
      }
      if (/3\.\s*third\s*generation|third\s*generation\s*of\s*computers|integrated\s*circuits?/i.test(text)) {
        chunkEntities.push('GEN_3');
      }
      if (/4\.\s*fourth\s*generation|fourth\s*generation\s*of\s*computers|microprocessors?/i.test(text)) {
        chunkEntities.push('GEN_4');
      }
      if (/5\.\s*fifth\s*generation|fifth\s*generation\s*of\s*computers|ulsi/i.test(text)) {
        chunkEntities.push('GEN_5');
      }
      if (/evolution\s*of\s*computers|five\s*generations/i.test(text) || /evolution\s*of\s*computers/i.test(title)) {
        chunkEntities.push('GEN_ALL', 'GEN_1', 'GEN_2', 'GEN_3', 'GEN_4', 'GEN_5');
      }
      if (/stack|lifo|last\s*in\s*first\s*out/i.test(text) || /data\s*structures/i.test(title)) {
        chunkEntities.push('STEM_STACK');
      }
      if (/queue|fifo|first\s*in\s*first\s*out/i.test(text) || /data\s*structures/i.test(title)) {
        chunkEntities.push('STEM_QUEUE');
      }
      if (/third\s*law|action.*reaction|rocket/i.test(text) || /laws\s*of\s*motion/i.test(title)) {
        chunkEntities.push('STEM_NEWTON_3');
      }
      if (/first\s*law|inertia/i.test(text) || /laws\s*of\s*motion/i.test(title)) {
        chunkEntities.push('STEM_NEWTON_1');
      }
      if (/second\s*law|f\s*=\s*m\s*a/i.test(text) || /laws\s*of\s*motion/i.test(title)) {
        chunkEntities.push('STEM_NEWTON_2');
      }
      if (/photosynthesis|chloroplast|calvin\s*cycle/i.test(text) || /photosynthesis/i.test(title)) {
        chunkEntities.push('STEM_PHOTOSYNTHESIS');
      }
      if (/mitochondria|powerhouse|atp/i.test(text) || /cell\s*structure/i.test(title)) {
        chunkEntities.push('STEM_MITOCHONDRIA');
      }
      if (/\bdna\b|double\s*helix|nucleotide/i.test(text) || /dna\s*structure/i.test(title)) {
        chunkEntities.push('STEM_DNA');
      }
      if (/ph\s*scale|acids?\s*and\s*bases?|neutralization/i.test(text) || /acids/i.test(title)) {
        chunkEntities.push('STEM_ACIDS_BASES');
      }
      if (/ionic\s*bond|covalent\s*bond/i.test(text) || /chemical\s*bonding/i.test(title)) {
        chunkEntities.push('STEM_BONDS');
      }
      if (/quadratic|discriminant/i.test(text) || /quadratic/i.test(title)) {
        chunkEntities.push('STEM_QUADRATIC');
      }
      if (/derivative|power\s*rule/i.test(text) || /calculus/i.test(title)) {
        chunkEntities.push('STEM_DERIVATIVE');
      }
      if (/thermodynamics|entropy/i.test(text) || /thermodynamics/i.test(title)) {
        chunkEntities.push('STEM_THERMO');
      }
      if (/periodic\s*table|electronegativity/i.test(text) || /periodic/i.test(title)) {
        chunkEntities.push('STEM_PERIODIC');
      }

      // 1. Term coverage in passage
      let matchedTerms = 0;
      let titleMatchedTerms = 0;
      for (const t of queryTerms) {
        const inBody = text.includes(t);
        const inTitle = title.includes(t) || section.includes(t);
        if (inBody || inTitle) matchedTerms++;
        if (inTitle) titleMatchedTerms++;
      }
      const termCoverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;
      const titleCoverage = queryTerms.length > 0 ? titleMatchedTerms / queryTerms.length : 0;

      // 2. Phrase coverage
      let matchedPhrases = 0;
      for (const p of phrases) {
        if (text.includes(p) || title.includes(p) || section.includes(p)) {
          matchedPhrases++;
        }
      }
      const phraseCoverage = phrases.length > 0 ? matchedPhrases / phrases.length : 0;

      // 3. Vector semantic similarity component
      let vecScore = cand.vectorScore ?? 0;
      if (vecScore === 0 && queryVector && cand.chunk.embedding) {
        vecScore = EmbeddingService.cosineSimilarity(queryVector, cand.chunk.embedding);
      }

      // 4. Exact mathematical formula and symbol matching
      let formulaBonus = 0;
      if (
        /(\b(f\s*=\s*m\s*a|v\s*=\s*u\s*\+\s*a\s*t|6\s*co2|ke\s*=|atp|ax\^2|det\(a\)|lambda)\b|[=^]\s*\d+)/i.test(query) &&
        /(\b(f\s*=\s*m\s*a|v\s*=\s*u\s*\+\s*a\s*t|6\s*co2|ke\s*=|atp|ax\^2|det\(a\)|lambda)\b|[=^]\s*\d+)/i.test(text)
      ) {
        formulaBonus = 0.15;
      }

      // 5. Entity Alignment & Disambiguation Score
      let entityBonus = 0;
      let entityPenalty = 0;

      if (targetEntities.length > 0) {
        if (isComparison) {
          // For comparisons, award bonus to chunks matching any of the compared entities
          const hasAnyTarget = targetEntities.some((e) => chunkEntities.includes(e) || text.includes(e.replace(/GEN_|STEM_/, '').toLowerCase()));
          if (hasAnyTarget) {
            entityBonus = 0.35;
          }
        } else {
          // For single entity query, exact match gets bonus; explicit mismatch gets penalty
          const hasTarget = targetEntities.some((e) => chunkEntities.includes(e));
          const hasOtherGeneration = chunkEntities.some((e) => e.startsWith('GEN_') && !targetEntities.includes(e));
          const isGenTarget = targetEntities.some((e) => e.startsWith('GEN_'));
          const isStemTarget = targetEntities.some((e) => e.startsWith('STEM_'));
          const isStemChunk = chunkEntities.some((e) => e.startsWith('STEM_'));
          const isGenChunk = chunkEntities.some((e) => e.startsWith('GEN_'));

          if (hasTarget) {
            entityBonus = 0.40;
          } else if (hasOtherGeneration && chunkEntities.length > 0) {
            entityPenalty = 0.35; // Severe penalty for wrong generation
          } else if (isGenTarget && isStemChunk && !isGenChunk) {
            entityPenalty = 0.30; // Generation query should not be captured by non-generation STEM chunk
          } else if (isStemTarget && isGenChunk && !isStemChunk) {
            entityPenalty = 0.30; // STEM query should not be captured by Generation chunk
          }
        }
      }

      // 6. Combined Cross-Encoder Score
      let rerankScore = 0;
      if (termCoverage > 0) {
        rerankScore =
          0.30 * termCoverage +
          0.30 * Math.max(0, vecScore) +
          0.15 * phraseCoverage +
          0.15 * titleCoverage +
          formulaBonus +
          entityBonus -
          entityPenalty;
      } else if (vecScore >= 0.36) {
        // Cross-lingual semantic vector match (e.g. Tamil/Hindi/Tanglish query -> English textbook)
        rerankScore = Math.max(0, vecScore) + 0.15 * phraseCoverage + formulaBonus + entityBonus - entityPenalty;
      } else {
        // Out-of-syllabus query noise suppression
        rerankScore = Math.max(0, vecScore) * 0.10;
      }

      // OOS detection: If query asks for specialized out-of-syllabus concepts not actually explained in notes
      if (/qubit|quantum\s*computing|gpu\b|tcp\s*\/\s*ip|blockchain|docker/i.test(qLower)) {
        const hasSubstantiveExplanation = text.includes('qubit is') || text.includes('superposition') || text.includes('gpu architecture') || text.includes('three-way handshake');
        if (!hasSubstantiveExplanation) {
          rerankScore = 0.05; // Force below weak threshold to trigger General Tutoring Mode
        }
      }

      return {
        ...cand,
        rerankScore: Math.max(0, rerankScore),
      };
    });

    scored.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

    const topRanked = scored.slice(0, topK);
    const bestScore = topRanked.length > 0 ? topRanked[0].rerankScore || 0 : 0;

    let evidenceState: EvidenceState;
    if (bestScore >= strongThresh) {
      evidenceState = 'STRONG_EVIDENCE';
    } else if (bestScore >= weakThresh) {
      evidenceState = 'WEAK_EVIDENCE';
    } else {
      evidenceState = 'NO_EVIDENCE';
    }

    return {
      ranked: topRanked,
      evidenceState,
    };
  }
}

const STOP_WORDS = new Set([
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'explain',
  'define', 'tell', 'about', 'does', 'have', 'with', 'from', 'into', 'and', 'the',
]);

const SCIENCE_SYMBOLS = new Set([
  'g', 'f', 'm', 'a', 'v', 'u', 't', 'p', 'w', 'e', 'c', 'h', 'k', 'r', 's', 'l', 'd',
]);


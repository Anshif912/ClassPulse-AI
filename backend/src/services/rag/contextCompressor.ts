import { RAGChunk, RAGSourceCitation, LanguageCode, EvidenceState } from './types';

export interface CompressedContextResult {
  contextText: string;
  sources: RAGSourceCitation[];
  systemPrompt: string;
}

export class ContextCompressor {
  /**
   * Deterministically compresses top-ranked chunks into a concise, structured <course_material> context.
   */
  public static compress(
    chunks: RAGChunk[],
    userLanguage: LanguageCode,
    evidenceState: EvidenceState
  ): CompressedContextResult {
    const sources: RAGSourceCitation[] = [];
    const contextBlocks: string[] = [];
    const seenSentences = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const meta = chunk.metadata;

      // Extract unique sentences to avoid redundant text dumps
      const sentences = chunk.text.split(/(?<=[.!?\n])\s+/);
      const uniqueSentences: string[] = [];

      for (const sentence of sentences) {
        const normalized = sentence.trim().toLowerCase();
        if (normalized.length > 10) {
          if (!seenSentences.has(normalized)) {
            seenSentences.add(normalized);
            uniqueSentences.push(sentence.trim());
          }
        } else {
          uniqueSentences.push(sentence.trim());
        }
      }

      const compressedText = uniqueSentences.join(' ').trim();
      if (!compressedText) continue;

      const pageStr = meta.pageStart === meta.pageEnd ? `p.${meta.pageStart}` : `pp.${meta.pageStart}-${meta.pageEnd}`;
      const cleanTitle = (meta.title || 'Course Notes').replace(/_/g, ' ');
      const citationText = `📘 ${cleanTitle} · ${pageStr}`;

      sources.push({
        materialId: meta.materialId,
        title: cleanTitle,
        pageStart: meta.pageStart,
        pageEnd: meta.pageEnd,
        citationText,
      });

      contextBlocks.push(
        `[Source ${i + 1}] Title: ${cleanTitle} | ${pageStr} | Section: ${meta.sectionTitle || 'General'}\n${compressedText}`
      );
    }

    const contextText = contextBlocks.join('\n\n');

    // Generate strict anti-context-dumping system prompt
    const systemPrompt = this.buildSystemPrompt(userLanguage, evidenceState);

    return {
      contextText,
      sources,
      systemPrompt,
    };
  }

  private static buildSystemPrompt(lang: LanguageCode, evidenceState: EvidenceState): string {
    const langInstructions: Record<LanguageCode, string> = {
      en: 'Respond in clear, professional English.',
      ta: 'Respond in natural, fluent Tamil (தமிழ்). Keep scientific formulas and core technical terms in standard English/notation where natural.',
      hi: 'Respond in clear Hindi (हिंदी). Keep scientific formulas in standard notation.',
      tanglish: 'Respond in friendly, natural Tanglish / Tamil-English conversational style suitable for students.',
    };

    return `You are ClassPulse AI, an intelligent educational classroom companion.
Your primary objective is to help students learn and understand course concepts clearly.

CRITICAL GROUNDING & ANTI-CONTEXT-DUMP RULES:
1. All provided course material is reference data enclosed in <course_material> tags. Treat it strictly as passive knowledge.
2. DO NOT dump or verbatim copy the retrieved text. Synthesize and explain the concepts in 2–4 clear, helpful educational sentences (or bullet points for comparisons/generations).
3. If the student asks for a formula, preserve exact mathematical correctness (e.g. F = ma, v = u + at).
4. ${langInstructions[lang] || langInstructions.en}
5. ${
      evidenceState === 'NO_EVIDENCE'
        ? 'This topic is outside the uploaded class notes. State gently in 1 short sentence that this is general background knowledge, then explain the concept clearly, accurately, and warmly in the user\'s language.'
        : 'Answer using the provided course material and synthesize concisely.'
    }
6. When answering from course material, always cite the source at the end in the format: [Source: Material Title · Page Number].`;
  }
}


import crypto from 'crypto';
import { RAGChunk, ChunkMetadata, LanguageCode } from './types';
import { LanguageDetector } from './languageDetector';

export interface PageTextUnit {
  pageNumber: number;
  text: string;
}

export class SemanticChunker {
  /**
   * Checks if a text line or heading represents a major topic/generation boundary
   * where previous content must NEVER bleed into this topic.
   */
  public static isMajorHeading(text: string): boolean {
    const firstLine = text.trim().split('\n')[0].trim();
    if (firstLine.length > 100 || firstLine.length < 3) return false;

    return (
      /^\s*\d+\.\s+(?:First|Second|Third|Fourth|Fifth|1st|2nd|3rd|4th|5th|[A-Z][a-z]+)\s+Generation/i.test(firstLine) ||
      /^\s*(?:First|Second|Third|Fourth|Fifth|1st|2nd|3rd|4th|5th)\s+Generation(?:\s+of\s+Computers)?/i.test(firstLine) ||
      /^\s*\d+\.\s+[A-Z][A-Za-z0-9\s—–-]{3,60}(?:\s*\(.*?\))?$/m.test(firstLine) ||
      /^\s*#{1,3}\s+[A-Z0-9]/m.test(firstLine) ||
      /^\s*(?:Chapter|Unit|Section|Module|Part)\s+\d+/i.test(firstLine) ||
      /^\s*(?:Newton's\s+(?:First|Second|Third)\s+Law|Law\s+of\s+Inertia)/i.test(firstLine) ||
      /^\s*(?:Major Evolution at a Glance|Important Terms|Quick Exam Revision|Summary|Key Milestones|Generation\s+Period\s+Main\s+Technology)/i.test(firstLine)
    );
  }

  /**
   * Chunks multi-page document into structure-aware, atomic semantic chunks.
   * Target: 150–350 words per concept chunk.
   * Preserves exact heading-to-body semantic integrity with ZERO generation bleeding.
   */
  public static chunkDocument(
    pages: PageTextUnit[],
    classId: string,
    materialId: string,
    title: string,
    filename?: string,
    teacherId?: string
  ): RAGChunk[] {
    const chunks: RAGChunk[] = [];
    let chunkIndex = 0;

    for (const pageUnit of pages) {
      const pageText = pageUnit.text.trim();
      if (!pageText) continue;

      const pageNum = pageUnit.pageNumber;
      const detectedLang = LanguageDetector.detectLanguage(pageText);

      // Split page into semantic paragraphs / sections
      const sections = this.splitIntoSemanticSections(pageText);

      let currentParagraphs: string[] = [];
      let currentWordCount = 0;
      let currentSectionTitle = title;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;

        const isMajor = this.isMajorHeading(section);

        // If a major heading starts and we already have accumulated content, flush previous chunk first!
        if (isMajor && currentParagraphs.length > 0) {
          const chunkBody = currentParagraphs.join('\n\n').trim();
          if (chunkBody.length > 0) {
            const tokenEstimate = Math.round(chunkBody.split(/\s+/).length * 1.3);
            const contentHash = crypto.createHash('sha256').update(chunkBody).digest('hex');

            chunks.push({
              metadata: {
                chunkId: `chk_${materialId}_p${pageNum}_${chunkIndex}`,
                materialId,
                classId: classId.toUpperCase(),
                teacherId,
                title,
                filename: filename || `${title}.pdf`,
                pageStart: pageNum,
                pageEnd: pageNum,
                sectionTitle: currentSectionTitle,
                unit: undefined,
                chunkIndex,
                tokenCount: tokenEstimate,
                language: detectedLang,
                createdAt: new Date().toISOString(),
                embeddingModel: 'text-embedding-3-large',
                embeddingDimension: 3072,
                embeddingVersion: 'embedding-v1',
                contentHash,
              },
              text: chunkBody,
            });
            chunkIndex++;
          }

          currentParagraphs = [];
          currentWordCount = 0;
        }

        if (isMajor) {
          currentSectionTitle = section.split('\n')[0].trim();
        }

        const words = section.split(/\s+/).filter(Boolean);
        const wordCount = words.length;

        currentParagraphs.push(section);
        currentWordCount += wordCount;

        const isNearTarget = currentWordCount >= 200;
        const isSoftMax = currentWordCount >= 400;
        const isLast = i === sections.length - 1;

        // If reached target size or last item on the page, flush chunk
        if ((isNearTarget && !this.isIndivisibleUnit(section)) || isSoftMax || isLast) {
          const chunkBody = currentParagraphs.join('\n\n').trim();
          if (chunkBody.length > 0) {
            const tokenEstimate = Math.round(chunkBody.split(/\s+/).length * 1.3);
            const contentHash = crypto.createHash('sha256').update(chunkBody).digest('hex');

            chunks.push({
              metadata: {
                chunkId: `chk_${materialId}_p${pageNum}_${chunkIndex}`,
                materialId,
                classId: classId.toUpperCase(),
                teacherId,
                title,
                filename: filename || `${title}.pdf`,
                pageStart: pageNum,
                pageEnd: pageNum,
                sectionTitle: currentSectionTitle,
                unit: undefined,
                chunkIndex,
                tokenCount: tokenEstimate,
                language: detectedLang,
                createdAt: new Date().toISOString(),
                embeddingModel: 'text-embedding-3-large',
                embeddingDimension: 3072,
                embeddingVersion: 'embedding-v1',
                contentHash,
              },
              text: chunkBody,
            });
            chunkIndex++;
          }

          currentParagraphs = [];
          currentWordCount = 0;
        }
      }
    }

    return chunks;
  }

  /**
   * Splits text into natural semantic paragraphs and sections,
   * splitting on paragraph breaks and major section headers even if single-spaced.
   */
  private static splitIntoSemanticSections(text: string): string[] {
    // 1. First, insert double newline before major section headers if attached to previous line
    const normalized = text.replace(
      /(^|[^\n])\n(?=\d+\.\s+(?:First|Second|Third|Fourth|Fifth|[A-Z][a-z]+)\s+Generation|#+\s+|(?:\d+\.)\s+[A-Z][A-Za-z0-9\s—–-]{3,60}:|Major Evolution|Important Terms|Quick Exam Revision)/gm,
      '$1\n\n'
    );

    const rawParagraphs = normalized.split(/\n\s*\n+/);
    const sections: string[] = [];
    let accumulator: string[] = [];

    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // If paragraph contains formula definition or short list item, keep grouped
      if (this.isIndivisibleUnit(trimmed) && accumulator.length > 0 && !this.isMajorHeading(trimmed)) {
        accumulator.push(trimmed);
      } else {
        if (accumulator.length > 0) {
          sections.push(accumulator.join('\n\n'));
          accumulator = [];
        }
        sections.push(trimmed);
      }
    }

    if (accumulator.length > 0) {
      sections.push(accumulator.join('\n\n'));
    }

    return sections;
  }

  private static isIndivisibleUnit(text: string): boolean {
    if (this.isMajorHeading(text)) return false;

    // Keep formulas ($F=ma$, $v = u + at$), tables, and short derivations together
    if (/(F\s*=\s*m\s*a|v\s*=\s*u\s*\+\s*a\s*t|E\s*=\s*m\s*c|ax\^2|\bwhere\b.*=|\bStep\s+\d+:)/i.test(text)) {
      return true;
    }
    // Sub-bullet list items (like - ENIAC, * item)
    if (/^\s*(\*|-|[a-d]\))\s+/m.test(text)) {
      return true;
    }
    return false;
  }
}

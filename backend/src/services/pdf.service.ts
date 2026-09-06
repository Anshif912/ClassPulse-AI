// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import { MaterialChunk } from './db.service';
import { RAGChunk } from './rag/types';
import { SemanticChunker, PageTextUnit } from './rag/chunker';
import { EmbeddingService } from './rag/embeddingService';

export interface ProcessedPdfResult {
  title: string;
  totalText: string;
  pageCount: number;
  chunks: MaterialChunk[];
  ragChunks: RAGChunk[];
}

export class PdfService {
  /**
   * Validates if buffer is genuine PDF by magic bytes %PDF-
   */
  public static isValidPdfBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 5) return false;
    const header = buffer.subarray(0, 5).toString('ascii');
    return header.startsWith('%PDF-');
  }

  /**
   * Processes an uploaded PDF buffer into structure-aware semantic chunks with page metadata.
   */
  public static async processPdfBuffer(
    buffer: Buffer,
    filename: string,
    classId: string,
    materialId: string,
    titleOverride?: string,
    teacherId?: string
  ): Promise<ProcessedPdfResult> {
    if (!this.isValidPdfBuffer(buffer)) {
      throw new Error('Invalid PDF format. File must start with %PDF- header.');
    }

    const title = titleOverride?.trim() || filename.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

    const pages: PageTextUnit[] = [];

    // Custom pagerender to capture text per page accurately
    const renderPage = (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        pages.push({
          pageNumber: pageData.pageIndex + 1,
          text: text.trim(),
        });
        return text;
      });
    };

    let totalText = '';
    let pageCount = 1;

    try {
      if (pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: buffer });
        const result = await parser.getText();
        totalText = (result.text || '').trim();
        pageCount = result.total || result.pages?.length || 1;
        if (Array.isArray(result.pages)) {
          for (const p of result.pages) {
            const pageTxt = (p.text || '').trim();
            if (pageTxt) {
              pages.push({
                pageNumber: p.num || pages.length + 1,
                text: pageTxt,
              });
            }
          }
        }
      } else {
        const parseFn = typeof pdfParse === 'function' ? pdfParse : pdfParse.default;
        if (typeof parseFn === 'function') {
          const parsed = await parseFn(buffer, { pagerender: renderPage });
          totalText = (parsed.text || '').trim();
          pageCount = parsed.numpages || (pages.length > 0 ? pages.length : 1);
        } else {
          throw new Error('PDF parsing library could not be initialized.');
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }

    // Meaningful text validation (Rule 10)
    if (!totalText || totalText.length < 20) {
      throw new Error(
        'No readable text found in PDF. Scanned image PDFs without embedded text or OCR are not searchable.'
      );
    }

    // If per-page text wasn't captured, fallback to single block
    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: totalText });
    }

    // 1. Structure-aware semantic chunking
    const ragChunks = SemanticChunker.chunkDocument(
      pages,
      classId,
      materialId,
      title,
      filename,
      teacherId
    );

    // 2. Compute 3072-d embeddings for all chunks in batch
    const textsToEmbed = ragChunks.map((c) => c.text);
    const embeddings = await EmbeddingService.embedBatch(textsToEmbed);
    for (let i = 0; i < ragChunks.length; i++) {
      ragChunks[i].embedding = embeddings[i];
    }

    // 3. Backward compatible legacy MaterialChunk format
    const legacyChunks: MaterialChunk[] = ragChunks.map((c) => ({
      id: c.metadata.chunkId,
      materialId: c.metadata.materialId,
      classId: c.metadata.classId,
      title: c.metadata.title,
      pageNumber: c.metadata.pageStart,
      chunkIndex: c.metadata.chunkIndex,
      content: c.text,
      tokenCount: c.metadata.tokenCount,
    }));

    return {
      title,
      totalText,
      pageCount,
      chunks: legacyChunks,
      ragChunks,
    };
  }
}

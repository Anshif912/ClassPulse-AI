import { dbService } from '../db.service';
import { ragRepository } from './ragRepository';
import { SemanticChunker } from './chunker';
import { EmbeddingService } from './embeddingService';

/**
 * Synchronizes and re-indexes all database classroom materials into the RAG 2.0 repository
 * on server boot, ensuring zero chunk boundary corruption and up-to-date embeddings.
 */
export async function syncRAGRepositoryOnBoot(): Promise<void> {
  const classrooms = dbService.getAllClassrooms();
  let totalChunksIndexed = 0;

  console.log(`[RAG_BOOT_SYNC] Indexing materials for ${classrooms.length} classrooms...`);

  for (const cls of classrooms) {
    if (!cls.materials || cls.materials.length === 0) continue;

    for (const mat of cls.materials) {
      const title = mat.title || 'Course Material';
      const classId = cls.classId.toUpperCase();
      const content = mat.content || '';

      let pages: Array<{ pageNumber: number; text: string }> = [];
      if (mat.chunks && mat.chunks.length > 0) {
        pages = mat.chunks.map((c: any) => ({
          pageNumber: c.pageNumber || 1,
          text: c.content || '',
        })).filter((p: any) => p.text.trim().length > 0);
      }
      if (pages.length === 0 && content.trim()) {
        pages = [{ pageNumber: 1, text: content }];
      }
      if (pages.length === 0) continue;

      const ragChunks = SemanticChunker.chunkDocument(
        pages,
        classId,
        mat.id,
        title,
        mat.filename || `${title}.pdf`,
        mat.uploadedBy
      );

      // Compute normalized embeddings for all chunks in batch
      try {
        const embeddings = await EmbeddingService.embedBatch(ragChunks.map((c) => c.text));
        for (let i = 0; i < ragChunks.length; i++) {
          ragChunks[i].embedding = embeddings[i];
        }

        ragRepository.addChunks(ragChunks);
        totalChunksIndexed += ragChunks.length;
      } catch (err: any) {
        console.warn(`[RAG_BOOT_SYNC] Failed to embed material "${title}":`, err.message);
      }
    }
  }

  console.log(`[RAG_BOOT_SYNC] ✅ Successfully loaded and indexed ${totalChunksIndexed} atomic chunks into RAG 2.0 repository.`);
}

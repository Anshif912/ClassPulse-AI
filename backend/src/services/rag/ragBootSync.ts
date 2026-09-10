import { dbService } from '../db.service';
import { ragRepository } from './ragRepository';
import { SemanticChunker } from './chunker';
import { EmbeddingService } from './embeddingService';
import { RAGChunk } from './types';

// Concurrency mutex to prevent duplicate simultaneous boot-sync runs
let isBootSyncRunning = false;

export interface BootSyncSummary {
  totalClassrooms: number;
  totalMaterials: number;
  totalChunks: number;
  indexedChunks: number;
  skippedChunks: number;
  failedChunks: number;
  retryCount: number;
  totalEmbeddingTimeMs: number;
}

/**
 * Synchronizes and re-indexes all database classroom materials into the RAG repository
 * on server boot, ensuring zero chunk boundary corruption, idempotency, and robust error recovery.
 */
export async function syncRAGRepositoryOnBoot(): Promise<BootSyncSummary> {
  if (isBootSyncRunning) {
    console.warn('[RAG_BOOT_SYNC] A boot-sync process is already in progress. Skipping redundant invocation.');
    return {
      totalClassrooms: 0,
      totalMaterials: 0,
      totalChunks: 0,
      indexedChunks: 0,
      skippedChunks: 0,
      failedChunks: 0,
      retryCount: 0,
      totalEmbeddingTimeMs: 0,
    };
  }

  isBootSyncRunning = true;
  const startTime = Date.now();
  const classrooms = dbService.getAllClassrooms();

  const summary: BootSyncSummary = {
    totalClassrooms: classrooms.length,
    totalMaterials: 0,
    totalChunks: 0,
    indexedChunks: 0,
    skippedChunks: 0,
    failedChunks: 0,
    retryCount: 0,
    totalEmbeddingTimeMs: 0,
  };

  const activeConfig = EmbeddingService.getActiveConfigInfo();
  console.log(`[RAG_BOOT_SYNC] Starting sync for ${classrooms.length} classrooms using ${activeConfig.model} (${activeConfig.dimensions}d)...`);

  try {
    for (const cls of classrooms) {
      if (!cls.materials || cls.materials.length === 0) continue;

      for (const mat of cls.materials) {
        summary.totalMaterials++;
        const title = mat.title || 'Course Material';
        const classId = cls.classId.toUpperCase();
        const content = mat.content || '';

        let pages: Array<{ pageNumber: number; text: string }> = [];
        if (mat.chunks && mat.chunks.length > 0) {
          pages = mat.chunks
            .map((c: any) => ({
              pageNumber: c.pageNumber || 1,
              text: c.content || '',
            }))
            .filter((p: any) => p.text.trim().length > 0);
        }
        if (pages.length === 0 && content.trim()) {
          pages = [{ pageNumber: 1, text: content }];
        }
        if (pages.length === 0) continue;

        const candidateChunks = SemanticChunker.chunkDocument(
          pages,
          classId,
          mat.id,
          title,
          mat.filename || `${title}.pdf`,
          mat.uploadedBy
        );

        summary.totalChunks += candidateChunks.length;

        // Idempotency: filter out chunks already in repository with matching text, model, and dimension
        const chunksToEmbed: RAGChunk[] = [];
        const chunksAlreadyIndexed: RAGChunk[] = [];

        for (const chunk of candidateChunks) {
          const isIndexed = ragRepository.isChunkIndexedWithModel(
            chunk.metadata.chunkId,
            chunk.text,
            activeConfig.model,
            activeConfig.dimensions
          );

          if (isIndexed) {
            const existing = ragRepository.getChunk(chunk.metadata.chunkId);
            if (existing) {
              chunksAlreadyIndexed.push(existing);
            }
          } else {
            chunksToEmbed.push(chunk);
          }
        }

        summary.skippedChunks += chunksAlreadyIndexed.length;

        if (chunksToEmbed.length === 0) {
          console.log(`[RAG_BOOT_SYNC] Material "${title}" (${classId}): All ${candidateChunks.length} chunks already indexed and up-to-date.`);
          continue;
        }

        const retrievalMode = (process.env.RAG_RETRIEVAL_MODE || 'lexical_fast').toLowerCase();

        if (retrievalMode === 'lexical_fast') {
          ragRepository.addChunks(chunksToEmbed);
          summary.indexedChunks += chunksToEmbed.length;
          console.log(`[RAG_BOOT_SYNC] ✅ Indexed ${chunksToEmbed.length} chunks for "${title}" (Lexical Fast Mode) in 1ms.`);
          continue;
        }

        console.log(`[RAG_BOOT_SYNC] Material "${title}" (${classId}): Embedding ${chunksToEmbed.length} chunks (${chunksAlreadyIndexed.length} skipped)...`);

        const t0Mat = Date.now();
        try {
          const embeddings = await EmbeddingService.embedBatch(
            chunksToEmbed.map((c) => c.text),
            false,
            {
              materialName: title,
              onProgress: (progress) => {
                summary.retryCount += progress.retryCount > 0 ? 1 : 0;
                console.log(
                  `[RAG_BOOT_SYNC] Material: "${title}" | Batch ${progress.batchNumber}/${progress.totalBatches} (Size: ${progress.batchSize}) | Chunks Done: ${progress.successfulChunks}/${chunksToEmbed.length} | Retries: ${progress.retryCount}`
                );
              },
            }
          );

          for (let i = 0; i < chunksToEmbed.length; i++) {
            chunksToEmbed[i].embedding = embeddings[i];
          }

          ragRepository.addChunks(chunksToEmbed);
          summary.indexedChunks += chunksToEmbed.length;
          const matTime = Date.now() - t0Mat;
          summary.totalEmbeddingTimeMs += matTime;

          console.log(`[RAG_BOOT_SYNC] ✅ Indexed ${chunksToEmbed.length} chunks for "${title}" in ${matTime}ms.`);
        } catch (err: any) {
          summary.failedChunks += chunksToEmbed.length;
          console.error(`[RAG_BOOT_SYNC] ❌ Failed to embed material "${title}":`, err.message);
        }
      }
    }
  } finally {
    isBootSyncRunning = false;
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n================================================================`);
  console.log(`[RAG_BOOT_SYNC_SUMMARY] Boot-Sync Complete in ${totalTime}ms:`);
  console.log(` - Total Materials:      ${summary.totalMaterials}`);
  console.log(` - Total Chunks:         ${summary.totalChunks}`);
  console.log(` - Freshly Indexed:      ${summary.indexedChunks}`);
  console.log(` - Skipped (Up-to-Date): ${summary.skippedChunks}`);
  console.log(` - Failed Chunks:        ${summary.failedChunks}`);
  console.log(` - Retries Attempted:    ${summary.retryCount}`);
  console.log(` - Total Embedding Time: ${summary.totalEmbeddingTimeMs}ms`);
  console.log(`================================================================\n`);

  return summary;
}


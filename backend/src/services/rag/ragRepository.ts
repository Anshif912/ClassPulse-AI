import { RAGChunk } from './types';

export interface IRAGRepository {
  addChunks(chunks: RAGChunk[]): void;
  getChunksByClass(classId: string): RAGChunk[];
  removeMaterial(classId: string, materialId: string): void;
  clearClass(classId: string): void;
  getAllChunks(): RAGChunk[];
  hasChunk(chunkId: string): boolean;
  getChunk(chunkId: string): RAGChunk | undefined;
  isChunkIndexedWithModel(chunkId: string, text: string, model: string, dimension: number): boolean;
}

export class InMemoryRAGRepository implements IRAGRepository {
  private chunks: Map<string, RAGChunk> = new Map();

  public addChunks(newChunks: RAGChunk[]): void {
    for (const chunk of newChunks) {
      this.chunks.set(chunk.metadata.chunkId, chunk);
    }
  }

  public hasChunk(chunkId: string): boolean {
    return this.chunks.has(chunkId);
  }

  public getChunk(chunkId: string): RAGChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public isChunkIndexedWithModel(chunkId: string, text: string, model: string, dimension: number): boolean {
    const existing = this.chunks.get(chunkId);
    if (!existing) return false;
    const mode = (process.env.RAG_RETRIEVAL_MODE || 'lexical_fast').toLowerCase();
    if (mode === 'lexical_fast') {
      return existing.text.trim() === text.trim();
    }
    if (!existing.embedding) return false;
    return (
      existing.text.trim() === text.trim() &&
      existing.embedding.length === dimension &&
      existing.metadata.embeddingModel === model &&
      existing.metadata.embeddingDimension === dimension
    );
  }

  public getChunksByClass(classId: string): RAGChunk[] {
    const targetClassId = classId.toUpperCase();
    const result: RAGChunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.metadata.classId.toUpperCase() === targetClassId) {
        result.push(chunk);
      }
    }
    return result;
  }

  public removeMaterial(classId: string, materialId: string): void {
    const targetClassId = classId.toUpperCase();
    for (const [id, chunk] of this.chunks.entries()) {
      if (
        chunk.metadata.classId.toUpperCase() === targetClassId &&
        chunk.metadata.materialId === materialId
      ) {
        this.chunks.delete(id);
      }
    }
  }

  public clearClass(classId: string): void {
    const targetClassId = classId.toUpperCase();
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.metadata.classId.toUpperCase() === targetClassId) {
        this.chunks.delete(id);
      }
    }
  }

  public getAllChunks(): RAGChunk[] {
    return Array.from(this.chunks.values());
  }
}

export const ragRepository = new InMemoryRAGRepository();


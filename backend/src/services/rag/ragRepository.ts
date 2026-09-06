import { RAGChunk } from './types';

export interface IRAGRepository {
  addChunks(chunks: RAGChunk[]): void;
  getChunksByClass(classId: string): RAGChunk[];
  removeMaterial(classId: string, materialId: string): void;
  clearClass(classId: string): void;
  getAllChunks(): RAGChunk[];
}

export class InMemoryRAGRepository implements IRAGRepository {
  private chunks: Map<string, RAGChunk> = new Map();

  public addChunks(newChunks: RAGChunk[]): void {
    for (const chunk of newChunks) {
      this.chunks.set(chunk.metadata.chunkId, chunk);
    }
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

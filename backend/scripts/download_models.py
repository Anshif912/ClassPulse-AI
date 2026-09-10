import os
import sys

print("[DOWNLOAD] Downloading Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B...")

from huggingface_hub import snapshot_download

try:
    print("[DOWNLOAD] Downloading Qwen/Qwen3-Embedding-0.6B...")
    emb_path = snapshot_download(repo_id="Qwen/Qwen3-Embedding-0.6B", resume_download=True)
    print(f"[DOWNLOAD] Qwen3-Embedding-0.6B downloaded to: {emb_path}")
except Exception as e:
    print(f"[DOWNLOAD] Error downloading embedding: {e}")

try:
    print("[DOWNLOAD] Downloading Qwen/Qwen3-Reranker-0.6B...")
    rerank_path = snapshot_download(repo_id="Qwen/Qwen3-Reranker-0.6B", resume_download=True)
    print(f"[DOWNLOAD] Qwen3-Reranker-0.6B downloaded to: {rerank_path}")
except Exception as e:
    print(f"[DOWNLOAD] Error downloading reranker: {e}")

print("[DOWNLOAD] Done!")

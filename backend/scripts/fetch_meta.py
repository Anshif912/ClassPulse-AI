import os
import sys
import time
import requests
from pathlib import Path

def download_file_safe(url, dest_path):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists() and dest_path.stat().st_size > 0:
        return
    for attempt in range(5):
        try:
            print(f"Fetching {dest_path.name} from {url}...", flush=True)
            r = requests.get(url, timeout=30, allow_redirects=True)
            if r.status_code == 200:
                with open(dest_path, "wb") as f:
                    f.write(r.content)
                print(f"  Saved {dest_path.name} ({len(r.content)} bytes)", flush=True)
                return
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}", flush=True)
            time.sleep(1)

repos = [
    ("Qwen/Qwen3-Embedding-0.6B", Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/snapshots/main")),
    ("Qwen/Qwen3-Reranker-0.6B", Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/main")),
]

files = [
    "config.json",
    "config_sentence_transformers.json",
    "modules.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "merges.txt",
    "special_tokens_map.json",
    "README.md",
]

for repo, dest_dir in repos:
    for f in files:
        url = f"https://huggingface.co/{repo}/resolve/main/{f}"
        dest = dest_dir / f
        download_file_safe(url, dest)

print("\n[ALL METADATA READY]", flush=True)

import os
import sys
import requests
import concurrent.futures
from pathlib import Path

MODELS = [
    {
        "repo": "Qwen/Qwen3-Embedding-0.6B",
        "dir": "C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/snapshots/main",
        "files": [
            "config.json",
            "model.safetensors",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
            "merges.txt",
            "special_tokens_map.json",
            "modules.json",
            "config_sentence_transformers.json",
            "README.md",
        ]
    },
    {
        "repo": "Qwen/Qwen3-Reranker-0.6B",
        "dir": "C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/main",
        "files": [
            "config.json",
            "model.safetensors",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
            "merges.txt",
            "special_tokens_map.json",
            "config_sentence_transformers.json",
            "README.md",
        ]
    }
]

def download_file(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        # Check remote size if possible
        try:
            head = requests.head(url, allow_redirects=True, timeout=10)
            remote_size = int(head.headers.get("content-length", 0))
            if remote_size > 0 and dest.stat().st_size == remote_size:
                print(f"[EXISTS] {dest.name} ({dest.stat().st_size / (1024*1024):.2f} MB)")
                return
        except Exception:
            pass

    print(f"[DOWNLOADING] {url} -> {dest.name}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest.with_suffix(dest.suffix + ".part")
    
    with requests.get(url, stream=True, allow_redirects=True, timeout=60) as r:
        if r.status_code != 200:
            print(f"[SKIP/404] {url} (status: {r.status_code})")
            return
        total_len = int(r.headers.get('content-length', 0))
        downloaded = 0
        with open(tmp_dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024): # 1MB chunks
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_len > 10 * 1024 * 1024 and downloaded % (20 * 1024 * 1024) == 0:
                        print(f"  [{dest.name}] {downloaded / (1024*1024):.1f} / {total_len / (1024*1024):.1f} MB ({(downloaded/total_len)*100:.1f}%)")
    
    if tmp_dest.exists():
        if dest.exists():
            dest.unlink()
        tmp_dest.rename(dest)
        print(f"[COMPLETED] {dest.name} ({dest.stat().st_size / (1024*1024):.2f} MB)")

def download_repo(model_info):
    repo = model_info["repo"]
    target_dir = Path(model_info["dir"])
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Write ref to main
    ref_dir = target_dir.parent.parent / "refs"
    ref_dir.mkdir(parents=True, exist_ok=True)
    (ref_dir / "main").write_text("main")

    print(f"\n--- Downloading {repo} to {target_dir} ---")
    for fname in model_info["files"]:
        url = f"https://huggingface.co/{repo}/resolve/main/{fname}"
        dest = target_dir / fname
        try:
            download_file(url, dest)
        except Exception as e:
            print(f"[ERROR] downloading {fname}: {e}")

if __name__ == "__main__":
    for m in MODELS:
        download_repo(m)
    print("\n[ALL MODELS DOWNLOADED SUCCESSFULLY]")

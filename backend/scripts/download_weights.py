import os
import sys
import time
import requests
from pathlib import Path

def download_file_with_progress(url: str, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(output_path.suffix + ".downloading")
    
    headers = {}
    downloaded_bytes = 0
    if temp_path.exists():
        downloaded_bytes = temp_path.stat().st_size
        headers['Range'] = f'bytes={downloaded_bytes}-'
        print(f"[RESUME] Resuming {output_path.name} from {downloaded_bytes / (1024*1024):.1f} MB...")
    else:
        print(f"[START] Downloading {output_path.name} from {url}...")

    session = requests.Session()
    r = session.get(url, headers=headers, stream=True, timeout=60, allow_redirects=True)
    
    if r.status_code == 416: # Range not satisfiable (already completed)
        if temp_path.exists():
            temp_path.rename(output_path)
            return

    if r.status_code not in (200, 206):
        raise RuntimeError(f"HTTP {r.status_code}: Failed to download {url}")

    total_size = int(r.headers.get('content-length', 0)) + downloaded_bytes
    mode = 'ab' if downloaded_bytes > 0 and r.status_code == 206 else 'wb'
    if mode == 'wb':
        downloaded_bytes = 0

    t0 = time.time()
    last_print = t0
    with open(temp_path, mode) as f:
        for chunk in r.iter_content(chunk_size=2 * 1024 * 1024): # 2MB buffer
            if chunk:
                f.write(chunk)
                downloaded_bytes += len(chunk)
                now = time.time()
                if now - last_print >= 3.0: # Print every 3s
                    speed = (downloaded_bytes / (1024 * 1024)) / max(1, now - t0)
                    pct = (downloaded_bytes / total_size * 100) if total_size > 0 else 0
                    print(f"  -> {output_path.name}: {downloaded_bytes / (1024*1024):.1f} / {total_size / (1024*1024):.1f} MB ({pct:.1f}%) @ {speed:.2f} MB/s", flush=True)
                    last_print = now

    if temp_path.exists():
        if output_path.exists():
            output_path.unlink()
        temp_path.rename(output_path)
        print(f"[DONE] {output_path.name} ({output_path.stat().st_size / (1024*1024):.1f} MB)", flush=True)

if __name__ == "__main__":
    targets = [
        {
            "name": "Qwen3-Embedding-0.6B model.safetensors",
            "url": "https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/resolve/main/model.safetensors",
            "path": Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/snapshots/main/model.safetensors"),
        },
        {
            "name": "Qwen3-Reranker-0.6B model.safetensors",
            "url": "https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/resolve/main/model.safetensors",
            "path": Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/main/model.safetensors"),
        }
    ]

    for t in targets:
        print(f"\nProcessing {t['name']}...")
        if t['path'].exists() and t['path'].stat().st_size > 1000000000:
            print(f"[ALREADY COMPLETE] {t['path']}")
            continue
        download_file_with_progress(t['url'], t['path'])
    print("\n[ALL WEIGHTS READY]", flush=True)

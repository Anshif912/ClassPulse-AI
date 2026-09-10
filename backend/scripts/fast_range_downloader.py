import os
import sys
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

NUM_WORKERS = 6

def download_chunk_with_retry(cdn_url: str, start: int, end: int, part_path: Path):
    max_retries = 10
    for attempt in range(max_retries):
        try:
            downloaded = 0
            if part_path.exists():
                downloaded = part_path.stat().st_size
            
            chunk_total = end - start + 1
            if downloaded >= chunk_total:
                return

            current_start = start + downloaded
            headers = {"Range": f"bytes={current_start}-{end}"}
            r = requests.get(cdn_url, headers=headers, stream=True, timeout=60)
            
            if r.status_code in (200, 206):
                mode = "ab" if downloaded > 0 and r.status_code == 206 else "wb"
                with open(part_path, mode) as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
                if part_path.stat().st_size >= chunk_total:
                    return
        except Exception as e:
            time.sleep(2)
            if attempt == max_retries - 1:
                raise e

def download_file_parallel(url: str, dest_path: Path):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.exists() and dest_path.stat().st_size > 1000000000:
        print(f"[ALREADY COMPLETE] {dest_path.name} ({dest_path.stat().st_size / (1024*1024):.1f} MB)", flush=True)
        return

    print(f"\n[RESOLVING CDN URL] {url}...", flush=True)
    head = requests.head(url, allow_redirects=True, timeout=15)
    cdn_url = head.url
    total_size = int(head.headers.get("content-length", 0))
    if total_size == 0:
        raise RuntimeError(f"Could not determine file size for {url}")
    
    print(f"[DOWNLOADING] Total size: {total_size / (1024*1024):.2f} MB from CDN with {NUM_WORKERS} workers...", flush=True)
    chunk_size = total_size // NUM_WORKERS
    part_files = []
    futures = []

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        for i in range(NUM_WORKERS):
            start = i * chunk_size
            end = (start + chunk_size - 1) if i < NUM_WORKERS - 1 else total_size - 1
            part_path = dest_path.parent / f"{dest_path.name}.part{i}"
            part_files.append(part_path)
            futures.append(executor.submit(download_chunk_with_retry, cdn_url, start, end, part_path))

        # Wait with progress
        while any(not f.done() for f in futures):
            time.sleep(3)
            current_downloaded = sum(p.stat().st_size for p in part_files if p.exists())
            elapsed = time.time() - t0
            speed = (current_downloaded / (1024 * 1024)) / max(1, elapsed)
            pct = (current_downloaded / total_size) * 100
            print(f"  Progress: {current_downloaded / (1024*1024):.1f} / {total_size / (1024*1024):.1f} MB ({pct:.1f}%) @ {speed:.2f} MB/s", flush=True)

        for f in futures:
            f.result()

    # Combine parts into final file
    print(f"Combining {NUM_WORKERS} parts into {dest_path.name}...", flush=True)
    with open(dest_path, "wb") as out_f:
        for p in part_files:
            with open(p, "rb") as in_f:
                out_f.write(in_f.read())
            p.unlink()

    print(f"[COMPLETED] {dest_path.name} in {time.time()-t0:.1f}s ({dest_path.stat().st_size / (1024*1024):.1f} MB)", flush=True)

if __name__ == "__main__":
    targets = [
        {
            "name": "Qwen3-Embedding-0.6B",
            "url": "https://huggingface.co/Qwen/Qwen3-Embedding-0.6B/resolve/main/model.safetensors",
            "path": Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/snapshots/main/model.safetensors"),
        },
        {
            "name": "Qwen3-Reranker-0.6B",
            "url": "https://huggingface.co/Qwen/Qwen3-Reranker-0.6B/resolve/main/model.safetensors",
            "path": Path("C:/Users/jeeva/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/main/model.safetensors"),
        }
    ]

    for t in targets:
        download_file_parallel(t["url"], t["path"])
    print("\n[ALL PARALLEL DOWNLOADS FINISHED]", flush=True)

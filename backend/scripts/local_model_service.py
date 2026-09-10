import os
import sys
import time
import torch
import uvicorn
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForCausalLM, AutoTokenizer
from sentence_transformers import SentenceTransformer

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# ─── Configuration ─────────────────────────────────────────────────────────────
EMBEDDING_MODEL_NAME = os.getenv("QWEN_EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B")
RERANKER_MODEL_NAME = os.getenv("QWEN_RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B")
TARGET_EMBEDDING_DIM = int(os.getenv("QWEN_EMBEDDING_DIM", "1024"))
MAX_BATCH_SIZE = int(os.getenv("MAX_EMBEDDING_BATCH_SIZE", "32"))
MAX_RERANK_CANDIDATES = int(os.getenv("MAX_RERANK_CANDIDATES", "30"))
PORT = int(os.getenv("LOCAL_MODEL_PORT", "8000"))

# Check CUDA
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

print(f"[LOCAL_AI_SERVICE] Initializing on device: {DEVICE} (Dtype: {DTYPE})")

app = FastAPI(title="ClassPulse Local AI Neural Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global models loaded lazily or on startup
embedding_model: Optional[SentenceTransformer] = None
reranker_model: Optional[AutoModelForCausalLM] = None
reranker_tokenizer: Optional[AutoTokenizer] = None
token_true_id: Optional[int] = None
token_false_id: Optional[int] = None

embedding_load_error: Optional[str] = None
reranker_load_error: Optional[str] = None

RERANK_PROMPT_TEMPLATE = (
    "<|im_start|>system\n"
    "Judge whether the Document meets the requirements based on the Query and the Instruct provided. "
    'Note that the answer can only be "yes" or "no".<|im_end|>\n'
    "<|im_start|>user\n"
    "<Instruct>: Given a web search query, retrieve relevant passages that answer the query\n"
    "<Query>: {query}\n"
    "<Document>: {doc}<|im_end|>\n"
    "<|im_start|>assistant\n"
    "<think>\n\n</think>\n\n"
)

def get_embedding_path() -> str:
    # Direct snapshot check
    snapshot_path = os.path.expanduser(r"~/.cache/huggingface/hub/models--Qwen--Qwen3-Embedding-0.6B/snapshots/main")
    if os.path.isdir(snapshot_path) and os.path.isfile(os.path.join(snapshot_path, "model.safetensors")):
        return snapshot_path
    return EMBEDDING_MODEL_NAME

def get_reranker_path() -> str:
    snapshot_path = os.path.expanduser(r"~/.cache/huggingface/hub/models--Qwen--Qwen3-Reranker-0.6B/snapshots/main")
    if os.path.isdir(snapshot_path) and os.path.isfile(os.path.join(snapshot_path, "model.safetensors")):
        return snapshot_path
    return RERANKER_MODEL_NAME

def get_embedding_model() -> SentenceTransformer:
    global embedding_model, embedding_load_error
    if embedding_model is None:
        try:
            model_path = get_embedding_path()
            print(f"[LOCAL_AI_SERVICE] Loading embedding model from: {model_path} on {DEVICE}...")
            model_kwargs = {"torch_dtype": DTYPE} if DEVICE == "cuda" else {}
            embedding_model = SentenceTransformer(
                model_path,
                device=DEVICE,
                model_kwargs=model_kwargs,
                trust_remote_code=True,
            )
            print(f"[LOCAL_AI_SERVICE] Embedding model loaded successfully.")
        except Exception as e:
            embedding_load_error = str(e)
            print(f"[LOCAL_AI_SERVICE] Error loading embedding model: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load embedding model: {e}")
    return embedding_model

def get_reranker() -> tuple:
    global reranker_model, reranker_tokenizer, token_true_id, token_false_id, reranker_load_error
    if reranker_model is None or reranker_tokenizer is None:
        try:
            model_path = get_reranker_path()
            print(f"[LOCAL_AI_SERVICE] Loading reranker model from: {model_path} on {DEVICE}...")
            reranker_tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True,
                padding_side="left",
            )
            if reranker_tokenizer.pad_token is None:
                reranker_tokenizer.pad_token = reranker_tokenizer.eos_token

            reranker_model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=DTYPE,
                trust_remote_code=True,
            ).to(DEVICE)
            reranker_model.eval()

            token_true_id = reranker_tokenizer.encode("yes", add_special_tokens=False)[0]
            token_false_id = reranker_tokenizer.encode("no", add_special_tokens=False)[0]
            print(f"[LOCAL_AI_SERVICE] Reranker model loaded successfully. (true_id={token_true_id}, false_id={token_false_id})")
        except Exception as e:
            reranker_load_error = str(e)
            print(f"[LOCAL_AI_SERVICE] Error loading reranker model: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load reranker model: {e}")
    return reranker_model, reranker_tokenizer, token_true_id, token_false_id

# ─── Pydantic Models ───────────────────────────────────────────────────────────

class EmbeddingRequest(BaseModel):
    model: Optional[str] = None
    input: Optional[Union[str, List[str]]] = None
    prompt: Optional[str] = None
    is_query: bool = False
    instruction: Optional[str] = None

class EmbeddingResponseItem(BaseModel):
    index: int
    embedding: List[float]

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingResponseItem]
    model: str
    dimension: int
    usage: dict

class RerankRequest(BaseModel):
    model: Optional[str] = None
    query: str
    documents: List[str]
    top_n: Optional[int] = None

class RerankResultItem(BaseModel):
    index: int
    relevance_score: float
    document: Optional[str] = None

class RerankResponse(BaseModel):
    model: str
    results: List[RerankResultItem]
    latency_ms: float


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/v1/health")
async def health_check():
    vram_used_mb = 0
    vram_total_mb = 0
    gpu_name = "N/A"
    
    if torch.cuda.is_available():
        vram_used_mb = round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2)
        vram_total_mb = round(torch.cuda.get_device_properties(0).total_memory / (1024 * 1024), 2)
        gpu_name = torch.cuda.get_device_name(0)

    return {
        "status": "online",
        "service": "ClassPulse Local AI Neural Service",
        "device": DEVICE,
        "gpu": {
            "name": gpu_name,
            "cuda_available": torch.cuda.is_available(),
            "vram_used_mb": vram_used_mb,
            "vram_total_mb": vram_total_mb,
        },
        "embedding": {
            "provider": "qwen",
            "model": EMBEDDING_MODEL_NAME,
            "dimension": TARGET_EMBEDDING_DIM,
            "loaded": embedding_model is not None,
            "error": embedding_load_error,
            "status": "READY" if embedding_load_error is None else "ERROR",
        },
        "reranker": {
            "provider": "qwen",
            "model": RERANKER_MODEL_NAME,
            "type": "Neural Cross-Encoder",
            "loaded": reranker_model is not None,
            "error": reranker_load_error,
            "status": "READY" if reranker_load_error is None else "ERROR",
        },
    }

if DEVICE == "cpu":
    torch.set_num_threads(os.cpu_count() or 4)

@app.post("/v1/embeddings")
@app.post("/api/embeddings")
def create_embeddings(req: EmbeddingRequest):
    t0 = time.time()
    model = get_embedding_model()

    # Extract text items
    texts: List[str] = []
    if req.input is not None:
        if isinstance(req.input, str):
            texts = [req.input]
        else:
            texts = req.input
    elif req.prompt is not None:
        texts = [req.prompt]
    else:
        raise HTTPException(status_code=400, detail="Missing 'input' or 'prompt' field")

    if not texts:
        return {
            "object": "list",
            "data": [],
            "model": EMBEDDING_MODEL_NAME,
            "dimension": TARGET_EMBEDDING_DIM,
            "usage": {"total_tokens": 0},
        }

    # Format with Qwen instruction if it's a retrieval query
    formatted_texts: List[str] = []
    for t in texts:
        if req.is_query:
            inst = req.instruction or "Given a search query, retrieve relevant passages that answer the query"
            formatted_texts.append(f"Instruct: {inst}\nQuery: {t}")
        else:
            formatted_texts.append(t)

    # Encode with batch size limits
    try:
        raw_embeddings = model.encode(
            formatted_texts,
            batch_size=min(len(formatted_texts), MAX_BATCH_SIZE),
            normalize_embeddings=True,
            show_progress_bar=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding inference failed: {e}")

    # Build response with strict dimension validation
    data_items = []
    for idx, emb in enumerate(raw_embeddings):
        emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
        if len(emb_list) != TARGET_EMBEDDING_DIM:
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dimension mismatch: expected {TARGET_EMBEDDING_DIM}, got {len(emb_list)}",
            )
        data_items.append(EmbeddingResponseItem(index=idx, embedding=emb_list))

    # Ollama compatibility fallback format if single prompt requested
    if req.prompt is not None and len(data_items) == 1:
        return {
            "embedding": data_items[0].embedding,
            "dimension": len(data_items[0].embedding),
            "model": EMBEDDING_MODEL_NAME,
        }

    return {
        "object": "list",
        "data": [d.dict() for d in data_items],
        "model": EMBEDDING_MODEL_NAME,
        "dimension": TARGET_EMBEDDING_DIM,
        "latency_ms": round((time.time() - t0) * 1000, 2),
        "usage": {"prompt_count": len(texts)},
    }

import math

@app.post("/v1/rerank")
def rerank(req: RerankRequest):
    t0 = time.time()
    model, tokenizer, true_id, false_id = get_reranker()

    if not req.query:
        raise HTTPException(status_code=400, detail="'query' cannot be empty")
    if not req.documents:
        return {"model": RERANKER_MODEL_NAME, "results": [], "latency_ms": 0.0}

    # Limit max candidate count for VRAM safety
    docs = req.documents[:MAX_RERANK_CANDIDATES]

    results = []
    try:
        for idx, doc in enumerate(docs):
            prompt = RERANK_PROMPT_TEMPLATE.format(query=req.query, doc=doc)
            inputs = tokenizer(prompt, return_tensors="pt").to(DEVICE)
            with torch.no_grad():
                logits = model(**inputs).logits[:, -1, :]
                score_true = float(logits[:, true_id].item())
                score_false = float(logits[:, false_id].item())
                
                # Numerically stable sigmoid over logit diff
                diff = score_true - score_false
                clamped_diff = max(-50.0, min(50.0, diff))
                relevance_score = 1.0 / (1.0 + math.exp(-clamped_diff))
                
                if math.isnan(relevance_score) or math.isinf(relevance_score):
                    relevance_score = 0.0

            results.append(
                RerankResultItem(
                    index=idx,
                    relevance_score=round(float(relevance_score), 6),
                    document=doc if len(docs) <= 5 else None,
                )
            )
    except Exception as e:
        print(f"[LOCAL_AI_SERVICE] Rerank error: {e}")
        raise HTTPException(status_code=500, detail=f"CausalLM reranking failed: {e}")

    # Sort descending by relevance score
    results.sort(key=lambda r: r.relevance_score, reverse=True)

    if req.top_n is not None and req.top_n > 0:
        results = results[:req.top_n]

    serialized_results = [
        {"index": r.index, "relevance_score": r.relevance_score, "document": r.document}
        for r in results
    ]

    return {
        "model": RERANKER_MODEL_NAME,
        "results": serialized_results,
        "latency_ms": round((time.time() - t0) * 1000, 2),
    }

if __name__ == "__main__":
    print(f"[LOCAL_AI_SERVICE] Starting FastAPI server on http://127.0.0.1:{PORT}")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


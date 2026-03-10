"""
MIT Course Advisor — FastAPI backend.

Run:
    uvicorn app:app --reload --port 8000

Endpoints:
    GET  /health          — liveness check
    GET  /query?q=...     — semantic course search (returns JSON)
    POST /chat            — streaming chat (text/plain SSE)
"""

from dotenv import load_dotenv

load_dotenv()  # load HF_TOKEN from .env before importing src modules

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.embeddings import get_collection, search_courses
from src.chat import stream_chat

app = FastAPI(title="MIT Course Advisor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Pre-warm ChromaDB on startup (builds index on first run)."""
    print("Loading course index...")
    get_collection()
    print("Ready — courses indexed and searchable.")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/query")
def query(
    q: str = Query(..., description="Natural-language search query"),
    n: int = Query(10, ge=1, le=50),
    spring_only: bool = Query(False),
):
    """Semantic search over MIT courses. Returns top-n matches with metadata."""
    return search_courses(q, n_results=n, spring_only=spring_only)


class ChatRequest(BaseModel):
    messages: list[dict]
    profile: dict = {}


@app.post("/chat")
def chat(req: ChatRequest):
    """Streaming chat endpoint. Returns plain-text chunks as they're generated."""
    return StreamingResponse(
        stream_chat(req.messages, req.profile),
        media_type="text/plain; charset=utf-8",
    )

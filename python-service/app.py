"""
Bangkok Bless Asset — FastAPI RAG Service
Shared database with estate.ai (Supabase)

POST /chat   → RAG chatbot
GET  /health → health check
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from house_rec import init_pipeline, rag_chat

load_dotenv()


class ChatRequest(BaseModel):
    query: str
    history: list[dict] = []


class ListingItem(BaseModel):
    name: str | None = None
    type: str | None = None
    district: str | None = None
    province: str | None = None
    price_thb: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    distance_km: float | None = None
    url: str | None = None


class ChatResponse(BaseModel):
    answer: str
    mode: str
    sources: list[ListingItem]
    history: list[dict]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pipeline = init_pipeline()
    yield


app = FastAPI(title="Bangkok Bless Asset RAG Service", version="2.0.0", lifespan=lifespan)

# Allow requests from estate.ai frontend
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "Bangkok Bless Asset RAG Service", "version": "2.0.0"}


@app.get("/health")
def health():
    pipeline = getattr(app.state, "pipeline", None)
    doc_count = len(pipeline["docs"]) if pipeline else 0
    return {"status": "ok" if pipeline else "loading", "doc_count": doc_count}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    p = app.state.pipeline
    try:
        answer, sources, mode = rag_chat(
            req.query, req.history,
            p["embed_model"], p["idx"], p["docs"], p["llm"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    updated_history = req.history + [
        {"role": "user",      "content": req.query},
        {"role": "assistant", "content": answer},
    ]
    listing_items = [
        ListingItem(
            name=doc.get("name"), type=doc.get("type"),
            district=doc.get("district"), province=doc.get("province"),
            price_thb=doc.get("price_thb"),
            latitude=doc.get("latitude"), longitude=doc.get("longitude"),
            distance_km=round(val, 2) if mode == "location" else None,
            url=doc.get("url"),
        )
        for doc, val in sources
    ]
    return ChatResponse(answer=answer, mode=mode, sources=listing_items, history=updated_history)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from db.session import get_db
from rag.pipeline import query as rag_query
from rag.indexer import rebuild_index
from models.orm import QueryLog
from config import settings

router = APIRouter(prefix="/api/rag", tags=["RAG"])


class QueryRequest(BaseModel):
    question: str
    k: int = 6
    filter_type: Optional[str] = None  # vendor | purchase_order | invoice | contract


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    latency_ms: int
    provider: str
    model: str


@router.post("/query", response_model=QueryResponse)
def run_query(req: QueryRequest, db: Session = Depends(get_db)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        result = rag_query(req.question, k=req.k, filter_type=req.filter_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {str(e)}")

    # Log query
    import json
    log = QueryLog(
        query_text=req.question,
        answer_text=result["answer"],
        sources=json.dumps(result["sources"]),
        latency_ms=result["latency_ms"],
        llm_provider=result["provider"],
        llm_model=result["model"],
    )
    db.add(log)
    db.commit()

    return result


@router.post("/rebuild-index")
def trigger_rebuild():
    """Rebuild the FAISS vector index from the current database state."""
    try:
        rebuild_index()
        return {"status": "ok", "message": "FAISS index rebuilt successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def query_history(limit: int = 20, db: Session = Depends(get_db)):
    logs = (
        db.query(QueryLog)
        .order_by(QueryLog.created_at.desc())
        .limit(limit)
        .all()
    )
    import json
    return [
        {
            "id": l.id,
            "question": l.query_text,
            "answer": l.answer_text,
            "latency_ms": l.latency_ms,
            "provider": l.llm_provider,
            "model": l.llm_model,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


@router.get("/config")
def get_llm_config():
    return {
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
    }

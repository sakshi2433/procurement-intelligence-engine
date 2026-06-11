"""
RAG query engine: embed query → FAISS retrieval → prompt assembly → LLM answer with citations.
"""
import time
import json
from typing import Optional
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from rag.indexer import get_vectorstore
from rag.llm_factory import get_llm
from config import settings

SYSTEM_PROMPT = """You are a Procurement Intelligence Assistant with deep knowledge of the company's 
purchase orders, vendor relationships, invoices, and contracts.

Answer the user's question using ONLY the context provided below. 
- Be precise with numbers (amounts, dates, counts).
- If the answer is not in the context, say "I don't have enough data to answer that."
- Always cite which document(s) you used (e.g. "According to Invoice INV-12345...").
- Keep answers concise but complete.

Context:
{context}
"""

HUMAN_PROMPT = "{question}"


def format_docs(docs) -> str:
    parts = []
    for i, d in enumerate(docs, 1):
        meta = d.metadata
        source_label = f"[Source {i}: {meta.get('type', 'doc').title()} — {meta.get('po_number') or meta.get('invoice_number') or meta.get('title') or meta.get('name') or meta.get('id', '')[:8]}]"
        parts.append(f"{source_label}\n{d.page_content.strip()}")
    return "\n\n---\n\n".join(parts)


def query(
    question: str,
    k: int = 6,
    filter_type: Optional[str] = None,
) -> dict:
    """
    Run a RAG query.
    Returns: { answer, sources, latency_ms, provider, model }
    """
    start = time.time()

    vectorstore = get_vectorstore()

    # Retrieve
    if filter_type:
        retriever = vectorstore.as_retriever(
            search_kwargs={"k": k, "filter": {"type": filter_type}}
        )
    else:
        retriever = vectorstore.as_retriever(search_kwargs={"k": k})

    retrieved_docs = retriever.invoke(question)

    if not retrieved_docs:
        return {
            "answer": "No relevant procurement data found for your query.",
            "sources": [],
            "latency_ms": int((time.time() - start) * 1000),
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL,
        }

    context = format_docs(retrieved_docs)

    # Build chain
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_PROMPT),
    ])

    llm = get_llm(temperature=0.0)

    chain = (
        {"context": lambda _: context, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    answer = chain.invoke(question)
    latency_ms = int((time.time() - start) * 1000)

    sources = [
        {
            "type": d.metadata.get("type"),
            "id": d.metadata.get("id"),
            "label": (
                d.metadata.get("po_number")
                or d.metadata.get("invoice_number")
                or d.metadata.get("title")
                or d.metadata.get("name")
                or d.metadata.get("id", "")[:12]
            ),
            "snippet": d.page_content[:200],
        }
        for d in retrieved_docs
    ]

    return {
        "answer": answer,
        "sources": sources,
        "latency_ms": latency_ms,
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
    }

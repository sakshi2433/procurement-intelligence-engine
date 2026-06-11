"""
Builds and persists the FAISS vector index from procurement data.
Called on startup and after Odoo sync.
"""
import os
import json
from typing import Optional
from langchain.docstore.document import Document
from langchain_community.vectorstores import FAISS

from rag.llm_factory import get_embeddings
from db.session import SessionLocal
from models.orm import Vendor, PurchaseOrder, Invoice, Contract

FAISS_STORE_PATH = os.environ.get("FAISS_STORE_PATH", "/app/faiss_store")


def _vendor_docs(db) -> list[Document]:
    vendors = db.query(Vendor).all()
    docs = []
    for v in vendors:
        content = (
            f"Vendor: {v.name}\n"
            f"Category: {v.category}\n"
            f"Country: {v.country}\n"
            f"Status: {v.status.value}\n"
            f"Payment Terms: Net {v.payment_terms_days} days\n"
            f"Email: {v.email}\n"
        )
        docs.append(Document(
            page_content=content,
            metadata={"type": "vendor", "id": v.id, "name": v.name, "category": v.category}
        ))
    return docs


def _po_docs(db) -> list[Document]:
    pos = db.query(PurchaseOrder).all()
    docs = []
    for p in pos:
        vendor_name = p.vendor.name if p.vendor else "Unknown"
        content = (
            f"Purchase Order: {p.po_number}\n"
            f"Vendor: {vendor_name}\n"
            f"Category: {p.category}\n"
            f"Status: {p.status.value}\n"
            f"Amount: INR {p.amount:,.2f}\n"
            f"Order Date: {p.order_date.strftime('%Y-%m-%d') if p.order_date else 'N/A'}\n"
            f"Description: {p.description or 'N/A'}\n"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "type": "purchase_order", "id": p.id,
                "po_number": p.po_number, "vendor": vendor_name,
                "amount": p.amount, "status": p.status.value
            }
        ))
    return docs


def _invoice_docs(db) -> list[Document]:
    invoices = db.query(Invoice).all()
    docs = []
    for inv in invoices:
        vendor_name = inv.vendor.name if inv.vendor else "Unknown"
        content = (
            f"Invoice: {inv.invoice_number}\n"
            f"Vendor: {vendor_name}\n"
            f"Amount: INR {inv.amount:,.2f}\n"
            f"Status: {inv.status.value}\n"
            f"Invoice Date: {inv.invoice_date.strftime('%Y-%m-%d') if inv.invoice_date else 'N/A'}\n"
            f"Due Date: {inv.due_date.strftime('%Y-%m-%d') if inv.due_date else 'N/A'}\n"
            f"Description: {inv.description or 'N/A'}\n"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "type": "invoice", "id": inv.id,
                "invoice_number": inv.invoice_number,
                "vendor": vendor_name, "amount": inv.amount
            }
        ))
    return docs


def _contract_docs(db) -> list[Document]:
    contracts = db.query(Contract).all()
    docs = []
    for c in contracts:
        vendor_name = c.vendor.name if c.vendor else "Unknown"
        content = (
            f"Contract: {c.title}\n"
            f"Vendor: {vendor_name}\n"
            f"Value: INR {c.contract_value:,.2f}\n"
            f"Start: {c.start_date.strftime('%Y-%m-%d') if c.start_date else 'N/A'}\n"
            f"End: {c.end_date.strftime('%Y-%m-%d') if c.end_date else 'N/A'}\n"
            f"Auto-renew: {'Yes' if c.auto_renew else 'No'}\n"
            f"Terms: {(c.terms or '')[:800]}\n"
        )
        docs.append(Document(
            page_content=content,
            metadata={
                "type": "contract", "id": c.id,
                "vendor": vendor_name, "title": c.title,
                "end_date": c.end_date.isoformat() if c.end_date else None
            }
        ))
    return docs


def build_index(force: bool = False) -> FAISS:
    """Build FAISS index from DB. Loads from disk if already built."""
    embeddings = get_embeddings()
    index_file = os.path.join(FAISS_STORE_PATH, "index.faiss")

    if os.path.exists(index_file) and not force:
        print("Loading existing FAISS index...")
        return FAISS.load_local(FAISS_STORE_PATH, embeddings, allow_dangerous_deserialization=True)

    print("Building FAISS index from database...")
    db = SessionLocal()
    try:
        docs = []
        docs.extend(_vendor_docs(db))
        docs.extend(_po_docs(db))
        docs.extend(_invoice_docs(db))
        docs.extend(_contract_docs(db))
    finally:
        db.close()

    if not docs:
        raise RuntimeError("No documents found in DB. Run the seed script first.")

    print(f"  Embedding {len(docs)} documents...")
    vectorstore = FAISS.from_documents(docs, embeddings)
    os.makedirs(FAISS_STORE_PATH, exist_ok=True)
    vectorstore.save_local(FAISS_STORE_PATH)
    print(f"  ✓ FAISS index saved to {FAISS_STORE_PATH}")
    return vectorstore


# Singleton — loaded once per process
_vectorstore: Optional[FAISS] = None


def get_vectorstore() -> FAISS:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = build_index()
    return _vectorstore


def rebuild_index():
    global _vectorstore
    _vectorstore = build_index(force=True)

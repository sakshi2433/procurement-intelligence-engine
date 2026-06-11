from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from db.session import get_db
from models.orm import Vendor, PurchaseOrder, Invoice, Contract, VendorStatus

router = APIRouter(prefix="/api/procurement", tags=["Procurement"])


# ── Vendors ────────────────────────────────────────────────────────────────

@router.get("/vendors")
def list_vendors(
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Vendor)
    if status:
        q = q.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Vendor.name.ilike(f"%{search}%"))
    total = q.count()
    vendors = q.order_by(Vendor.name).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": v.id,
                "name": v.name,
                "category": v.category,
                "country": v.country,
                "status": v.status.value,
                "payment_terms_days": v.payment_terms_days,
                "email": v.email,
            }
            for v in vendors
        ],
    }


@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: str, db: Session = Depends(get_db)):
    v = db.query(Vendor).filter_by(id=vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    total_spend = (
        db.query(func.sum(Invoice.amount))
        .filter_by(vendor_id=vendor_id)
        .scalar() or 0
    )
    po_count = db.query(func.count(PurchaseOrder.id)).filter_by(vendor_id=vendor_id).scalar() or 0
    return {
        "id": v.id,
        "name": v.name,
        "category": v.category,
        "country": v.country,
        "email": v.email,
        "phone": v.phone,
        "status": v.status.value,
        "payment_terms_days": v.payment_terms_days,
        "total_spend": round(total_spend, 2),
        "po_count": po_count,
    }


@router.get("/vendor-categories")
def vendor_categories(db: Session = Depends(get_db)):
    rows = db.query(Vendor.category).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


# ── Purchase Orders ────────────────────────────────────────────────────────

@router.get("/purchase-orders")
def list_pos(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(PurchaseOrder)
    if vendor_id:
        q = q.filter_by(vendor_id=vendor_id)
    if status:
        q = q.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    total = q.count()
    pos = q.order_by(PurchaseOrder.order_date.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": p.id,
                "po_number": p.po_number,
                "vendor_id": p.vendor_id,
                "vendor_name": p.vendor.name if p.vendor else None,
                "status": p.status.value,
                "category": p.category,
                "amount": p.amount,
                "currency": p.currency,
                "order_date": p.order_date.isoformat() if p.order_date else None,
                "expected_delivery": p.expected_delivery.isoformat() if p.expected_delivery else None,
            }
            for p in pos
        ],
    }


# ── Invoices ───────────────────────────────────────────────────────────────

@router.get("/invoices")
def list_invoices(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Invoice)
    if vendor_id:
        q = q.filter_by(vendor_id=vendor_id)
    if status:
        q = q.filter_by(status=status)
    total = q.count()
    invoices = q.order_by(Invoice.invoice_date.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "vendor_id": inv.vendor_id,
                "vendor_name": inv.vendor.name if inv.vendor else None,
                "amount": inv.amount,
                "currency": inv.currency,
                "status": inv.status.value,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
            }
            for inv in invoices
        ],
    }


# ── Contracts ──────────────────────────────────────────────────────────────

@router.get("/contracts")
def list_contracts(
    vendor_id: Optional[str] = None,
    expiring_soon: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    from datetime import datetime, timedelta
    q = db.query(Contract)
    if vendor_id:
        q = q.filter_by(vendor_id=vendor_id)
    if expiring_soon:
        cutoff = datetime.utcnow() + timedelta(days=30)
        q = q.filter(Contract.end_date <= cutoff, Contract.end_date >= datetime.utcnow())
    total = q.count()
    contracts = q.order_by(Contract.end_date).offset(offset).limit(limit).all()
    now = datetime.utcnow()
    return {
        "total": total,
        "items": [
            {
                "id": c.id,
                "title": c.title,
                "vendor_id": c.vendor_id,
                "vendor_name": c.vendor.name if c.vendor else None,
                "contract_value": c.contract_value,
                "currency": c.currency,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "days_remaining": (c.end_date - now).days if c.end_date else None,
                "auto_renew": c.auto_renew,
            }
            for c in contracts
        ],
    }

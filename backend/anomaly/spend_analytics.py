"""
Spend analytics: category breakdown, vendor concentration risk (Herfindahl index),
month-over-month trends, top vendors.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.orm import Invoice, PurchaseOrder, Vendor, InvoiceStatus


def get_spend_by_category(db: Session, months: int = 12) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=months * 30)
    results = (
        db.query(
            PurchaseOrder.category,
            func.sum(Invoice.amount).label("total_spend"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .join(Invoice, Invoice.purchase_order_id == PurchaseOrder.id)
        .filter(Invoice.invoice_date >= since)
        .filter(Invoice.status != InvoiceStatus.cancelled)
        .group_by(PurchaseOrder.category)
        .order_by(func.sum(Invoice.amount).desc())
        .all()
    )
    return [
        {"category": r.category, "total_spend": round(r.total_spend, 2), "invoice_count": r.invoice_count}
        for r in results
    ]


def get_spend_by_vendor(db: Session, months: int = 12, top_n: int = 20) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=months * 30)
    results = (
        db.query(
            Vendor.id,
            Vendor.name,
            Vendor.category,
            func.sum(Invoice.amount).label("total_spend"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .join(Invoice, Invoice.vendor_id == Vendor.id)
        .filter(Invoice.invoice_date >= since)
        .filter(Invoice.status != InvoiceStatus.cancelled)
        .group_by(Vendor.id, Vendor.name, Vendor.category)
        .order_by(func.sum(Invoice.amount).desc())
        .limit(top_n)
        .all()
    )
    return [
        {
            "vendor_id": r.id,
            "vendor_name": r.name,
            "category": r.category,
            "total_spend": round(r.total_spend, 2),
            "invoice_count": r.invoice_count,
        }
        for r in results
    ]


def get_concentration_risk(db: Session, months: int = 12) -> dict:
    """
    Herfindahl-Hirschman Index (HHI) for vendor concentration.
    HHI = sum of (vendor_share)^2 * 10000
    HHI < 1500 → low risk | 1500–2500 → moderate | >2500 → high
    """
    vendors = get_spend_by_vendor(db, months=months, top_n=100)
    if not vendors:
        return {"hhi": 0, "risk_level": "unknown", "top_3_share": 0, "vendors": []}

    total = sum(v["total_spend"] for v in vendors)
    if total == 0:
        return {"hhi": 0, "risk_level": "unknown", "top_3_share": 0, "vendors": []}

    for v in vendors:
        v["share_pct"] = round(v["total_spend"] / total * 100, 2)

    hhi = sum((v["share_pct"] / 100) ** 2 for v in vendors) * 10000
    top_3_share = sum(v["share_pct"] for v in vendors[:3])

    risk_level = "low" if hhi < 1500 else ("moderate" if hhi < 2500 else "high")

    return {
        "hhi": round(hhi, 1),
        "risk_level": risk_level,
        "top_3_share_pct": round(top_3_share, 1),
        "total_spend": round(total, 2),
        "vendors": vendors[:10],
    }


def get_monthly_trend(db: Session, months: int = 12) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=months * 30)
    invoices = (
        db.query(Invoice.amount, Invoice.invoice_date)
        .filter(Invoice.invoice_date >= since)
        .filter(Invoice.status != InvoiceStatus.cancelled)
        .all()
    )
    if not invoices:
        return []

    df = pd.DataFrame([{"amount": i.amount, "date": i.invoice_date} for i in invoices])
    df["month"] = df["date"].dt.to_period("M")
    monthly = df.groupby("month").agg(
        total_spend=("amount", "sum"),
        invoice_count=("amount", "count"),
    ).reset_index()
    monthly["month_str"] = monthly["month"].astype(str)
    monthly = monthly.sort_values("month_str")

    result = monthly.to_dict(orient="records")
    for r in result:
        del r["month"]
        r["total_spend"] = round(r["total_spend"], 2)
    return result


def get_summary_kpis(db: Session) -> dict:
    """High-level KPIs for the dashboard header."""
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    def month_spend(start, end):
        result = (
            db.query(func.sum(Invoice.amount))
            .filter(Invoice.invoice_date >= start, Invoice.invoice_date < end)
            .filter(Invoice.status != InvoiceStatus.cancelled)
            .scalar()
        )
        return round(result or 0, 2)

    this_month = month_spend(this_month_start, now)
    last_month = month_spend(last_month_start, this_month_start)
    mom_change_pct = (
        round((this_month - last_month) / last_month * 100, 1) if last_month > 0 else 0
    )

    total_vendors = db.query(func.count(Vendor.id)).filter_by(status="active").scalar() or 0
    total_pos = db.query(func.count(PurchaseOrder.id)).scalar() or 0
    pending_invoices = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status == InvoiceStatus.posted)
        .scalar() or 0
    )
    overdue_invoices = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status == InvoiceStatus.posted)
        .filter(Invoice.due_date < now)
        .scalar() or 0
    )

    return {
        "this_month_spend": this_month,
        "last_month_spend": last_month,
        "mom_change_pct": mom_change_pct,
        "total_active_vendors": total_vendors,
        "total_purchase_orders": total_pos,
        "pending_invoices": pending_invoices,
        "overdue_invoices": overdue_invoices,
    }

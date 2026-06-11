"""
Statistical anomaly detection for procurement data.

Methods:
  1. Z-score  — flag invoices > 2σ from vendor's historical mean
  2. IQR      — flag invoices outside Q1-1.5*IQR .. Q3+1.5*IQR per vendor
  3. Duplicate — same amount + vendor within 7 days
  4. Contract expiry — contracts ending within 30 days
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.orm import Invoice, Contract, Vendor, AnomalyAlert, AnomalyType


ZSCORE_THRESHOLD = 2.0
IQR_MULTIPLIER = 1.5
DUPLICATE_WINDOW_DAYS = 7
DUPLICATE_AMOUNT_TOLERANCE = 0.01   # 1% tolerance
EXPIRY_WARNING_DAYS = 30
MIN_INVOICES_FOR_STATS = 3          # need ≥3 invoices to compute stats


def _clear_existing_alerts(db: Session):
    """Remove unresolved alerts before re-running scan."""
    db.query(AnomalyAlert).filter_by(resolved=False).delete()
    db.flush()


def _run_zscore(db: Session, df: pd.DataFrame) -> list[AnomalyAlert]:
    alerts = []
    for vendor_id, group in df.groupby("vendor_id"):
        if len(group) < MIN_INVOICES_FOR_STATS:
            continue
        amounts = group["amount"].values
        mean, std = amounts.mean(), amounts.std()
        if std == 0:
            continue
        for _, row in group.iterrows():
            z = (row["amount"] - mean) / std
            if abs(z) > ZSCORE_THRESHOLD:
                severity = "high" if abs(z) > 3.5 else "medium"
                alerts.append(AnomalyAlert(
                    anomaly_type=AnomalyType.zscore,
                    severity=severity,
                    vendor_id=row["vendor_id"],
                    invoice_id=row["id"],
                    title=f"Invoice amount outlier (Z={z:.2f}σ)",
                    description=(
                        f"Invoice {row['invoice_number']} from vendor {row['vendor_name']} "
                        f"is {abs(z):.1f} standard deviations from this vendor's average. "
                        f"Invoice amount: INR {row['amount']:,.2f} | "
                        f"Vendor mean: INR {mean:,.2f} | σ: INR {std:,.2f}"
                    ),
                    value=row["amount"],
                    threshold=mean + ZSCORE_THRESHOLD * std,
                    z_score=round(z, 4),
                ))
    return alerts


def _run_iqr(db: Session, df: pd.DataFrame) -> list[AnomalyAlert]:
    alerts = []
    for vendor_id, group in df.groupby("vendor_id"):
        if len(group) < MIN_INVOICES_FOR_STATS:
            continue
        amounts = group["amount"].values
        q1, q3 = np.percentile(amounts, 25), np.percentile(amounts, 75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower = q1 - IQR_MULTIPLIER * iqr
        upper = q3 + IQR_MULTIPLIER * iqr

        for _, row in group.iterrows():
            if row["amount"] > upper or row["amount"] < lower:
                # Skip if already caught by z-score (avoid duplicate alerts)
                if any(
                    a.invoice_id == row["id"] and a.anomaly_type == AnomalyType.zscore
                    for a in alerts
                ):
                    continue
                alerts.append(AnomalyAlert(
                    anomaly_type=AnomalyType.iqr,
                    severity="medium",
                    vendor_id=row["vendor_id"],
                    invoice_id=row["id"],
                    title=f"Invoice outside IQR range",
                    description=(
                        f"Invoice {row['invoice_number']} from {row['vendor_name']} "
                        f"is outside the expected IQR range. "
                        f"Amount: INR {row['amount']:,.2f} | "
                        f"Expected range: INR {lower:,.2f} – {upper:,.2f}"
                    ),
                    value=row["amount"],
                    threshold=upper,
                ))
    return alerts


def _run_duplicate_detection(db: Session, df: pd.DataFrame) -> list[AnomalyAlert]:
    alerts = []
    df_sorted = df.sort_values(["vendor_id", "invoice_date"])
    seen_pairs: set[tuple] = set()

    for vendor_id, group in df_sorted.groupby("vendor_id"):
        rows = group.reset_index(drop=True)
        for i in range(len(rows)):
            for j in range(i + 1, len(rows)):
                r1, r2 = rows.iloc[i], rows.iloc[j]
                date_diff = abs((r1["invoice_date"] - r2["invoice_date"]).days)
                if date_diff > DUPLICATE_WINDOW_DAYS:
                    break   # sorted, so no more matches
                amount_diff = abs(r1["amount"] - r2["amount"]) / max(r1["amount"], 1)
                if amount_diff <= DUPLICATE_AMOUNT_TOLERANCE:
                    pair = tuple(sorted([r1["id"], r2["id"]]))
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)
                    alerts.append(AnomalyAlert(
                        anomaly_type=AnomalyType.duplicate,
                        severity="high",
                        vendor_id=vendor_id,
                        invoice_id=r1["id"],
                        title="Potential duplicate invoice",
                        description=(
                            f"Invoice {r1['invoice_number']} (INR {r1['amount']:,.2f}, {r1['invoice_date'].date()}) "
                            f"appears to duplicate {r2['invoice_number']} "
                            f"(INR {r2['amount']:,.2f}, {r2['invoice_date'].date()}) "
                            f"from vendor {r1['vendor_name']}. "
                            f"Difference: {date_diff} days, amount delta: {amount_diff*100:.2f}%."
                        ),
                        value=r1["amount"],
                        threshold=0,
                    ))
    return alerts


def _run_contract_expiry(db: Session) -> list[AnomalyAlert]:
    alerts = []
    now = datetime.utcnow()
    cutoff = now + timedelta(days=EXPIRY_WARNING_DAYS)

    contracts = (
        db.query(Contract)
        .filter(Contract.end_date <= cutoff, Contract.end_date >= now)
        .all()
    )

    for c in contracts:
        days_left = (c.end_date - now).days
        severity = "high" if days_left <= 7 else ("medium" if days_left <= 14 else "low")
        vendor_name = c.vendor.name if c.vendor else "Unknown"
        alerts.append(AnomalyAlert(
            anomaly_type=AnomalyType.contract_expiry,
            severity=severity,
            vendor_id=c.vendor_id,
            contract_id=c.id,
            title=f"Contract expiring in {days_left} day{'s' if days_left != 1 else ''}",
            description=(
                f"Contract '{c.title}' with {vendor_name} expires on "
                f"{c.end_date.strftime('%Y-%m-%d')} ({days_left} days). "
                f"Value: INR {(c.contract_value or 0):,.2f}. "
                f"Auto-renew: {'Yes' if c.auto_renew else 'No — action required'}."
            ),
            value=c.contract_value or 0,
            threshold=EXPIRY_WARNING_DAYS,
        ))
    return alerts


def run_full_scan(db: Session) -> dict:
    """
    Run all anomaly detectors and persist results.
    Returns summary counts.
    """
    _clear_existing_alerts(db)

    # Load invoices into DataFrame
    invoices = db.query(Invoice).all()
    if not invoices:
        return {"total": 0, "zscore": 0, "iqr": 0, "duplicate": 0, "contract_expiry": 0}

    rows = []
    for inv in invoices:
        rows.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "vendor_id": inv.vendor_id,
            "vendor_name": inv.vendor.name if inv.vendor else "Unknown",
            "amount": inv.amount,
            "invoice_date": inv.invoice_date or datetime.utcnow(),
        })
    df = pd.DataFrame(rows)

    all_alerts = []
    zscore_alerts = _run_zscore(db, df)
    iqr_alerts = _run_iqr(db, df)
    dup_alerts = _run_duplicate_detection(db, df)
    expiry_alerts = _run_contract_expiry(db)

    all_alerts = zscore_alerts + iqr_alerts + dup_alerts + expiry_alerts

    for alert in all_alerts:
        db.add(alert)
    db.commit()

    return {
        "total": len(all_alerts),
        "zscore": len(zscore_alerts),
        "iqr": len(iqr_alerts),
        "duplicate": len(dup_alerts),
        "contract_expiry": len(expiry_alerts),
    }


def get_recent_alerts(db: Session, limit: int = 50, severity: str = None) -> list[AnomalyAlert]:
    q = db.query(AnomalyAlert).filter_by(resolved=False)
    if severity:
        q = q.filter_by(severity=severity)
    return q.order_by(AnomalyAlert.detected_at.desc()).limit(limit).all()

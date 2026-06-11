from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from db.session import get_db
from anomaly.detector import run_full_scan, get_recent_alerts
from models.orm import AnomalyAlert, AnomalyType

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])


@router.post("/scan")
def trigger_scan(db: Session = Depends(get_db)):
    """Run a full anomaly scan across all invoices and contracts."""
    try:
        summary = run_full_scan(db)
        return {"status": "ok", "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
def list_alerts(
    limit: int = 50,
    severity: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AnomalyAlert).filter_by(resolved=False)
    if severity:
        q = q.filter_by(severity=severity)
    if anomaly_type:
        try:
            at = AnomalyType(anomaly_type)
            q = q.filter_by(anomaly_type=at)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid anomaly_type: {anomaly_type}")
    alerts = q.order_by(AnomalyAlert.detected_at.desc()).limit(limit).all()

    return [
        {
            "id": a.id,
            "anomaly_type": a.anomaly_type.value,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "value": a.value,
            "threshold": a.threshold,
            "z_score": a.z_score,
            "vendor_id": a.vendor_id,
            "invoice_id": a.invoice_id,
            "contract_id": a.contract_id,
            "detected_at": a.detected_at.isoformat(),
        }
        for a in alerts
    ]


@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(AnomalyAlert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    db.commit()
    return {"status": "resolved", "id": alert_id}


@router.get("/summary")
def alert_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    rows = (
        db.query(AnomalyAlert.anomaly_type, AnomalyAlert.severity, func.count(AnomalyAlert.id))
        .filter_by(resolved=False)
        .group_by(AnomalyAlert.anomaly_type, AnomalyAlert.severity)
        .all()
    )
    result: dict = {}
    for anomaly_type, severity, count in rows:
        key = anomaly_type.value
        if key not in result:
            result[key] = {"total": 0, "high": 0, "medium": 0, "low": 0}
        result[key][severity] += count
        result[key]["total"] += count
    return result

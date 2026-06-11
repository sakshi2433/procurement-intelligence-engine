from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from anomaly.spend_analytics import (
    get_spend_by_category,
    get_spend_by_vendor,
    get_concentration_risk,
    get_monthly_trend,
    get_summary_kpis,
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/kpis")
def kpis(db: Session = Depends(get_db)):
    return get_summary_kpis(db)


@router.get("/spend-by-category")
def spend_by_category(months: int = 12, db: Session = Depends(get_db)):
    return get_spend_by_category(db, months=months)


@router.get("/spend-by-vendor")
def spend_by_vendor(months: int = 12, top_n: int = 10, db: Session = Depends(get_db)):
    return get_spend_by_vendor(db, months=months, top_n=top_n)


@router.get("/concentration-risk")
def concentration_risk(months: int = 12, db: Session = Depends(get_db)):
    return get_concentration_risk(db, months=months)


@router.get("/monthly-trend")
def monthly_trend(months: int = 12, db: Session = Depends(get_db)):
    return get_monthly_trend(db, months=months)

from sqlalchemy import (
    Column, String, Float, Integer, DateTime, Boolean,
    ForeignKey, Text, Enum, Index
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum


class Base(DeclarativeBase):
    pass


def gen_uuid():
    return str(uuid.uuid4())


class VendorStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    blacklisted = "blacklisted"


class POStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    received = "received"
    cancelled = "cancelled"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    posted = "posted"
    paid = "paid"
    cancelled = "cancelled"


class AnomalyType(str, enum.Enum):
    zscore = "zscore"
    iqr = "iqr"
    duplicate = "duplicate"
    contract_expiry = "contract_expiry"


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False)
    country = Column(String(100))
    email = Column(String(255))
    phone = Column(String(50))
    status = Column(Enum(VendorStatus), default=VendorStatus.active)
    payment_terms_days = Column(Integer, default=30)
    odoo_id = Column(Integer, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    invoices = relationship("Invoice", back_populates="vendor")
    contracts = relationship("Contract", back_populates="vendor")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False)
    status = Column(Enum(POStatus), default=POStatus.draft)
    category = Column(String(100))
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    order_date = Column(DateTime, nullable=False)
    expected_delivery = Column(DateTime)
    description = Column(Text)
    odoo_id = Column(Integer, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="purchase_orders")
    invoices = relationship("Invoice", back_populates="purchase_order")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=gen_uuid)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.draft)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    invoice_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime)
    description = Column(Text)
    odoo_id = Column(Integer, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="invoices")
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")

    __table_args__ = (
        Index("ix_invoice_vendor_date", "vendor_id", "invoice_date"),
    )


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=False)
    title = Column(String(255), nullable=False)
    contract_value = Column(Float)
    currency = Column(String(10), default="INR")
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    auto_renew = Column(Boolean, default=False)
    terms = Column(Text)           # full contract text for RAG embedding
    odoo_id = Column(Integer, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="contracts")


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(String, primary_key=True, default=gen_uuid)
    anomaly_type = Column(Enum(AnomalyType), nullable=False)
    severity = Column(String(20), default="medium")  # low | medium | high
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)
    contract_id = Column(String, ForeignKey("contracts.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    value = Column(Float)           # the flagged amount
    threshold = Column(Float)       # the threshold that was exceeded
    z_score = Column(Float, nullable=True)
    resolved = Column(Boolean, default=False)
    detected_at = Column(DateTime, default=datetime.utcnow)


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    query_text = Column(Text, nullable=False)
    answer_text = Column(Text)
    sources = Column(Text)         # JSON list of source chunks
    latency_ms = Column(Integer)
    llm_provider = Column(String(50))
    llm_model = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

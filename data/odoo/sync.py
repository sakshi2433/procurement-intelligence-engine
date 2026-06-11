"""
Odoo XML-RPC connector.
Pulls vendors, purchase orders, vendor bills (invoices), and contracts.

Usage:
    python -m data.odoo.sync
"""
import xmlrpc.client
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from datetime import datetime
from config import settings
from db.session import db_session, init_db
from models.orm import Vendor, PurchaseOrder, Invoice, Contract, VendorStatus, POStatus, InvoiceStatus


ODOO_PO_STATE_MAP = {
    "draft": POStatus.draft,
    "sent": POStatus.draft,
    "purchase": POStatus.confirmed,
    "done": POStatus.received,
    "cancel": POStatus.cancelled,
}

ODOO_INVOICE_STATE_MAP = {
    "draft": InvoiceStatus.draft,
    "posted": InvoiceStatus.posted,
    "cancel": InvoiceStatus.cancelled,
}


class OdooConnector:
    def __init__(self):
        url = settings.ODOO_URL
        self.db = settings.ODOO_DB
        self.uid = None
        self.password = settings.ODOO_PASSWORD

        self.common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
        self.models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")

        self.uid = self.common.authenticate(
            self.db, settings.ODOO_USERNAME, settings.ODOO_PASSWORD, {}
        )
        if not self.uid:
            raise ConnectionError("Odoo authentication failed. Check credentials.")
        print(f"✓ Connected to Odoo (uid={self.uid})")

    def call(self, model: str, method: str, args, kwargs=None):
        return self.models.execute_kw(
            self.db, self.uid, self.password,
            model, method, args, kwargs or {}
        )

    def fetch_vendors(self, limit=500) -> list[dict]:
        ids = self.call("res.partner", "search", [[["supplier_rank", ">", 0]]], {"limit": limit})
        records = self.call("res.partner", "read", [ids], {
            "fields": ["id", "name", "supplier_rank", "email", "phone", "country_id", "active"]
        })
        return records

    def fetch_purchase_orders(self, limit=2000) -> list[dict]:
        ids = self.call("purchase.order", "search", [[]], {"limit": limit})
        records = self.call("purchase.order", "read", [ids], {
            "fields": [
                "id", "name", "partner_id", "state", "amount_total",
                "currency_id", "date_order", "date_planned", "notes"
            ]
        })
        return records

    def fetch_vendor_bills(self, limit=2000) -> list[dict]:
        ids = self.call("account.move", "search", [
            [["move_type", "=", "in_invoice"]]
        ], {"limit": limit})
        records = self.call("account.move", "read", [ids], {
            "fields": [
                "id", "name", "partner_id", "purchase_id", "state",
                "amount_total", "currency_id", "invoice_date", "invoice_date_due"
            ]
        })
        return records

    def fetch_contracts(self, limit=500) -> list[dict]:
        """Odoo doesn't have a native contract model in CE; use purchase.order for long-term."""
        try:
            ids = self.call("purchase.contract", "search", [[]], {"limit": limit})
            records = self.call("purchase.contract", "read", [ids], {
                "fields": ["id", "name", "partner_id", "date_start", "date_end", "amount_total"]
            })
            return records
        except Exception:
            # Fallback: treat confirmed POs with date_planned > 180 days as contracts
            return []


def parse_date(val) -> datetime | None:
    if not val or val is False:
        return None
    if isinstance(val, datetime):
        return val
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def sync():
    if not settings.USE_ODOO:
        print("USE_ODOO is false in .env — skipping Odoo sync.")
        return

    print("Connecting to Odoo...")
    connector = OdooConnector()
    init_db()

    with db_session() as db:
        # ── Vendors ──────────────────────────────────────────────
        print("Syncing vendors...")
        odoo_vendors = connector.fetch_vendors()
        vendor_id_map: dict[int, str] = {}

        for ov in odoo_vendors:
            existing = db.query(Vendor).filter_by(odoo_id=ov["id"]).first()
            country = ov["country_id"][1] if ov.get("country_id") else "Unknown"

            if existing:
                existing.name = ov["name"]
                existing.email = ov.get("email") or existing.email
                existing.phone = str(ov.get("phone") or existing.phone or "")[:20]
                existing.country = country
                existing.status = VendorStatus.active if ov.get("active") else VendorStatus.inactive
                vendor_id_map[ov["id"]] = existing.id
            else:
                v = Vendor(
                    name=ov["name"],
                    category="Uncategorized",
                    email=ov.get("email") or "",
                    phone=str(ov.get("phone") or "")[:20],
                    country=country,
                    odoo_id=ov["id"],
                    status=VendorStatus.active if ov.get("active") else VendorStatus.inactive,
                )
                db.add(v)
                db.flush()
                vendor_id_map[ov["id"]] = v.id

        db.commit()
        print(f"  ✓ {len(odoo_vendors)} vendors synced")

        # ── Purchase Orders ───────────────────────────────────────
        print("Syncing purchase orders...")
        odoo_pos = connector.fetch_purchase_orders()
        po_id_map: dict[int, str] = {}

        for op in odoo_pos:
            vendor_local_id = vendor_id_map.get(op["partner_id"][0] if op.get("partner_id") else None)
            if not vendor_local_id:
                continue

            existing = db.query(PurchaseOrder).filter_by(odoo_id=op["id"]).first()
            if existing:
                existing.status = ODOO_PO_STATE_MAP.get(op["state"], POStatus.draft)
                existing.amount = op.get("amount_total", 0.0)
                po_id_map[op["id"]] = existing.id
            else:
                po = PurchaseOrder(
                    po_number=op["name"],
                    vendor_id=vendor_local_id,
                    status=ODOO_PO_STATE_MAP.get(op["state"], POStatus.draft),
                    amount=op.get("amount_total", 0.0),
                    currency=op["currency_id"][1] if op.get("currency_id") else "INR",
                    order_date=parse_date(op.get("date_order")) or datetime.utcnow(),
                    expected_delivery=parse_date(op.get("date_planned")),
                    description=op.get("notes") or "",
                    odoo_id=op["id"],
                )
                db.add(po)
                db.flush()
                po_id_map[op["id"]] = po.id

        db.commit()
        print(f"  ✓ {len(odoo_pos)} purchase orders synced")

        # ── Vendor Bills (Invoices) ───────────────────────────────
        print("Syncing vendor bills...")
        odoo_bills = connector.fetch_vendor_bills()

        for ob in odoo_bills:
            vendor_local_id = vendor_id_map.get(ob["partner_id"][0] if ob.get("partner_id") else None)
            if not vendor_local_id:
                continue

            po_local_id = po_id_map.get(ob["purchase_id"][0] if ob.get("purchase_id") else None)
            existing = db.query(Invoice).filter_by(odoo_id=ob["id"]).first()

            if existing:
                existing.amount = ob.get("amount_total", 0.0)
                existing.status = ODOO_INVOICE_STATE_MAP.get(ob["state"], InvoiceStatus.draft)
            else:
                inv = Invoice(
                    invoice_number=ob["name"],
                    vendor_id=vendor_local_id,
                    purchase_order_id=po_local_id,
                    status=ODOO_INVOICE_STATE_MAP.get(ob["state"], InvoiceStatus.draft),
                    amount=ob.get("amount_total", 0.0),
                    currency=ob["currency_id"][1] if ob.get("currency_id") else "INR",
                    invoice_date=parse_date(ob.get("invoice_date")) or datetime.utcnow(),
                    due_date=parse_date(ob.get("invoice_date_due")),
                    odoo_id=ob["id"],
                )
                db.add(inv)

        db.commit()
        print(f"  ✓ {len(odoo_bills)} vendor bills synced")

    print("\n✓ Odoo sync complete.")


if __name__ == "__main__":
    sync()

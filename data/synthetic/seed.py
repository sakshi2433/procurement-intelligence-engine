"""
Synthetic data generator that mimics the Odoo procurement data model.
Run: python -m data.synthetic.seed
"""
import random
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from faker import Faker
from faker.providers import company, address
import numpy as np
from datetime import datetime, timedelta

from db.session import db_session, init_db
from models.orm import (
    Vendor, PurchaseOrder, Invoice, Contract,
    VendorStatus, POStatus, InvoiceStatus
)

fake = Faker("en_IN")
fake.add_provider(company)
fake.add_provider(address)

random.seed(42)
np.random.seed(42)

CATEGORIES = [
    "IT Hardware", "Software Licenses", "Office Supplies",
    "Logistics", "Raw Materials", "Maintenance Services",
    "Marketing", "Consulting", "Facilities", "Travel"
]

VENDOR_COUNTS = 60
PO_PER_VENDOR = (5, 20)
INVOICE_ANOMALY_RATE = 0.08   # 8% anomalous invoices
DUPLICATE_RATE = 0.04         # 4% duplicate invoices


def make_vendors(n: int) -> list[dict]:
    vendors = []
    for i in range(n):
        status = random.choices(
            [VendorStatus.active, VendorStatus.inactive, VendorStatus.blacklisted],
            weights=[80, 15, 5]
        )[0]
        vendors.append({
            "name": fake.company(),
            "category": random.choice(CATEGORIES),
            "country": random.choice(["India", "India", "India", "USA", "Germany", "Singapore"]),
            "email": fake.company_email(),
            "phone": fake.phone_number()[:20],
            "status": status,
            "payment_terms_days": random.choice([15, 30, 45, 60, 90]),
        })
    return vendors


def make_pos(vendor_id: str, category: str, n: int) -> list[dict]:
    pos = []
    base_amount = np.random.lognormal(mean=11, sigma=1.2)  # ~INR 60k median
    for i in range(n):
        order_date = fake.date_time_between(start_date="-2y", end_date="now")
        pos.append({
            "po_number": f"PO-{fake.unique.random_number(digits=8)}",
            "vendor_id": vendor_id,
            "status": random.choices(
                [POStatus.confirmed, POStatus.received, POStatus.cancelled],
                weights=[20, 70, 10]
            )[0],
            "category": category,
            "amount": round(base_amount * random.uniform(0.6, 1.5), 2),
            "currency": "INR",
            "order_date": order_date,
            "expected_delivery": order_date + timedelta(days=random.randint(7, 45)),
            "description": fake.bs().capitalize(),
        })
    return pos


def make_invoices(vendor_id: str, po: dict, inject_anomaly: bool, inject_duplicate: bool) -> list[dict]:
    invoices = []
    # Normal invoice
    base_amount = po["amount"] * random.uniform(0.95, 1.05)

    if inject_anomaly:
        # Spike: 3–6x normal
        invoice_amount = base_amount * random.uniform(3.0, 6.0)
    else:
        invoice_amount = base_amount

    invoice_date = po["order_date"] + timedelta(days=random.randint(1, 30))
    invoices.append({
        "invoice_number": f"INV-{fake.unique.random_number(digits=8)}",
        "vendor_id": vendor_id,
        "purchase_order_id": po.get("_id"),
        "status": random.choices(
            [InvoiceStatus.posted, InvoiceStatus.paid, InvoiceStatus.draft],
            weights=[30, 60, 10]
        )[0],
        "amount": round(invoice_amount, 2),
        "currency": "INR",
        "invoice_date": invoice_date,
        "due_date": invoice_date + timedelta(days=po.get("payment_terms_days", 30)),
        "description": f"Invoice for {po['description']}",
    })

    # Duplicate injection
    if inject_duplicate:
        dup = invoices[0].copy()
        dup["invoice_number"] = f"INV-{fake.unique.random_number(digits=8)}"
        dup["invoice_date"] = invoices[0]["invoice_date"] + timedelta(days=random.randint(0, 5))
        invoices.append(dup)

    return invoices


def make_contracts(vendor_id: str, category: str) -> list[dict]:
    contracts = []
    n = random.randint(1, 3)
    for _ in range(n):
        start = fake.date_time_between(start_date="-3y", end_date="-1y")
        duration_days = random.choice([180, 365, 730])
        end = start + timedelta(days=duration_days)
        expiry_soon = random.random() < 0.15  # 15% expiring within 30 days
        if expiry_soon:
            end = datetime.utcnow() + timedelta(days=random.randint(1, 29))

        contracts.append({
            "vendor_id": vendor_id,
            "title": f"{category} Services Agreement — {fake.company()}",
            "contract_value": round(random.uniform(100_000, 5_000_000), 2),
            "currency": "INR",
            "start_date": start,
            "end_date": end,
            "auto_renew": random.random() < 0.3,
            "terms": (
                f"This agreement is between {fake.company()} (Client) and the Vendor for the provision of {category} services. "
                f"The contract value is INR {round(random.uniform(100_000, 5_000_000), 2):,.2f}. "
                f"Payment terms: Net {random.choice([30, 45, 60])} days from invoice date. "
                f"Scope of work: {fake.paragraph(nb_sentences=3)} "
                f"SLA: {random.randint(95, 99)}% uptime guaranteed. "
                f"Penalty clause: {random.randint(1, 5)}% of contract value for breach. "
                f"Jurisdiction: {random.choice(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'])} courts."
            ),
        })
    return contracts


def seed(clear: bool = False):
    print("Initialising database...")
    init_db()

    with db_session() as db:
        if clear:
            print("Clearing existing data...")
            for model in [Invoice, PurchaseOrder, Contract, Vendor]:
                db.query(model).delete()
            db.commit()

        existing = db.query(Vendor).count()
        if existing > 0:
            print(f"Database already has {existing} vendors. Use --clear to reseed.")
            return

        print(f"Seeding {VENDOR_COUNTS} vendors...")
        vendor_dicts = make_vendors(VENDOR_COUNTS)
        vendor_objs = []
        for v in vendor_dicts:
            obj = Vendor(**v)
            db.add(obj)
            db.flush()
            vendor_objs.append(obj)

        print("Seeding purchase orders, invoices, and contracts...")
        for vendor in vendor_objs:
            n_pos = random.randint(*PO_PER_VENDOR)
            po_dicts = make_pos(vendor.id, vendor.category, n_pos)
            po_objs = []
            for p in po_dicts:
                obj = PurchaseOrder(**{k: v for k, v in p.items() if k != "_id"})
                obj.vendor = vendor
                db.add(obj)
                db.flush()
                p["_id"] = obj.id
                po_objs.append((p, obj))

            for p, po_obj in po_objs:
                inject_anomaly = random.random() < INVOICE_ANOMALY_RATE
                inject_dup = random.random() < DUPLICATE_RATE
                p["payment_terms_days"] = vendor.payment_terms_days
                inv_dicts = make_invoices(vendor.id, p, inject_anomaly, inject_dup)
                for inv in inv_dicts:
                    inv_obj = Invoice(**inv)
                    db.add(inv_obj)

            for c in make_contracts(vendor.id, vendor.category):
                db.add(Contract(**c))

        db.commit()

    print("✓ Synthetic data seeded successfully.")
    print(f"  Vendors: {VENDOR_COUNTS}")
    print(f"  Purchase orders: ~{VENDOR_COUNTS * sum(PO_PER_VENDOR) // 2}")
    print(f"  Anomaly rate: {INVOICE_ANOMALY_RATE * 100:.0f}%")
    print(f"  Duplicate rate: {DUPLICATE_RATE * 100:.0f}%")


if __name__ == "__main__":
    import sys
    seed(clear="--clear" in sys.argv)

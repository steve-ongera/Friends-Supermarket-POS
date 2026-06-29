"""
core/management/commands/seed_demo_data.py

Fast seed — uses bulk_create throughout. Completes in ~30-60 seconds.
Flushes existing demo data automatically before seeding.

Usage:
    python manage.py seed_demo_data
"""

import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from core.models import (
    Category, Package, Product, Sale, SaleItem,
    SalesSession, StockMovement, Subscription, Supermarket,
)

User = get_user_model()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DAYS_BACK   = 90
DAILY_MIN   = 5
DAILY_MAX   = 12
WEEKEND_MIN = 12
WEEKEND_MAX = 22
MAX_ITEMS   = 4
BATCH_SIZE  = 500

# ---------------------------------------------------------------------------
# All subscription packages
# ---------------------------------------------------------------------------
PACKAGES = [
    {
        "name": "Poa",
        "description": "Trial users & kiosks. Perfect for getting started.",
        "daily_free_sales": 10,
        "unlock_price": Decimal("5.00"),
        "session_duration_hours": 1,
    },
    {
        "name": "Chapaa",
        "description": "Small kiosks. A quick top-up for light trading.",
        "daily_free_sales": 20,
        "unlock_price": Decimal("10.00"),
        "session_duration_hours": 3,
    },
    {
        "name": "Biashara",
        "description": "Small retail shops. Covers a full working shift.",
        "daily_free_sales": 50,
        "unlock_price": Decimal("20.00"),
        "session_duration_hours": 8,
    },
    {
        "name": "Mzinga",
        "description": "Busy businesses. Full-day unlimited throughput.",
        "daily_free_sales": 100,
        "unlock_price": Decimal("50.00"),
        "session_duration_hours": 24,
    },
    {
        "name": "Weekend Pass",
        "description": "Weekend traders. Unlimited sales across 3 days.",
        "daily_free_sales": None,
        "unlock_price": Decimal("120.00"),
        "session_duration_hours": 72,
    },
    {
        "name": "Weekly Plus",
        "description": "Growing businesses. Unlimited sales for a full week.",
        "daily_free_sales": None,
        "unlock_price": Decimal("250.00"),
        "session_duration_hours": 168,
    },
    {
        "name": "Business Pro",
        "description": "Monthly subscription. Unlimited sales for 30 days.",
        "daily_free_sales": None,
        "unlock_price": Decimal("800.00"),
        "session_duration_hours": 720,
    },
    {
        "name": "Business Elite",
        "description": "Annual subscription. Unlimited sales for a full year.",
        "daily_free_sales": None,
        "unlock_price": Decimal("8000.00"),
        "session_duration_hours": 8760,
    },
    {
        "name": "Bazooka Enterprise",
        "description": "Supermarkets & multi-branch businesses. Custom pricing — contact sales.",
        "daily_free_sales": None,
        "unlock_price": Decimal("0.00"),   # custom — set per client
        "session_duration_hours": 8760,
    },
]

# ---------------------------------------------------------------------------
# Demo businesses  (all use Business Pro — unlimited, so sales never block)
# ---------------------------------------------------------------------------
SUPERMARKETS = [
    {
        "name": "Quickmart Westlands",
        "phone": "0700111001",
        "email": "westlands@quickmart.co.ke",
        "location": "Westlands, Nairobi",
        "username": "qm_westlands",
        "password": "password123",
        "first_name": "James", "last_name": "Kariuki",
    },
    {
        "name": "Naivas Ngong Road",
        "phone": "0700222002",
        "email": "ngong@naivas.co.ke",
        "location": "Ngong Road, Nairobi",
        "username": "naivas_ngong",
        "password": "password123",
        "first_name": "Grace", "last_name": "Wanjiku",
    },
    {
        "name": "Choppies Mombasa Road",
        "phone": "0700333003",
        "email": "mombasa@choppies.co.ke",
        "location": "Mombasa Road, Nairobi",
        "username": "choppies_mbsa",
        "password": "password123",
        "first_name": "Ali", "last_name": "Hassan",
    },
]

# ---------------------------------------------------------------------------
# 30 realistic Kenyan supermarket products
# (category, name, cost_kes, selling_kes, unit)
# ---------------------------------------------------------------------------
CATALOGUE = [
    ("Dairy & Eggs",    "Brookside Fresh Milk 1L",        100, 130, "pcs"),
    ("Dairy & Eggs",    "KCC Butter 250g",                180, 230, "pcs"),
    ("Dairy & Eggs",    "Fresha Eggs Tray 30",            350, 430, "tray"),
    ("Dairy & Eggs",    "Daima Yoghurt 500ml",            120, 155, "pcs"),
    ("Bread & Bakery",  "Festive Sliced White Bread",      50,  65, "pcs"),
    ("Bread & Bakery",  "Supa Loaf Brown Bread",           55,  70, "pcs"),
    ("Grains & Flours", "Unga Dola Maize Flour 2kg",      130, 165, "pcs"),
    ("Grains & Flours", "Basmati Rice 1kg",               150, 200, "kg"),
    ("Grains & Flours", "Pishori Rice 5kg",               700, 900, "pcs"),
    ("Cooking Oils",    "Elianto Sunflower Oil 1L",       200, 260, "pcs"),
    ("Cooking Oils",    "Rina Cooking Oil 2L",            380, 480, "pcs"),
    ("Cooking Oils",    "Kimbo Cooking Fat 500g",         140, 185, "pcs"),
    ("Sugar & Spices",  "Mumias Sugar 2kg",               255, 320, "pcs"),
    ("Sugar & Spices",  "Kensalt Iodised Salt 500g",       45,  60, "pcs"),
    ("Sugar & Spices",  "Royco Mchuzi Mix 75g",            35,  50, "pcs"),
    ("Tea & Coffee",    "Ketepa Pride Tea 100 bags",      200, 260, "pcs"),
    ("Tea & Coffee",    "Africafe Instant Coffee 50g",    180, 230, "pcs"),
    ("Beverages",       "Keringet Water 500ml",            30,  40, "pcs"),
    ("Beverages",       "Coca Cola 500ml",                 55,  75, "pcs"),
    ("Beverages",       "Delmonte Juice Mango 1L",        150, 195, "pcs"),
    ("Personal Care",   "Colgate Toothpaste 75ml",         80, 110, "pcs"),
    ("Personal Care",   "Dettol Bar Soap 175g",            80, 105, "pcs"),
    ("Personal Care",   "Nivea Body Lotion 200ml",        350, 450, "pcs"),
    ("Household",       "Ariel Detergent 1kg",            300, 390, "pcs"),
    ("Household",       "Jik Bleach 1L",                  160, 210, "pcs"),
    ("Household",       "Toilet Paper Softex 4-roll",     140, 185, "pcs"),
    ("Snacks",          "Pringles Original 110g",         180, 230, "pcs"),
    ("Snacks",          "Digestive Biscuits 400g",        130, 170, "pcs"),
    ("Canned Foods",    "Kenshero Sardines 425g",          90, 120, "pcs"),
    ("Canned Foods",    "Indomie Noodles Chicken 70g",     25,  35, "pcs"),
]

PAYMENT_METHODS = ["CASH", "MPESA", "CARD"]
PAYMENT_WEIGHTS = [0.55, 0.35, 0.10]


class Command(BaseCommand):
    help = "Fast-seeds packages, 3 demo supermarkets, products + 3 months of sales."

    def handle(self, *args, **options):
        self._flush()
        self._seed_packages()
        demo_package = Package.objects.get(name="Business Pro")

        for sm_data in SUPERMARKETS:
            self.stdout.write(f"\n── {sm_data['name']} ──")
            supermarket, cashier, session = self._create_supermarket(sm_data, demo_package)
            products = self._seed_products(supermarket)
            self._seed_sales(supermarket, cashier, session, products)

        self.stdout.write(self.style.SUCCESS("\n✓ Done."))

    # -----------------------------------------------------------------------
    # Flush all demo data first
    # -----------------------------------------------------------------------
    def _flush(self):
        names     = [s["name"]     for s in SUPERMARKETS]
        usernames = [s["username"] for s in SUPERMARKETS]
        sm_count, _ = Supermarket.objects.filter(name__in=names).delete()
        u_count,  _ = User.objects.filter(username__in=usernames).delete()
        self.stdout.write(
            self.style.WARNING(
                f"Flushed {sm_count} supermarket(s) + {u_count} user(s) "
                f"and all cascaded data.\n"
            )
        )

    # -----------------------------------------------------------------------
    # Seed all 9 packages (upsert — safe to re-run)
    # -----------------------------------------------------------------------
    def _seed_packages(self):
        created = updated = 0
        for data in PACKAGES:
            _, is_new = Package.objects.update_or_create(
                name=data["name"],
                defaults={
                    "description":            data["description"],
                    "daily_free_sales":       data["daily_free_sales"],
                    "unlock_price":           data["unlock_price"],
                    "session_duration_hours": data["session_duration_hours"],
                    "is_active":              True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Packages: {created} created, {updated} updated.\n"
            )
        )
        # Pretty summary table
        self.stdout.write(
            f"  {'Package':<22} {'Sales':>8}  {'Price (KES)':>12}  {'Hours':>6}"
        )
        self.stdout.write("  " + "-" * 54)
        for p in Package.objects.filter(
            name__in=[d["name"] for d in PACKAGES]
        ).order_by("unlock_price"):
            limit = str(p.daily_free_sales) if p.daily_free_sales else "Unlimited"
            price = f"{p.unlock_price}" if p.unlock_price > 0 else "Custom"
            self.stdout.write(
                f"  {p.name:<22} {limit:>8}  {price:>12}  {p.session_duration_hours:>6}h"
            )

    # -----------------------------------------------------------------------
    # Supermarket + owner + subscription + session
    # -----------------------------------------------------------------------
    def _create_supermarket(self, data, package):
        slug = slugify(data["name"])
        supermarket = Supermarket.objects.create(
            name=data["name"], slug=slug,
            phone_number=data["phone"], email=data["email"],
            location=data["location"],
        )

        owner = User(
            username=data["username"], email=data["email"],
            first_name=data["first_name"], last_name=data["last_name"],
            role=User.Role.OWNER, supermarket=supermarket,
        )
        owner.set_password(data["password"])
        owner.save()

        # Business Pro = unlimited, so demo sales are never gated
        Subscription.objects.create(
            supermarket=supermarket, package=package,
            sales_allocated=0, sales_remaining=0,
            status=Subscription.Status.ACTIVE,
            started_at=timezone.now(),
        )

        session = SalesSession.objects.create(
            supermarket=supermarket, cashier=owner,
            package=package, sales_limit=None,
            status=SalesSession.Status.ACTIVE,
        )

        self.stdout.write(f"  ✓ Supermarket + owner created")
        return supermarket, owner, session

    # -----------------------------------------------------------------------
    # Products — single bulk_create
    # -----------------------------------------------------------------------
    def _seed_products(self, supermarket):
        category_cache = {}
        to_create = []

        for (cat_name, name, cost, selling, unit) in CATALOGUE:
            if cat_name not in category_cache:
                cat, _ = Category.objects.get_or_create(
                    supermarket=supermarket, name=cat_name
                )
                category_cache[cat_name] = cat

            to_create.append(Product(
                id=uuid.uuid4(),
                supermarket=supermarket,
                category=category_cache[cat_name],
                name=name,
                barcode=uuid.uuid4().hex[:12].upper(),
                unit=unit,
                cost_price=Decimal(str(cost)),
                selling_price=Decimal(str(selling)),
                quantity_in_stock=Decimal(str(random.randint(50, 200))),
                reorder_level=Decimal("10.00"),
                is_active=True,
            ))

        products = Product.objects.bulk_create(to_create)
        self.stdout.write(f"  ✓ {len(products)} products created")
        return products

    # -----------------------------------------------------------------------
    # Sales — build in memory, then 3 bulk_create passes
    # -----------------------------------------------------------------------
    def _seed_sales(self, supermarket, cashier, session, products):
        now   = timezone.now()
        start = now - timedelta(days=DAYS_BACK)

        sales_buf = []
        items_buf = []
        moves_buf = []
        seen      = set()
        total     = 0

        current = start
        while current <= now:
            dow   = current.weekday()
            count = (
                random.randint(WEEKEND_MIN, WEEKEND_MAX)
                if dow >= 5
                else random.randint(DAILY_MIN, DAILY_MAX)
            )

            for _ in range(count):
                sale_time = current.replace(
                    hour=random.randint(7, 20),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59),
                )
                if sale_time > now:
                    continue

                while True:
                    rcpt = f"RCPT-{uuid.uuid4().hex[:10].upper()}"
                    if rcpt not in seen:
                        seen.add(rcpt)
                        break

                method   = random.choices(PAYMENT_METHODS, PAYMENT_WEIGHTS)[0]
                sale_id  = uuid.uuid4()
                chosen   = random.sample(products, random.randint(1, MAX_ITEMS))
                subtotal = Decimal("0.00")

                for product in chosen:
                    qty        = Decimal(str(random.randint(1, 3)))
                    line_total = qty * product.selling_price
                    subtotal  += line_total

                    items_buf.append(SaleItem(
                        sale_id=sale_id,
                        product=product,
                        product_name=product.name,
                        barcode=product.barcode,
                        quantity=qty,
                        unit_price=product.selling_price,
                        line_total=line_total,
                    ))
                    moves_buf.append(StockMovement(
                        product=product,
                        movement_type=StockMovement.MovementType.SALE,
                        quantity=-qty,
                        note=f"Demo sale {rcpt}",
                        performed_by=cashier,
                    ))

                tendered = (
                    subtotal + Decimal(str(random.randint(0, 50)))
                    if method == "CASH" else subtotal
                )

                sales_buf.append(Sale(
                    id=sale_id,
                    supermarket=supermarket,
                    cashier=cashier,
                    session=session,
                    receipt_number=rcpt,
                    payment_method=method,
                    subtotal=subtotal,
                    discount=Decimal("0.00"),
                    tax=Decimal("0.00"),
                    total=subtotal,
                    amount_tendered=tendered,
                    change_due=max(tendered - subtotal, Decimal("0.00")),
                    status=Sale.Status.COMPLETED,
                    created_at=sale_time,
                ))
                total += 1

            current += timedelta(days=1)

        self.stdout.write(f"  · Inserting {total} sales …", ending="")
        for i in range(0, len(sales_buf), BATCH_SIZE):
            Sale.objects.bulk_create(sales_buf[i:i + BATCH_SIZE])
        self.stdout.write(" ✓")

        self.stdout.write(f"  · Inserting {len(items_buf)} line items …", ending="")
        for i in range(0, len(items_buf), BATCH_SIZE):
            SaleItem.objects.bulk_create(items_buf[i:i + BATCH_SIZE])
        self.stdout.write(" ✓")

        self.stdout.write(f"  · Inserting {len(moves_buf)} stock movements …", ending="")
        for i in range(0, len(moves_buf), BATCH_SIZE):
            StockMovement.objects.bulk_create(moves_buf[i:i + BATCH_SIZE])
        self.stdout.write(" ✓")

        SalesSession.objects.filter(pk=session.pk).update(sales_count=total)
        self.stdout.write(
            f"  ✓ {total} transactions  ({start.date()} → {now.date()})"
        )
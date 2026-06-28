"""
core/management/commands/seed_data.py

Seeds the database with ~6 months of realistic Kenyan supermarket data:
- 1 Supermarket + Subscription
- Owner, Manager, and 3 Cashiers
- Categories, Suppliers, Products (with barcodes, KES pricing)
- Daily SalesSessions per cashier (with quota lock/unlock cycles)
- Historical Sales + SaleItems spread across the last N months
- StockMovements (restocks + sale deductions)
- M-Pesa Payment records for session unlocks and MPESA sales

Usage:
    python manage.py seed_data
    python manage.py seed_data --months 6
    python manage.py seed_data --months 6 --flush
"""

import random
import uuid
from datetime import timedelta, time, datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    Supermarket,
    Package,
    Subscription,
    SalesSession,
    Payment,
    Category,
    Supplier,
    Product,
    StockMovement,
    Sale,
    SaleItem,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Static seed reference data
# ---------------------------------------------------------------------------

CASHIER_NAMES = [
    ("Achieng", "Otieno"),
    ("Wanjiru", "Kamau"),
    ("Mutiso", "Kioko"),
    ("Naliaka", "Wafula"),
    ("Cherono", "Kiprop"),
]

CATEGORY_DATA = [
    "Beverages",
    "Bakery",
    "Dairy & Eggs",
    "Cereals & Grains",
    "Household Essentials",
    "Personal Care",
    "Snacks & Confectionery",
    "Fresh Produce",
    "Meat & Poultry",
    "Cleaning Supplies",
]

SUPPLIER_DATA = [
    ("Brookside Dairy Ltd", "0722111222"),
    ("Unga Group Suppliers", "0733222333"),
    ("Kapa Oil Refineries", "0711333444"),
    ("Tropical Heat Distributors", "0700444555"),
    ("Coca-Cola Nairobi Bottlers", "0722555666"),
    ("Kenafric Industries", "0733666777"),
    ("Bidco Africa Distributors", "0711777888"),
    ("Wakulima Fresh Produce", "0700888999"),
]

# (name, category index, unit, cost_price, selling_price)
PRODUCT_DATA = [
    ("Fresh Milk 500ml", 2, "pcs", 45, 55),
    ("Brookside Yoghurt 250ml", 2, "pcs", 50, 65),
    ("Large Eggs Tray (30pcs)", 2, "tray", 360, 420),
    ("White Bread 400g", 1, "pcs", 55, 65),
    ("Brown Bread 400g", 1, "pcs", 60, 70),
    ("Digestive Biscuits 250g", 5, "pcs", 80, 100),
    ("Soda 500ml (Coca-Cola)", 0, "pcs", 45, 60),
    ("Soda 2L (Fanta)", 0, "pcs", 120, 150),
    ("Mineral Water 1L", 0, "pcs", 40, 55),
    ("Unga wa Ngano 2kg", 3, "pcs", 180, 210),
    ("Unga wa Sembe 2kg", 3, "pcs", 140, 165),
    ("Rice Pishori 2kg", 3, "pcs", 280, 330),
    ("Cooking Oil 2L (Fresh Fri)", 4, "pcs", 480, 540),
    ("Sugar 2kg", 4, "pcs", 260, 300),
    ("Salt 1kg", 4, "pcs", 35, 45),
    ("Bar Soap 800g", 5, "pcs", 130, 160),
    ("Toothpaste 100ml", 5, "pcs", 110, 140),
    ("Toilet Tissue 4-pack", 5, "pack", 150, 190),
    ("Sanitary Pads (Pack of 8)", 5, "pack", 95, 120),
    ("Potato Crisps 100g", 6, "pcs", 60, 80),
    ("Chocolate Bar 50g", 6, "pcs", 70, 90),
    ("Tomatoes 1kg", 7, "kg", 60, 90),
    ("Onions 1kg", 7, "kg", 70, 100),
    ("Sukuma Wiki Bunch", 7, "pcs", 15, 25),
    ("Bananas 1kg", 7, "kg", 50, 70),
    ("Chicken Whole (1.5kg)", 8, "pcs", 450, 550),
    ("Beef 1kg", 8, "kg", 480, 600),
    ("Sausages 500g Pack", 8, "pack", 220, 270),
    ("Dishwashing Liquid 500ml", 9, "pcs", 90, 120),
    ("Bleach 1L (Jik)", 9, "pcs", 100, 130),
    ("Laundry Detergent 1kg (Omo)", 9, "pcs", 220, 260),
]

PAYMENT_METHOD_WEIGHTS = [
    ("CASH", 0.50),
    ("MPESA", 0.42),
    ("CARD", 0.08),
]


def weighted_choice(choices):
    methods, weights = zip(*choices)
    return random.choices(methods, weights=weights, k=1)[0]


def random_business_time(day):
    """Random datetime during business hours (7am - 9pm) for a given date."""
    hour = random.randint(7, 20)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    naive = datetime.combine(day, time(hour, minute, second))
    return timezone.make_aware(naive)


class Command(BaseCommand):
    help = "Seed the database with ~6 months of realistic Kenyan supermarket POS data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--months", type=int, default=6, help="Number of months of history to generate (default: 6)"
        )
        parser.add_argument(
            "--flush", action="store_true", help="Delete existing seed-related data before generating new data."
        )
        parser.add_argument(
            "--max-sales-per-day", type=int, default=35,
            help="Upper bound of sales generated per cashier per day (default: 35)",
        )

    def handle(self, *args, **options):
        months = options["months"]
        flush = options["flush"]
        max_sales_per_day = options["max_sales_per_day"]

        if flush:
            self.stdout.write(self.style.WARNING("Flushing existing data..."))
            self._flush_data()

        with transaction.atomic():
            supermarket, package = self._create_supermarket_and_package()
            owner, manager, cashiers = self._create_staff(supermarket)
            categories = self._create_categories(supermarket)
            suppliers = self._create_suppliers(supermarket)
            products = self._create_products(supermarket, categories, suppliers)

        self.stdout.write(self.style.SUCCESS(
            f"Created supermarket '{supermarket.name}' with {len(products)} products, "
            f"{len(cashiers)} cashiers."
        ))

        self._generate_sales_history(
            supermarket=supermarket,
            package=package,
            cashiers=cashiers,
            products=products,
            months=months,
            max_sales_per_day=max_sales_per_day,
        )

        self.stdout.write(self.style.SUCCESS("✅ Seed data generation complete."))

    # -----------------------------------------------------------------
    # Setup helpers
    # -----------------------------------------------------------------

    def _flush_data(self):
        Payment.objects.all().delete()
        SaleItem.objects.all().delete()
        Sale.objects.all().delete()
        SalesSession.objects.all().delete()
        StockMovement.objects.all().delete()
        Product.objects.all().delete()
        Supplier.objects.all().delete()
        Category.objects.all().delete()
        Subscription.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        Supermarket.objects.all().delete()
        Package.objects.all().delete()

    def _create_supermarket_and_package(self):
        package, _ = Package.objects.get_or_create(
            name="Free Daily Tier",
            defaults={
                "description": "20 free sales per session, KES 100 to unlock a new session via M-Pesa.",
                "daily_free_sales": 20,
                "unlock_price": Decimal("100.00"),
                "session_duration_hours": 24,
            },
        )

        supermarket, _ = Supermarket.objects.get_or_create(
            slug="friends-supermarket-nairobi",
            defaults={
                "name": "Friends Supermarket",
                "location": "Buruburu, Nairobi",
                "phone_number": "0712345678",
                "email": "info@friendssupermarket.co.ke",
                "kra_pin": "P051234567A",
                "mpesa_shortcode": "174379",
                "is_active": True,
            },
        )

        Subscription.objects.get_or_create(
            supermarket=supermarket, defaults={"package": package, "is_active": True}
        )

        return supermarket, package

    def _create_staff(self, supermarket):
        owner, created = User.objects.get_or_create(
            username="owner_friends",
            defaults={
                "first_name": "Daniel",
                "last_name": "Mwangi",
                "email": "owner@friendssupermarket.co.ke",
                "phone_number": "0712345678",
                "role": User.Role.OWNER,
                "supermarket": supermarket,
            },
        )
        if created:
            owner.set_password("password123")
            owner.save()

        manager, created = User.objects.get_or_create(
            username="manager_friends",
            defaults={
                "first_name": "Grace",
                "last_name": "Njoki",
                "email": "manager@friendssupermarket.co.ke",
                "phone_number": "0722334455",
                "role": User.Role.MANAGER,
                "supermarket": supermarket,
            },
        )
        if created:
            manager.set_password("password123")
            manager.save()

        cashiers = []
        for i, (first, last) in enumerate(CASHIER_NAMES, start=1):
            username = f"cashier{i}_{first.lower()}"
            cashier, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"{username}@friendssupermarket.co.ke",
                    "phone_number": f"07{random.randint(10000000, 99999999)}",
                    "role": User.Role.CASHIER,
                    "supermarket": supermarket,
                },
            )
            if created:
                cashier.set_password("password123")
                cashier.save()
            cashiers.append(cashier)

        return owner, manager, cashiers

    def _create_categories(self, supermarket):
        categories = []
        for name in CATEGORY_DATA:
            category, _ = Category.objects.get_or_create(supermarket=supermarket, name=name)
            categories.append(category)
        return categories

    def _create_suppliers(self, supermarket):
        suppliers = []
        for name, phone in SUPPLIER_DATA:
            supplier, _ = Supplier.objects.get_or_create(
                supermarket=supermarket,
                name=name,
                defaults={"phone_number": phone, "address": "Nairobi, Kenya"},
            )
            suppliers.append(supplier)
        return suppliers

    def _create_products(self, supermarket, categories, suppliers):
        products = []
        for name, cat_index, unit, cost, price in PRODUCT_DATA:
            barcode = f"6{random.randint(100000000000, 999999999999)}"
            product, created = Product.objects.get_or_create(
                supermarket=supermarket,
                name=name,
                defaults={
                    "category": categories[cat_index],
                    "supplier": random.choice(suppliers),
                    "barcode": barcode,
                    "unit": unit,
                    "cost_price": Decimal(cost),
                    "selling_price": Decimal(price),
                    "quantity_in_stock": Decimal(random.randint(80, 250)),
                    "reorder_level": Decimal(random.randint(10, 25)),
                },
            )
            if created:
                StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.MovementType.RESTOCK,
                    quantity=product.quantity_in_stock,
                    note="Initial stock seed",
                )
            products.append(product)
        return products

    # -----------------------------------------------------------------
    # Historical sales generation
    # -----------------------------------------------------------------

    def _generate_sales_history(self, supermarket, package, cashiers, products, months, max_sales_per_day):
        today = timezone.localdate()
        start_date = today - timedelta(days=30 * months)
        total_days = (today - start_date).days

        self.stdout.write(self.style.NOTICE(
            f"Generating {total_days} days of sales history "
            f"({start_date} -> {today}) for {len(cashiers)} cashiers..."
        ))

        receipt_counter = 0
        payment_counter = 0

        for day_offset in range(total_days):
            day = start_date + timedelta(days=day_offset)

            # Skip ~1 in 20 days to simulate closures (e.g. public holidays)
            if random.random() < 0.05:
                continue

            for cashier in cashiers:
                num_sales_today = random.randint(5, max_sales_per_day)
                receipt_counter, payment_counter = self._generate_day_for_cashier(
                    supermarket=supermarket,
                    package=package,
                    cashier=cashier,
                    products=products,
                    day=day,
                    num_sales=num_sales_today,
                    receipt_counter=receipt_counter,
                    payment_counter=payment_counter,
                )

            if day_offset % 30 == 0:
                self.stdout.write(f"  ...processed up to {day} ({day_offset}/{total_days} days)")

        self.stdout.write(self.style.SUCCESS(
            f"Generated {receipt_counter} sales and {payment_counter} M-Pesa session-unlock payments."
        ))

    def _generate_day_for_cashier(
        self, supermarket, package, cashier, products, day, num_sales, receipt_counter, payment_counter
    ):
        sales_limit = package.daily_free_sales
        session = SalesSession.objects.create(
            supermarket=supermarket,
            cashier=cashier,
            package=package,
            sales_limit=sales_limit,
            status=SalesSession.Status.ACTIVE,
        )
        # Backdate the session start to the simulated day
        session.started_at = random_business_time(day)
        session.save(update_fields=["started_at"])

        for _ in range(num_sales):
            # If quota exhausted, simulate an M-Pesa unlock payment + new session
            if session.sales_count >= session.sales_limit:
                payment_counter += 1
                payment = Payment.objects.create(
                    supermarket=supermarket,
                    initiated_by=cashier,
                    purpose=Payment.Purpose.SESSION_UNLOCK,
                    amount=package.unlock_price,
                    phone_number=cashier.phone_number or "0700000000",
                    status=Payment.Status.SUCCESS,
                    mpesa_receipt_number=f"S{uuid.uuid4().hex[:8].upper()}",
                    result_code="0",
                    result_desc="The service request is processed successfully.",
                )
                payment.created_at = random_business_time(day)
                payment.save(update_fields=["created_at"])

                session.status = SalesSession.Status.LOCKED
                session.locked_at = payment.created_at
                session.save(update_fields=["status", "locked_at"])

                session = SalesSession.objects.create(
                    supermarket=supermarket,
                    cashier=cashier,
                    package=package,
                    sales_limit=sales_limit,
                    status=SalesSession.Status.ACTIVE,
                    unlocked_by_payment=payment,
                )
                session.started_at = payment.created_at
                session.save(update_fields=["started_at"])

            receipt_counter += 1
            self._create_sale(supermarket, cashier, session, products, day)
            session.sales_count += 1
            if session.sales_count >= session.sales_limit:
                session.status = SalesSession.Status.LOCKED
                session.locked_at = timezone.now()
            session.save(update_fields=["sales_count", "status", "locked_at"])

        return receipt_counter, payment_counter

    def _create_sale(self, supermarket, cashier, session, products, day):
        sale_time = random_business_time(day)
        payment_method = weighted_choice(PAYMENT_METHOD_WEIGHTS)

        num_items = random.randint(1, 6)
        chosen_products = random.sample(products, k=min(num_items, len(products)))

        sale = Sale(
            supermarket=supermarket,
            cashier=cashier,
            session=session,
            payment_method=payment_method,
            status=Sale.Status.COMPLETED,
            customer_phone=f"07{random.randint(10000000, 99999999)}" if random.random() < 0.3 else "",
        )
        sale.created_at = sale_time
        sale.save()

        subtotal = Decimal("0.00")
        sale_items = []
        for product in chosen_products:
            quantity = Decimal(random.randint(1, 4))
            line_total = quantity * product.selling_price
            subtotal += line_total

            sale_items.append(
                SaleItem(
                    sale=sale,
                    product=product,
                    product_name=product.name,
                    barcode=product.barcode,
                    quantity=quantity,
                    unit_price=product.selling_price,
                    line_total=line_total,
                )
            )

            # Deduct stock (allow restock top-up if running low, to keep numbers plausible)
            if product.quantity_in_stock < quantity:
                restock_qty = Decimal(random.randint(50, 150))
                product.quantity_in_stock += restock_qty
                StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.MovementType.RESTOCK,
                    quantity=restock_qty,
                    note="Auto-restock during seed simulation",
                    performed_by=cashier,
                )

            product.quantity_in_stock -= quantity
            product.save(update_fields=["quantity_in_stock"])

            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.MovementType.SALE,
                quantity=-quantity,
                note=f"Sold via receipt {sale.receipt_number}",
                performed_by=cashier,
            )

        SaleItem.objects.bulk_create(sale_items)

        discount = Decimal("0.00")
        tax = Decimal("0.00")
        total = subtotal - discount + tax

        amount_tendered = None
        change_due = Decimal("0.00")
        if payment_method == "CASH":
            # Round up tendered amount to a "natural" denomination
            denominations = [50, 100, 200, 500, 1000]
            amount_tendered = next((d for d in denominations if d >= total), total)
            amount_tendered = Decimal(amount_tendered)
            change_due = max(amount_tendered - total, Decimal("0.00"))

        sale.subtotal = subtotal
        sale.discount = discount
        sale.tax = tax
        sale.total = total
        sale.amount_tendered = amount_tendered
        sale.change_due = change_due
        sale.save(update_fields=["subtotal", "discount", "tax", "total", "amount_tendered", "change_due"])

        # Link an M-Pesa Payment record for MPESA-paid sales
        if payment_method == "MPESA":
            Payment.objects.create(
                supermarket=supermarket,
                initiated_by=cashier,
                purpose=Payment.Purpose.OTHER,
                amount=total,
                phone_number=sale.customer_phone or f"07{random.randint(10000000, 99999999)}",
                status=Payment.Status.SUCCESS,
                mpesa_receipt_number=f"R{uuid.uuid4().hex[:8].upper()}",
                result_code="0",
                result_desc="The service request is processed successfully.",
            )

        return sale
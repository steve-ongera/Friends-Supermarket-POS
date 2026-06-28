"""
core/models.py
Friends Supermarket POS & Inventory SaaS
-----------------------------------------
Single core app containing all models for:
- Multi-business (supermarket) accounts
- Staff / cashier management
- Subscription packages billed per sales-session (pay-to-unlock model)
- M-Pesa STK Push payment tracking
- Inventory (categories, products, barcode, stock)
- Sales / POS transactions with QR-coded receipts
- Stock movement audit trail
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_receipt_number():
    return f"RCPT-{uuid.uuid4().hex[:10].upper()}"


def generate_reference_code():
    return uuid.uuid4().hex[:12].upper()


# ---------------------------------------------------------------------------
# Tenant / Business
# ---------------------------------------------------------------------------

class Supermarket(models.Model):
    """A registered business (tenant) using the POS system."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True)
    location = models.CharField(max_length=200, blank=True)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    kra_pin = models.CharField(max_length=20, blank=True, help_text="KRA PIN for receipts")
    logo = models.ImageField(upload_to="supermarket_logos/", blank=True, null=True)

    mpesa_shortcode = models.CharField(max_length=15, blank=True, help_text="Till/Paybill for receiving customer payments (optional)")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Users / Staff
# ---------------------------------------------------------------------------

class User(AbstractUser):
    """Custom user. Owners manage the business; Cashiers operate the POS."""

    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        MANAGER = "MANAGER", "Manager"
        CASHIER = "CASHIER", "Cashier"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supermarket = models.ForeignKey(
        Supermarket, on_delete=models.CASCADE, related_name="staff", null=True, blank=True
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CASHIER)
    phone_number = models.CharField(max_length=20, blank=True)
    is_locked = models.BooleanField(default=False, help_text="Locked when daily free sales quota is exhausted")

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


# ---------------------------------------------------------------------------
# Subscription Packages & Billing (pay-per-session unlock model)
# ---------------------------------------------------------------------------

class Package(models.Model):
    """
    Defines a billing tier, e.g.:
    'Free Daily Tier' -> 20 sales/day, then KES 100 to unlock a new session.
    """

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    daily_free_sales = models.PositiveIntegerField(
        default=20,
        null=True,
        blank=True,
        help_text="Sales allowed before lock. Leave blank for unlimited (no lock ever applied).",
    )
    unlock_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("100.00"))
    session_duration_hours = models.PositiveIntegerField(
        default=24, help_text="Validity of an unlocked session, in hours"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.daily_free_sales} sales/day, KES {self.unlock_price} to unlock)"


class Subscription(models.Model):
    """A supermarket's active package subscription."""

    supermarket = models.OneToOneField(Supermarket, on_delete=models.CASCADE, related_name="subscription")
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name="subscriptions")
    started_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.supermarket.name} -> {self.package.name}"


class SalesSession(models.Model):
    """
    Tracks a cashier's daily sales quota usage.
    Once `sales_count` reaches the package's daily_free_sales limit,
    the session is locked and a Payment is required to unlock a new one.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        LOCKED = "LOCKED", "Locked - quota exhausted"
        EXPIRED = "EXPIRED", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="sessions")
    cashier = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name="sessions")

    sales_count = models.PositiveIntegerField(default=0)
    sales_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Snapshot of package limit at session start. Null means unlimited.",
    )

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    started_at = models.DateTimeField(auto_now_add=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    unlocked_by_payment = models.ForeignKey(
        "Payment", on_delete=models.SET_NULL, null=True, blank=True, related_name="unlocked_sessions"
    )

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Session({self.cashier.username}) {self.sales_count}/{self.sales_limit} [{self.status}]"

    @property
    def is_quota_exhausted(self):
        if self.sales_limit is None:
            return False  # unlimited package — never locks
        return self.sales_count >= self.sales_limit

    def increment_sale(self):
        self.sales_count += 1
        if self.is_quota_exhausted:
            self.status = self.Status.LOCKED
            self.locked_at = timezone.now()
        self.save(update_fields=["sales_count", "status", "locked_at"])


class Payment(models.Model):
    """
    M-Pesa STK Push payment record used to unlock a new SalesSession,
    pay for a subscription, settle a POS sale, or other purposes.
    """

    class Purpose(models.TextChoices):
        SESSION_UNLOCK = "SESSION_UNLOCK", "Unlock Sales Session"
        SUBSCRIPTION = "SUBSCRIPTION", "Subscription Payment"
        SALE = "SALE", "POS Sale Payment"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="payments")
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="payments")

    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.SESSION_UNLOCK)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=15, help_text="Payer MSISDN, format 2547XXXXXXXX")

    # Which package tier this payment is unlocking (SESSION_UNLOCK only).
    # Null means "use whatever the supermarket's current subscription package is".
    package = models.ForeignKey(
        Package,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    # Daraja / STK Push fields
    merchant_request_id = models.CharField(max_length=100, blank=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    result_code = models.CharField(max_length=10, blank=True)
    result_desc = models.CharField(max_length=255, blank=True)

    reference_code = models.CharField(max_length=20, unique=True, default=generate_reference_code)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference_code} - KES {self.amount} - {self.status}"


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class Category(models.Model):
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("supermarket", "name")
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Supplier(models.Model):
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    """Inventory item, scannable via barcode at the POS."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="products")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")

    name = models.CharField(max_length=150)
    barcode = models.CharField(max_length=64, db_index=True, help_text="Scanned barcode value (EAN/UPC/Code128)")
    sku = models.CharField(max_length=50, blank=True)
    image = models.ImageField(upload_to="products/", blank=True, null=True)

    unit = models.CharField(max_length=30, default="pcs", help_text="e.g. pcs, kg, litre, pack")
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)

    quantity_in_stock = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("5.00"))

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("supermarket", "barcode")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.barcode})"

    @property
    def is_low_stock(self):
        return self.quantity_in_stock <= self.reorder_level


class StockMovement(models.Model):
    """Audit trail for every stock change (restock, sale deduction, adjustment)."""

    class MovementType(models.TextChoices):
        RESTOCK = "RESTOCK", "Restock"
        SALE = "SALE", "Sale Deduction"
        ADJUSTMENT = "ADJUSTMENT", "Manual Adjustment"
        RETURN = "RETURN", "Customer Return"
        DAMAGE = "DAMAGE", "Damage / Loss"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    movement_type = models.CharField(max_length=12, choices=MovementType.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, help_text="Positive for additions, negative for deductions")
    note = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="stock_movements")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name} {self.movement_type} {self.quantity}"


# ---------------------------------------------------------------------------
# Sales / POS Transactions
# ---------------------------------------------------------------------------

class Sale(models.Model):
    """A completed POS transaction. Generates a QR-coded receipt."""

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        MPESA = "MPESA", "M-Pesa"
        CARD = "CARD", "Card"
        MIXED = "MIXED", "Mixed"

    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        VOIDED = "VOIDED", "Voided"
        REFUNDED = "REFUNDED", "Refunded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supermarket = models.ForeignKey(Supermarket, on_delete=models.CASCADE, related_name="sales")
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sales")
    session = models.ForeignKey(SalesSession, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales")

    receipt_number = models.CharField(max_length=30, unique=True, default=generate_receipt_number)
    qr_code = models.ImageField(upload_to="receipts/qr/", blank=True, null=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    mpesa_payment = models.ForeignKey(
        Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="sale_payments"
    )
    amount_tendered = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    change_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.COMPLETED)
    customer_phone = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.receipt_number} - KES {self.total}"

    def recalculate_totals(self):
        agg = self.items.aggregate(total=models.Sum(models.F("quantity") * models.F("unit_price")))
        self.subtotal = agg["total"] or Decimal("0.00")
        self.total = self.subtotal - self.discount + self.tax
        self.save(update_fields=["subtotal", "total"])


class SaleItem(models.Model):
    """Line item within a Sale, captured from a barcode scan."""

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, related_name="sale_items")

    product_name = models.CharField(max_length=150, help_text="Snapshot in case product is later edited/deleted")
    barcode = models.CharField(max_length=64, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity or Decimal("0")) * (self.unit_price or Decimal("0"))
        if self.product and not self.product_name:
            self.product_name = self.product.name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"
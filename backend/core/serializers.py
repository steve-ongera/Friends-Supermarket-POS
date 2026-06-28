"""
core/serializers.py
Friends Supermarket POS & Inventory SaaS
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
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
# Auth / Users
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "full_name",
            "phone_number", "role", "supermarket", "is_locked", "is_active",
        ]
        read_only_fields = ["id", "is_locked"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "phone_number", "role", "supermarket", "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class RegisterSupermarketSerializer(serializers.Serializer):
    """Sign-up flow: creates a Supermarket + its Owner user + default subscription."""

    supermarket_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True)

    username = serializers.CharField(max_length=150)
    owner_email = serializers.EmailField(required=False, allow_blank=True)
    owner_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from django.utils.text import slugify

        supermarket = Supermarket.objects.create(
            name=validated_data["supermarket_name"],
            slug=slugify(validated_data["supermarket_name"]),
            phone_number=validated_data["phone_number"],
            email=validated_data.get("email", ""),
        )

        owner = User(
            username=validated_data["username"],
            email=validated_data.get("owner_email", ""),
            phone_number=validated_data.get("owner_phone", ""),
            role=User.Role.OWNER,
            supermarket=supermarket,
        )
        owner.set_password(validated_data["password"])
        owner.save()

        default_package, _ = Package.objects.get_or_create(
            name="Free Daily Tier",
            defaults={"daily_free_sales": 20, "unlock_price": Decimal("100.00")},
        )
        Subscription.objects.create(supermarket=supermarket, package=default_package)

        return {"supermarket": supermarket, "owner": owner}


# ---------------------------------------------------------------------------
# Supermarket
# ---------------------------------------------------------------------------

class SupermarketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supermarket
        fields = [
            "id", "name", "slug", "location", "phone_number", "email",
            "kra_pin", "logo", "mpesa_shortcode", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Billing: Package / Subscription / SalesSession / Payment
# ---------------------------------------------------------------------------

class PackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Package
        fields = [
            "id", "name", "description", "daily_free_sales",
            "unlock_price", "session_duration_hours", "is_active", "created_at",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    package_detail = PackageSerializer(source="package", read_only=True)

    class Meta:
        model = Subscription
        fields = ["id", "supermarket", "package", "package_detail", "started_at", "is_active"]


class SalesSessionSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source="cashier.username", read_only=True)
    remaining_sales = serializers.SerializerMethodField()

    class Meta:
        model = SalesSession
        fields = [
            "id", "supermarket", "cashier", "cashier_name", "package",
            "sales_count", "sales_limit", "remaining_sales", "status",
            "started_at", "locked_at", "expires_at", "unlocked_by_payment",
        ]
        read_only_fields = [
            "id", "sales_count", "status", "started_at", "locked_at", "unlocked_by_payment",
        ]

    def get_remaining_sales(self, obj):
        return max(obj.sales_limit - obj.sales_count, 0)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "supermarket", "initiated_by", "purpose", "amount", "phone_number",
            "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
            "result_code", "result_desc", "reference_code", "status",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "merchant_request_id", "checkout_request_id", "mpesa_receipt_number",
            "result_code", "result_desc", "reference_code", "status",
            "created_at", "updated_at",
        ]


class STKPushRequestSerializer(serializers.Serializer):
    """Input payload to trigger an M-Pesa STK Push (e.g. for session unlock)."""

    phone_number = serializers.CharField(max_length=15, help_text="2547XXXXXXXX")
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    purpose = serializers.ChoiceField(
        choices=Payment.Purpose.choices, default=Payment.Purpose.SESSION_UNLOCK
    )


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "supermarket", "name", "description", "created_at"]
        read_only_fields = ["id", "supermarket", "created_at"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "supermarket", "name", "phone_number", "email", "address", "created_at"]
        read_only_fields = ["id", "supermarket", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "supermarket", "category", "category_name", "supplier", "supplier_name",
            "name", "barcode", "sku", "image", "unit", "cost_price", "selling_price",
            "quantity_in_stock", "reorder_level", "is_low_stock", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "supermarket", "created_at", "updated_at"]


class ProductLookupSerializer(serializers.ModelSerializer):
    """Lightweight serializer for fast barcode-scan lookups at POS."""

    class Meta:
        model = Product
        fields = ["id", "name", "barcode", "selling_price", "unit", "quantity_in_stock"]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    performed_by_name = serializers.CharField(source="performed_by.username", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "movement_type", "quantity",
            "note", "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StockAdjustSerializer(serializers.Serializer):
    """Input payload for restock / manual adjustment endpoints."""

    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    movement_type = serializers.ChoiceField(choices=StockMovement.MovementType.choices)
    note = serializers.CharField(required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Sales / POS
# ---------------------------------------------------------------------------

class SaleItemInputSerializer(serializers.Serializer):
    """Used when creating a Sale — one row per scanned/added product."""

    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "barcode", "quantity", "unit_price", "line_total"]
        read_only_fields = ["id", "product_name", "barcode", "unit_price", "line_total"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    cashier_name = serializers.CharField(source="cashier.username", read_only=True, default=None)

    class Meta:
        model = Sale
        fields = [
            "id", "supermarket", "cashier", "cashier_name", "session", "receipt_number",
            "qr_code", "subtotal", "discount", "tax", "total", "payment_method",
            "mpesa_payment", "amount_tendered", "change_due", "status",
            "customer_phone", "created_at", "items",
        ]
        read_only_fields = [
            "id", "receipt_number", "qr_code", "subtotal", "total",
            "change_due", "created_at", "items",
        ]


class SaleCreateSerializer(serializers.Serializer):
    """
    Payload to create a full POS sale in one request:
    cart items (scanned barcodes/products) + payment details.
    """

    items = SaleItemInputSerializer(many=True)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    payment_method = serializers.ChoiceField(choices=Sale.PaymentMethod.choices, default=Sale.PaymentMethod.CASH)
    amount_tendered = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    customer_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value
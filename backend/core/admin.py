"""
core/admin.py
Friends Supermarket POS & Inventory SaaS — Django Admin registration
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db import models as django_models

from .models import (
    Supermarket,
    User,
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


# ---------------------------------------------------------------------------
# Tenant / Business
# ---------------------------------------------------------------------------

@admin.register(Supermarket)
class SupermarketAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "phone_number", "mpesa_shortcode", "is_active", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("name", "slug", "phone_number", "email", "kra_pin")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)


# ---------------------------------------------------------------------------
# Users / Staff
# ---------------------------------------------------------------------------

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Extends Django's built-in UserAdmin with our custom fields."""

    list_display = (
        "username", "full_name", "role", "supermarket", "phone_number",
        "is_locked", "is_active", "is_staff",
    )
    list_filter = ("role", "is_locked", "is_active", "supermarket")
    search_fields = ("username", "first_name", "last_name", "email", "phone_number")
    ordering = ("username",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Friends POS Details", {
            "fields": ("supermarket", "role", "phone_number", "is_locked"),
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Friends POS Details", {
            "fields": ("supermarket", "role", "phone_number"),
        }),
    )

    @admin.display(description="Full Name")
    def full_name(self, obj):
        return obj.get_full_name() or "-"


# ---------------------------------------------------------------------------
# Billing: Package / Subscription / SalesSession / Payment
# ---------------------------------------------------------------------------

@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("name", "daily_free_sales", "unlock_price", "session_duration_hours", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("supermarket", "package", "is_active", "started_at")
    list_filter = ("is_active", "package")
    search_fields = ("supermarket__name",)
    autocomplete_fields = ("supermarket", "package")


@admin.register(SalesSession)
class SalesSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "supermarket", "cashier", "package", "sales_count", "sales_limit",
        "status", "started_at", "locked_at",
    )
    list_filter = ("status", "supermarket", "package")
    search_fields = ("cashier__username", "supermarket__name")
    readonly_fields = ("id", "started_at", "locked_at")
    autocomplete_fields = ("supermarket", "cashier", "package", "unlocked_by_payment")
    ordering = ("-started_at",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "reference_code", "supermarket", "purpose", "amount", "phone_number",
        "status", "mpesa_receipt_number", "created_at",
    )
    list_filter = ("status", "purpose", "supermarket")
    search_fields = (
        "reference_code", "phone_number", "mpesa_receipt_number",
        "checkout_request_id", "merchant_request_id",
    )
    readonly_fields = (
        "id", "reference_code", "merchant_request_id", "checkout_request_id",
        "mpesa_receipt_number", "result_code", "result_desc", "created_at", "updated_at",
    )
    autocomplete_fields = ("supermarket", "initiated_by")
    ordering = ("-created_at",)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "supermarket", "created_at")
    list_filter = ("supermarket",)
    search_fields = ("name",)
    autocomplete_fields = ("supermarket",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "supermarket", "phone_number", "email", "created_at")
    list_filter = ("supermarket",)
    search_fields = ("name", "phone_number", "email")
    autocomplete_fields = ("supermarket",)


class LowStockFilter(admin.SimpleListFilter):
    title = "stock level"
    parameter_name = "stock_level"

    def lookups(self, request, model_admin):
        return (("low", "Low stock (at/below reorder level)"), ("ok", "Sufficient stock"))

    def queryset(self, request, queryset):
        if self.value() == "low":
            return queryset.filter(quantity_in_stock__lte=django_models.F("reorder_level"))
        if self.value() == "ok":
            return queryset.filter(quantity_in_stock__gt=django_models.F("reorder_level"))
        return queryset


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name", "barcode", "supermarket", "category", "supplier",
        "selling_price", "cost_price", "quantity_in_stock", "is_low_stock_display", "is_active",
    )
    list_filter = ("supermarket", "category", "supplier", "is_active", LowStockFilter)
    search_fields = ("name", "barcode", "sku")
    autocomplete_fields = ("supermarket", "category", "supplier")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("name",)

    @admin.display(boolean=True, description="Low Stock")
    def is_low_stock_display(self, obj):
        return obj.is_low_stock


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "performed_by", "created_at")
    list_filter = ("movement_type", "created_at")
    search_fields = ("product__name", "product__barcode", "note")
    autocomplete_fields = ("product", "performed_by")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


# ---------------------------------------------------------------------------
# Sales / POS
# ---------------------------------------------------------------------------

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("product_name", "barcode", "line_total")
    fields = ("product", "product_name", "barcode", "quantity", "unit_price", "line_total")
    autocomplete_fields = ("product",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "receipt_number", "supermarket", "cashier", "total", "payment_method",
        "status", "created_at",
    )
    list_filter = ("status", "payment_method", "supermarket", "created_at")
    search_fields = ("receipt_number", "customer_phone", "cashier__username")
    autocomplete_fields = ("supermarket", "cashier", "session", "mpesa_payment")
    readonly_fields = ("id", "receipt_number", "qr_code", "created_at")
    inlines = [SaleItemInline]
    ordering = ("-created_at",)

    fieldsets = (
        (None, {
            "fields": (
                "id", "supermarket", "cashier", "session", "receipt_number", "qr_code", "status",
            )
        }),
        ("Amounts", {
            "fields": ("subtotal", "discount", "tax", "total", "amount_tendered", "change_due"),
        }),
        ("Payment", {
            "fields": ("payment_method", "mpesa_payment", "customer_phone"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ("sale", "product_name", "barcode", "quantity", "unit_price", "line_total")
    search_fields = ("product_name", "barcode", "sale__receipt_number")
    autocomplete_fields = ("sale", "product")
    readonly_fields = ("line_total",)
# core/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.db.models import Sum, F
from .models import (
    Supermarket, User, Package, Subscription, SalesSession,
    Payment, Category, Supplier, Product, StockMovement, Sale, SaleItem,
)

# ---------------------------------------------------------------------------
# Site branding
# ---------------------------------------------------------------------------
admin.site.site_header  = "Friends POS"
admin.site.site_title   = "Friends POS Admin"
admin.site.index_title  = "Dashboard"


# ---------------------------------------------------------------------------
# Supermarket
# ---------------------------------------------------------------------------
@admin.register(Supermarket)
class SupermarketAdmin(admin.ModelAdmin):
    list_display  = ("name", "slug", "location", "phone_number", "email", "kra_pin", "is_active", "created_at")
    list_filter   = ("is_active",)
    search_fields = ("name", "slug", "phone_number", "email", "kra_pin")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Business Info", {
            "fields": ("name", "slug", "location", "phone_number", "email", "kra_pin", "logo"),
        }),
        ("M-Pesa", {
            "fields": ("mpesa_shortcode",),
        }),
        ("Status", {
            "fields": ("is_active", "created_at", "updated_at"),
        }),
    )


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ("username", "get_full_name", "email", "supermarket", "role", "is_locked", "is_active")
    list_filter   = ("role", "is_locked", "is_active", "supermarket")
    search_fields = ("username", "first_name", "last_name", "email", "phone_number")
    autocomplete_fields = ("supermarket",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("POS Info", {
            "fields": ("supermarket", "role", "phone_number", "is_locked"),
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("POS Info", {
            "fields": ("supermarket", "role", "phone_number"),
        }),
    )


# ---------------------------------------------------------------------------
# Package
# ---------------------------------------------------------------------------
@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ("name", "daily_free_sales", "unlock_price", "session_duration_hours", "is_active")
    list_filter  = ("is_active",)
    search_fields = ("name",)


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------
@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display  = ("supermarket", "package", "sales_allocated", "sales_remaining", "status", "started_at", "expires_at")
    list_filter   = ("status", "package")
    search_fields = ("supermarket__name",)
    autocomplete_fields = ("supermarket",)
    readonly_fields = ("created_at", "started_at")
    date_hierarchy = "created_at"


# ---------------------------------------------------------------------------
# SalesSession
# ---------------------------------------------------------------------------
@admin.register(SalesSession)
class SalesSessionAdmin(admin.ModelAdmin):
    list_display  = ("cashier", "supermarket", "package", "sales_count", "sales_limit", "status", "started_at", "expires_at")
    list_filter   = ("status", "supermarket")
    search_fields = ("cashier__username", "supermarket__name")
    readonly_fields = ("started_at", "locked_at")
    date_hierarchy = "started_at"


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ("reference_code", "supermarket", "initiated_by", "purpose", "amount", "phone_number", "status", "mpesa_receipt_number", "created_at")
    list_filter   = ("status", "purpose", "supermarket")
    search_fields = ("reference_code", "phone_number", "mpesa_receipt_number", "checkout_request_id")
    readonly_fields = ("reference_code", "created_at", "updated_at", "merchant_request_id", "checkout_request_id")
    date_hierarchy = "created_at"


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ("name", "supermarket", "description", "created_at")
    list_filter   = ("supermarket",)
    search_fields = ("name", "supermarket__name")
    autocomplete_fields = ("supermarket",)


# ---------------------------------------------------------------------------
# Supplier
# ---------------------------------------------------------------------------
@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display  = ("name", "supermarket", "phone_number", "email", "address")
    list_filter   = ("supermarket",)
    search_fields = ("name", "phone_number", "email")
    autocomplete_fields = ("supermarket",)


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display  = ("name", "barcode", "sku", "supermarket", "category", "selling_price", "cost_price", "quantity_in_stock", "low_stock_badge", "is_active")
    list_filter   = ("supermarket", "category", "is_active")
    search_fields = ("name", "barcode", "sku")
    autocomplete_fields = ("supermarket", "category", "supplier")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"
    fieldsets = (
        ("Identity", {
            "fields": ("supermarket", "name", "barcode", "sku", "image", "unit", "category", "supplier"),
        }),
        ("Pricing & Stock", {
            "fields": ("cost_price", "selling_price", "quantity_in_stock", "reorder_level"),
        }),
        ("Status", {
            "fields": ("is_active", "created_at", "updated_at"),
        }),
    )

    @admin.display(description="Low Stock", boolean=True)
    def low_stock_badge(self, obj):
        return obj.is_low_stock


# ---------------------------------------------------------------------------
# StockMovement
# ---------------------------------------------------------------------------
@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display  = ("product", "movement_type", "quantity", "performed_by", "note", "created_at")
    list_filter   = ("movement_type", "product__supermarket")
    search_fields = ("product__name", "product__barcode", "note")
    readonly_fields = ("created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("product", "performed_by")


# ---------------------------------------------------------------------------
# Sale + SaleItem inline
# ---------------------------------------------------------------------------
class SaleItemInline(admin.TabularInline):
    model  = SaleItem
    extra  = 0
    fields = ("product", "product_name", "barcode", "quantity", "unit_price", "line_total")
    readonly_fields = ("line_total", "product_name", "barcode")
    autocomplete_fields = ("product",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display  = ("receipt_number", "supermarket", "cashier", "payment_method", "subtotal", "discount", "tax", "total", "status", "created_at")
    list_filter   = ("status", "payment_method", "supermarket")
    search_fields = ("receipt_number", "cashier__username", "customer_phone")
    readonly_fields = ("receipt_number", "created_at", "subtotal", "total", "change_due")
    date_hierarchy = "created_at"
    inlines = [SaleItemInline]
    fieldsets = (
        ("Transaction", {
            "fields": ("supermarket", "cashier", "session", "receipt_number", "status"),
        }),
        ("Totals", {
            "fields": ("subtotal", "discount", "tax", "total"),
        }),
        ("Payment", {
            "fields": ("payment_method", "mpesa_payment", "amount_tendered", "change_due", "customer_phone"),
        }),
        ("Meta", {
            "fields": ("qr_code", "created_at"),
        }),
    )


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display  = ("product_name", "barcode", "quantity", "unit_price", "line_total", "sale")
    search_fields = ("product_name", "barcode")
    readonly_fields = ("line_total",)
    autocomplete_fields = ("sale", "product")
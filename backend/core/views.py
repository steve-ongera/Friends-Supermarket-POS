"""
core/views.py
Friends Supermarket POS & Inventory SaaS
----------------------------------------
API views for:
- Authentication & user management
- Supermarket & subscription management
- M-Pesa payment processing
- Inventory management (categories, suppliers, products, stock)
- POS sales processing
- Dashboard analytics
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, F, Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, status, viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

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
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    RegisterSupermarketSerializer,
    SupermarketSerializer,
    PackageSerializer,
    SubscriptionSerializer,
    SubscriptionStackSerializer,
    SalesSessionSerializer,
    PaymentSerializer,
    STKPushRequestSerializer,
    CategorySerializer,
    SupplierSerializer,
    ProductSerializer,
    ProductLookupSerializer,
    StockMovementSerializer,
    StockAdjustSerializer,
    SaleSerializer,
    SaleCreateSerializer,
)
from .services.mpesa import initiate_stk_push, MpesaError
from .services.qrcode_service import generate_receipt_qr
from .services.billing import (
    get_or_create_active_session,
    register_sale_against_session,
    add_subscription_to_stack,
)


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class IsOwnerOrManager(BasePermission):
    """
    Custom permission: Allows full access only to Owners and Managers.
    Read-only access (GET, HEAD, OPTIONS) is allowed for all authenticated users.
    """
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ("OWNER", "MANAGER")


class SameSupermarketMixin:
    """
    Mixin that filters querysets to only include objects belonging to
    the current user's supermarket.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and getattr(user, "supermarket_id", None):
            return qs.filter(supermarket_id=user.supermarket_id)
        return qs.none()


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

class RegisterSupermarketView(APIView):
    """
    Register a new supermarket with its owner user.
    Creates:
    - Supermarket tenant
    - Owner user with OWNER role
    - Default subscription (Free Daily Tier)
    Returns JWT tokens for the owner.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSupermarketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        owner = result["owner"]
        refresh = RefreshToken.for_user(owner)
        return Response(
            {
                "supermarket": SupermarketSerializer(result["supermarket"]).data,
                "user": UserSerializer(owner).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """Get the current authenticated user's profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class StaffViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    """
    CRUD operations for staff users (Managers and Cashiers).
    Only Owners and Managers can manage staff.
    """
    queryset = UserCreateSerializer.Meta.model.objects.all()
    permission_classes = [IsOwnerOrManager]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


# ---------------------------------------------------------------------------
# Supermarket / Package / Subscription Views
# ---------------------------------------------------------------------------

class SupermarketDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve and update the current user's supermarket details.
    Only Owners and Managers can update.
    """
    serializer_class = SupermarketSerializer
    permission_classes = [IsOwnerOrManager]

    def get_object(self):
        return self.request.user.supermarket


class PackageListView(generics.ListAPIView):
    """List all active billing packages/tiers available for purchase."""
    queryset = Package.objects.filter(is_active=True)
    serializer_class = PackageSerializer
    permission_classes = [AllowAny]


class SubscriptionDetailView(APIView):
    """
    GET /subscription/
    Returns the full subscription stack for the supermarket:
      - active: the currently consuming bundle
      - queued: bundles waiting in line (oldest first)
      - total_sales_remaining: sum across all active + queued bundles
      - is_unlimited: True if active bundle is unlimited
      - has_quota: whether sales can currently be made

    PATCH /subscription/
    Direct package assignment (admin/migration use only).
    """
    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        supermarket = request.user.supermarket

        active = (
            Subscription.objects.filter(
                supermarket=supermarket, status=Subscription.Status.ACTIVE
            )
            .select_related("package", "payment")
            .first()
        )

        queued = list(
            Subscription.objects.filter(
                supermarket=supermarket, status=Subscription.Status.QUEUED
            )
            .select_related("package", "payment")
            .order_by("created_at")
        )

        # Calculate total sales remaining
        is_unlimited = bool(active and active.is_unlimited)
        
        if is_unlimited:
            total_remaining = None
        else:
            # Sum remaining from active + all queued
            total_remaining = sum(
                s.sales_remaining
                for s in ([active] if active else []) + queued
                if not s.is_unlimited
            )

        has_quota = bool(
            active and (active.is_unlimited or active.sales_remaining > 0)
        )

        # Build response with all subscription data
        data = {
            "active": active,
            "queued": queued,
            "total_sales_remaining": total_remaining,
            "is_unlimited": is_unlimited,
            "has_quota": has_quota,
            # Additional metadata for better UX
            "total_bundles": 1 + len(queued) if active else len(queued),
            "active_bundle_remaining": active.sales_remaining if active and not is_unlimited else None,
            "queued_bundles_count": len(queued),
        }

        serializer = SubscriptionStackSerializer(data)
        return Response(serializer.data)

    def patch(self, request):
        """
        PATCH /subscription/
        Upgrade to a new package. Handles unlimited packages properly.
        """
        supermarket = request.user.supermarket
        package_id = request.data.get("package")
        
        if not package_id:
            return Response(
                {"detail": "package field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        package = get_object_or_404(Package, pk=package_id, is_active=True)

        # Get current active subscription
        current_active = Subscription.objects.filter(
            supermarket=supermarket, status=Subscription.Status.ACTIVE
        ).first()

        # If upgrading to the same package, just return current
        if current_active and current_active.package_id == package.id:
            return Response(SubscriptionSerializer(current_active).data)

        # Expire current active subscription
        if current_active:
            current_active.status = Subscription.Status.EXPIRED
            current_active.save(update_fields=["status"])

        # Create new subscription
        # For unlimited packages, set a very large number or handle differently
        is_unlimited = package.daily_free_sales is None
        sales_allocated = package.daily_free_sales or 0
        sales_remaining = package.daily_free_sales if not is_unlimited else 999999  # Large number for unlimited

        new_sub = Subscription.objects.create(
            supermarket=supermarket,
            package=package,
            sales_allocated=sales_allocated,
            sales_remaining=sales_remaining,
            status=Subscription.Status.ACTIVE,
            started_at=timezone.now(),
        )

        # Reopen any locked sessions
        SalesSession.objects.filter(
            supermarket=supermarket, status=SalesSession.Status.LOCKED
        ).update(status=SalesSession.Status.ACTIVE, locked_at=None)

        return Response(SubscriptionSerializer(new_sub).data)


# ---------------------------------------------------------------------------
# Sales Session Views (quota / lock state)
# ---------------------------------------------------------------------------

class CurrentSessionView(APIView):
    """
    Get or create the current cashier's active sales session.
    The session tracks the cashier's sales activity and quota status.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session = get_or_create_active_session(request.user)
        return Response(SalesSessionSerializer(session).data)


class SalesSessionListView(SameSupermarketMixin, generics.ListAPIView):
    """List all sales sessions for the current supermarket."""
    queryset = SalesSession.objects.select_related("cashier", "package").all()
    serializer_class = SalesSessionSerializer
    permission_classes = [IsAuthenticated]


# ---------------------------------------------------------------------------
# M-Pesa Payment Views (STK Push)
# ---------------------------------------------------------------------------

class InitiateSTKPushView(APIView):
    """
    Triggers an M-Pesa STK Push payment request.
    Both SESSION_UNLOCK and SUBSCRIPTION purposes add to the subscription
    stack via add_subscription_to_stack() on payment success.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = STKPushRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        supermarket = request.user.supermarket
        amount = data.get("amount")
        purpose = data["purpose"]
        chosen_package = data.get("package")

        # Derive amount from chosen package if not explicitly provided.
        if not amount:
            if chosen_package:
                amount = chosen_package.unlock_price
            else:
                active_sub = Subscription.objects.filter(
                    supermarket=supermarket, status=Subscription.Status.ACTIVE
                ).select_related("package").first()
                if active_sub:
                    amount = active_sub.package.unlock_price
                else:
                    return Response(
                        {"detail": "No active subscription found. Please select a package."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        payment = Payment.objects.create(
            supermarket=supermarket,
            initiated_by=request.user,
            purpose=purpose,
            amount=amount,
            phone_number=data["phone_number"],
            status=Payment.Status.PENDING,
            package=chosen_package,
        )

        try:
            stk_response = initiate_stk_push(
                phone_number=data["phone_number"],
                amount=amount,
                account_reference=payment.reference_code,
                transaction_desc=f"{supermarket.name} - {purpose}",
            )
        except MpesaError as exc:
            payment.status = Payment.Status.FAILED
            payment.result_desc = str(exc)
            payment.save(update_fields=["status", "result_desc"])
            return Response(
                {"detail": str(exc), "daraja_error": exc.daraja_body},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.merchant_request_id = stk_response.get("MerchantRequestID", "")
        payment.checkout_request_id = stk_response.get("CheckoutRequestID", "")
        payment.save(update_fields=["merchant_request_id", "checkout_request_id"])

        return Response(
            {
                "payment": PaymentSerializer(payment).data,
                "daraja_response": stk_response,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class PaymentStatusView(generics.RetrieveAPIView):
    """Check the status of a payment using its reference code."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "reference_code"


@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """
    Daraja STK Push callback webhook endpoint.
    M-Pesa will POST to this URL when a payment is completed or fails.
    On success, adds the purchased package to the subscription stack
    regardless of whether purpose is SESSION_UNLOCK or SUBSCRIPTION.
    """
    callback = request.data.get("Body", {}).get("stkCallback", {})
    checkout_request_id = callback.get("CheckoutRequestID")
    result_code = callback.get("ResultCode")
    result_desc = callback.get("ResultDesc", "")

    payment = Payment.objects.filter(checkout_request_id=checkout_request_id).first()
    if not payment:
        return Response({"detail": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)

    payment.result_code = str(result_code)
    payment.result_desc = result_desc

    if str(result_code) == "0":
        payment.status = Payment.Status.SUCCESS
        items = callback.get("CallbackMetadata", {}).get("Item", [])
        for item in items:
            if item.get("Name") == "MpesaReceiptNumber":
                payment.mpesa_receipt_number = item.get("Value", "")
        payment.save()

        # Both SESSION_UNLOCK and SUBSCRIPTION add quota to the stack.
        if payment.purpose in (
            Payment.Purpose.SESSION_UNLOCK,
            Payment.Purpose.SUBSCRIPTION,
        ):
            add_subscription_to_stack(payment)
    else:
        payment.status = Payment.Status.FAILED
        payment.save()

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ---------------------------------------------------------------------------
# Inventory Views
# ---------------------------------------------------------------------------

class CategoryViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    """CRUD operations for product categories."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsOwnerOrManager]

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


class SupplierViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    """CRUD operations for suppliers."""
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsOwnerOrManager]

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


class ProductViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    """
    CRUD operations for products.
    Supports filtering by low_stock parameter.
    """
    queryset = Product.objects.select_related("category", "supplier").all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "barcode", "sku"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOwnerOrManager()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)

    def get_queryset(self):
        qs = super().get_queryset()
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            qs = qs.filter(quantity_in_stock__lte=F("reorder_level"))
        return qs


class ProductBarcodeLookupView(APIView):
    """
    Quick product lookup by barcode for POS scanning.
    Returns lightweight product data for fast checkout.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, barcode):
        product = Product.objects.filter(
            supermarket=request.user.supermarket, barcode=barcode, is_active=True
        ).first()
        if not product:
            return Response(
                {"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(ProductLookupSerializer(product).data)


class StockMovementListView(SameSupermarketMixin, generics.ListAPIView):
    """
    List stock movements/audit trail.
    Can filter by product_id query parameter.
    """
    queryset = StockMovement.objects.select_related("product", "performed_by").all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = StockMovement.objects.filter(
            product__supermarket=self.request.user.supermarket
        ).select_related("product", "performed_by")
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs


class StockAdjustView(APIView):
    """
    Adjust product stock levels (restock, return, adjustment, damage).
    Only Owners and Managers can adjust stock.
    """
    permission_classes = [IsOwnerOrManager]

    @transaction.atomic
    def post(self, request, pk):
        product = get_object_or_404(
            Product, pk=pk, supermarket=request.user.supermarket
        )
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        movement_type = data["movement_type"]
        quantity = data["quantity"]
        signed_quantity = quantity if movement_type in (
            StockMovement.MovementType.RESTOCK, StockMovement.MovementType.RETURN
        ) else -abs(quantity)

        product.quantity_in_stock = product.quantity_in_stock + signed_quantity
        product.save(update_fields=["quantity_in_stock"])

        movement = StockMovement.objects.create(
            product=product,
            movement_type=movement_type,
            quantity=signed_quantity,
            note=data.get("note", ""),
            performed_by=request.user,
        )
        return Response(
            StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# Sales / POS Checkout Views
# ---------------------------------------------------------------------------

class SaleViewSet(SameSupermarketMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only view for completed sales.
    Supports search by receipt_number or customer_phone.
    """
    queryset = Sale.objects.select_related(
        "cashier", "session"
    ).prefetch_related("items").all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["receipt_number", "customer_phone"]


class CreateSaleView(APIView):
    """
    Create a new POS sale.
    Process:
    1. Verify user has an active session with quota
    2. Validate all items have sufficient stock
    3. Create sale and sale items
    4. Update stock levels
    5. Record stock movements
    6. Deduct from subscription stack
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        supermarket = user.supermarket

        session = get_or_create_active_session(user)
        if session.status == SalesSession.Status.LOCKED:
            return Response(
                {
                    "detail": (
                        "No sales quota remaining. Purchase a subscription package "
                        "via M-Pesa to continue."
                    ),
                    "session": SalesSessionSerializer(session).data,
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sale = Sale.objects.create(
            supermarket=supermarket,
            cashier=user,
            session=session,
            discount=data["discount"],
            tax=data["tax"],
            payment_method=data["payment_method"],
            amount_tendered=data.get("amount_tendered"),
            customer_phone=data.get("customer_phone", ""),
        )

        subtotal = Decimal("0.00")
        for item_data in data["items"]:
            product = get_object_or_404(
                Product, pk=item_data["product_id"], supermarket=supermarket, is_active=True
            )
            quantity = item_data["quantity"]

            if product.quantity_in_stock < quantity:
                transaction.set_rollback(True)
                return Response(
                    {
                        "detail": (
                            f"Insufficient stock for '{product.name}'. "
                            f"Available: {product.quantity_in_stock}"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            line_total = quantity * product.selling_price
            subtotal += line_total

            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                barcode=product.barcode,
                quantity=quantity,
                unit_price=product.selling_price,
            )

            product.quantity_in_stock -= quantity
            product.save(update_fields=["quantity_in_stock"])

            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.MovementType.SALE,
                quantity=-quantity,
                note=f"Sold via receipt {sale.receipt_number}",
                performed_by=user,
            )

        sale.subtotal = subtotal
        sale.total = subtotal - sale.discount + sale.tax
        if sale.amount_tendered:
            sale.change_due = max(
                sale.amount_tendered - sale.total, Decimal("0.00")
            )
        sale.save(update_fields=["subtotal", "total", "change_due"])

        generate_receipt_qr(sale)

        # Deduct from subscription stack (may auto-promote next queued bundle).
        register_sale_against_session(session)

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


class VoidSaleView(APIView):
    """
    Void a completed sale.
    Process:
    1. Verify sale exists and belongs to the supermarket
    2. Restore stock quantities
    3. Record reverse stock movements
    4. Mark sale as VOIDED
    """
    permission_classes = [IsOwnerOrManager]

    @transaction.atomic
    def post(self, request, pk):
        sale = get_object_or_404(Sale, pk=pk, supermarket=request.user.supermarket)
        if sale.status != Sale.Status.COMPLETED:
            return Response(
                {"detail": "Sale already voided/refunded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for item in sale.items.select_related("product"):
            if item.product:
                item.product.quantity_in_stock += item.quantity
                item.product.save(update_fields=["quantity_in_stock"])
                StockMovement.objects.create(
                    product=item.product,
                    movement_type=StockMovement.MovementType.RETURN,
                    quantity=item.quantity,
                    note=f"Voided sale {sale.receipt_number}",
                    performed_by=request.user,
                )

        sale.status = Sale.Status.VOIDED
        sale.save(update_fields=["status"])
        return Response(SaleSerializer(sale).data)


# ---------------------------------------------------------------------------
# Dashboard / Analytics Views
# ---------------------------------------------------------------------------

class DashboardSummaryView(APIView):
    """
    Get key metrics for the supermarket dashboard:
    - Today's sales count and revenue
    - Low stock product count
    - Active and locked sessions
    - Subscription stack summary
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        supermarket = request.user.supermarket
        today = timezone.localdate()

        sales_today = Sale.objects.filter(
            supermarket=supermarket,
            created_at__date=today,
            status=Sale.Status.COMPLETED,
        )
        revenue_today = (
            sales_today.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
        )

        low_stock_count = Product.objects.filter(
            supermarket=supermarket,
            quantity_in_stock__lte=F("reorder_level"),
            is_active=True,
        ).count()

        active_sessions = SalesSession.objects.filter(
            supermarket=supermarket, status=SalesSession.Status.ACTIVE
        ).count()

        locked_sessions = SalesSession.objects.filter(
            supermarket=supermarket, status=SalesSession.Status.LOCKED
        ).count()

        # Subscription stack summary for the dashboard.
        active_sub = (
            Subscription.objects.filter(
                supermarket=supermarket, status=Subscription.Status.ACTIVE
            ).first()
        )
        queued_count = Subscription.objects.filter(
            supermarket=supermarket, status=Subscription.Status.QUEUED
        ).count()
        total_sales_remaining = None
        if active_sub and not active_sub.is_unlimited:
            queued_subs = Subscription.objects.filter(
                supermarket=supermarket, status=Subscription.Status.QUEUED
            )
            total_sales_remaining = active_sub.sales_remaining + sum(
                s.sales_remaining for s in queued_subs
            )

        return Response(
            {
                "sales_count_today": sales_today.count(),
                "revenue_today": revenue_today,
                "low_stock_count": low_stock_count,
                "active_sessions": active_sessions,
                "locked_sessions": locked_sessions,
                "subscription": {
                    "has_active": active_sub is not None,
                    "is_unlimited": active_sub.is_unlimited if active_sub else False,
                    "sales_remaining": (
                        active_sub.sales_remaining if active_sub and not active_sub.is_unlimited else None
                    ),
                    "total_sales_remaining": total_sales_remaining,
                    "queued_bundles": queued_count,
                },
            }
        )


class DashboardChartsView(APIView):
    """
    Get chart data for dashboard visualizations:
    - 14-day sales trend
    - Payment method breakdown
    - Top 5 selling products
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        from django.db.models.functions import TruncDate

        supermarket = request.user.supermarket
        today = timezone.localdate()
        start_date = today - timedelta(days=13)

        trend_qs = (
            Sale.objects.filter(
                supermarket=supermarket,
                status=Sale.Status.COMPLETED,
                created_at__date__gte=start_date,
            )
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(revenue=Sum("total"), sales_count=Count("id"))
            .order_by("day")
        )
        trend_by_day = {row["day"]: row for row in trend_qs}

        sales_trend = []
        for i in range(14):
            day = start_date + timedelta(days=i)
            row = trend_by_day.get(day)
            sales_trend.append(
                {
                    "date": day.isoformat(),
                    "revenue": float(row["revenue"]) if row else 0.0,
                    "sales_count": row["sales_count"] if row else 0,
                }
            )

        payment_qs = (
            Sale.objects.filter(
                supermarket=supermarket, status=Sale.Status.COMPLETED
            )
            .values("payment_method")
            .annotate(count=Count("id"), total=Sum("total"))
            .order_by("-count")
        )
        payment_breakdown = [
            {
                "payment_method": row["payment_method"],
                "count": row["count"],
                "total": float(row["total"] or 0),
            }
            for row in payment_qs
        ]

        top_products_qs = (
            SaleItem.objects.filter(
                sale__supermarket=supermarket, sale__status=Sale.Status.COMPLETED
            )
            .values("product_name")
            .annotate(quantity_sold=Sum("quantity"), revenue=Sum("line_total"))
            .order_by("-quantity_sold")[:5]
        )
        top_products = [
            {
                "product_name": row["product_name"],
                "quantity_sold": float(row["quantity_sold"]),
                "revenue": float(row["revenue"] or 0),
            }
            for row in top_products_qs
        ]

        return Response(
            {
                "sales_trend": sales_trend,
                "payment_breakdown": payment_breakdown,
                "top_products": top_products,
            }
        )
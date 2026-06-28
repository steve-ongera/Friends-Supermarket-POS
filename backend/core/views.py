"""
core/views.py
Friends Supermarket POS & Inventory SaaS
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
from .services.mpesa import initiate_stk_push
from .services.qrcode_service import generate_receipt_qr
from .services.billing import (
    get_or_create_active_session,
    register_sale_against_session,
)


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class IsOwnerOrManager(BasePermission):
    """Allows write access only to Owners/Managers; Cashiers get read-only POS actions."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ("OWNER", "MANAGER")


class SameSupermarketMixin:
    """Restricts queryset to the requesting user's supermarket."""

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and getattr(user, "supermarket_id", None):
            return qs.filter(supermarket_id=user.supermarket_id)
        return qs.none()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterSupermarketView(APIView):
    """Sign-up: creates Supermarket + Owner user + default subscription."""

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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class StaffViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    """Owner/Manager manages cashiers & managers."""

    queryset = UserCreateSerializer.Meta.model.objects.all()
    permission_classes = [IsOwnerOrManager]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


# ---------------------------------------------------------------------------
# Supermarket / Package / Subscription
# ---------------------------------------------------------------------------

class SupermarketDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SupermarketSerializer
    permission_classes = [IsOwnerOrManager]

    def get_object(self):
        return self.request.user.supermarket


class PackageListView(generics.ListAPIView):
    """Public — lets a prospective customer view available billing packages."""

    queryset = Package.objects.filter(is_active=True)
    serializer_class = PackageSerializer
    permission_classes = [AllowAny]


class SubscriptionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [IsOwnerOrManager]

    def get_object(self):
        return get_object_or_404(Subscription, supermarket=self.request.user.supermarket)


# ---------------------------------------------------------------------------
# Sales Session (quota / lock state)
# ---------------------------------------------------------------------------

class CurrentSessionView(APIView):
    """Returns (or creates) the cashier's current active/locked session."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        session = get_or_create_active_session(request.user)
        return Response(SalesSessionSerializer(session).data)


class SalesSessionListView(SameSupermarketMixin, generics.ListAPIView):
    queryset = SalesSession.objects.select_related("cashier", "package").all()
    serializer_class = SalesSessionSerializer
    permission_classes = [IsAuthenticated]


# ---------------------------------------------------------------------------
# M-Pesa Payments (STK Push for session unlock / customer checkout)
# ---------------------------------------------------------------------------

class InitiateSTKPushView(APIView):
    """
    Triggers an M-Pesa STK Push.
    purpose=SESSION_UNLOCK -> uses the supermarket's package.unlock_price by default.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = STKPushRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        supermarket = request.user.supermarket
        amount = data.get("amount")
        purpose = data["purpose"]

        if purpose == Payment.Purpose.SESSION_UNLOCK and not amount:
            subscription = get_object_or_404(Subscription, supermarket=supermarket)
            amount = subscription.package.unlock_price

        payment = Payment.objects.create(
            supermarket=supermarket,
            initiated_by=request.user,
            purpose=purpose,
            amount=amount,
            phone_number=data["phone_number"],
            status=Payment.Status.PENDING,
        )

        stk_response = initiate_stk_push(
            phone_number=data["phone_number"],
            amount=amount,
            account_reference=payment.reference_code,
            transaction_desc=f"{supermarket.name} - {purpose}",
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
    """Poll endpoint — frontend polls this while waiting for the STK callback."""

    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "reference_code"


@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """
    Daraja STK Push callback webhook.
    Expected payload shape (simplified):
    {
        "Body": {
            "stkCallback": {
                "MerchantRequestID": "...",
                "CheckoutRequestID": "...",
                "ResultCode": 0,
                "ResultDesc": "...",
                "CallbackMetadata": {
                    "Item": [{"Name": "MpesaReceiptNumber", "Value": "..."}, ...]
                }
            }
        }
    }
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

        if payment.purpose == Payment.Purpose.SESSION_UNLOCK:
            from .services.billing import unlock_new_session
            unlock_new_session(payment)
    else:
        payment.status = Payment.Status.FAILED
        payment.save()

    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class CategoryViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsOwnerOrManager]

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


class SupplierViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsOwnerOrManager]

    def perform_create(self, serializer):
        serializer.save(supermarket=self.request.user.supermarket)


class ProductViewSet(SameSupermarketMixin, viewsets.ModelViewSet):
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
    """POS barcode scan endpoint: GET /products/lookup/<barcode>/"""

    permission_classes = [IsAuthenticated]

    def get(self, request, barcode):
        product = Product.objects.filter(
            supermarket=request.user.supermarket, barcode=barcode, is_active=True
        ).first()
        if not product:
            return Response({"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductLookupSerializer(product).data)


class StockMovementListView(SameSupermarketMixin, generics.ListAPIView):
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
    """POST /products/<id>/adjust-stock/ -> restock, manual adjustment, damage etc."""

    permission_classes = [IsOwnerOrManager]

    @transaction.atomic
    def post(self, request, pk):
        product = get_object_or_404(Product, pk=pk, supermarket=request.user.supermarket)
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
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Sales / POS Checkout
# ---------------------------------------------------------------------------

class SaleViewSet(SameSupermarketMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only listing/detail of past sales. Creation goes through CreateSaleView."""

    queryset = Sale.objects.select_related("cashier", "session").prefetch_related("items").all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["receipt_number", "customer_phone"]


class CreateSaleView(APIView):
    """
    Main POS checkout endpoint.
    Validates the cashier's session quota, deducts stock, generates the
    receipt + QR code, and increments the sales session counter.
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
                    "detail": "Sales quota exhausted for this session. Unlock a new session via M-Pesa to continue.",
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
                    {"detail": f"Insufficient stock for '{product.name}'. Available: {product.quantity_in_stock}"},
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
            sale.change_due = max(sale.amount_tendered - sale.total, Decimal("0.00"))
        sale.save(update_fields=["subtotal", "total", "change_due"])

        # Generate & attach QR code for the receipt
        generate_receipt_qr(sale)

        # Update the cashier's session quota (may flip to LOCKED)
        register_sale_against_session(session)

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


class VoidSaleView(APIView):
    """Voids a sale and restores stock (Owner/Manager only)."""

    permission_classes = [IsOwnerOrManager]

    @transaction.atomic
    def post(self, request, pk):
        sale = get_object_or_404(Sale, pk=pk, supermarket=request.user.supermarket)
        if sale.status != Sale.Status.COMPLETED:
            return Response({"detail": "Sale already voided/refunded."}, status=status.HTTP_400_BAD_REQUEST)

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
# Dashboard / Reports
# ---------------------------------------------------------------------------

class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        supermarket = request.user.supermarket
        today = timezone.localdate()

        sales_today = Sale.objects.filter(
            supermarket=supermarket, created_at__date=today, status=Sale.Status.COMPLETED
        )
        revenue_today = sales_today.aggregate(total=Sum("total"))["total"] or Decimal("0.00")

        low_stock_count = Product.objects.filter(
            supermarket=supermarket, quantity_in_stock__lte=F("reorder_level"), is_active=True
        ).count()

        active_sessions = SalesSession.objects.filter(
            supermarket=supermarket, status=SalesSession.Status.ACTIVE
        ).count()

        locked_sessions = SalesSession.objects.filter(
            supermarket=supermarket, status=SalesSession.Status.LOCKED
        ).count()

        return Response(
            {
                "sales_count_today": sales_today.count(),
                "revenue_today": revenue_today,
                "low_stock_count": low_stock_count,
                "active_sessions": active_sessions,
                "locked_sessions": locked_sessions,
            }
        )


class DashboardChartsView(APIView):
    """
    Aggregated data for the dashboard visualizations:
    - sales_trend: revenue per day, last 14 days (line chart)
    - payment_breakdown: count per payment method (pie chart)
    - top_products: top 5 best-selling products by quantity (bar chart)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        from django.db.models.functions import TruncDate

        supermarket = request.user.supermarket
        today = timezone.localdate()
        start_date = today - timedelta(days=13)

        # --- Sales trend (line chart): revenue per day, last 14 days ---
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

        # --- Payment method breakdown (pie chart) ---
        payment_qs = (
            Sale.objects.filter(supermarket=supermarket, status=Sale.Status.COMPLETED)
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

        # --- Top products by quantity sold (bar chart) ---
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
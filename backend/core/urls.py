"""
core/urls.py
Friends Supermarket POS & Inventory SaaS

Included in the main project urls.py as:
    path("api/", include("core.urls"))
"""

from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register(r"staff", views.StaffViewSet, basename="staff")
router.register(r"categories", views.CategoryViewSet, basename="category")
router.register(r"suppliers", views.SupplierViewSet, basename="supplier")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"sales", views.SaleViewSet, basename="sale")

urlpatterns = [
    # --- Auth ---
    path("auth/register/", views.RegisterSupermarketView.as_view(), name="register-supermarket"),
    path("auth/login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    # --- Supermarket / Billing ---
    path("supermarket/", views.SupermarketDetailView.as_view(), name="supermarket-detail"),
    path("packages/", views.PackageListView.as_view(), name="package-list"),
    path("subscription/", views.SubscriptionDetailView.as_view(), name="subscription-detail"),

    # --- Sales Sessions (quota / lock state) ---
    path("sessions/current/", views.CurrentSessionView.as_view(), name="session-current"),
    path("sessions/", views.SalesSessionListView.as_view(), name="session-list"),

    # --- M-Pesa Payments ---
    path("payments/stk-push/", views.InitiateSTKPushView.as_view(), name="stk-push"),
    path("payments/status/<str:reference_code>/", views.PaymentStatusView.as_view(), name="payment-status"),
    path("payments/mpesa/callback/", views.mpesa_callback, name="mpesa-callback"),

    # --- Inventory: barcode + stock ---
    path("products/lookup/<str:barcode>/", views.ProductBarcodeLookupView.as_view(), name="product-barcode-lookup"),
    path("products/<uuid:pk>/adjust-stock/", views.StockAdjustView.as_view(), name="product-adjust-stock"),
    path("stock-movements/", views.StockMovementListView.as_view(), name="stock-movement-list"),

    # --- POS / Sales actions ---
    path("sales/create/", views.CreateSaleView.as_view(), name="sale-create"),
    path("sales/<uuid:pk>/void/", views.VoidSaleView.as_view(), name="sale-void"),

    # --- Dashboard ---
    path("dashboard/summary/", views.DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("dashboard/charts/", views.DashboardChartsView.as_view(), name="dashboard-charts"),

    # --- Router (ViewSets: staff, categories, suppliers, products, sales) ---
    *router.urls,
]
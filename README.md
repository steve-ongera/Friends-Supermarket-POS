# Friends Supermarket POS & Inventory SaaS

A multi-tenant Point-of-Sale and Inventory Management SaaS for supermarkets in Kenya.
Billing is **pay-per-session**: each cashier gets a session of **20 sales**, and once
exhausted, the supermarket pays **KES 100 via M-Pesa STK Push** to unlock the next
session. Receipts include an auto-generated **QR code**, and the till supports
**barcode scanning** for fast checkout.

---

## Tech Stack

**Backend:** Django + Django REST Framework (single core app)
**Frontend:** React (Vite) + Bootstrap Icons, plain responsive CSS
**Payments:** M-Pesa Daraja API (STK Push + C2B/callback)
**Extras:** `qrcode` (receipt QR), barcode scanning via device keyboard-wedge scanners or `react-zxing` camera scan

---

##  Full Project Structure

```
friends-supermarket-pos/
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env
│   ├── .gitignore
│   │
│   ├── pos_saas/                      # Django project (settings)
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py                    # MAIN urls.py -> includes core.urls
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   └── core/                          # the one core application
│       ├── __init__.py
│       ├── apps.py
│       ├── admin.py
│       ├── models.py                  # Supermarket, User, Package, Subscription,
│       │                               #   SalesSession, Payment, Category, Supplier,
│       │                               #   Product, StockMovement, Sale, SaleItem
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py                    # app-level urls (/api/...)
│       ├── permissions.py             # role-based + session-lock permission checks
│       ├── signals.py                 # auto stock deduction, session checks
│       ├── tests.py
│       │
│       ├── services/
│       │   ├── __init__.py
│       │   ├── mpesa.py               # Daraja: access token + STK Push + callback
│       │   ├── qrcode_service.py      # receipt QR code generation (qrcode + Pillow)
│       │   └── billing.py             # sales quota / session lock-unlock logic
│       │
│       └── migrations/
│           └── __init__.py
│
├── frontend/
│   ├── index.html                     # includes Bootstrap Icons CDN <link>
│   ├── package.json
│   ├── vite.config.js
│   ├── .env
│   ├── .gitignore
│   │
│   └── src/
│       ├── main.jsx                   # React root entry
│       ├── App.jsx                    # routes / layout shell
│       │
│       ├── services/
│       │   └── api.js                 # axios instance + all endpoint calls
│       │
│       ├── styles/
│       │   └── main.css               # global responsive styling, theme vars
│       │
│       ├── context/
│       │   ├── AuthContext.jsx        # logged-in user, role, token
│       │   └── SessionContext.jsx     # sales session / lock state
│       │
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── Navbar.jsx
│       │   ├── BarcodeScanner.jsx     # camera/USB scanner input handler
│       │   ├── ProtectedRoute.jsx     # role-based route guard
│       │   ├── SessionLockModal.jsx   # M-Pesa STK Push unlock popup
│       │   ├── ProductCard.jsx
│       │   ├── CartTable.jsx
│       │   ├── ReceiptQR.jsx          # renders QR + printable receipt
│       │   └── Loader.jsx
│       │
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── POS.jsx                # main cashier till / checkout screen
│       │   ├── Inventory.jsx
│       │   ├── Products.jsx
│       │   ├── Categories.jsx
│       │   ├── Suppliers.jsx
│       │   ├── Sales.jsx              # sales history
│       │   ├── Receipt.jsx            # single receipt view/print
│       │   ├── Staff.jsx              # cashier/manager management
│       │   ├── Subscription.jsx       # package & payment history
│       │   └── Settings.jsx
│       │
│       └── assets/
│           └── logo.png
│
└── README.md
```

### Main `urls.py`
```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
```

---

##  Core Models (see `models.py`)

| Model | Purpose |
|---|---|
| `Supermarket` | Tenant — one row per registered supermarket |
| `StaffProfile` | Links a Django `User` to a supermarket + role (owner/manager/cashier) |
| `Package` | Billing plan, e.g. *Basic: 20 sales @ KES 100* |
| `SalesSession` | Tracks a cashier's current unlocked session and sale count; flips to `exhausted` at the limit |
| `Category` / `Product` | Inventory catalog, barcode-indexed |
| `StockMovement` | Audit trail for stock in/out/adjustment/sale |
| `Customer` | Optional walk-in/loyalty customer record |
| `Sale` / `SaleItem` | The transaction and line items; auto-generates receipt number + QR code |
| `MpesaTransaction` | Records STK push requests/callbacks for both session unlocks and sale payments |

### Session-billing flow
1. Cashier logs in → active `SalesSession` is fetched (or none exists).
2. Each completed `Sale` calls `session.register_sale()`, incrementing `sales_count`.
3. At `sales_count == package.sales_limit`, status → `exhausted`. POS frontend blocks new sales and shows "Pay KES 100 to continue" with an STK push prompt.
4. On successful M-Pesa callback, backend creates a new `SalesSession` (status `active`) linked to the `MpesaTransaction`.

---

##  Key API Endpoints (`core/urls.py`)

```
POST   /api/auth/login/                       # JWT login
POST   /api/auth/refresh/

GET    /api/supermarkets/                     # owner: list/create
GET    /api/staff/                            # manage cashiers

GET    /api/products/                          # list/search/filter
GET    /api/products/barcode/<code>/           # quick lookup for scanner
POST   /api/products/
PUT    /api/products/<id>/
GET    /api/products/low-stock/

GET    /api/categories/

GET    /api/sessions/current/                  # cashier's active/exhausted session
POST   /api/sessions/unlock/                   # trigger STK push to unlock new session

POST   /api/sales/                             # create sale (checks session lock first)
GET    /api/sales/<id>/receipt/                # receipt detail incl. QR image

POST   /api/mpesa/stk-push/                    # generic STK push (sale or session)
POST   /api/mpesa/callback/                    # Daraja callback (public, no auth)
GET    /api/mpesa/status/<checkout_request_id>/

GET    /api/reports/daily-sales/
GET    /api/reports/stock/
```

---

##  M-Pesa Integration

- Uses Daraja **STK Push (Lipa na M-Pesa Online)**.
- Two trigger points:
  - **Session unlock** — fixed amount from `Package.price` (e.g. KES 100).
  - **Sale payment** — variable amount = `Sale.total_amount`.
- Callback URL updates `MpesaTransaction.status`, then:
  - if `purpose=session_unlock` → creates new `SalesSession`.
  - if `purpose=sale_payment` → marks `Sale.payment_method=mpesa` and stores `mpesa_receipt_number`.
- Frontend polls `/api/mpesa/status/<checkout_request_id>/` to know when to refresh UI.

---

##  Receipts & QR Codes

- On `Sale` creation, a unique `receipt_number` is generated.
- `utils.py` uses the `qrcode` library to encode a verification URL
  (e.g. `https://yourapp.com/verify/<receipt_number>`) and saves it to `Sale.qr_code`.
- Printed/digital receipt template renders the QR for instant verification or reorder.

---

##  Barcode Scanning

- Most USB/Bluetooth barcode scanners act as a **keyboard wedge** — scanning a code
  just "types" it into the focused input + Enter. The POS search/add-item input
  listens for fast keystroke bursts ending in Enter and auto-submits to
  `/api/products/barcode/<code>/`.
- For mobile/tablet use without a physical scanner, an optional camera-based scan
  modal (`react-zxing` or `html5-qrcode`) can be added later.

---

##  Frontend Notes

```html
<!-- index.html includes Bootstrap Icons via CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
```

---

##  Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install django djangorestframework djangorestframework-simplejwt qrcode pillow requests python-decouple
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

`.env` (via `python-decouple`):
```
SECRET_KEY=
DEBUG=True
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=
```

### Frontend
```bash
cd frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom bootstrap-icons
npm run dev
```

---

##  Sample Packages (seed data)

| Package | Sales Limit | Price (KES) |
|---|---|---|
| Basic | 20 | 100 |
| Standard | 50 | 220 |
| Pro | 120 | 480 |

---

##  Roles

- **Owner** — manages supermarket profile, packages, staff, full reports.
- **Manager** — manages products/inventory, views reports.
- **Cashier** — operates the POS till only; locked out once session is exhausted.

---

## 🛣 Next Steps

1. `serializers.py` for all models above.
2. `views.py` (DRF `ViewSet`s) + `permissions.py` for role/session checks.
3. `mpesa.py` Daraja helper (OAuth token, STK push, callback parsing).
4. React pages wired to `services/api.js`.
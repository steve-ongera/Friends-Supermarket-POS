# Friends POS — Supermarket POS & Inventory SaaS

**Friends POS** (`www.friendspos.com`) is a cloud-based Point-of-Sale and Inventory
Management SaaS built for supermarkets and retail shops in Kenya. Billing is
**pay-per-sales-quota** — each cashier gets a free daily sales allowance (e.g. 20
sales), then pays a small fee via M-Pesa STK Push to unlock a new session.

This README covers:
1. [Project Structure](#1-project-structure)
2. [Backend Setup](#2-backend-setup)
3. [Frontend Setup](#3-frontend-setup)
4. [Connecting Hardware](#4-connecting-hardware-barcode-scanner--thermal-printer)
5. [Going Live on friendspos.com](#5-going-live-on-friendspoacom)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Project Structure

```
friends-supermarket-pos/
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env
│   ├── .gitignore
│   │
│   ├── friends_pos/                   # Django project (settings)
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
│       ├── permissions.py
│       ├── signals.py
│       ├── tests.py
│       │
│       ├── management/
│       │   └── commands/
│       │       └── seed_data.py       # generates ~6 months of demo data
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
│       │   ├── api.js                 # axios instance + all endpoint calls
│       │   └── printer.js             # thermal printer bridge (Web Serial / QZ Tray)
│       │
│       ├── styles/
│       │   └── main.css               # global responsive styling, theme vars
│       │
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── SessionContext.jsx
│       │
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── Navbar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── SessionLockModal.jsx   # M-Pesa STK Push unlock popup
│       │
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx          # KPIs + line/pie/bar charts
│           ├── POS.jsx                # till screen: scanner + product grid + cart
│           ├── Inventory.jsx
│           ├── Products.jsx
│           ├── Categories.jsx
│           ├── Suppliers.jsx
│           ├── Sales.jsx
│           ├── Receipt.jsx            # printable receipt w/ QR code
│           ├── Staff.jsx
│           ├── Subscription.jsx
│           └── Settings.jsx
│
└── README.md
```

---

## 2. Backend Setup

### 2.1 Requirements
- Python 3.11+
- PostgreSQL 14+ (SQLite is fine for local dev/testing)
- A Safaricom Daraja account (sandbox or production) for M-Pesa

### 2.2 Install & configure

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=postgres://user:pass@localhost:5432/friends_pos

CORS_ALLOWED_ORIGINS=http://localhost:5173,https://www.friendspos.com

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://api.friendspos.com/api/payments/mpesa/callback/

FRONTEND_URL=https://www.friendspos.com
```

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_data --months 6      # optional: load demo data
python manage.py runserver
```

---

## 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

```bash
npm run dev          # local development -> http://localhost:5173
npm run build        # production build -> deploy /dist to friendspos.com
```

---

## 4. Connecting Hardware (Barcode Scanner & Thermal Printer)

Friends POS works fully in the browser with **no special drivers required**
for most setups — but here's exactly how each device connects, for clients
who want a complete checkout counter.

### 4.1 Barcode Scanner Setup

The vast majority of barcode scanners (USB or Bluetooth) operate in
**"keyboard wedge" mode** — to the computer, they behave exactly like someone
typing very fast on a keyboard, followed by an Enter key. This means **no
driver installation is needed**; the scanner just types the barcode into
whichever input box is focused.

```
 ┌────────────────────┐        USB / Bluetooth         ┌─────────────────────┐
 │   Barcode Scanner   │ ───────(keyboard wedge)──────▶ │   Cashier's PC /     │
 │  (laser / CCD / 2D)  │                                │   Tablet (Browser)   │
 └────────────────────┘                                 │                       │
                                                          │  ┌─────────────────┐ │
                                                          │  │ Friends POS      │ │
                                                          │  │ POS.jsx page     │ │
                                                          │  │ [barcode input]◀─┼─┼── cursor must be
                                                          │  │  focused here    │ │   focused in this
                                                          │  └─────────────────┘ │   field when scanning
                                                          └─────────────────────┘
```

**Setup steps:**
1. Plug the USB receiver into the PC (or pair via Bluetooth, if applicable). Windows/macOS/Linux will detect it automatically as a generic HID keyboard — no driver download needed.
2. Open the **POS** page in Friends POS.
3. Click once inside the **"Scan barcode here..."** input box so it's focused.
4. Scan a product. The barcode types into the box and the form auto-submits (most scanners send an `Enter` keystroke after the code), which adds the item straight to the cart.
5. If your scanner doesn't send an Enter keystroke automatically, check its manual for a setting like **"Add Carriage Return / Suffix"** and enable it — this is a one-time scanner configuration, not a software change.

**If scanning doesn't work:**
- Click into the product search box and use the **on-screen product grid** instead — every product can be tapped/clicked to add to the cart, so checkout never has to stop because of a scanner issue.

### 4.2 Thermal Receipt Printer Setup

Thermal printers (the small receipt printers using ESC/POS commands) typically
connect in one of three ways. Browsers can't talk to USB/Serial printers
directly for security reasons, so Friends POS uses a small **print bridge**
to send receipts to the printer. We recommend **QZ Tray** (free, open-source)
for USB/Serial printers, or direct **network printing** for LAN/Wi-Fi printers.

```
                     ┌───────────────────────────────────────────┐
                     │              Friends POS (Browser)         │
                     │     Receipt.jsx → "Print Receipt" button   │
                     └───────────────────┬─────────────────────────┘
                                          │ sends ESC/POS print job
                       ┌──────────────────┼───────────────────────┐
                       │                  │                       │
                       ▼                  ▼                       ▼
            ┌─────────────────┐  ┌─────────────────┐   ┌─────────────────────┐
            │  USB Connection  │  │  Network (LAN/  │   │  Bluetooth (mobile/  │
            │  via QZ Tray     │  │  Wi-Fi) Printer  │   │  tablet) via         │
            │  print bridge    │  │  (IP:Port 9100)  │   │  Web Bluetooth API   │
            └────────┬─────────┘  └────────┬─────────┘   └──────────┬──────────┘
                      │                     │                        │
                      ▼                     ▼                        ▼
            ┌─────────────────────────────────────────────────────────────┐
            │                  Thermal Printer (58mm / 80mm)               │
            │                     prints receipt + QR code                 │
            └─────────────────────────────────────────────────────────────┘
```

#### Option A — USB Thermal Printer (most common, recommended)

1. **Install QZ Tray** (free print bridge app) on the cashier's PC:
   `https://qz.io/download/`
2. Connect the printer via USB and install the manufacturer driver
   (e.g. Epson TM-T20, Xprinter XP-58, GP-58 series — driver download is on
   the printer box or manufacturer site).
3. Open **QZ Tray** — it runs quietly in the system tray and listens for
   print jobs from the browser over a local secure WebSocket connection.
4. In Friends POS → **Settings → Printer**, select the detected printer
   name from the dropdown (Friends POS auto-detects printers registered
   with QZ Tray).
5. Click **"Print Test Receipt"** to confirm.

```
   PC USB Port ──cable──▶ Thermal Printer
        │
        ▼
   QZ Tray (background app)
        │  (listens on wss://localhost:8181)
        ▼
   Friends POS (browser tab)
```

#### Option B — Network (LAN / Wi-Fi) Thermal Printer

1. Connect the printer to the same Wi-Fi/LAN network as the till PC
   (most network thermal printers have a small LCD/button-based setup menu
   for entering Wi-Fi credentials, or an Ethernet port for a cable).
2. Find the printer's **IP address** (usually printed on a self-test receipt —
   hold the feed button while powering on).
3. In Friends POS → **Settings → Printer**, choose **"Network Printer"** and
   enter the printer's `IP address : Port` (default ESC/POS port is `9100`).
4. Click **"Print Test Receipt"**.

```
  Router / Wi-Fi
   │         │
   │         └────────────── Thermal Printer (static IP, port 9100)
   │
   └── Cashier PC/Tablet (Friends POS) ── sends print job directly over LAN
```

#### Option C — Bluetooth Printer (mobile/tablet checkout)

1. Pair the printer with the tablet/phone via Bluetooth settings (standard
   OS pairing, no app required for pairing itself).
2. In Friends POS (opened in a Bluetooth-capable browser like Chrome on
   Android), click **"Print Receipt" → Connect Bluetooth Printer** and
   select it from the picker.
3. Friends POS will remember the paired printer for future receipts.

#### Receipt Output

Every receipt prints with:
- Supermarket name, location, KRA PIN
- Itemized list with quantity & price
- Subtotal, discount, tax, total
- Payment method (+ M-Pesa receipt number, if applicable)
- A **QR code** for digital verification of the receipt

```
        ╔══════════════════════════╗
        ║   FRIENDS SUPERMARKET     ║
        ║   Buruburu, Nairobi       ║
        ║   KRA PIN: P05123456A     ║
        ╟──────────────────────────╢
        ║ Milk 500ml        x2  110 ║
        ║ Bread 400g        x1   65 ║
        ║ Sugar 2kg         x1  300 ║
        ╟──────────────────────────╢
        ║ TOTAL            KES 475 ║
        ║ Paid: M-PESA              ║
        ║                           ║
        ║      [ QR CODE ]          ║
        ║   Scan to verify          ║
        ╚══════════════════════════╝
```

---

## 5. Going Live on friendspos.com

| Component | Where it runs |
|---|---|
| Frontend (`frontend/dist`) | Static hosting (e.g. Vercel, Netlify, S3+CloudFront) behind `www.friendspos.com` |
| Backend (Django/DRF) | `api.friendspos.com` (e.g. Gunicorn + Nginx, on Railway/Render/EC2) |
| Database | Managed PostgreSQL |
| Media (QR codes, logos) | S3-compatible bucket (recommended for production, instead of local disk) |

Set `MPESA_CALLBACK_URL` to your **public** API domain
(`https://api.friendspos.com/api/payments/mpesa/callback/`) — Safaricom
must be able to reach this URL directly; it will not work with `localhost`.

---

## 6. Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| Scanner doesn't add items | Cursor not focused on the barcode input | Click into the scan box, or use the clickable product grid instead |
| Scanner adds barcode but doesn't submit | Scanner missing "Enter/Carriage Return" suffix | Enable that setting in the scanner's config (see manual / config barcode sheet) |
| "Printer not found" in Settings | QZ Tray not running, or printer driver not installed | Start QZ Tray from the system tray; reinstall printer driver |
| Network printer not printing | Wrong IP/port, or printer not on same network | Re-check IP via self-test receipt; confirm port `9100` is open |
| M-Pesa STK push not arriving | Wrong shortcode/passkey, or callback URL unreachable | Verify `.env` Daraja credentials; ensure `MPESA_CALLBACK_URL` is a public HTTPS URL |
| Session stuck on "Locked" after successful payment | Callback not received yet | Wait a few seconds (frontend polls automatically) or check Daraja callback logs |

---

## License

Proprietary — Friends POS SaaS (`www.friendspos.com`).
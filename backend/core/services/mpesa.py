"""
core/services/mpesa.py
M-Pesa Daraja API integration: access token + STK Push (Lipa Na M-Pesa Online).
"""

import base64
import datetime
import re

import requests
from django.conf import settings


DARAJA_BASE_URL = (
    "https://sandbox.safaricom.co.ke" if settings.MPESA_ENV == "sandbox"
    else "https://api.safaricom.co.ke"
)

# Safaricom's sandbox sits behind an Incapsula WAF that occasionally challenges
# requests lacking a normal browser User-Agent (returns a 403 HTML challenge
# page instead of a JSON error). Sending a standard UA avoids that.
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class MpesaError(Exception):
    """Raised when Daraja rejects a request. Carries the parsed error body."""

    def __init__(self, message, status_code=None, daraja_body=None):
        super().__init__(message)
        self.status_code = status_code
        self.daraja_body = daraja_body or {}


def normalize_phone_number(raw_phone):
    """
    Normalizes any common Kenyan phone format to Daraja's required
    2547XXXXXXXX / 2541XXXXXXXX (12 digits, no '+', no leading 0).

    Accepts: 0712345678, 712345678, +254712345678, 254712345678,
             with spaces or dashes.
    Raises MpesaError if the result isn't a valid Safaricom-format number.
    """
    digits = re.sub(r"\D", "", raw_phone or "")

    if digits.startswith("254") and len(digits) == 12:
        normalized = digits
    elif digits.startswith("0") and len(digits) == 10:
        normalized = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in ("7", "1"):
        normalized = "254" + digits
    else:
        normalized = digits

    if not re.fullmatch(r"254(7|1)\d{8}", normalized):
        raise MpesaError(
            f"Invalid phone number format: '{raw_phone}'. "
            "Expected a Kenyan Safaricom number, e.g. 0712345678 or 254712345678."
        )
    return normalized


def get_access_token():
    url = f"{DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(
        url,
        auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
        headers=_REQUEST_HEADERS,
        timeout=30,
    )
    if not response.ok:
        raise MpesaError(
            "Failed to obtain M-Pesa access token. Check MPESA_CONSUMER_KEY/SECRET "
            f"and MPESA_ENV. Daraja responded {response.status_code}: {response.text}",
            status_code=response.status_code,
            daraja_body=_safe_json(response),
        )
    return response.json()["access_token"]


def _generate_password_and_timestamp():
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    raw = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    password = base64.b64encode(raw.encode()).decode()
    return password, timestamp


def _safe_json(response):
    try:
        return response.json()
    except ValueError:
        text = response.text
        if "Incapsula" in text or "<html" in text.lower():
            return {
                "raw_text": text,
                "note": (
                    "This looks like a WAF/bot-protection challenge page (e.g. "
                    "Incapsula) from Safaricom's edge, not a real Daraja JSON "
                    "error. Usually fixed by adding a normal browser User-Agent "
                    "header or waiting a few minutes before retrying."
                ),
            }
        return {"raw_text": text}


def initiate_stk_push(phone_number, amount, account_reference, transaction_desc):
    """
    Triggers an STK Push prompt on the customer's/cashier's phone.
    Returns the raw Daraja response dict (MerchantRequestID, CheckoutRequestID, etc).

    Raises MpesaError (with the parsed Daraja error body attached) on failure,
    instead of a bare requests.HTTPError, so callers can surface a useful
    message instead of a generic 500.
    """
    normalized_phone = normalize_phone_number(phone_number)

    access_token = get_access_token()
    password, timestamp = _generate_password_and_timestamp()

    url = f"{DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest"
    headers = {**_REQUEST_HEADERS, "Authorization": f"Bearer {access_token}"}
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": normalized_phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": normalized_phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_reference[:12],  # Daraja caps this at 12 chars
        "TransactionDesc": transaction_desc[:13],     # Daraja caps this at 13 chars
    }

    response = requests.post(url, json=payload, headers=headers, timeout=30)

    if not response.ok:
        body = _safe_json(response)
        # Daraja error bodies look like:
        # {"requestId": "...", "errorCode": "400.002.02", "errorMessage": "Bad Request - ..."}
        error_message = body.get("errorMessage") or body.get("errorMessage") or str(body)
        raise MpesaError(
            f"Daraja STK push rejected ({response.status_code}): {error_message}",
            status_code=response.status_code,
            daraja_body=body,
        )

    return response.json()
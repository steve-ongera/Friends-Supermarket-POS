"""
core/services/mpesa.py
M-Pesa Daraja API integration: access token + STK Push (Lipa Na M-Pesa Online).
"""

import base64
import datetime
import requests
from django.conf import settings

DARAJA_BASE_URL = (
    "https://sandbox.safaricom.co.ke" if settings.MPESA_ENV == "sandbox"
    else "https://api.safaricom.co.ke"
)


def get_access_token():
    url = f"{DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials"
    response = requests.get(
        url, auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET), timeout=30
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _generate_password_and_timestamp():
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    raw = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    password = base64.b64encode(raw.encode()).decode()
    return password, timestamp


def initiate_stk_push(phone_number, amount, account_reference, transaction_desc):
    """
    Triggers an STK Push prompt on the customer's/cashier's phone.
    Returns the raw Daraja response dict (MerchantRequestID, CheckoutRequestID, etc).
    """
    access_token = get_access_token()
    password, timestamp = _generate_password_and_timestamp()

    url = f"{DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest"
    headers = {"Authorization": f"Bearer {access_token}"}
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone_number,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone_number,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_reference,
        "TransactionDesc": transaction_desc,
    }

    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()
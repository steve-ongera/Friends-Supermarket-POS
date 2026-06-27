"""
core/services/qrcode_service.py
Generates a QR code for each Sale receipt and attaches it to Sale.qr_code.
"""

import io
import qrcode
from django.core.files.base import ContentFile


def generate_receipt_qr(sale):
    """
    Encodes the receipt number (+ verification URL) into a QR code image
    and saves it to the Sale.qr_code ImageField.
    """
    verify_url = f"https://yourdomain.com/verify-receipt/{sale.receipt_number}"

    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(verify_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    file_name = f"{sale.receipt_number}.png"

    sale.qr_code.save(file_name, ContentFile(buffer.getvalue()), save=True)
    return sale.qr_code
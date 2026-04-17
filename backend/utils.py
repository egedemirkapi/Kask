import secrets
import string
import qrcode
import base64
from io import BytesIO

_ALPHABET = string.ascii_uppercase + string.digits


def generate_room_code() -> str:
    return ''.join(secrets.choice(_ALPHABET) for _ in range(6))


def generate_qr(url: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"

import secrets
import string
import plistlib
import urllib.parse
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


def generate_shortcut_plist(room_code: str, student_name: str, app: str, event: str, api_url: str) -> bytes:
    url = (
        f"{api_url}/app-event"
        f"?room_code={urllib.parse.quote(room_code)}"
        f"&student_name={urllib.parse.quote(student_name)}"
        f"&app={urllib.parse.quote(app)}"
        f"&event={event}"
    )
    shortcut = {
        "WFWorkflowClientVersion": "1140.10",
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": 59511,
            "WFWorkflowIconStartColor": 946986751,
        },
        "WFWorkflowImportQuestions": [],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowName": f"CC {app} {'Opened' if event == 'opened' else 'Closed'}",
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowTypes": [],
        "WFWorkflowActions": [
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
                "WFWorkflowActionParameters": {
                    "ShowHeaders": False,
                    "WFHTTPMethod": "GET",
                    "WFURL": url,
                },
            }
        ],
    }
    return plistlib.dumps(shortcut, fmt=plistlib.FMT_XML)

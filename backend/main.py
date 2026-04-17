import os
import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from session_manager import SessionManager
from models import CreateSessionResponse, SessionExistsResponse, AppEventRequest
from utils import generate_room_code, generate_qr, generate_shortcut_plist

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "https://kask.onrender.com")
ALLOWED_STUDENT_TYPES = {"TAB_SWITCHED", "TAB_RESTORED", "URL_CHANGED", "WORKING_IN_APP"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(sessions.cleanup_expired())
    yield

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="ClassControl API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "chrome-extension://*", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = SessionManager()


# ── REST ────────────────────────────────────────────────────────────────────

@app.post("/session/create", response_model=CreateSessionResponse)
@limiter.limit("10/hour")
async def create_session(request: Request):
    room_code = generate_room_code()
    join_url = f"{FRONTEND_URL}/join?code={room_code}"
    qr_data_url = generate_qr(join_url)
    sessions.create(room_code)
    return CreateSessionResponse(room_code=room_code, qr_data_url=qr_data_url)


@app.get("/session/{room_code}/exists", response_model=SessionExistsResponse)
async def session_exists(room_code: str):
    return SessionExistsResponse(exists=sessions.exists(room_code))


@app.get("/app-event")
async def app_event_get(request: Request, room_code: str, student_name: str, app: str, event: str):
    return await _process_app_event(room_code, student_name, app, event)


@app.post("/app-event")
@limiter.limit("60/minute")
async def app_event(request: Request, data: AppEventRequest):
    return await _process_app_event(data.room_code, data.student_name, data.app, data.event)


async def _process_app_event(room_code: str, student_name: str, app: str, event: str):
    session = sessions.get(room_code)
    if not session:
        return {"ok": False, "error": "Session not found"}

    student_id = next(
        (sid for sid, s in session["students"].items()
         if s["name"].lower() == student_name.lower()),
        None
    )
    if not student_id:
        return {"ok": False, "error": "Student not found"}

    student = session["students"][student_id]
    if event == "opened":
        student["status"] = "in_app"
        student["current_app"] = app
    else:
        student["status"] = "active"
        student["current_app"] = None

    if session.get("teacher_ws"):
        await _safe_send(session["teacher_ws"], {
            "type": "STUDENT_APP_EVENT",
            "student_id": student_id,
            "name": student_name,
            "app": app,
            "event": event
        })

    return {"ok": True}


@app.get("/shortcut")
async def download_shortcut(room_code: str, student_name: str, app: str, event: str):
    if event not in ("opened", "closed"):
        return {"error": "event must be opened or closed"}
    plist_data = generate_shortcut_plist(room_code, student_name, app, event, API_PUBLIC_URL)
    safe_app = app.replace(" ", "_")
    filename = f"CC_{safe_app}_{event}.shortcut"
    return FastAPIResponse(
        content=plist_data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── WebSockets ───────────────────────────────────────────────────────────────

@app.websocket("/ws/teacher/{room_code}")
async def teacher_ws(websocket: WebSocket, room_code: str):
    if not sessions.exists(room_code):
        await websocket.close(code=4004)
        return

    await websocket.accept()
    session = sessions.get(room_code)
    session["teacher_ws"] = websocket

    await websocket.send_json({
        "type": "SESSION_STATE",
        "students": [
            {"id": sid, "name": s["name"], "device": s["device"],
             "status": s["status"], "last_url": s["last_url"],
             "current_app": s.get("current_app")}
            for sid, s in session["students"].items()
        ],
        "rules": session["rules"]
    })

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_teacher_msg(data, room_code, session)
    except WebSocketDisconnect:
        session["teacher_ws"] = None


async def _handle_teacher_msg(data: dict, room_code: str, session: dict):
    msg_type = data.get("type")

    if msg_type == "SET_WHITELIST":
        session["rules"]["whitelist"] = data.get("urls", [])
        await _broadcast_students(session, {"type": "SET_WHITELIST", "urls": session["rules"]["whitelist"]})

    elif msg_type == "LOCK_URL":
        session["rules"]["locked_url"] = data.get("url")
        await _broadcast_students(session, {"type": "LOCK_URL", "url": data.get("url")})

    elif msg_type == "SEND_MESSAGE":
        sid = data.get("student_id")
        if sid in session["students"]:
            await _safe_send(session["students"][sid]["ws"], {"type": "MESSAGE", "text": data.get("text", "")})

    elif msg_type == "BROADCAST_MSG":
        await _broadcast_students(session, {"type": "MESSAGE", "text": data.get("text", "")})

    elif msg_type == "KICK":
        sid = data.get("student_id")
        if sid in session["students"]:
            await _safe_send(session["students"][sid]["ws"], {"type": "KICKED"})
            await _safe_close(session["students"][sid]["ws"])
            del session["students"][sid]

    elif msg_type == "END_SESSION":
        await _broadcast_students(session, {"type": "SESSION_ENDED"})
        for s in list(session["students"].values()):
            await _safe_close(s["ws"])
        sessions.delete(room_code)


@app.websocket("/ws/student/{room_code}")
async def student_ws(websocket: WebSocket, room_code: str):
    if not sessions.exists(room_code):
        await websocket.close(code=4004)
        return

    await websocket.accept()
    session = sessions.get(room_code)

    try:
        data = await websocket.receive_json()
    except Exception:
        await websocket.close(code=4003)
        return

    if data.get("type") != "JOINED":
        await websocket.close(code=4003)
        return

    sid = str(uuid.uuid4())
    name = str(data.get("name", "Student"))[:30]
    device = data.get("device", "safari")

    session["students"][sid] = {
        "ws": websocket,
        "name": name,
        "device": device,
        "status": "active",
        "last_url": None,
        "current_app": None,
        "joined_at": datetime.utcnow().timestamp()
    }

    await websocket.send_json({"type": "SESSION_RULES", "rules": session["rules"]})

    if session["teacher_ws"]:
        await _safe_send(session["teacher_ws"], {
            "type": "STUDENT_JOINED",
            "student": {"id": sid, "name": name, "device": device, "status": "active", "last_url": None, "current_app": None}
        })

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_student_msg(data, sid, name, session)
    except WebSocketDisconnect:
        session["students"].pop(sid, None)
        if session.get("teacher_ws"):
            await _safe_send(session["teacher_ws"], {
                "type": "STUDENT_DISCONNECTED",
                "student_id": sid,
                "name": name
            })


async def _handle_student_msg(data: dict, sid: str, name: str, session: dict):
    if data.get("type") not in ALLOWED_STUDENT_TYPES:
        return
    if sid not in session["students"]:
        return

    student = session["students"][sid]
    teacher_ws = session.get("teacher_ws")
    msg_type = data["type"]

    if msg_type == "TAB_SWITCHED":
        student["status"] = "switched"
        if teacher_ws:
            await _safe_send(teacher_ws, {
                "type": "STUDENT_SWITCHED",
                "student_id": sid,
                "name": name,
                "timestamp": data.get("timestamp")
            })

    elif msg_type == "TAB_RESTORED":
        student["status"] = "active"
        if teacher_ws:
            await _safe_send(teacher_ws, {"type": "STUDENT_RESTORED", "student_id": sid})

    elif msg_type == "URL_CHANGED":
        student["last_url"] = str(data.get("url", ""))[:500]

    elif msg_type == "WORKING_IN_APP":
        student["status"] = "working"
        if teacher_ws:
            await _safe_send(teacher_ws, {
                "type": "STUDENT_WORKING",
                "student_id": sid,
                "name": name
            })


async def _broadcast_students(session: dict, message: dict):
    for s in list(session["students"].values()):
        await _safe_send(s["ws"], message)


async def _safe_send(ws: WebSocket, message: dict):
    try:
        await ws.send_json(message)
    except Exception:
        pass


async def _safe_close(ws: WebSocket):
    try:
        await ws.close()
    except Exception:
        pass

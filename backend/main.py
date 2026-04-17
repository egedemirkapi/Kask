import os
import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from session_manager import SessionManager
from models import CreateSessionResponse, SessionExistsResponse
from utils import generate_room_code, generate_qr

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_STUDENT_TYPES = {"TAB_SWITCHED", "TAB_RESTORED", "URL_CHANGED"}

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
             "status": s["status"], "last_url": s["last_url"]}
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
        "joined_at": datetime.utcnow().timestamp()
    }

    await websocket.send_json({"type": "SESSION_RULES", "rules": session["rules"]})

    if session["teacher_ws"]:
        await _safe_send(session["teacher_ws"], {
            "type": "STUDENT_JOINED",
            "student": {"id": sid, "name": name, "device": device, "status": "active", "last_url": None}
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

import asyncio
from datetime import datetime
from typing import Optional

SESSION_EXPIRY_SECONDS = 4 * 3600


class SessionManager:
    def __init__(self):
        self._sessions: dict = {}

    def create(self, room_code: str) -> None:
        self._sessions[room_code] = {
            "teacher_ws": None,
            "students": {},
            "rules": {"whitelist": [], "locked_url": None},
            "created_at": datetime.utcnow().timestamp()
        }

    def exists(self, room_code: str) -> bool:
        return room_code in self._sessions

    def get(self, room_code: str) -> Optional[dict]:
        return self._sessions.get(room_code)

    def delete(self, room_code: str) -> None:
        self._sessions.pop(room_code, None)

    async def cleanup_expired(self) -> None:
        while True:
            await asyncio.sleep(3600)
            now = datetime.utcnow().timestamp()
            expired = [
                code for code, s in self._sessions.items()
                if now - s["created_at"] > SESSION_EXPIRY_SECONDS
            ]
            for code in expired:
                self.delete(code)

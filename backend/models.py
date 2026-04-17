from pydantic import BaseModel
from typing import Optional


class CreateSessionResponse(BaseModel):
    room_code: str
    qr_data_url: str


class SessionExistsResponse(BaseModel):
    exists: bool


class AppEventRequest(BaseModel):
    room_code: str
    student_name: str
    app: str
    event: str  # "opened" or "closed"

from pydantic import BaseModel
from typing import Optional


class CreateSessionResponse(BaseModel):
    room_code: str
    qr_data_url: str
    ipad_monitoring_enabled: bool


class SessionExistsResponse(BaseModel):
    exists: bool


class AppEventRequest(BaseModel):
    room_code: str
    student_name: str
    app: str
    event: str  # "opened" or "closed"


class DnsStatusResponse(BaseModel):
    enabled: bool
    profile_id: Optional[str] = None
    blocked_categories: list[str] = []


class DnsLogEntry(BaseModel):
    domain: str
    timestamp: str
    status: str
    device_name: Optional[str] = None


class DnsLogsResponse(BaseModel):
    enabled: bool
    logs: list[DnsLogEntry] = []


class AddAllowedDomainRequest(BaseModel):
    domain: str


class ManualProfileRequest(BaseModel):
    profile_id: str


class ManualProfileResponse(BaseModel):
    ok: bool
    profile_id: str

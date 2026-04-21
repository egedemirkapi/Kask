"""NextDNS API integration for iPad-level domain monitoring and blocking.

Each ClassControl session provisions a unique NextDNS profile.
Teachers distribute the profile (.mobileconfig) to student iPads via AirDrop.
All iPad traffic (Safari, in-app webviews, Notability embeds) is then visible
in the teacher dashboard as a real-time domain log.

Falls back gracefully when NEXTDNS_API_KEY is unset — endpoints return a clear
"unconfigured" status so the frontend can show setup instructions.
"""

import os
import plistlib
from typing import Optional
import httpx

NEXTDNS_API_BASE = "https://api.nextdns.io"
NEXTDNS_DOH_BASE = "https://dns.nextdns.io"

DEFAULT_BLOCKED_CATEGORIES = [
    "social-networks",
    "video-streaming",
    "gambling",
    "porn",
    "dating",
    "piracy",
]

DEFAULT_BLOCKED_SERVICES = [
    "youtube",
    "tiktok",
    "instagram",
    "snapchat",
    "reddit",
    "twitch",
    "discord",
    "roblox",
    "fortnite",
]


def is_configured() -> bool:
    return bool(os.getenv("NEXTDNS_API_KEY"))


def _headers() -> dict:
    return {
        "X-Api-Key": os.getenv("NEXTDNS_API_KEY", ""),
        "Content-Type": "application/json",
    }


async def create_profile(room_code: str) -> Optional[str]:
    """Create a NextDNS profile scoped to this classroom session.
    Returns the profile id (used in DoH endpoint) or None if API unavailable.
    """
    if not is_configured():
        return None

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{NEXTDNS_API_BASE}/profiles",
                headers=_headers(),
                json={"name": f"ClassControl-{room_code}"},
            )
            resp.raise_for_status()
            profile_id = resp.json().get("data", {}).get("id")
            if not profile_id:
                return None

            await _apply_default_rules(client, profile_id)
            return profile_id
        except (httpx.HTTPError, ValueError):
            return None


async def _apply_default_rules(client: httpx.AsyncClient, profile_id: str) -> None:
    """Block distracting categories and services by default."""
    base = f"{NEXTDNS_API_BASE}/profiles/{profile_id}"

    for category in DEFAULT_BLOCKED_CATEGORIES:
        try:
            await client.post(
                f"{base}/parentalcontrol/categories",
                headers=_headers(),
                json={"id": category, "active": True},
            )
        except httpx.HTTPError:
            pass

    for service in DEFAULT_BLOCKED_SERVICES:
        try:
            await client.post(
                f"{base}/parentalcontrol/services",
                headers=_headers(),
                json={"id": service, "active": True},
            )
        except httpx.HTTPError:
            pass


async def delete_profile(profile_id: str) -> None:
    if not is_configured() or not profile_id:
        return
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.delete(
                f"{NEXTDNS_API_BASE}/profiles/{profile_id}",
                headers=_headers(),
            )
        except httpx.HTTPError:
            pass


async def fetch_recent_logs(profile_id: str, limit: int = 100) -> list[dict]:
    """Fetch the most recent DNS queries for this profile.
    Each entry: {domain, timestamp, status, device_name}
    """
    if not is_configured() or not profile_id:
        return []
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{NEXTDNS_API_BASE}/profiles/{profile_id}/logs",
                headers=_headers(),
                params={"limit": limit},
            )
            resp.raise_for_status()
            return resp.json().get("data", [])
        except (httpx.HTTPError, ValueError):
            return []


async def add_allowed_domain(profile_id: str, domain: str) -> bool:
    if not is_configured() or not profile_id:
        return False
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{NEXTDNS_API_BASE}/profiles/{profile_id}/allowlist",
                headers=_headers(),
                json={"id": domain, "active": True},
            )
            return resp.status_code in (200, 201, 204)
        except httpx.HTTPError:
            return False


async def remove_allowed_domain(profile_id: str, domain: str) -> bool:
    if not is_configured() or not profile_id:
        return False
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.delete(
                f"{NEXTDNS_API_BASE}/profiles/{profile_id}/allowlist/hex:{domain.encode().hex()}",
                headers=_headers(),
            )
            return resp.status_code in (200, 204)
        except httpx.HTTPError:
            return False


def build_mobileconfig(profile_id: str, room_code: str) -> bytes:
    """Build an iOS configuration profile that routes all DNS through this
    NextDNS session profile. Teacher AirDrops it to each student iPad once;
    student taps install in Settings (about 4 taps).
    """
    payload_uuid = f"CC-{room_code}-DNS"
    profile_uuid = f"CC-{room_code}"
    doh_url = f"{NEXTDNS_DOH_BASE}/{profile_id}"

    profile = {
        "PayloadContent": [
            {
                "PayloadType": "com.apple.dnsSettings.managed",
                "PayloadVersion": 1,
                "PayloadIdentifier": f"app.classcontrol.dns.{room_code}",
                "PayloadUUID": payload_uuid,
                "PayloadDisplayName": f"ClassControl DNS ({room_code})",
                "PayloadDescription": "Routes DNS through ClassControl during this class session.",
                "DNSSettings": {
                    "DNSProtocol": "HTTPS",
                    "ServerURL": doh_url,
                },
            }
        ],
        "PayloadDisplayName": f"ClassControl Session {room_code}",
        "PayloadIdentifier": f"app.classcontrol.{room_code}",
        "PayloadType": "Configuration",
        "PayloadUUID": profile_uuid,
        "PayloadVersion": 1,
        "PayloadDescription": (
            "Lets your teacher see and limit which sites this iPad visits "
            "during the class session. Remove anytime under Settings, General, "
            "VPN and Device Management."
        ),
        "PayloadOrganization": "ClassControl",
        "PayloadRemovalDisallowed": False,
    }

    return plistlib.dumps(profile, fmt=plistlib.FMT_XML)

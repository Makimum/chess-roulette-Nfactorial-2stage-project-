from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_address

from fastapi import Request


COUNTRY_HEADER_NAMES = (
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
    "x-country-code",
)

IP_HEADER_NAMES = (
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
)


@dataclass(frozen=True)
class LocationSnapshot:
    country_code: str


def _normalize_country_code(value: str | None) -> str | None:
    if not value:
        return None
    code = value.strip().upper()
    if len(code) != 2 or code in {"XX", "T1"}:
        return None
    return code


def client_ip_from_request(request: Request | None) -> str | None:
    if not request:
        return None
    for header_name in IP_HEADER_NAMES:
        raw_value = request.headers.get(header_name)
        if not raw_value:
            continue
        candidate = raw_value.split(",", 1)[0].strip()
        if candidate:
            return candidate
    return request.client.host if request.client else None


def is_public_ip(value: str | None) -> bool:
    if not value:
        return False
    try:
        parsed = ip_address(value)
    except ValueError:
        return False
    return not (
        parsed.is_private
        or parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_multicast
        or parsed.is_reserved
        or parsed.is_unspecified
    )


def resolve_location_snapshot(request: Request | None) -> LocationSnapshot:
    """Resolve an immutable registration country snapshot.

    In production behind Cloudflare/Vercel/CloudFront the country headers are
    derived from the client IP at the edge. When those headers are absent, we
    store the country code as unknown instead of trusting user-provided data.
    """

    for header_name in COUNTRY_HEADER_NAMES:
        country_code = _normalize_country_code(request.headers.get(header_name) if request else None)
        if country_code:
            return LocationSnapshot(country_code=country_code)
    return LocationSnapshot(country_code="XX")

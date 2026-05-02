"""app.parsers.router — public endpoint POST /api/parse/car-link.

Принимает URL объявления (mobile.de), возвращает структурированные данные.
Stateless, без auth (нужен и анонимам перед заказом проверки).

Лёгкий rate-limit: дополнительная защита поверх глобального rate-limit middleware.
"""
from __future__ import annotations
import time
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.parsers.mobile_de import parse_url

logger = logging.getLogger("parsers.router")

router = APIRouter(prefix="/api/parse", tags=["parsers"])


class CarLinkRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)


# in-memory rate limit (по IP, 20 запросов / 60 сек на парсер)
_rate_state: dict[str, list[float]] = {}
_RATE_LIMIT = 20
_RATE_WINDOW = 60.0


def _ip_throttle(ip: str) -> bool:
    now = time.time()
    bucket = _rate_state.setdefault(ip, [])
    # cleanup
    cutoff = now - _RATE_WINDOW
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= _RATE_LIMIT:
        return False
    bucket.append(now)
    return True


@router.post("/car-link")
async def parse_car_link(payload: CarLinkRequest, request: Request):
    """Parse external car listing URL → structured data.

    Currently supports: **mobile.de**.

    Response shape:
    ```
    {
      "parsed": true,
      "source": "mobile.de",
      "sourceUrl": "...",
      "title": "Audi A6 2.0 TDI",
      "make": "Audi", "model": "A6 2.0 TDI",
      "year": 2018, "price": 18900, "currency": "EUR",
      "mileage": 120000, "fuel": "diesel",
      "image": "https://...",
      "marketAvg": 18000,
      "listingId": "..."
    }
    ```
    """
    ip = (request.client.host if request.client else None) or "anon"
    if not _ip_throttle(ip):
        raise HTTPException(status_code=429, detail={"error": True, "code": "RATE_LIMITED",
                                                     "message": "Too many parse requests"})

    url = payload.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url

    try:
        data = await parse_url(url)
    except Exception:
        logger.exception(f"parse_car_link failed url={url}")
        raise HTTPException(status_code=500, detail={"error": True, "code": "PARSE_ERROR",
                                                     "message": "Failed to parse listing"})

    return data


@router.get("/supported-sources")
async def supported_sources():
    """List of currently supported listing platforms."""
    return {
        "sources": [
            {"id": "mobile.de", "name": "mobile.de", "country": "DE", "active": True},
            # future: autoscout24, kleinanzeigen, ebay-motors
        ]
    }

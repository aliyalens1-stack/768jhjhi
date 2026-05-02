"""app.customer.router — Sprint 21 C16 extraction from server.py.

Все endpoints /api/customer/* перенесены 1-в-1 (без изменения поведения).
Зависимости, которые раньше жили в server.py module scope, теперь берутся
из app.core.* (ctx, db, config, security).
"""
from __future__ import annotations
import random
import logging
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.core.config import NESTJS_URL, JWT_SECRET, JWT_ALGO
from app.core.context import ctx
from app.core.db import db
from app.core.security import verify_admin_token
from app.core.utils import now_utc, uid
from app.customer.service import rebuild_customer_intelligence


logger = logging.getLogger("server")

router = APIRouter()

# shim: старый код использует `http_client` как имя. Резолвим в runtime через ctx.
class _HttpClientProxy:
    def __getattr__(self, name):
        return getattr(ctx.http_client, name)

http_client = _HttpClientProxy()




@router.get("/api/customer/intelligence")
async def get_customer_intelligence(request: Request):
    """Get customer intelligence profile"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    # Try cached first
    cached = await db.customer_intelligence.find_one({"customerId": cid}, {"_id": 0})
    if cached:
        return cached
    
    # Rebuild
    # Runtime import чтобы избежать circular (server.py ← app/customer/router.py).
    # rebuild_customer_intelligence остаётся в server.py (использует только db),
    # вынос в app/customer/service.py — tech debt (не-blocking).
    from server import rebuild_customer_intelligence
    return await rebuild_customer_intelligence(cid)





# ── C.2: Favorites Engine ──

@router.get("/api/customer/favorites")
async def get_customer_favorites(request: Request):
    """Get customer favorites list with provider details"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    favs = await db.customer_favorites.find({"customerId": cid}, {"_id": 0}).to_list(50)
    
    # Enrich with provider data
    enriched = []
    for f in favs:
        provider = await db.organizations.find_one({"slug": f.get("providerId")}, {"_id": 0, "name": 1, "slug": 1, "ratingAvg": 1, "reviewsCount": 1, "isOnline": 1, "address": 1, "priceFrom": 1, "badges": 1, "type": 1, "workHours": 1})
        if provider:
            enriched.append({**f, "provider": provider})
        else:
            enriched.append(f)
    
    return {"favorites": enriched, "total": len(enriched)}





@router.post("/api/customer/favorites")
async def add_customer_favorite(request: Request):
    """Add provider to favorites"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    body = await request.json()
    provider_id = body.get("providerId")
    if not provider_id:
        raise HTTPException(400, "providerId required")
    
    existing = await db.customer_favorites.find_one({"customerId": cid, "providerId": provider_id})
    if not existing:
        await db.customer_favorites.insert_one({
            "customerId": cid, "providerId": provider_id,
            "createdAt": now_utc().isoformat(),
        })
    
    count = await db.customer_favorites.count_documents({"customerId": cid})
    
    # Track behavior
    await db.customer_behavior_events.insert_one({
        "customerId": cid, "type": "favorite_added", "providerId": provider_id,
        "timestamp": now_utc().isoformat(),
    })
    
    return {"ok": True, "favoriteCount": count}





@router.delete("/api/customer/favorites/{provider_id}")
async def remove_customer_favorite(provider_id: str, request: Request):
    """Remove provider from favorites"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    await db.customer_favorites.delete_one({"customerId": cid, "providerId": provider_id})
    count = await db.customer_favorites.count_documents({"customerId": cid})
    return {"ok": True, "favoriteCount": count}





# ── C.3: Repeat Booking Engine ──

@router.get("/api/customer/repeat-options")
async def get_repeat_options(request: Request):
    """Get repeat booking options based on history"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    # Get recent completed bookings
    bookings = await db.web_bookings.find(
        {"customerId": cid, "status": "completed"},
        {"_id": 0}
    ).sort("completedAt", -1).to_list(20)
    
    if not bookings:
        bookings = await db.bookings.find(
            {"customerId": cid, "status": "completed"},
            {"_id": 0}
        ).sort("createdAt", -1).to_list(20)
    
    # Build repeat options with scoring
    seen = set()
    options = []
    
    for b in bookings:
        pid = b.get("providerId", b.get("organizationSlug", ""))
        sid = b.get("serviceId", b.get("serviceName", ""))
        key = f"{pid}_{sid}"
        if key in seen or not pid:
            continue
        seen.add(key)
        
        # Recency score (0-1): recent = higher
        created = b.get("completedAt", b.get("createdAt", ""))
        days_ago = 30  # default
        if created:
            try:
                from dateutil.parser import parse as parse_dt
                delta = now_utc() - parse_dt(created).replace(tzinfo=timezone.utc)
                days_ago = delta.days
            except Exception:
                pass
        recency = max(0, min(1, 1 - days_ago / 180))
        
        # Frequency score
        freq_count = sum(1 for bb in bookings if bb.get("providerId", bb.get("organizationSlug")) == pid)
        frequency = min(1, freq_count / 5)
        
        # Provider rating score
        provider = await db.organizations.find_one({"slug": pid}, {"_id": 0, "name": 1, "ratingAvg": 1, "isOnline": 1, "priceFrom": 1})
        rating_score = (provider.get("ratingAvg", 4) / 5) if provider else 0.8
        
        confidence = round(recency * 0.35 + frequency * 0.30 + rating_score * 0.20 + 0.15, 2)
        
        options.append({
            "providerId": pid,
            "serviceId": sid,
            "vehicleId": b.get("vehicleId"),
            "title": f"Повторить: {b.get('serviceName', sid)}",
            "providerName": provider.get("name", pid) if provider else pid,
            "priceFrom": provider.get("priceFrom") if provider else b.get("price"),
            "isOnline": provider.get("isOnline", False) if provider else False,
            "lastOrderedAt": created,
            "daysAgo": days_ago,
            "repeatConfidence": confidence,
        })
    
    options.sort(key=lambda x: -x["repeatConfidence"])
    return {"options": options[:5], "total": len(options)}





@router.post("/api/customer/repeat-booking")
async def create_repeat_booking(request: Request):
    """Create a repeat booking from history"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    body = await request.json()
    pid = body.get("providerId")
    sid = body.get("serviceId")
    vid = body.get("vehicleId")
    
    if not pid or not sid:
        raise HTTPException(400, "providerId and serviceId required")
    
    # Create booking draft
    booking = {
        "id": uid(), "customerId": cid, "providerId": pid,
        "serviceId": sid, "vehicleId": vid,
        "source": "repeat", "status": "draft",
        "createdAt": now_utc().isoformat(),
    }
    await db.web_bookings.insert_one(booking)
    booking.pop("_id", None)
    
    # Track behavior
    await db.customer_behavior_events.insert_one({
        "customerId": cid, "type": "repeat_clicked", "providerId": pid, "serviceId": sid,
        "timestamp": now_utc().isoformat(),
    })
    
    return {"status": "draft_created", "booking": booking}





# ── C.4: Garage Intelligence ──

@router.get("/api/customer/garage/recommendations")
async def get_garage_recommendations(request: Request):
    """Get vehicle-aware maintenance recommendations"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    vehicles = await db.vehicles.find({"userId": cid}, {"_id": 0}).to_list(10)
    
    recommendations = []
    
    for v in vehicles:
        vid = v.get("id", str(v.get("_id", "")))
        brand = v.get("brand", v.get("make", "Авто"))
        model_name = v.get("model", "")
        year = v.get("year", 2020)
        
        # Get last service dates from bookings
        last_oil = await db.web_bookings.find_one(
            {"customerId": cid, "vehicleId": vid, "serviceName": {"$regex": "масл|oil", "$options": "i"}, "status": "completed"},
            {"_id": 0}
        )
        last_diag = await db.web_bookings.find_one(
            {"customerId": cid, "vehicleId": vid, "serviceName": {"$regex": "диагност|diagnostics", "$options": "i"}, "status": "completed"},
            {"_id": 0}
        )
        last_brakes = await db.web_bookings.find_one(
            {"customerId": cid, "vehicleId": vid, "serviceName": {"$regex": "тормоз|brake", "$options": "i"}, "status": "completed"},
            {"_id": 0}
        )
        
        car_name = f"{brand} {model_name}".strip()
        car_age = 2026 - year
        
        # Oil change recommendation
        months_since_oil = 7  # default
        if last_oil:
            try:
                from dateutil.parser import parse as parse_dt
                d = now_utc() - parse_dt(last_oil.get("completedAt", last_oil.get("createdAt", ""))).replace(tzinfo=timezone.utc)
                months_since_oil = d.days // 30
            except Exception:
                pass
        
        if months_since_oil >= 6:
            urgency = "high" if months_since_oil >= 10 else "medium"
            recommendations.append({
                "vehicleId": vid, "vehicleName": car_name,
                "type": "oil_change", "title": "Замена масла",
                "reason": f"Прошло {months_since_oil} мес. с прошлой замены" if last_oil else "Рекомендуем регулярную замену масла",
                "urgency": urgency, "confidence": min(0.95, 0.5 + months_since_oil * 0.05),
                "serviceSlug": "oil-change",
            })
        
        # Diagnostics recommendation
        months_since_diag = 13  # default
        if last_diag:
            try:
                from dateutil.parser import parse as parse_dt
                d = now_utc() - parse_dt(last_diag.get("completedAt", last_diag.get("createdAt", ""))).replace(tzinfo=timezone.utc)
                months_since_diag = d.days // 30
            except Exception:
                pass
        
        if months_since_diag >= 12:
            recommendations.append({
                "vehicleId": vid, "vehicleName": car_name,
                "type": "diagnostics", "title": "Компьютерная диагностика",
                "reason": f"Прошло {months_since_diag} мес. — пора проверить" if last_diag else "Рекомендуем ежегодную диагностику",
                "urgency": "medium", "confidence": 0.7,
                "serviceSlug": "computer-diagnostics",
            })
        
        # Age-based
        if car_age >= 5:
            recommendations.append({
                "vehicleId": vid, "vehicleName": car_name,
                "type": "seasonal_check", "title": "Сезонный осмотр",
                "reason": f"Авто {year} года — рекомендуем регулярные проверки",
                "urgency": "low", "confidence": 0.55,
                "serviceSlug": "full-maintenance",
            })
    
    recommendations.sort(key=lambda x: -x["confidence"])
    return {"recommendations": recommendations, "total": len(recommendations)}





# ── C.5: Unified Recommendation Engine ──

@router.get("/api/customer/recommendations")
async def get_customer_recommendations(request: Request):
    """Unified recommendation engine: repeat, favorites, maintenance, zone"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    recs = []
    
    # 1. Repeat booking recs
    try:
        repeat_opts = await db.web_bookings.find(
            {"customerId": cid, "status": "completed"},
            {"_id": 0}
        ).sort("completedAt", -1).to_list(5)
        
        if repeat_opts:
            b = repeat_opts[0]
            pid = b.get("providerId", b.get("organizationSlug", ""))
            provider = await db.organizations.find_one({"slug": pid}, {"_id": 0, "name": 1, "isOnline": 1})
            pname = provider.get("name", pid) if provider else pid
            recs.append({
                "id": uid(), "type": "repeat_booking", "priority": 90,
                "title": f"Повторить: {b.get('serviceName', 'заказ')}",
                "subtitle": f"У {pname}" + (" • Онлайн" if provider and provider.get("isOnline") else ""),
                "ctaText": "Повторить", "ctaAction": "repeat_booking",
                "payload": {"providerId": pid, "serviceId": b.get("serviceId"), "vehicleId": b.get("vehicleId")},
            })
    except Exception:
        pass
    
    # 2. Favorite provider nearby
    try:
        favs = await db.customer_favorites.find({"customerId": cid}, {"_id": 0}).to_list(10)
        for f in favs[:2]:
            provider = await db.organizations.find_one({"slug": f.get("providerId")}, {"_id": 0, "name": 1, "isOnline": 1, "ratingAvg": 1})
            if provider and provider.get("isOnline"):
                recs.append({
                    "id": uid(), "type": "favorite_provider", "priority": 75,
                    "title": f"{provider['name']} онлайн",
                    "subtitle": f"Рейтинг {provider.get('ratingAvg', 4.5)} • Ваш проверенный мастер",
                    "ctaText": "Записаться", "ctaAction": "open_provider",
                    "payload": {"providerId": f.get("providerId")},
                })
    except Exception:
        pass
    
    # 3. Vehicle maintenance
    try:
        vehicles = await db.vehicles.find({"userId": cid}, {"_id": 0}).to_list(5)
        for v in vehicles[:1]:
            car_name = f"{v.get('brand', v.get('make', ''))} {v.get('model', '')}".strip()
            if car_name:
                recs.append({
                    "id": uid(), "type": "maintenance", "priority": 60,
                    "title": f"Проверьте {car_name}",
                    "subtitle": "Рекомендуем пройти диагностику",
                    "ctaText": "Подробнее", "ctaAction": "open_service",
                    "payload": {"serviceSlug": "computer-diagnostics", "vehicleId": v.get("id")},
                })
    except Exception:
        pass
    
    # 4. Zone opportunity
    try:
        # Get user's zone and check if it's good
        user_zone = await db.zones.find_one({"status": "BALANCED"}, {"_id": 0, "name": 1, "supplyScore": 1, "surgeMultiplier": 1})
        if user_zone and user_zone.get("surgeMultiplier", 1) <= 1.1:
            recs.append({
                "id": uid(), "type": "zone_opportunity", "priority": 45,
                "title": f"{user_zone['name']}: guter Moment",
                "subtitle": f"{user_zone.get('supplyScore', 0)} Werkstätten online · kein Surge",
                "ctaText": "Werkstatt finden", "ctaAction": "quick_request",
                "payload": {"zoneId": user_zone.get("id")},
            })
    except Exception:
        pass
    
    # 5. Service suggestion
    if not recs:
        recs.append({
            "id": uid(), "type": "service_suggestion", "priority": 30,
            "title": "Werkstatt benötigt?",
            "subtitle": "Geprüfte Werkstätten in Ihrer Nähe finden",
            "ctaText": "Werkstatt finden", "ctaAction": "quick_request",
            "payload": {},
        })
    
    recs.sort(key=lambda x: -x["priority"])
    return {"recommendations": recs, "total": len(recs)}





# ── C.6: Customer History Summary ──

@router.get("/api/customer/history/summary")
async def get_customer_history_summary(request: Request):
    """Get customer behavior summary"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    # Aggregate bookings
    bookings = await db.web_bookings.find({"customerId": cid}, {"_id": 0}).to_list(200)
    if not bookings:
        bookings = await db.bookings.find({"customerId": cid}, {"_id": 0}).to_list(200)
    
    completed = [b for b in bookings if b.get("status") == "completed"]
    cancelled = [b for b in bookings if b.get("status") == "cancelled"]
    
    service_freq = {}
    provider_freq = {}
    zone_freq = {}
    total_spend = 0
    
    for b in completed:
        sid = b.get("serviceId", b.get("serviceName", "unknown"))
        service_freq[sid] = service_freq.get(sid, 0) + 1
        pid = b.get("providerId", b.get("organizationSlug", ""))
        if pid:
            provider_freq[pid] = provider_freq.get(pid, 0) + 1
        zid = b.get("zoneId", "")
        if zid:
            zone_freq[zid] = zone_freq.get(zid, 0) + 1
        total_spend += b.get("price", b.get("amount", 0))
    
    n = max(len(completed), 1)
    repeat_providers = sum(1 for c in provider_freq.values() if c > 1)
    
    # Behavior events
    events_count = await db.customer_behavior_events.count_documents({"customerId": cid})
    quick_count = await db.customer_behavior_events.count_documents({"customerId": cid, "type": "quick_request_used"})
    
    return {
        "customerId": cid,
        "totalBookings": len(bookings),
        "completedBookings": len(completed),
        "cancelledBookings": len(cancelled),
        "completionRate": round(len(completed) / max(len(bookings), 1) * 100, 1),
        "avgSpend": round(total_spend / n),
        "totalSpend": total_spend,
        "topServices": sorted(service_freq.items(), key=lambda x: -x[1])[:5],
        "topProviders": sorted(provider_freq.items(), key=lambda x: -x[1])[:5],
        "topZones": sorted(zone_freq.items(), key=lambda x: -x[1])[:3],
        "repeatProviderRate": round(repeat_providers / max(len(provider_freq), 1) * 100, 1),
        "quickRequestUsageRate": round(quick_count / max(events_count, 1) * 100, 1),
        "totalBehaviorEvents": events_count,
    }





# ── C.7: Customer Behavior Events ──

@router.post("/api/customer/behavior/track")
async def track_customer_behavior(request: Request):
    """Track customer behavior event"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        cid = payload.get("sub")
    except Exception:
        raise HTTPException(401, "Invalid token")
    
    body = await request.json()
    event = {
        "customerId": cid,
        "type": body.get("type", "unknown"),
        "providerId": body.get("providerId"),
        "serviceId": body.get("serviceId"),
        "vehicleId": body.get("vehicleId"),
        "zoneId": body.get("zoneId"),
        "timestamp": now_utc().isoformat(),
    }
    await db.customer_behavior_events.insert_one(event)
    event.pop("_id", None)
    return {"status": "tracked", "event": event}




"""Customer API: create + list + get own car requests."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auto_requests.schemas import CreateCarRequest, CarRequestOut
from app.auto_requests import service as svc
from app.auto_requests.auth import get_user_id_optional, get_user_id_required
from app.packages import service as credits_svc

router = APIRouter(prefix="/api/customer/requests", tags=["auto_requests:customer"])


@router.post("", response_model=CarRequestOut)
async def create_endpoint(data: CreateCarRequest, request: Request):
    """Create a new car selection request.

    Sprint 3 guard: each city in the request requires 1 inspection credit.
    - Guest (no auth) → skipGuard off: allowed (treated as pre-payment flow demo).
    - Authenticated → reserve credits atomically; 402 if insufficient.
    """
    uid = get_user_id_optional(request)
    cities_count = len(data.cities)

    # If authenticated — enforce credits
    if uid:
        balance = await credits_svc.get_balance(uid)
        if balance.available < cities_count:
            return JSONResponse(
                status_code=402,
                content={
                    "error": "PAYMENT_REQUIRED",
                    "message": f"Need {cities_count} credits, available {balance.available}",
                    "required": cities_count,
                    "available": balance.available,
                    "balance": balance.balance,
                    "reserved": balance.reserved,
                },
            )

    out = await svc.create_request(data, user_id=uid)

    if uid and cities_count > 0:
        ok = await credits_svc.reserve_credits(uid, cities_count, request_id=out.id)
        if not ok:
            # Rare race — rollback request
            from app.core.db import get_db
            await get_db().car_requests.delete_one({"_id": out.id})
            await get_db().inspection_jobs.delete_many({"requestId": out.id})
            return JSONResponse(status_code=402, content={"error": "PAYMENT_REQUIRED", "message": "credits race — retry"})

    return out


@router.get("/my", response_model=list[CarRequestOut])
async def my_requests(uid: str = Depends(get_user_id_required)):
    return await svc.list_my_requests(uid)


@router.get("/{request_id}", response_model=CarRequestOut)
async def get_one(request_id: str):
    doc = await svc.get_request(request_id)
    if not doc:
        raise HTTPException(404, "request not found")
    return doc


@router.get("/{request_id}/jobs")
async def get_request_jobs(request_id: str):
    doc = await svc.get_request(request_id)
    if not doc:
        raise HTTPException(404, "request not found")
    jobs = await svc.get_jobs_for_request(request_id)
    return {"request": doc, "jobs": jobs}

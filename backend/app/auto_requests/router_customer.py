"""Customer API: create + list + get own car requests."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auto_requests.schemas import CreateCarRequest, CarRequestOut
from app.auto_requests import service as svc
from app.auto_requests.auth import get_user_id_optional, get_user_id_required

router = APIRouter(prefix="/api/customer/requests", tags=["auto_requests:customer"])


@router.post("", response_model=CarRequestOut)
async def create_endpoint(data: CreateCarRequest, request: Request):
    """Create a new car selection request.

    Auth optional: if JWT provided we bind to userId, otherwise it's a guest request.
    """
    uid = get_user_id_optional(request)
    return await svc.create_request(data, user_id=uid)


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

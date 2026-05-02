"""Inspector API: list open jobs, claim, list my claimed."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.auto_requests import service as svc
from app.auto_requests.auth import get_user_id_required, get_user_id_optional

router = APIRouter(prefix="/api/inspector/jobs", tags=["auto_requests:inspector"])


@router.get("")
async def list_open_jobs_endpoint(
    city: Optional[str] = Query(default=None, description="Filter by city"),
    request: Request = None,
):
    """Public list of open jobs. Any authenticated user can claim (role wiring Sprint 4)."""
    jobs = await svc.list_open_jobs(city=city)
    return {"jobs": jobs, "count": len(jobs)}


@router.post("/{job_id}/claim")
async def claim_job_endpoint(job_id: str, uid: str = Depends(get_user_id_required)):
    res = await svc.claim_job(job_id, inspector_id=uid)
    if not res:
        raise HTTPException(409, "job already claimed or not found")
    return {"status": "ok", "job": res}


@router.get("/my")
async def my_jobs(uid: str = Depends(get_user_id_required)):
    jobs = await svc.list_my_jobs(uid)
    return {"jobs": jobs, "count": len(jobs)}

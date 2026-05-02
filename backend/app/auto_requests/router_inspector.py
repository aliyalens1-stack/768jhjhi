"""Inspector API: list open jobs, claim, list my claimed."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.auto_requests import service as svc
from app.auto_requests.auth import get_user_id_required, get_user_id_optional
from app.packages import service as credits_svc
from app.core.db import get_db

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


@router.post("/{job_id}/complete")
async def complete_job_endpoint(job_id: str, uid: str = Depends(get_user_id_required)):
    """Sprint 3: complete a job — consume 1 reserved credit from the request owner."""
    db = get_db()
    job = await db.inspection_jobs.find_one({"_id": job_id, "inspectorId": uid, "status": "claimed"})
    if not job:
        raise HTTPException(409, "job not found, not yours, or not claimed")
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    await db.inspection_jobs.update_one(
        {"_id": job_id},
        {"$set": {"status": "done", "completedAt": now}},
    )
    # Bump request counters
    req = await db.car_requests.find_one({"_id": job["requestId"]})
    await db.car_requests.update_one(
        {"_id": job["requestId"]},
        {"$inc": {"jobsClaimed": -1, "jobsDone": +1}, "$set": {"updatedAt": now}},
    )
    # Consume customer's reserved credit
    if req and req.get("userId"):
        await credits_svc.consume_credit(req["userId"], job_id=job_id, request_id=req["_id"])
    # If all jobs done → mark request completed
    fresh = await db.car_requests.find_one({"_id": job["requestId"]})
    if fresh and fresh.get("jobsDone", 0) >= fresh.get("jobsTotal", 0):
        await db.car_requests.update_one({"_id": fresh["_id"]}, {"$set": {"status": "completed", "updatedAt": now}})
    return {"status": "ok"}


@router.get("/my")
async def my_jobs(uid: str = Depends(get_user_id_required)):
    jobs = await svc.list_my_jobs(uid)
    return {"jobs": jobs, "count": len(jobs)}

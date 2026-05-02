"""Admin API: list all requests, view jobs, manual assign."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auto_requests import service as svc
from app.auto_requests.schemas import AssignJob
from app.core.security import verify_admin_token

router = APIRouter(prefix="/api/admin", tags=["auto_requests:admin"])


@router.get("/requests")
async def list_requests(
    status: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    _=Depends(verify_admin_token),
):
    items = await svc.list_all_requests(status=status, city=city)
    return {"items": items, "count": len(items)}


@router.get("/requests/stats")
async def requests_stats(_=Depends(verify_admin_token)):
    return await svc.stats()


@router.get("/requests/{request_id}")
async def get_request_detail(request_id: str, _=Depends(verify_admin_token)):
    doc = await svc.get_request(request_id)
    if not doc:
        raise HTTPException(404, "not found")
    jobs = await svc.get_jobs_for_request(request_id)
    return {"request": doc, "jobs": jobs}


@router.post("/requests/assign")
async def assign_job(data: AssignJob, _=Depends(verify_admin_token)):
    res = await svc.admin_assign_job(data.jobId, data.inspectorId)
    if not res:
        raise HTTPException(409, "job not found or already completed")
    return {"status": "ok", "job": res}

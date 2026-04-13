"""Anomaly Detection — public alert endpoints."""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_db():
    raise NotImplementedError("get_db must be overridden at app startup")


@router.get("/alerts")
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """List anomaly alerts for the authenticated user."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    offset = (page - 1) * page_size
    where_clause = "WHERE user_id = :uid"
    if unread_only:
        where_clause += " AND acknowledged_at IS NULL"

    result = await db.execute(
        text(
            f"SELECT id, transaction_id, category_id, z_score, description, "
            f"acknowledged_at, created_at FROM anomaly_alerts "
            f"{where_clause} ORDER BY created_at DESC LIMIT :lim OFFSET :off"
        ),
        {"uid": x_user_id, "lim": page_size, "off": offset},
    )
    return [
        {
            "id": str(row.id),
            "transaction_id": str(row.transaction_id) if row.transaction_id else None,
            "category_id": row.category_id,
            "z_score": float(row.z_score),
            "description": row.description,
            "acknowledged_at": str(row.acknowledged_at) if row.acknowledged_at else None,
            "created_at": str(row.created_at),
        }
        for row in result.fetchall()
    ]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Mark an alert as acknowledged."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    await db.execute(
        text(
            "UPDATE anomaly_alerts SET acknowledged_at = NOW() "
            "WHERE id = :aid AND user_id = :uid AND acknowledged_at IS NULL"
        ),
        {"aid": alert_id, "uid": x_user_id},
    )
    await db.commit()
    return {"status": "acknowledged"}

"""Ingestion Router — endpoints for CSV upload, manual entry, bank API, and transaction listing."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from schemas import (
    ManualTransactionRequest,
    BankAPITransactionRequest,
    IngestionResponse,
    TransactionListResponse,
    TransactionResponse,
)
from service import IngestionService
from models import Transaction
from publishers.base import INotificationPublisher

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_db():
    """Dependency — injected by main.py."""
    raise NotImplementedError("get_db must be overridden at app startup")


async def get_publisher() -> INotificationPublisher:
    """Dependency — injected by main.py."""
    raise NotImplementedError("get_publisher must be overridden at app startup")


@router.post("/ingest", response_model=IngestionResponse)
async def ingest_csv(
    file: UploadFile = File(...),
    source_type: str = Form(default="csv_v1"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
    publisher: INotificationPublisher = Depends(get_publisher),
):
    """Ingest transactions from a CSV file upload."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    content = await file.read()
    csv_text = content.decode("utf-8")

    service = IngestionService(db, publisher)
    try:
        result = await service.ingest(x_user_id, source_type, csv_text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return IngestionResponse(**result)


@router.post("/manual", response_model=IngestionResponse)
async def ingest_manual(
    req: ManualTransactionRequest,
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
    publisher: INotificationPublisher = Depends(get_publisher),
):
    """Ingest a single manually entered transaction."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    service = IngestionService(db, publisher)
    try:
        result = await service.ingest(x_user_id, "manual_v1", req.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return IngestionResponse(**result)


@router.post("/bank-api", response_model=IngestionResponse)
async def ingest_bank_api(
    req: BankAPITransactionRequest,
    source_type: str = Query(default="icici_v1"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
    publisher: INotificationPublisher = Depends(get_publisher),
):
    """Ingest a transaction from a bank API."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    service = IngestionService(db, publisher)
    try:
        result = await service.ingest(x_user_id, source_type, req.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return IngestionResponse(**result)


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """List transactions for the authenticated user with pagination."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    offset = (page - 1) * page_size

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == x_user_id)
    )
    total = count_result.scalar()

    # Fetch page
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == x_user_id)
        .order_by(desc(Transaction.ts))
        .offset(offset)
        .limit(page_size)
    )
    transactions = result.scalars().all()

    return TransactionListResponse(
        transactions=[
            TransactionResponse(
                id=str(t.id),
                amount=float(t.amount),
                currency=t.currency,
                merchant_name=t.merchant_name,
                raw_description=t.raw_description,
                mcc_code=t.mcc_code,
                ts=t.ts,
                created_at=t.created_at,
            )
            for t in transactions
        ],
        total=total,
        page=page,
        page_size=page_size,
    )

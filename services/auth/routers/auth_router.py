"""Auth Service — Router with registration, login, refresh, and token validation endpoints."""

import hashlib
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
    ACCESS_EXPIRE_MIN,
)
from models import User
from schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
    HealthResponse,
)

router = APIRouter()


async def get_db():
    """Dependency — injected by main.py."""
    raise NotImplementedError("get_db must be overridden at app startup")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check if user already exists
    email_hash = hashlib.sha256(req.email.lower().encode()).hexdigest()
    existing = await db.execute(select(User).where(User.email_hash == email_hash))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create user
    user = User(
        email=req.email,
        email_hash=email_hash,
        display_name=req.display_name,
        password_hash=hash_password(req.password),
        role="USER",
        encryption_key_ref=f"key-{uuid.uuid4().hex[:12]}",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Issue tokens
    user_id = str(user.id)
    return TokenResponse(
        access_token=create_access_token(user_id, user.role),
        refresh_token=create_refresh_token(user_id),
        expires_in=ACCESS_EXPIRE_MIN * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and issue JWT tokens."""
    email_hash = hashlib.sha256(req.email.lower().encode()).hexdigest()
    result = await db.execute(select(User).where(User.email_hash == email_hash))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.deleted_at:
        raise HTTPException(status_code=403, detail="Account has been deactivated")

    user_id = str(user.id)
    return TokenResponse(
        access_token=create_access_token(user_id, user.role),
        refresh_token=create_refresh_token(user_id),
        expires_in=ACCESS_EXPIRE_MIN * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    try:
        payload = verify_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user_id, user.role),
        refresh_token=create_refresh_token(user_id),
        expires_in=ACCESS_EXPIRE_MIN * 60,
    )


@router.get("/internal/validate-token")
async def validate_token(authorization: str = Header(None)):
    """
    Called by nginx auth_request to validate JWT tokens.
    Returns 200 with X-User-ID header on success, 401 on failure.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = verify_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    from fastapi.responses import Response
    response = Response(status_code=200)
    response.headers["X-User-ID"] = payload["sub"]
    response.headers["X-User-Role"] = payload.get("role", "USER")
    return response


@router.get("/health/ready", response_model=HealthResponse)
async def health_ready():
    """Health check endpoint for Docker/K8s."""
    return HealthResponse(status="ok", service="auth", timestamp=datetime.utcnow())


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile (X-User-ID injected by gateway)."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")
    result = await db.execute(select(User).where(User.id == x_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        created_at=user.created_at,
    )

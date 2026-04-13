"""Pydantic schemas for the Auth Service."""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    display_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "auth"
    timestamp: Optional[datetime] = None

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

# Base User Schema properties
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_-]+$")
    email: EmailStr

# Schema for User Registration
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

# Schema for User Response/Output
class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    is_verified: bool
    is_superuser: bool
    created_at: datetime
    verification_sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Schema for login (supports OAuth2 password flow)
class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

# Forgot & Reset Password schemas
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)

# Change Password schema
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)

# Resend Verification & Status schemas
class ResendVerificationRequest(BaseModel):
    email: EmailStr

class VerificationStatusResponse(BaseModel):
    email: EmailStr
    is_verified: bool
    verification_sent_at: Optional[datetime] = None

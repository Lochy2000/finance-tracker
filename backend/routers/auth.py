from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
import os
import uuid
import secrets
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


# Request/Response models
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class GoogleSessionRequest(BaseModel):
    session_id: str


async def get_current_user(request: Request, db) -> dict:
    """Get current user from JWT token in cookie or header."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def check_brute_force(db, identifier: str):
    """Check for brute force login attempts."""
    attempt = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempt:
        if attempt.get("locked_until"):
            locked_until = attempt["locked_until"]
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    return attempt


async def record_failed_attempt(db, identifier: str, current_attempt: dict = None):
    """Record a failed login attempt."""
    attempts = (current_attempt.get("attempts", 0) if current_attempt else 0) + 1
    
    update_data = {
        "identifier": identifier,
        "attempts": attempts,
        "last_attempt": datetime.now(timezone.utc).isoformat()
    }
    
    if attempts >= 5:
        update_data["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$set": update_data},
        upsert=True
    )


async def clear_failed_attempts(db, identifier: str):
    """Clear failed login attempts after successful login."""
    await db.login_attempts.delete_one({"identifier": identifier})


def create_auth_router(db):
    """Create auth router with database dependency."""
    
    @router.post("/register")
    async def register(user_data: UserCreate, response: Response):
        email = user_data.email.lower()
        
        # Check if user exists
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        password_hash = hash_password(user_data.password)
        
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": user_data.name,
            "password_hash": password_hash,
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        
        # Create tokens
        access_token = create_access_token(user_id, email)
        refresh_token = create_refresh_token(user_id)
        
        # Set cookies
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=900,
            path="/"
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=604800,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": user_data.name,
            "role": "user"
        }
    
    @router.post("/login")
    async def login(credentials: UserLogin, request: Request, response: Response):
        email = credentials.email.lower()
        ip = request.client.host if request.client else "unknown"
        identifier = f"{ip}:{email}"
        
        # Check brute force
        attempt = await check_brute_force(db, identifier)
        
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            await record_failed_attempt(db, identifier, attempt)
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        if not verify_password(credentials.password, user["password_hash"]):
            await record_failed_attempt(db, identifier, attempt)
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Clear failed attempts on success
        await clear_failed_attempts(db, identifier)
        
        # Create tokens
        access_token = create_access_token(user["user_id"], email)
        refresh_token = create_refresh_token(user["user_id"])
        
        # Set cookies
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=900,
            path="/"
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=604800,
            path="/"
        )
        
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user")
        }
    
    @router.post("/logout")
    async def logout(response: Response):
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
        return {"message": "Logged out successfully"}
    
    @router.get("/me")
    async def get_me(request: Request):
        user = await get_current_user(request, db)
        return user
    
    @router.post("/refresh")
    async def refresh_token(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid token type")
            
            user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            access_token = create_access_token(user["user_id"], user["email"])
            
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=False,
                samesite="lax",
                max_age=900,
                path="/"
            )
            
            return {"message": "Token refreshed"}
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    @router.post("/forgot-password")
    async def forgot_password(request_data: ForgotPasswordRequest):
        email = request_data.email.lower()
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        # Always return success to prevent email enumeration
        if not user:
            return {"message": "If the email exists, a reset link has been sent"}
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        await db.password_reset_tokens.insert_one({
            "token": reset_token,
            "user_id": user["user_id"],
            "email": email,
            "expires_at": expires_at.isoformat(),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Log reset link (in production, send email)
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        print(f"Password reset link: {frontend_url}/reset-password?token={reset_token}")
        
        return {"message": "If the email exists, a reset link has been sent"}
    
    @router.post("/reset-password")
    async def reset_password(request_data: ResetPasswordRequest):
        token_doc = await db.password_reset_tokens.find_one(
            {"token": request_data.token, "used": False},
            {"_id": 0}
        )
        
        if not token_doc:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        # Check expiry
        expires_at = token_doc["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Reset token has expired")
        
        # Update password
        new_hash = hash_password(request_data.new_password)
        await db.users.update_one(
            {"user_id": token_doc["user_id"]},
            {"$set": {"password_hash": new_hash}}
        )
        
        # Mark token as used
        await db.password_reset_tokens.update_one(
            {"token": request_data.token},
            {"$set": {"used": True}}
        )
        
        return {"message": "Password reset successful"}
    
    # Google OAuth - Emergent Auth Integration
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    @router.post("/google/session")
    async def google_session(session_data: GoogleSessionRequest, response: Response):
        """Exchange Emergent session_id for user data and create session."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                    headers={"X-Session-ID": session_data.session_id}
                )
                
                if resp.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid session")
                
                google_data = resp.json()
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Failed to verify session")
        
        email = google_data["email"].lower()
        
        # Find or create user
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if not user:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = {
                "user_id": user_id,
                "email": email,
                "name": google_data.get("name", email.split("@")[0]),
                "picture": google_data.get("picture"),
                "role": "user",
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
        else:
            user_id = user["user_id"]
            # Update picture if changed
            if google_data.get("picture") and user.get("picture") != google_data["picture"]:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"picture": google_data["picture"]}}
                )
                user["picture"] = google_data["picture"]
        
        # Create tokens
        access_token = create_access_token(user_id, email)
        refresh_token = create_refresh_token(user_id)
        
        # Set cookies
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=900,
            path="/"
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=604800,
            path="/"
        )
        
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": user.get("role", "user")
        }
    
    return router

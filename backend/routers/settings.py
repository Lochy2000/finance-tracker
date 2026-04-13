from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/settings", tags=["settings"])


def create_settings_router(db, get_current_user):
    """Create settings router for user preferences."""
    
    @router.get("")
    async def get_settings(request: Request):
        """Get user settings."""
        user = await get_current_user(request)
        
        settings = await db.user_settings.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not settings:
            # Return default settings
            return {
                "user_id": user["user_id"],
                "currency": "GBP",
                "date_format": "DD/MM/YYYY",
                "theme": "light",
                "notifications_enabled": True,
                "default_account": None
            }
        
        return settings
    
    @router.patch("")
    async def update_settings(request: Request):
        """Update user settings."""
        user = await get_current_user(request)
        body = await request.json()
        
        # Allowed settings fields
        allowed_fields = {
            "currency", "date_format", "theme",
            "notifications_enabled", "default_account"
        }
        
        update_data = {k: v for k, v in body.items() if k in allowed_fields}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.user_settings.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data},
            upsert=True
        )
        
        # Return updated settings
        settings = await db.user_settings.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0}
        )
        
        return settings
    
    @router.get("/accounts")
    async def list_accounts(request: Request):
        """List user's linked accounts."""
        user = await get_current_user(request)
        
        accounts = await db.accounts.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).to_list(100)
        
        return {"accounts": accounts}
    
    @router.post("/accounts")
    async def create_account(request: Request):
        """Create a new account."""
        user = await get_current_user(request)
        body = await request.json()
        
        import uuid
        account_id = f"acc_{uuid.uuid4().hex[:12]}"
        
        account = {
            "account_id": account_id,
            "user_id": user["user_id"],
            "name": body.get("name", "Default Account"),
            "bank_name": body.get("bank_name"),
            "account_type": body.get("account_type", "checking"),
            "currency": body.get("currency", "GBP"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.accounts.insert_one(account)
        account.pop("_id", None)
        
        return account
    
    @router.delete("/accounts/{account_id}")
    async def delete_account(account_id: str, request: Request):
        """Delete an account."""
        user = await get_current_user(request)
        
        result = await db.accounts.delete_one(
            {"account_id": account_id, "user_id": user["user_id"]}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        
        return {"message": "Account deleted successfully"}
    
    @router.get("/profile")
    async def get_profile(request: Request):
        """Get user profile."""
        user = await get_current_user(request)
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": user.get("role", "user"),
            "created_at": user.get("created_at")
        }
    
    @router.patch("/profile")
    async def update_profile(request: Request):
        """Update user profile."""
        user = await get_current_user(request)
        body = await request.json()
        
        # Only allow updating name
        update_data = {}
        if "name" in body:
            update_data["name"] = body["name"]
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
        
        # Return updated user
        updated_user = await db.users.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        
        return updated_user
    
    return router

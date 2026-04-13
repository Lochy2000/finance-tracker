from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import List, Optional
import uuid

router = APIRouter(prefix="/transactions", tags=["transactions"])


def create_transactions_router(db, get_current_user):
    """Create transactions router with database and auth dependency."""
    
    @router.get("")
    async def list_transactions(
        request: Request,
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=100),
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
        account_id: Optional[str] = None,
        sort_by: str = "date",
        sort_order: str = "desc"
    ):
        """List transactions with filtering and pagination."""
        user = await get_current_user(request)
        
        # Build query
        query = {"user_id": user["user_id"]}
        
        if category:
            query["category"] = category
        
        if account_id:
            query["account_id"] = account_id
        
        if start_date:
            query.setdefault("date", {})
            query["date"]["$gte"] = start_date
        
        if end_date:
            query.setdefault("date", {})
            query["date"]["$lte"] = end_date
        
        if search:
            query["$or"] = [
                {"merchant_raw": {"$regex": search, "$options": "i"}},
                {"merchant_clean": {"$regex": search, "$options": "i"}},
                {"notes": {"$regex": search, "$options": "i"}}
            ]
        
        # Sort
        sort_direction = -1 if sort_order == "desc" else 1
        
        # Get total count
        total = await db.transactions.count_documents(query)
        
        # Get transactions
        skip = (page - 1) * page_size
        transactions = await db.transactions.find(
            query,
            {"_id": 0}
        ).sort(sort_by, sort_direction).skip(skip).limit(page_size).to_list(page_size)
        
        return {
            "transactions": transactions,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    
    @router.get("/categories")
    async def get_categories(request: Request):
        """Get all categories used by the user."""
        user = await get_current_user(request)
        
        pipeline = [
            {"$match": {"user_id": user["user_id"]}},
            {"$group": {
                "_id": "$category",
                "count": {"$sum": 1},
                "total_amount": {"$sum": "$amount"}
            }},
            {"$sort": {"count": -1}}
        ]
        
        results = await db.transactions.aggregate(pipeline).to_list(100)
        
        categories = [
            {
                "category": r["_id"] or "Uncategorized",
                "count": r["count"],
                "total_amount": round(r["total_amount"], 2)
            }
            for r in results
        ]
        
        return {"categories": categories}
    
    @router.get("/{transaction_id}")
    async def get_transaction(transaction_id: str, request: Request):
        """Get a single transaction by ID."""
        user = await get_current_user(request)
        
        transaction = await db.transactions.find_one(
            {"transaction_id": transaction_id, "user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return transaction
    
    @router.patch("/{transaction_id}")
    async def update_transaction(transaction_id: str, request: Request):
        """Update a transaction (category, merchant_clean, notes)."""
        user = await get_current_user(request)
        body = await request.json()
        
        # Only allow updating certain fields
        allowed_fields = {"merchant_clean", "category", "subcategory", "notes"}
        update_data = {k: v for k, v in body.items() if k in allowed_fields}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.transactions.update_one(
            {"transaction_id": transaction_id, "user_id": user["user_id"]},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Return updated transaction
        transaction = await db.transactions.find_one(
            {"transaction_id": transaction_id},
            {"_id": 0}
        )
        
        return transaction
    
    @router.delete("/{transaction_id}")
    async def delete_transaction(transaction_id: str, request: Request):
        """Delete a transaction."""
        user = await get_current_user(request)
        
        result = await db.transactions.delete_one(
            {"transaction_id": transaction_id, "user_id": user["user_id"]}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return {"message": "Transaction deleted successfully"}
    
    @router.post("/bulk-update")
    async def bulk_update_transactions(request: Request):
        """Bulk update transactions (e.g., change category for multiple)."""
        user = await get_current_user(request)
        body = await request.json()
        
        transaction_ids = body.get("transaction_ids", [])
        update_data = body.get("update", {})
        
        if not transaction_ids:
            raise HTTPException(status_code=400, detail="No transaction IDs provided")
        
        # Only allow updating certain fields
        allowed_fields = {"category", "subcategory"}
        update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.transactions.update_many(
            {
                "transaction_id": {"$in": transaction_ids},
                "user_id": user["user_id"]
            },
            {"$set": update_data}
        )
        
        return {
            "message": "Transactions updated",
            "modified_count": result.modified_count
        }
    
    return router

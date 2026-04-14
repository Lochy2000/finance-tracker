from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/budgets", tags=["budgets"])


def create_budgets_router(db, get_current_user):
    """
    Budget management — per-category monthly spending limits.
    The dashboard reads these to show progress bars.
    When AI is connected, it can auto-suggest budgets based on
    historical spending patterns.
    """

    @router.get("")
    async def list_budgets(request: Request):
        user = await get_current_user(request)
        budgets = await db.budgets.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).to_list(100)
        return {"budgets": budgets}

    @router.post("")
    async def create_budget(request: Request):
        user = await get_current_user(request)
        body = await request.json()
        category = body.get("category")
        monthly_limit = body.get("monthly_limit")
        if not category or monthly_limit is None:
            raise HTTPException(status_code=400, detail="category and monthly_limit are required")

        # Upsert — one budget per category per user
        budget_id = f"budget_{uuid.uuid4().hex[:12]}"
        existing = await db.budgets.find_one(
            {"user_id": user["user_id"], "category": category}, {"_id": 0}
        )
        if existing:
            await db.budgets.update_one(
                {"user_id": user["user_id"], "category": category},
                {"$set": {"monthly_limit": monthly_limit, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            updated = await db.budgets.find_one(
                {"user_id": user["user_id"], "category": category}, {"_id": 0}
            )
            return updated

        doc = {
            "budget_id": budget_id,
            "user_id": user["user_id"],
            "category": category,
            "monthly_limit": monthly_limit,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.budgets.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.delete("/{budget_id}")
    async def delete_budget(budget_id: str, request: Request):
        user = await get_current_user(request)
        result = await db.budgets.delete_one({"budget_id": budget_id, "user_id": user["user_id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Budget not found")
        return {"message": "Budget deleted"}

    return router

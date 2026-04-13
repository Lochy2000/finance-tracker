from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from services.ai_service import (
    detect_recurring_payments,
    detect_unusual_spending,
    generate_savings_suggestions,
    compare_months
)

router = APIRouter(prefix="/insights", tags=["insights"])


def create_insights_router(db, get_current_user):
    """Create insights router with AI-powered analysis."""
    
    @router.get("/")
    async def get_all_insights(request: Request):
        """Get all AI insights for the user."""
        user = await get_current_user(request)
        
        # Get recent transactions (last 90 days)
        now = datetime.now(timezone.utc)
        ninety_days_ago = datetime(
            now.year, now.month - 3 if now.month > 3 else now.month + 9,
            now.day, tzinfo=timezone.utc
        ).replace(year=now.year if now.month > 3 else now.year - 1)
        
        transactions = await db.transactions.find(
            {
                "user_id": user["user_id"],
                "date": {"$gte": ninety_days_ago.isoformat()}
            },
            {"_id": 0}
        ).to_list(10000)
        
        if not transactions:
            return {
                "recurring_payments": [],
                "unusual_spending": [],
                "savings_suggestions": [],
                "month_comparison": None,
                "message": "Upload some transactions to see AI insights"
            }
        
        # Detect recurring payments
        recurring = await detect_recurring_payments(transactions)
        
        # Detect unusual spending
        unusual = await detect_unusual_spending(transactions)
        
        # Generate savings suggestions
        savings = await generate_savings_suggestions(transactions, recurring)
        
        # Month over month comparison
        current_month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year = now.year if now.month > 1 else now.year - 1
        prev_month_start = datetime(prev_year, prev_month, 1, tzinfo=timezone.utc)
        
        current_month_txns = [
            t for t in transactions
            if t["date"] >= current_month_start.isoformat()
        ]
        prev_month_txns = [
            t for t in transactions
            if prev_month_start.isoformat() <= t["date"] < current_month_start.isoformat()
        ]
        
        month_comparison = await compare_months(current_month_txns, prev_month_txns)
        
        return {
            "recurring_payments": recurring,
            "unusual_spending": unusual,
            "savings_suggestions": savings,
            "month_comparison": month_comparison,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    @router.get("/recurring")
    async def get_recurring_payments(request: Request):
        """Get detected recurring payments."""
        user = await get_current_user(request)
        
        transactions = await db.transactions.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).to_list(10000)
        
        recurring = await detect_recurring_payments(transactions)
        
        return {"recurring_payments": recurring}
    
    @router.get("/unusual")
    async def get_unusual_spending(request: Request):
        """Get unusual spending alerts."""
        user = await get_current_user(request)
        
        # Get recent transactions
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)
        
        transactions = await db.transactions.find(
            {
                "user_id": user["user_id"],
                "date": {"$gte": thirty_days_ago.isoformat()}
            },
            {"_id": 0}
        ).to_list(10000)
        
        unusual = await detect_unusual_spending(transactions)
        
        return {"unusual_spending": unusual}
    
    @router.get("/savings")
    async def get_savings_suggestions(request: Request):
        """Get personalized savings suggestions."""
        user = await get_current_user(request)
        
        transactions = await db.transactions.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).to_list(10000)
        
        recurring = await detect_recurring_payments(transactions)
        savings = await generate_savings_suggestions(transactions, recurring)
        
        return {"savings_suggestions": savings}
    
    @router.get("/compare")
    async def compare_periods(
        request: Request,
        period1_start: str,
        period1_end: str,
        period2_start: str,
        period2_end: str
    ):
        """Compare spending between two custom periods."""
        user = await get_current_user(request)
        
        period1_txns = await db.transactions.find(
            {
                "user_id": user["user_id"],
                "date": {"$gte": period1_start, "$lte": period1_end}
            },
            {"_id": 0}
        ).to_list(10000)
        
        period2_txns = await db.transactions.find(
            {
                "user_id": user["user_id"],
                "date": {"$gte": period2_start, "$lte": period2_end}
            },
            {"_id": 0}
        ).to_list(10000)
        
        comparison = await compare_months(period1_txns, period2_txns)
        
        return {
            "period1": {"start": period1_start, "end": period1_end},
            "period2": {"start": period2_start, "end": period2_end},
            "comparison": comparison
        }
    
    return router

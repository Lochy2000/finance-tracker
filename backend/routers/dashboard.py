from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict

from services.ai_service import generate_monthly_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def create_dashboard_router(db, get_current_user):
    """Create dashboard router with database and auth dependency."""
    
    @router.get("")
    async def get_dashboard(
        request: Request,
        month: Optional[int] = None,
        year: Optional[int] = None
    ):
        """Get dashboard data for a specific month."""
        user = await get_current_user(request)
        
        # Default to current month
        now = datetime.now(timezone.utc)
        month = month or now.month
        year = year or now.year
        
        # Build date range
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        # Get transactions for the month
        transactions = await db.transactions.find(
            {
                "user_id": user["user_id"],
                "date": {
                    "$gte": start_date.isoformat(),
                    "$lt": end_date.isoformat()
                }
            },
            {"_id": 0}
        ).to_list(10000)
        
        # Calculate totals
        total_spend = sum(abs(t["amount"]) for t in transactions if t["amount"] < 0)
        total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
        
        # Spending by category
        category_totals = defaultdict(lambda: {"amount": 0, "count": 0})
        for t in transactions:
            if t["amount"] < 0:
                cat = t.get("category") or "Uncategorized"
                category_totals[cat]["amount"] += abs(t["amount"])
                category_totals[cat]["count"] += 1
        
        spending_by_category = [
            {
                "category": cat,
                "amount": round(data["amount"], 2),
                "percentage": round((data["amount"] / total_spend * 100) if total_spend > 0 else 0, 1),
                "transaction_count": data["count"]
            }
            for cat, data in sorted(category_totals.items(), key=lambda x: x[1]["amount"], reverse=True)
        ]
        
        # Spending over time (daily)
        daily_spending = defaultdict(float)
        for t in transactions:
            if t["amount"] < 0:
                date_str = t["date"][:10]  # Get YYYY-MM-DD
                daily_spending[date_str] += abs(t["amount"])
        
        spending_over_time = [
            {"date": date, "amount": round(amount, 2)}
            for date, amount in sorted(daily_spending.items())
        ]
        
        # Top merchants
        merchant_totals = defaultdict(lambda: {"amount": 0, "count": 0})
        for t in transactions:
            if t["amount"] < 0:
                merchant = t.get("merchant_clean") or t.get("merchant_raw", "Unknown")
                merchant_totals[merchant]["amount"] += abs(t["amount"])
                merchant_totals[merchant]["count"] += 1
        
        top_merchants = [
            {
                "merchant": merchant,
                "amount": round(data["amount"], 2),
                "transaction_count": data["count"]
            }
            for merchant, data in sorted(merchant_totals.items(), key=lambda x: x[1]["amount"], reverse=True)[:10]
        ]
        
        # Recent uploads
        recent_uploads = await db.uploaded_files.find(
            {"user_id": user["user_id"]},
            {"_id": 0, "file_id": 1, "filename": 1, "uploaded_at": 1, "status": 1, "transaction_count": 1}
        ).sort("uploaded_at", -1).limit(5).to_list(5)
        
        # Generate AI summary
        ai_summary = None
        if transactions:
            summary_data = await generate_monthly_summary(transactions, month, year)
            ai_summary = summary_data
        
        return {
            "total_spend_month": round(total_spend, 2),
            "total_income_month": round(total_income, 2),
            "spending_by_category": spending_by_category,
            "spending_over_time": spending_over_time,
            "top_merchants": top_merchants,
            "recent_uploads": recent_uploads,
            "ai_summary": ai_summary,
            "month": month,
            "year": year,
            "transaction_count": len(transactions)
        }
    
    @router.get("/stats")
    async def get_quick_stats(request: Request):
        """Get quick stats for the sidebar or header."""
        user = await get_current_user(request)
        
        now = datetime.now(timezone.utc)
        start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        
        # Get this month's totals
        pipeline = [
            {
                "$match": {
                    "user_id": user["user_id"],
                    "date": {"$gte": start_of_month.isoformat()}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_spend": {
                        "$sum": {
                            "$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]
                        }
                    },
                    "total_income": {
                        "$sum": {
                            "$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]
                        }
                    },
                    "transaction_count": {"$sum": 1}
                }
            }
        ]
        
        result = await db.transactions.aggregate(pipeline).to_list(1)
        
        if result:
            return {
                "total_spend_month": round(result[0]["total_spend"], 2),
                "total_income_month": round(result[0]["total_income"], 2),
                "transaction_count": result[0]["transaction_count"]
            }
        
        return {
            "total_spend_month": 0,
            "total_income_month": 0,
            "transaction_count": 0
        }
    
    return router

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional, List
from collections import defaultdict
import uuid

router = APIRouter(prefix="/reports", tags=["reports"])


def create_reports_router(db, get_current_user):
    """Create reports router for generating financial reports."""
    
    @router.post("/generate")
    async def generate_report(request: Request):
        """Generate a new report based on filters."""
        user = await get_current_user(request)
        body = await request.json()
        
        start_date = body.get("start_date")
        end_date = body.get("end_date")
        categories = body.get("categories")  # Optional filter
        report_type = body.get("report_type", "summary")
        
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date are required")
        
        # Build query
        query = {
            "user_id": user["user_id"],
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        if categories:
            query["category"] = {"$in": categories}
        
        # Get transactions
        transactions = await db.transactions.find(query, {"_id": 0}).to_list(10000)
        
        if not transactions:
            return {
                "report_id": None,
                "message": "No transactions found for the selected period",
                "total_spend": 0,
                "total_income": 0,
                "net_change": 0,
                "category_breakdown": [],
                "daily_spending": []
            }
        
        # Calculate totals
        total_spend = sum(abs(t["amount"]) for t in transactions if t["amount"] < 0)
        total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
        net_change = total_income - total_spend
        
        # Category breakdown
        category_totals = defaultdict(lambda: {"amount": 0, "count": 0})
        for t in transactions:
            if t["amount"] < 0:
                cat = t.get("category") or "Uncategorized"
                category_totals[cat]["amount"] += abs(t["amount"])
                category_totals[cat]["count"] += 1
        
        category_breakdown = [
            {
                "category": cat,
                "total_amount": round(data["amount"], 2),
                "transaction_count": data["count"],
                "average_transaction": round(data["amount"] / data["count"], 2) if data["count"] > 0 else 0,
                "percentage_of_total": round((data["amount"] / total_spend * 100) if total_spend > 0 else 0, 1)
            }
            for cat, data in sorted(category_totals.items(), key=lambda x: x[1]["amount"], reverse=True)
        ]
        
        # Daily spending
        daily = defaultdict(float)
        for t in transactions:
            if t["amount"] < 0:
                date_str = t["date"][:10]
                daily[date_str] += abs(t["amount"])
        
        daily_spending = [
            {"date": date, "amount": round(amount, 2)}
            for date, amount in sorted(daily.items())
        ]
        
        # Generate report ID
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        
        # Generate AI summary
        ai_summary = f"During this period, you spent £{total_spend:.2f} across {len(transactions)} transactions. "
        if category_breakdown:
            top_cat = category_breakdown[0]
            ai_summary += f"Your highest spending category was {top_cat['category']} at £{top_cat['total_amount']:.2f} ({top_cat['percentage_of_total']}% of total). "
        if total_income > 0:
            ai_summary += f"You received £{total_income:.2f} in income, resulting in a net change of £{net_change:.2f}."
        
        report_data = {
            "report_id": report_id,
            "user_id": user["user_id"],
            "start_date": start_date,
            "end_date": end_date,
            "report_type": report_type,
            "filters": {"categories": categories} if categories else {},
            "total_spend": round(total_spend, 2),
            "total_income": round(total_income, 2),
            "net_change": round(net_change, 2),
            "transaction_count": len(transactions),
            "category_breakdown": category_breakdown,
            "daily_spending": daily_spending,
            "ai_summary": ai_summary,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Save report
        await db.reports.insert_one(report_data)
        
        # Remove _id before returning
        report_data.pop("_id", None)
        
        return report_data
    
    @router.get("/")
    async def list_reports(request: Request, skip: int = 0, limit: int = 20):
        """List saved reports."""
        user = await get_current_user(request)
        
        reports = await db.reports.find(
            {"user_id": user["user_id"]},
            {"_id": 0, "report_id": 1, "start_date": 1, "end_date": 1, "total_spend": 1, "generated_at": 1}
        ).sort("generated_at", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.reports.count_documents({"user_id": user["user_id"]})
        
        return {"reports": reports, "total": total}
    
    @router.get("/{report_id}")
    async def get_report(report_id: str, request: Request):
        """Get a saved report by ID."""
        user = await get_current_user(request)
        
        report = await db.reports.find_one(
            {"report_id": report_id, "user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
    
    @router.delete("/{report_id}")
    async def delete_report(report_id: str, request: Request):
        """Delete a saved report."""
        user = await get_current_user(request)
        
        result = await db.reports.delete_one(
            {"report_id": report_id, "user_id": user["user_id"]}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return {"message": "Report deleted successfully"}
    
    return router

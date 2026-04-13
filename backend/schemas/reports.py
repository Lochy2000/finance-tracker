from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class ReportRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    categories: Optional[List[str]] = None
    accounts: Optional[List[str]] = None
    report_type: str = "summary"  # summary, detailed, comparison


class ReportCategorySummary(BaseModel):
    category: str
    total_amount: float
    transaction_count: int
    average_transaction: float
    percentage_of_total: float


class ReportResponse(BaseModel):
    report_id: str
    user_id: str
    start_date: datetime
    end_date: datetime
    total_spend: float
    total_income: float
    net_change: float
    category_breakdown: List[ReportCategorySummary]
    daily_spending: List[Dict]
    ai_summary: Optional[str] = None
    generated_at: datetime


class SavedReportResponse(BaseModel):
    report_id: str
    name: str
    start_date: datetime
    end_date: datetime
    generated_at: datetime

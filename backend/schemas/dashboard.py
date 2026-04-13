from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime


class SpendingByCategory(BaseModel):
    category: str
    amount: float
    percentage: float
    transaction_count: int


class SpendingOverTime(BaseModel):
    date: str
    amount: float


class TopMerchant(BaseModel):
    merchant: str
    amount: float
    transaction_count: int


class RecentUpload(BaseModel):
    file_id: str
    filename: str
    uploaded_at: datetime
    status: str
    transaction_count: Optional[int] = None


class AISummary(BaseModel):
    summary_text: str
    highlights: List[str]
    generated_at: datetime


class DashboardResponse(BaseModel):
    total_spend_month: float
    total_income_month: float
    spending_by_category: List[SpendingByCategory]
    spending_over_time: List[SpendingOverTime]
    top_merchants: List[TopMerchant]
    recent_uploads: List[RecentUpload]
    ai_summary: Optional[AISummary] = None
    month: str
    year: int

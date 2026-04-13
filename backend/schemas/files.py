from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UploadedFileResponse(BaseModel):
    file_id: str
    user_id: str
    filename: str
    file_type: str
    file_size: int
    status: str  # pending, parsing, parsed, failed
    transaction_count: Optional[int] = None
    bank_name: Optional[str] = None
    uploaded_at: datetime
    parsed_at: Optional[datetime] = None


class FileListResponse(BaseModel):
    files: List[UploadedFileResponse]
    total: int


class ParsedTransactionPreview(BaseModel):
    date: str
    merchant_raw: str
    amount: float
    currency: str
    suggested_category: Optional[str] = None
    confidence_score: Optional[float] = None


class FileParsePreviewResponse(BaseModel):
    file_id: str
    filename: str
    transactions: List[ParsedTransactionPreview]
    total_transactions: int
    total_amount: float
    date_range: Optional[dict] = None

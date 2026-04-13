from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TransactionBase(BaseModel):
    date: datetime
    merchant_raw: str
    amount: float
    currency: str = "GBP"


class TransactionCreate(BaseModel):
    date: datetime
    merchant_raw: str
    merchant_clean: Optional[str] = None
    amount: float
    currency: str = "GBP"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    account_id: Optional[str] = None
    source_file_id: Optional[str] = None
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    merchant_clean: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    transaction_id: str
    user_id: str
    account_id: Optional[str] = None
    date: datetime
    merchant_raw: str
    merchant_clean: Optional[str] = None
    amount: float
    currency: str = "GBP"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    source_file_id: Optional[str] = None
    confidence_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    page_size: int


class BulkTransactionCreate(BaseModel):
    transactions: List[TransactionCreate]
    source_file_id: Optional[str] = None

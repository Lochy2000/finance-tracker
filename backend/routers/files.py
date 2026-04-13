from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import os
import aiofiles

from services.parser_service import parse_file
from services.ai_service import categorize_transaction, normalize_merchant_name

router = APIRouter(prefix="/files", tags=["files"])

# Allowed file types
ALLOWED_EXTENSIONS = {'.csv', '.pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_file(filename: str, file_size: int):
    """Validate file type and size."""
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )


def create_files_router(db, get_current_user):
    """Create files router with database and auth dependency."""
    
    @router.post("/upload")
    async def upload_file(request: Request, file: UploadFile = File(...)):
        """Upload a bank statement file for parsing."""
        user = await get_current_user(request)
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate
        validate_file(file.filename, file_size)
        
        file_id = f"file_{uuid.uuid4().hex[:12]}"
        ext = os.path.splitext(file.filename.lower())[1]
        
        # Save file locally
        upload_dir = "/app/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Use secure filename
        safe_filename = f"{file_id}{ext}"
        file_path = os.path.join(upload_dir, safe_filename)
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Create file record
        file_doc = {
            "file_id": file_id,
            "user_id": user["user_id"],
            "filename": file.filename,
            "safe_filename": safe_filename,
            "file_type": ext[1:],  # Remove dot
            "file_size": file_size,
            "status": "pending",
            "transaction_count": None,
            "bank_name": None,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "parsed_at": None
        }
        
        await db.uploaded_files.insert_one(file_doc)
        
        # Start parsing
        try:
            await db.uploaded_files.update_one(
                {"file_id": file_id},
                {"$set": {"status": "parsing"}}
            )
            
            parse_result = await parse_file(content, file.filename)
            
            if parse_result.get("error"):
                await db.uploaded_files.update_one(
                    {"file_id": file_id},
                    {"$set": {
                        "status": "failed",
                        "error": parse_result["error"]
                    }}
                )
                return {
                    "file_id": file_id,
                    "status": "failed",
                    "error": parse_result["error"]
                }
            
            # Enrich transactions with AI categorization
            enriched_transactions = []
            for txn in parse_result.get("transactions", []):
                cat_result = await categorize_transaction(txn["merchant_raw"], txn["amount"])
                merchant_clean = await normalize_merchant_name(txn["merchant_raw"])
                
                enriched_transactions.append({
                    **txn,
                    "merchant_clean": merchant_clean,
                    "category": cat_result["category"],
                    "subcategory": cat_result["subcategory"],
                    "confidence_score": cat_result["confidence_score"]
                })
            
            # Store parsed transactions temporarily for preview
            await db.parsed_previews.insert_one({
                "file_id": file_id,
                "user_id": user["user_id"],
                "transactions": enriched_transactions,
                "bank_name": parse_result.get("bank_name"),
                "total_amount": sum(t["amount"] for t in enriched_transactions),
                "date_range": parse_result.get("date_range"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": datetime.now(timezone.utc).isoformat()  # Preview expires in 24h
            })
            
            await db.uploaded_files.update_one(
                {"file_id": file_id},
                {"$set": {
                    "status": "parsed",
                    "bank_name": parse_result.get("bank_name"),
                    "transaction_count": len(enriched_transactions),
                    "parsed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {
                "file_id": file_id,
                "status": "parsed",
                "filename": file.filename,
                "bank_name": parse_result.get("bank_name"),
                "transaction_count": len(enriched_transactions),
                "total_amount": sum(t["amount"] for t in enriched_transactions),
                "date_range": parse_result.get("date_range")
            }
            
        except Exception as e:
            await db.uploaded_files.update_one(
                {"file_id": file_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
            raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
    
    @router.get("/preview/{file_id}")
    async def get_file_preview(file_id: str, request: Request):
        """Get parsed transactions preview before importing."""
        user = await get_current_user(request)
        
        preview = await db.parsed_previews.find_one(
            {"file_id": file_id, "user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not preview:
            raise HTTPException(status_code=404, detail="Preview not found or expired")
        
        file_doc = await db.uploaded_files.find_one(
            {"file_id": file_id},
            {"_id": 0}
        )
        
        return {
            "file_id": file_id,
            "filename": file_doc["filename"] if file_doc else "Unknown",
            "transactions": preview["transactions"],
            "total_transactions": len(preview["transactions"]),
            "total_amount": preview["total_amount"],
            "date_range": preview.get("date_range"),
            "bank_name": preview.get("bank_name")
        }
    
    @router.post("/import/{file_id}")
    async def import_transactions(file_id: str, request: Request):
        """Import parsed transactions to the database."""
        user = await get_current_user(request)
        
        preview = await db.parsed_previews.find_one(
            {"file_id": file_id, "user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not preview:
            raise HTTPException(status_code=404, detail="Preview not found or expired")
        
        # Create transaction documents
        transactions_to_insert = []
        for txn in preview["transactions"]:
            txn_id = f"txn_{uuid.uuid4().hex[:12]}"
            
            # Parse date if string
            date = txn["date"]
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            
            transactions_to_insert.append({
                "transaction_id": txn_id,
                "user_id": user["user_id"],
                "account_id": None,  # Can be linked later
                "date": date.isoformat() if isinstance(date, datetime) else date,
                "merchant_raw": txn["merchant_raw"],
                "merchant_clean": txn.get("merchant_clean"),
                "amount": txn["amount"],
                "currency": txn.get("currency", "GBP"),
                "category": txn.get("category"),
                "subcategory": txn.get("subcategory"),
                "source_file_id": file_id,
                "confidence_score": txn.get("confidence_score"),
                "notes": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if transactions_to_insert:
            await db.transactions.insert_many(transactions_to_insert)
        
        # Update file status
        await db.uploaded_files.update_one(
            {"file_id": file_id},
            {"$set": {"status": "imported"}}
        )
        
        # Delete preview
        await db.parsed_previews.delete_one({"file_id": file_id})
        
        return {
            "message": "Transactions imported successfully",
            "imported_count": len(transactions_to_insert),
            "file_id": file_id
        }
    
    @router.get("")
    async def list_files(request: Request, skip: int = 0, limit: int = 50):
        """List uploaded files for the current user."""
        user = await get_current_user(request)
        
        files = await db.uploaded_files.find(
            {"user_id": user["user_id"]},
            {"_id": 0}
        ).sort("uploaded_at", -1).skip(skip).limit(limit).to_list(limit)
        
        total = await db.uploaded_files.count_documents({"user_id": user["user_id"]})
        
        return {
            "files": files,
            "total": total
        }
    
    @router.delete("/{file_id}")
    async def delete_file(file_id: str, request: Request):
        """Delete a file and optionally its transactions."""
        user = await get_current_user(request)
        
        file_doc = await db.uploaded_files.find_one(
            {"file_id": file_id, "user_id": user["user_id"]},
            {"_id": 0}
        )
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file from disk
        file_path = os.path.join("/app/uploads", file_doc.get("safe_filename", ""))
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete records
        await db.uploaded_files.delete_one({"file_id": file_id})
        await db.parsed_previews.delete_one({"file_id": file_id})
        
        # Note: We keep transactions - they can be deleted separately if needed
        
        return {"message": "File deleted successfully"}
    
    return router

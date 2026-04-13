"""
Parser Service for LedgerLens
------------------------------
Handles parsing of CSV and PDF bank statements.

TODO: Add more bank formats (Monzo, HSBC, Barclays, etc.)
TODO: Implement PDF text extraction with OCR fallback
"""

import csv
import io
from typing import List, Dict, Optional
from datetime import datetime
import re


# Bank format detection patterns
BANK_FORMATS = {
    "monzo": {
        "headers": ["date", "time", "type", "name", "emoji", "category", "amount", "currency", "local_amount", "local_currency", "notes_and_tags"],
        "date_column": "date",
        "merchant_column": "name",
        "amount_column": "amount",
        "date_format": "%d/%m/%Y"
    },
    "hsbc": {
        "headers": ["date", "description", "amount"],
        "date_column": "date",
        "merchant_column": "description",
        "amount_column": "amount",
        "date_format": "%d/%m/%Y"
    },
    "generic": {
        "headers": ["date", "description", "amount"],
        "date_column": 0,
        "merchant_column": 1,
        "amount_column": 2,
        "date_format": "%Y-%m-%d"
    }
}


def detect_bank_format(headers: List[str]) -> str:
    """Detect which bank format the CSV matches."""
    headers_lower = [h.lower().strip() for h in headers]
    
    # Check for Monzo format
    if "emoji" in headers_lower or "notes_and_tags" in headers_lower:
        return "monzo"
    
    # Check for HSBC format
    if len(headers) == 3 and "description" in headers_lower:
        return "hsbc"
    
    return "generic"


def parse_date(date_str: str, format_hint: str = None) -> Optional[datetime]:
    """Parse date string trying multiple formats."""
    formats = [
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%d %b %Y",
        "%d %B %Y",
    ]
    
    if format_hint:
        formats.insert(0, format_hint)
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    
    return None


def parse_amount(amount_str: str) -> Optional[float]:
    """Parse amount string to float."""
    try:
        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[£$€\s,]', '', str(amount_str))
        # Handle negative amounts in parentheses
        if '(' in cleaned and ')' in cleaned:
            cleaned = '-' + cleaned.replace('(', '').replace(')', '')
        return float(cleaned)
    except (ValueError, TypeError):
        return None


async def parse_csv_file(file_content: bytes, filename: str) -> Dict:
    """
    Parse a CSV file and extract transactions.
    
    Returns:
        Dict with transactions list, bank name, and parsing stats
    """
    try:
        # Decode content
        content = file_content.decode('utf-8-sig')  # Handle BOM
        reader = csv.reader(io.StringIO(content))
        
        rows = list(reader)
        if not rows:
            return {"error": "Empty file", "transactions": []}
        
        headers = rows[0]
        bank_format = detect_bank_format(headers)
        format_config = BANK_FORMATS.get(bank_format, BANK_FORMATS["generic"])
        
        transactions = []
        errors = []
        
        for i, row in enumerate(rows[1:], start=2):
            if not row or all(cell.strip() == '' for cell in row):
                continue
            
            try:
                # Get column indices
                if isinstance(format_config["date_column"], int):
                    date_idx = format_config["date_column"]
                    merchant_idx = format_config["merchant_column"]
                    amount_idx = format_config["amount_column"]
                else:
                    headers_lower = [h.lower().strip() for h in headers]
                    date_idx = headers_lower.index(format_config["date_column"].lower())
                    merchant_idx = headers_lower.index(format_config["merchant_column"].lower())
                    amount_idx = headers_lower.index(format_config["amount_column"].lower())
                
                date = parse_date(row[date_idx], format_config.get("date_format"))
                merchant = row[merchant_idx].strip() if merchant_idx < len(row) else ""
                amount = parse_amount(row[amount_idx]) if amount_idx < len(row) else None
                
                if date and merchant and amount is not None:
                    # Get currency if available
                    currency = "GBP"
                    if bank_format == "monzo":
                        currency_idx = headers_lower.index("currency") if "currency" in headers_lower else None
                        if currency_idx and currency_idx < len(row):
                            currency = row[currency_idx].upper() or "GBP"
                    
                    transactions.append({
                        "date": date.isoformat(),
                        "merchant_raw": merchant,
                        "amount": amount,
                        "currency": currency,
                    })
                else:
                    errors.append(f"Row {i}: Could not parse date, merchant, or amount")
                    
            except (IndexError, ValueError) as e:
                errors.append(f"Row {i}: {str(e)}")
        
        return {
            "transactions": transactions,
            "bank_name": bank_format.title(),
            "total_parsed": len(transactions),
            "total_errors": len(errors),
            "errors": errors[:10],  # Return first 10 errors
            "date_range": {
                "start": min(t["date"] for t in transactions) if transactions else None,
                "end": max(t["date"] for t in transactions) if transactions else None,
            }
        }
        
    except Exception as e:
        return {"error": str(e), "transactions": []}


async def parse_pdf_file(file_content: bytes, filename: str) -> Dict:
    """
    Parse a PDF bank statement.
    
    TODO: Implement actual PDF parsing using PyPDF2 or pdfplumber
    TODO: Add OCR support for scanned statements
    
    Currently returns a placeholder response.
    """
    try:
        from PyPDF2 import PdfReader
        import io
        
        reader = PdfReader(io.BytesIO(file_content))
        text = ""
        
        for page in reader.pages:
            text += page.extract_text() or ""
        
        # TODO: Implement actual transaction extraction from PDF text
        # This would require bank-specific parsing logic
        
        return {
            "transactions": [],
            "bank_name": "Unknown (PDF)",
            "total_parsed": 0,
            "total_errors": 0,
            "errors": [],
            "message": "PDF parsing is in development. Please use CSV exports for now.",
            "raw_text_preview": text[:500] if text else "No text extracted"
        }
        
    except Exception as e:
        return {"error": f"PDF parsing error: {str(e)}", "transactions": []}


async def parse_file(file_content: bytes, filename: str) -> Dict:
    """Route to appropriate parser based on file type."""
    filename_lower = filename.lower()
    
    if filename_lower.endswith('.csv'):
        return await parse_csv_file(file_content, filename)
    elif filename_lower.endswith('.pdf'):
        return await parse_pdf_file(file_content, filename)
    else:
        return {"error": f"Unsupported file type: {filename}", "transactions": []}

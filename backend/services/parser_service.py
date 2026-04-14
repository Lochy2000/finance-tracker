"""
Parser Service for LedgerLens
------------------------------
Handles parsing of CSV and PDF bank statements.

PDF parsing uses regex-based extraction from text. This is the "rule engine"
layer that a future AI model will enhance or replace entirely. The function
signatures and return shapes are stable — only the internals change.
"""

import csv
import io
from typing import List, Dict, Optional
from datetime import datetime
import re


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
    headers_lower = [h.lower().strip() for h in headers]
    if "emoji" in headers_lower or "notes_and_tags" in headers_lower:
        return "monzo"
    if len(headers) == 3 and "description" in headers_lower:
        return "hsbc"
    return "generic"


def parse_date(date_str: str, format_hint: str = None) -> Optional[datetime]:
    formats = [
        "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y",
        "%Y/%m/%d", "%d %b %Y", "%d %B %Y", "%d %b %y",
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
    try:
        cleaned = re.sub(r'[£$€\s,]', '', str(amount_str))
        if '(' in cleaned and ')' in cleaned:
            cleaned = '-' + cleaned.replace('(', '').replace(')', '')
        return float(cleaned)
    except (ValueError, TypeError):
        return None


async def parse_csv_file(file_content: bytes, filename: str) -> Dict:
    try:
        content = file_content.decode('utf-8-sig')
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
            "errors": errors[:10],
            "date_range": {
                "start": min(t["date"] for t in transactions) if transactions else None,
                "end": max(t["date"] for t in transactions) if transactions else None,
            }
        }
    except Exception as e:
        return {"error": str(e), "transactions": []}


# ---------------------------------------------------------------------------
# PDF transaction extraction
# ---------------------------------------------------------------------------
# Regex patterns for common UK bank statement line formats.
# These cover most text-based PDF exports from major UK banks.
# TODO: When AI is integrated, this regex engine becomes the fallback —
#       the AI model will be called first and this runs only if the model
#       cannot parse a line.

_PDF_LINE_PATTERNS = [
    # Pattern 1: "13 Apr 2026  TESCO STORES  -45.67"  or  "13/04/2026  TESCO  £45.67"
    re.compile(
        r'(?P<date>\d{1,2}[\s/\-][A-Za-z]{3,9}[\s/\-]\d{2,4})'
        r'\s+'
        r'(?P<merchant>.+?)'
        r'\s+'
        r'(?P<amount>[£$€]?\s*-?\s*[\d,]+\.\d{2})\s*$'
    ),
    # Pattern 2: "13/04/2026  TESCO STORES  45.67 DR" or "45.67 CR"
    re.compile(
        r'(?P<date>\d{1,2}/\d{1,2}/\d{2,4})'
        r'\s+'
        r'(?P<merchant>.+?)'
        r'\s+'
        r'(?P<amount>[\d,]+\.\d{2})'
        r'\s*(?P<direction>DR|CR|D|C)?\s*$',
        re.IGNORECASE
    ),
    # Pattern 3: "2026-04-13  TESCO STORES  -45.67"
    re.compile(
        r'(?P<date>\d{4}-\d{2}-\d{2})'
        r'\s+'
        r'(?P<merchant>.+?)'
        r'\s+'
        r'(?P<amount>-?[\d,]+\.\d{2})\s*$'
    ),
]


def _extract_transactions_from_text(text: str) -> List[Dict]:
    """
    Rule-based transaction extraction from raw PDF text.
    Tries multiple regex patterns per line. A future AI service
    can replace or augment this function.
    """
    transactions = []
    lines = text.split('\n')

    for line in lines:
        line = line.strip()
        if len(line) < 10:
            continue

        for pattern in _PDF_LINE_PATTERNS:
            m = pattern.match(line)
            if not m:
                continue

            date_str = m.group('date')
            merchant = m.group('merchant').strip()
            amount_str = m.group('amount').strip()

            # Skip header-like lines
            if merchant.upper() in ('DESCRIPTION', 'DETAILS', 'TRANSACTION', 'PAYMENT', 'BALANCE'):
                break

            date = parse_date(date_str)
            amount = parse_amount(amount_str)
            if not date or amount is None:
                break

            # Handle DR/CR direction marker
            direction = m.groupdict().get('direction', '')
            if direction and direction.upper() in ('DR', 'D'):
                amount = -abs(amount)
            elif direction and direction.upper() in ('CR', 'C'):
                amount = abs(amount)

            # Clean merchant
            merchant = re.sub(r'\s{2,}', ' ', merchant)

            transactions.append({
                "date": date.isoformat(),
                "merchant_raw": merchant,
                "amount": amount,
                "currency": "GBP",
            })
            break  # matched a pattern, move to next line

    return transactions


async def parse_pdf_file(file_content: bytes, filename: str) -> Dict:
    """
    Parse a PDF bank statement by extracting text and applying
    regex-based transaction detection.
    """
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(file_content))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        if not text.strip():
            return {
                "error": "Could not extract text from PDF. The file may be scanned/image-based.",
                "transactions": []
            }

        transactions = _extract_transactions_from_text(text)

        if not transactions:
            return {
                "transactions": [],
                "bank_name": "Unknown (PDF)",
                "total_parsed": 0,
                "total_errors": 0,
                "errors": [],
                "message": "No transactions could be extracted. The PDF format may not be supported yet.",
                "raw_text_preview": text[:500]
            }

        return {
            "transactions": transactions,
            "bank_name": "PDF Statement",
            "total_parsed": len(transactions),
            "total_errors": 0,
            "errors": [],
            "date_range": {
                "start": min(t["date"] for t in transactions),
                "end": max(t["date"] for t in transactions),
            }
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

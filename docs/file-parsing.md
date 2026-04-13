# File Parsing

File: `backend/services/parser_service.py`

---

## Supported formats

| Format | Status | Notes |
|---|---|---|
| **Monzo CSV** | Working | Detected by `emoji` or `notes_and_tags` column headers. |
| **HSBC CSV** | Working | Detected by 3 columns with `description` header. |
| **Generic CSV** | Working | Fallback — expects columns in order: date, description, amount. |
| **PDF** | Placeholder | Extracts raw text via PyPDF2 but does **not** parse transactions from it. Returns empty array. |

---

## Upload → Import pipeline

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────────┐
│  Upload   │───►│  Validate │───►│  Parse CSV/  │───►│  AI Enrich │───►│  Save to     │
│  (POST)   │    │  type+size│    │  PDF         │    │  each txn  │    │  previews    │
└──────────┘    └───────────┘    └──────────────┘    └────────────┘    └──────────────┘
                                                                              │
                                                                              ▼
                                                                      ┌──────────────┐
                                                     User reviews ───►│  Import      │
                                                     and confirms     │  (POST)      │
                                                                      │  → txns coll │
                                                                      └──────────────┘
```

### Step-by-step

1. **Upload** (`POST /api/files/upload`)
   - File is read into memory.
   - Validated: must be `.csv` or `.pdf`, max 10 MB.
   - Saved to disk as `/app/uploads/{file_id}.{ext}`.
   - `uploaded_files` document created with `status: "pending"`.

2. **Parse**
   - Status updated to `"parsing"`.
   - `parse_file()` routes to `parse_csv_file()` or `parse_pdf_file()`.
   - CSV parser: detects bank format from headers → extracts date/merchant/amount from each row.
   - Returns `{ transactions: [...], bank_name, total_parsed, total_errors, date_range }`.

3. **AI enrichment**
   - For each parsed transaction:
     - `categorize_transaction(merchant_raw, amount)` → `{ category, subcategory, confidence_score }`
     - `normalize_merchant_name(merchant_raw)` → cleaned merchant string
   - Enriched transactions are stored in `parsed_previews` collection.

4. **Preview** (`GET /api/files/preview/{file_id}`)
   - Returns the enriched transactions for user review.
   - Frontend shows a table with date, merchant, suggested category, amount, confidence.

5. **Import** (`POST /api/files/import/{file_id}`)
   - Reads from `parsed_previews`.
   - Creates `transaction` documents in the `transactions` collection.
   - Deletes the preview.
   - Updates file status to `"imported"`.

---

## CSV parsing details

### Bank format detection (`detect_bank_format`)

```python
if "emoji" in headers or "notes_and_tags" in headers → "monzo"
if len(headers) == 3 and "description" in headers → "hsbc"
else → "generic"
```

### Date parsing (`parse_date`)

Tries these formats in order:
1. `%d/%m/%Y` (e.g. `13/04/2026`)
2. `%Y-%m-%d` (e.g. `2026-04-13`)
3. `%d-%m-%Y`
4. `%m/%d/%Y`
5. `%Y/%m/%d`
6. `%d %b %Y` (e.g. `13 Apr 2026`)
7. `%d %B %Y` (e.g. `13 April 2026`)

If a bank format specifies a `date_format`, that's tried first.

### Amount parsing (`parse_amount`)

- Strips `£`, `$`, `€`, commas, whitespace.
- Handles parenthesised negatives: `(50.00)` → `-50.00`.
- Returns `float`.

---

## PDF parsing (placeholder)

`parse_pdf_file()` uses PyPDF2 to extract raw text from all pages but **does not attempt to parse transactions** from the text. It returns:

```json
{
  "transactions": [],
  "bank_name": "Unknown (PDF)",
  "message": "PDF parsing is in development. Please use CSV exports for now.",
  "raw_text_preview": "first 500 chars of extracted text"
}
```

To implement real PDF parsing, you would need:
- Bank-specific text patterns (each bank formats their PDF statements differently).
- Possibly OCR support (Tesseract) for scanned statements.
- A library like `pdfplumber` (better table extraction than PyPDF2).

---

## File validation

- **Allowed extensions:** `.csv`, `.pdf`
- **Max file size:** 10 MB
- **Filename sanitisation:** Original filename is stored in the DB but not used for disk storage. Files are saved as `{file_id}.{ext}`.

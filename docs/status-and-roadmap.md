# Status & Roadmap

Last updated: 2026-04-13

---

## What's built and working

| Area | Status | Notes |
|---|---|---|
| **Auth — registration** | Working | Creates user, sets cookies, redirects to dashboard. |
| **Auth — login** | Working | Validates credentials, brute-force protection, sets cookies. |
| **Auth — logout** | Working | Clears cookies. |
| **Auth — Google OAuth** | Wired up | Frontend redirects to Emergent auth, backend exchanges session. Untested end-to-end (requires real Google account). |
| **Auth — forgot/reset password** | Backend working | Token generated and stored. Reset link logged to stdout. No email service, no frontend reset UI. |
| **Seed data** | Working | ~270 transactions + 3 salary payments seeded on startup for the admin user. |
| **CSV upload + parse** | Working | Monzo, HSBC, and generic CSV formats detected and parsed. |
| **AI categorisation** | Working (MOCKED) | Keyword-based. Returns realistic-looking results. |
| **Transaction preview** | Working | After upload, user sees enriched transactions before importing. |
| **Transaction import** | Working | Moves transactions from preview to permanent collection. |
| **Transaction list + filter** | Backend working | Paginated, searchable, filterable by category. |
| **Transaction edit** | Backend working | Can update merchant_clean, category, subcategory, notes. |
| **Dashboard API** | Working | Returns spend, income, categories, daily trends, merchants, AI summary. |
| **Insights API** | Working | Recurring payments, unusual spending, savings suggestions, month comparison. |
| **Reports API** | Working | Generates and saves reports with category breakdown and AI summary. |
| **Settings API** | Working | CRUD for settings, profile, accounts. |
| **Frontend — all 7 pages** | Built | Login, Dashboard, Upload, Transactions, Insights, Reports, Settings. |
| **Sidebar navigation** | Working | Desktop sidebar + mobile hamburger menu. |
| **Charts** | Built | Pie chart (categories), line chart (daily spending), bar chart (report daily). |

---

## Known bugs (P0 — must fix)

### 1. `GET /api/auth/me` returns 500

**File:** `backend/routers/auth.py` line 260  
**Cause:** `get_me()` calls `await get_current_user(request)` but the function signature is `get_current_user(request, db)` — the `db` argument is missing.  
**Impact:** The frontend's initial auth check always fails, so the user is treated as unauthenticated after a page refresh. Login still works because it returns user data directly, but refreshing the page forces a re-login.  
**Fix:** Change line 260 to `user = await get_current_user(request, db)`.

### 2. Dashboard / Transactions / Insights / Reports / Settings return 404

**File:** `backend/server.py` line 37  
**Cause:** `redirect_slashes=False` is set, but all router root endpoints are registered as `@router.get("/")` which creates paths like `/api/dashboard/`. The frontend calls `/api/dashboard` (no trailing slash), which doesn't match.  
**Impact:** The dashboard shows £0.00 and "No spending data" because the API call fails with 404.  
**Fix:** Either:
- (a) Remove `redirect_slashes=False` and fix the mixed-content redirect issue differently (e.g. with a `ProxyHeaders` middleware), or
- (b) Register duplicate routes: `@router.get("")` alongside `@router.get("/")` on every root handler, or
- (c) Add trailing slashes to frontend API calls.

### 3. `GET /api/insights/unusual` crashes with `NameError`

**File:** `backend/routers/insights.py` lines 102–106  
**Cause:** `timedelta` is referenced on line 103 but imported on line 106 (inside the function body, after use).  
**Fix:** Move `from datetime import timedelta` to the top of the file.

---

## Known bugs (P1 — should fix)

### 4. `parsed_previews.expires_at` is set to creation time

**File:** `backend/routers/files.py` line 125  
**Cause:** `"expires_at": datetime.now(timezone.utc).isoformat()` — should be `+ timedelta(hours=24)`.  
**Impact:** Previews never expire. No cleanup mechanism.  
**Fix:** Set `expires_at` to `datetime.now(timezone.utc) + timedelta(hours=24)` and add a periodic cleanup task.

### 5. `generate_monthly_summary` returns a `datetime` object

**File:** `backend/services/ai_service.py` line 168  
**Cause:** `"generated_at": datetime.now(timezone.utc)` — this is a Python datetime, not a string. FastAPI's JSON encoder handles it, but it may cause issues if the dict is stored in MongoDB or compared as a string elsewhere.  
**Fix:** Use `.isoformat()`.

### 6. Pydantic schemas defined but mostly unused

**Files:** `backend/schemas/*.py`  
**Cause:** Schemas were created as reference models but the routers use raw `request.json()` and return plain dicts instead of Pydantic response models.  
**Impact:** No input validation beyond what's manually coded. No automatic OpenAPI schema generation for most endpoints.  
**Fix:** Wire schemas into the router handlers as `response_model=` and request body types.

---

## Missing features (prioritised)

### P0 — Core functionality gaps

| Feature | Description |
|---|---|
| **Token auto-refresh** | Frontend doesn't call `/auth/refresh` when the 15-min access token expires. After 15 min of inactivity, all API calls fail with 401 and the user must re-login. |
| **Frontend error handling on auth expiry** | No Axios interceptor to catch 401 and either refresh or redirect to login. |

### P1 — Important for usability

| Feature | Description |
|---|---|
| **PDF transaction extraction** | Currently returns empty. Need bank-specific PDF parsing (pdfplumber, regex patterns per bank). |
| **Password change flow** | Backend has forgot/reset but no "change current password" endpoint. Frontend "Change Password" button is disabled. |
| **Report export** | "Export" button shows a toast. Need CSV/PDF export generation. |
| **Delete account** | Frontend button exists but is disabled. Backend has no endpoint. |
| **Delete transactions by file** | When deleting an uploaded file, imported transactions remain. No option to cascade-delete. |
| **Upload history page** | File list is only shown as "Recent Uploads" on the dashboard. No dedicated page to see all uploads with statuses. |
| **Reset password frontend UI** | `/forgot-password` just renders the login page. Need a proper "Enter email → Check inbox → Enter new password" flow. |

### P2 — Nice to have

| Feature | Description |
|---|---|
| **Multi-currency support** | Currency selector exists in settings but dashboard/reports always format as GBP. |
| **Date format setting** | Setting exists but `formatDate()` in the frontend ignores it. |
| **Dark mode** | Theme toggle exists in settings but no dark mode CSS variables or class switching. |
| **Notification system** | Toggle exists but no actual notification mechanism. |
| **Bulk category editing in UI** | Backend supports `POST /transactions/bulk-update` but frontend has no multi-select UI. |
| **Account linking to transactions** | `account_id` field exists on transactions but is always `null`. No UI to assign transactions to accounts. |
| **Subcategory display** | Backend stores subcategories but frontend doesn't show them. |
| **Natural language queries** | e.g. "How much did I spend on coffee last month?" — would require the AI service to be connected to a real LLM. |
| **Transaction splitting** | Split a single transaction into multiple categories. |
| **Budgets** | Set monthly budgets per category and track against them. |
| **Merchant rules** | User-defined rules like "Always categorise 'AMZN' as Shopping". The `user_rules` collection from the original spec is not implemented. |

---

## Architecture improvements

| Item | Description |
|---|---|
| **Use BSON dates instead of ISO strings** | Currently all dates are stored as strings. Using proper BSON Date objects would enable MongoDB date aggregation operators and improve query performance. |
| **Add Pydantic response models** | Wire the existing schemas into endpoints for validation and OpenAPI docs. |
| **Background task queue** | File parsing currently happens synchronously in the upload request. For large files or PDF OCR, this should be a background job (e.g. Celery, or FastAPI `BackgroundTasks`). |
| **Rate limiting** | No rate limiting on API endpoints beyond brute-force protection on login. |
| **Audit logging** | No record of who changed what. |
| **Test suite** | No automated tests (unit or integration). |
| **Migrate to Vite** | The problem statement specified Vite + TypeScript but the scaffold uses CRA + JavaScript. |

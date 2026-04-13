# Backend API Reference

Base URL: `{REACT_APP_BACKEND_URL}/api`

All protected endpoints require an `access_token` httpOnly cookie (set by login/register) **or** an `Authorization: Bearer <token>` header.

---

## Auth (`/api/auth`)

| Method | Path | Auth? | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/register` | No | `{ email, password, name }` | User object. Sets `access_token` + `refresh_token` cookies. |
| POST | `/auth/login` | No | `{ email, password }` | User object. Sets cookies. Brute-force protected (5 fails → 15 min lockout). |
| POST | `/auth/logout` | No | — | Clears cookies. |
| GET | `/auth/me` | Yes | — | Current user (without `password_hash`). |
| POST | `/auth/refresh` | Cookie | — | Issues a new `access_token`. Reads `refresh_token` cookie. |
| POST | `/auth/forgot-password` | No | `{ email }` | Always returns success (prevents enumeration). Logs reset link to stdout. |
| POST | `/auth/reset-password` | No | `{ token, new_password }` | Resets password using the token from forgot-password. |
| POST | `/auth/google/session` | No | `{ session_id }` | Exchanges Emergent OAuth session for JWT cookies. Creates user if new. |

### Known bug

`GET /auth/me` currently returns **500** because the handler calls `get_current_user(request)` without passing the `db` argument. See [status-and-roadmap.md](status-and-roadmap.md).

---

## Files (`/api/files`)

| Method | Path | Auth? | Body | Returns |
|---|---|---|---|---|
| POST | `/files/upload` | Yes | `multipart/form-data` with `file` field | Parse result: `file_id`, `status`, `transaction_count`, etc. |
| GET | `/files/preview/{file_id}` | Yes | — | Parsed transactions before import (stored temporarily in `parsed_previews`). |
| POST | `/files/import/{file_id}` | Yes | — | Imports previewed transactions into the `transactions` collection. Deletes preview. |
| GET | `/files` | Yes | `?skip=0&limit=50` | List of uploaded files for the current user. |
| DELETE | `/files/{file_id}` | Yes | — | Deletes file record and disk file. Does **not** delete already-imported transactions. |

### Upload flow

1. File is saved to `/app/uploads/{file_id}.{ext}`.
2. Parser service attempts to parse (CSV only — PDF is placeholder).
3. AI service enriches each transaction with `category`, `subcategory`, `confidence_score`, `merchant_clean`.
4. Enriched transactions are saved to `parsed_previews` collection.
5. User reviews the preview via `/files/preview/{file_id}`.
6. User confirms via `/files/import/{file_id}` → transactions are inserted into `transactions` collection.

---

## Transactions (`/api/transactions`)

| Method | Path | Auth? | Params / Body | Returns |
|---|---|---|---|---|
| GET | `/transactions` | Yes | `?page=1&page_size=50&category=&search=&start_date=&end_date=&sort_by=date&sort_order=desc` | Paginated list with `total`, `total_pages`. |
| GET | `/transactions/categories` | Yes | — | Aggregated list of categories with counts and totals. |
| GET | `/transactions/{id}` | Yes | — | Single transaction. |
| PATCH | `/transactions/{id}` | Yes | `{ merchant_clean?, category?, subcategory?, notes? }` | Updated transaction. |
| DELETE | `/transactions/{id}` | Yes | — | Confirmation message. |
| POST | `/transactions/bulk-update` | Yes | `{ transaction_ids: [], update: { category?, subcategory? } }` | Count of modified documents. |

---

## Dashboard (`/api/dashboard`)

| Method | Path | Auth? | Params | Returns |
|---|---|---|---|---|
| GET | `/dashboard` | Yes | `?month=4&year=2026` | `total_spend_month`, `total_income_month`, `spending_by_category`, `spending_over_time`, `top_merchants`, `recent_uploads`, `ai_summary`, `transaction_count`. |
| GET | `/dashboard/stats` | Yes | — | Quick summary: spend, income, transaction count for current month. |

### Known bug

`GET /dashboard` returns **404** when called without a trailing slash because `redirect_slashes=False` is set on the FastAPI app. The frontend calls `/dashboard?month=…` (no trailing slash) which doesn't match the registered route `/dashboard/`. See [status-and-roadmap.md](status-and-roadmap.md).

---

## Insights (`/api/insights`)

| Method | Path | Auth? | Params | Returns |
|---|---|---|---|---|
| GET | `/insights` | Yes | — | All insights: `recurring_payments`, `unusual_spending`, `savings_suggestions`, `month_comparison`. |
| GET | `/insights/recurring` | Yes | — | Recurring payment list. |
| GET | `/insights/unusual` | Yes | — | Unusual spending alerts. |
| GET | `/insights/savings` | Yes | — | Savings suggestions. |
| GET | `/insights/compare` | Yes | `?period1_start=&period1_end=&period2_start=&period2_end=` | Side-by-side period comparison. |

### Known bug

`GET /insights/unusual` references `timedelta` before importing it (the `from datetime import timedelta` is placed *after* the first usage on line 102–104). This would crash at runtime.

---

## Reports (`/api/reports`)

| Method | Path | Auth? | Body | Returns |
|---|---|---|---|---|
| POST | `/reports/generate` | Yes | `{ start_date, end_date, categories?, report_type? }` | Full report: totals, category breakdown, daily spending, AI summary. Saved to `reports` collection. |
| GET | `/reports` | Yes | `?skip=0&limit=20` | List of saved report summaries. |
| GET | `/reports/{id}` | Yes | — | Full saved report. |
| DELETE | `/reports/{id}` | Yes | — | Confirmation message. |

---

## Settings (`/api/settings`)

| Method | Path | Auth? | Body | Returns |
|---|---|---|---|---|
| GET | `/settings` | Yes | — | User settings (or defaults if none saved). |
| PATCH | `/settings` | Yes | `{ currency?, date_format?, theme?, notifications_enabled? }` | Updated settings. |
| GET | `/settings/profile` | Yes | — | User profile (name, email, picture, role). |
| PATCH | `/settings/profile` | Yes | `{ name }` | Updated profile. |
| GET | `/settings/accounts` | Yes | — | List of linked bank accounts. |
| POST | `/settings/accounts` | Yes | `{ name, bank_name?, account_type?, currency? }` | New account object. |
| DELETE | `/settings/accounts/{id}` | Yes | — | Confirmation message. |

# Database Models

Database: MongoDB (accessed via Motor async driver)  
DB name: value of `DB_NAME` env var (default: `ledgerlens`)

---

## Collections

### `users`

| Field | Type | Notes |
|---|---|---|
| `user_id` | string | `"user_{12-char-hex}"`. Primary identifier. |
| `email` | string | Unique, lower-cased. |
| `name` | string | Display name. |
| `password_hash` | string | bcrypt hash. Absent for Google OAuth users. |
| `role` | string | `"user"` or `"admin"`. |
| `auth_provider` | string | `"google"` for OAuth users. Absent for email users. |
| `picture` | string | Google profile picture URL. Optional. |
| `created_at` | string (ISO 8601) | |

**Indexes:**
- `email` — unique
- `user_id` — unique

---

### `transactions`

| Field | Type | Notes |
|---|---|---|
| `transaction_id` | string | `"txn_{12-char-hex}"`. Primary identifier. |
| `user_id` | string | FK to `users.user_id`. |
| `account_id` | string / null | FK to `accounts.account_id`. Currently always null in seeded data. |
| `date` | string (ISO 8601) | Transaction date. Stored as string, compared lexicographically. |
| `merchant_raw` | string | Original merchant name from the bank statement. |
| `merchant_clean` | string / null | AI-cleaned merchant name. |
| `amount` | float | Negative = expense, positive = income. |
| `currency` | string | Default `"GBP"`. |
| `category` | string / null | AI-assigned or user-edited category. |
| `subcategory` | string / null | |
| `source_file_id` | string / null | FK to `uploaded_files.file_id`. Null for seeded data. |
| `confidence_score` | float / null | 0.0–1.0. How confident the AI was in the categorisation. |
| `notes` | string / null | User-added notes. |
| `created_at` | string (ISO 8601) | |
| `updated_at` | string (ISO 8601) | Set on edit. |

**Indexes:**
- `transaction_id` — unique
- `(user_id, date)` — compound, descending date

**Note:** Dates are stored as ISO 8601 strings, not BSON Date objects. This means date range queries use string comparison (`$gte`, `$lt` on strings). This works correctly because ISO 8601 sorts lexicographically, but it prevents using MongoDB's date aggregation operators (e.g. `$month`, `$year`).

---

### `uploaded_files`

| Field | Type | Notes |
|---|---|---|
| `file_id` | string | `"file_{12-char-hex}"`. |
| `user_id` | string | |
| `filename` | string | Original uploaded filename. |
| `safe_filename` | string | Disk filename: `{file_id}.{ext}`. |
| `file_type` | string | `"csv"` or `"pdf"`. |
| `file_size` | int | Bytes. |
| `status` | string | `"pending"`, `"parsing"`, `"parsed"`, `"imported"`, `"failed"`. |
| `transaction_count` | int / null | Number of transactions parsed. |
| `bank_name` | string / null | Detected bank format. |
| `error` | string | Error message if status is `"failed"`. |
| `uploaded_at` | string (ISO 8601) | |
| `parsed_at` | string (ISO 8601) / null | |

**Indexes:**
- `file_id` — unique
- `(user_id, uploaded_at)` — compound, descending

---

### `parsed_previews`

Temporary collection holding enriched transactions between parsing and import.

| Field | Type | Notes |
|---|---|---|
| `file_id` | string | FK to `uploaded_files.file_id`. |
| `user_id` | string | |
| `transactions` | array of objects | Enriched transaction objects (same shape as `transactions` collection minus `transaction_id`). |
| `bank_name` | string | |
| `total_amount` | float | |
| `date_range` | object | `{ start, end }` ISO strings. |
| `created_at` | string | |
| `expires_at` | string | Currently set to `created_at` (bug — should be +24h). |

**No indexes defined.** Queried by `file_id + user_id`. Deleted after import.

---

### `reports`

| Field | Type | Notes |
|---|---|---|
| `report_id` | string | `"report_{12-char-hex}"`. |
| `user_id` | string | |
| `start_date` | string | |
| `end_date` | string | |
| `report_type` | string | `"summary"`. |
| `filters` | object | `{ categories: [...] }` if filtered. |
| `total_spend` | float | |
| `total_income` | float | |
| `net_change` | float | |
| `transaction_count` | int | |
| `category_breakdown` | array | Category summaries. |
| `daily_spending` | array | `[{ date, amount }]`. |
| `ai_summary` | string | Templated summary text. |
| `generated_at` | string (ISO 8601) | |

**Indexes:**
- `(user_id, generated_at)` — compound, descending

---

### `accounts`

| Field | Type | Notes |
|---|---|---|
| `account_id` | string | `"acc_{12-char-hex}"`. |
| `user_id` | string | |
| `name` | string | User-given name. |
| `bank_name` | string / null | |
| `account_type` | string | `"checking"` default. |
| `currency` | string | `"GBP"` default. |
| `created_at` | string | |

**No indexes defined.**

---

### `user_settings`

| Field | Type | Notes |
|---|---|---|
| `user_id` | string | |
| `currency` | string | `"GBP"` / `"USD"` / `"EUR"`. |
| `date_format` | string | `"DD/MM/YYYY"` etc. |
| `theme` | string | `"light"`. |
| `notifications_enabled` | bool | |
| `default_account` | string / null | |
| `updated_at` | string | |

**No indexes defined.** Upserted on write.

---

### `login_attempts`

| Field | Type | Notes |
|---|---|---|
| `identifier` | string | `"{IP}:{email}"`. |
| `attempts` | int | Counter. |
| `last_attempt` | string | |
| `locked_until` | string / null | ISO 8601. If set and in the future, login is blocked. |

**Indexes:**
- `identifier`

---

### `password_reset_tokens`

| Field | Type | Notes |
|---|---|---|
| `token` | string | `secrets.token_urlsafe(32)`. |
| `user_id` | string | |
| `email` | string | |
| `expires_at` | string | 1 hour from creation. |
| `used` | bool | Set to `true` after successful reset. |
| `created_at` | string | |

**Indexes:**
- `token`

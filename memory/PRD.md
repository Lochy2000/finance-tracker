# LedgerLens — PRD

## Original Problem Statement
Build a full-stack MVP web application called LedgerLens, a private AI-powered finance tracker for analysing uploaded bank statements and exports. Users can upload CSV/PDF files from banks (Monzo, HSBC), get AI categorisation, and view dashboards and reports.

## User Personas
- **Personal finance enthusiast** who downloads bank CSV exports and wants a private tool to analyse spending without sharing data with third-party services.
- **Freelancer / small business owner** tracking multiple accounts and wanting category-level insights across banks.

## Core Requirements (static)
- JWT + Google OAuth authentication
- CSV/PDF upload with parsing and AI categorisation
- Transaction management (view, filter, edit, search)
- Dashboard with charts (spending by category, over time, top merchants)
- AI Insights (recurring payments, unusual spending, savings suggestions, month comparison)
- Custom report generation with date range and category filters
- Settings (profile, preferences, accounts)
- Mock AI service layer swappable with Ollama/local models

## Architecture
- Frontend: React (CRA) + Tailwind + Shadcn/UI + Recharts
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- Auth: JWT cookies + Emergent Google OAuth
- File storage: Local disk

## What's Been Implemented (2026-04-13)
- Full backend with 7 routers (auth, files, transactions, dashboard, insights, reports, settings)
- AI service with 6 mock functions (categorize, normalize, recurring, summary, unusual, savings)
- CSV parser supporting Monzo, HSBC, generic formats
- PDF parser placeholder (text extraction only)
- Frontend with 7 pages (Login, Dashboard, Upload, Transactions, Insights, Reports, Settings)
- Sample data seeding (~270 transactions)
- Comprehensive documentation (9 docs + README)

## What's NOT Working (known bugs — documented in docs/status-and-roadmap.md)
- `GET /api/auth/me` returns 500 (missing db arg)
- Dashboard/Transactions/etc return 404 (redirect_slashes issue)
- `GET /api/insights/unusual` crashes (timedelta import order)
- parsed_previews.expires_at set incorrectly
- generate_monthly_summary returns non-serializable datetime

## Prioritised Backlog
### P0
- Fix the 3 backend bugs blocking frontend functionality
- Add token auto-refresh (Axios interceptor)

### P1
- PDF transaction extraction
- Password change flow
- Report CSV/PDF export
- Delete account endpoint
- Upload history page
- Reset password frontend UI

### P2
- Multi-currency display
- Dark mode
- Bulk category editing UI
- Account linking to transactions
- Budgets feature
- Merchant rules (user_rules collection)
- Natural language queries (requires real LLM)
- Migrate to Vite + TypeScript

## Next Tasks
1. Fix the 3 P0 backend bugs
2. Add Axios 401 interceptor for token refresh
3. Test full upload → preview → import flow end-to-end
4. Implement PDF parsing for at least one bank format
5. Add report export (CSV)

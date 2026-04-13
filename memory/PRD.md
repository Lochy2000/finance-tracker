# LedgerLens — PRD

## Original Problem Statement
Build a full-stack MVP web application called LedgerLens, a private AI-powered finance tracker for analysing uploaded bank statements and exports.

## What's Been Implemented (2026-04-13)
- Full backend with 7 routers (auth, files, transactions, dashboard, insights, reports, settings)
- AI service with 6 mock functions (categorize, normalize, recurring, summary, unusual, savings)
- CSV parser supporting Monzo, HSBC, generic formats; PDF placeholder
- Frontend with 7 pages, all data-connected and working
- JWT + Google OAuth authentication with brute-force protection
- Axios 401 interceptor for automatic token refresh
- Sample data seeding (~270 transactions)
- Comprehensive documentation (9 docs + README)
- Code quality refactor: all hook deps fixed, components extracted, insecure random replaced

## Bugs Fixed (2026-04-13)
- GET /api/auth/me 500 → fixed (missing db arg)
- Dashboard/Transactions/etc 404 → fixed (route path mismatch with redirect_slashes)
- insights/unusual crash → fixed (timedelta import order)

## Verified Working (19/19 backend tests, 95% frontend)
- Login, registration, logout, auth/me, token refresh
- Dashboard with charts, AI summary, spending data
- Transactions with search, filter, pagination, edit
- AI Insights with recurring, unusual, savings, month comparison
- Report generation with category breakdown
- Settings with profile, preferences, accounts
- CSV upload with parse + preview + import pipeline

## Prioritised Backlog
### P1
- PDF transaction extraction
- Password change flow
- Report CSV/PDF export
- Upload history page
- Reset password frontend UI

### P2
- Multi-currency display
- Dark mode
- Bulk category editing UI
- Budgets feature
- Merchant rules

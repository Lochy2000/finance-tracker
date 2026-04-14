# LedgerLens — PRD

## Original Problem Statement
Build LedgerLens, an AI-powered personal finance tracker. Upload bank CSV/PDF, get AI categorisation, view dashboards/reports.

## What's Implemented (2026-04-14)
- Auth: JWT + Google OAuth + change-password + brute-force protection + Axios 401 auto-refresh
- 8 backend routers: auth, files, transactions, dashboard, insights, reports, settings, budgets
- AI service: 6 mock functions (categorize, normalize, recurring, summary, unusual, savings) — designed for Ollama/local LLM swap
- Parser: CSV (Monzo, HSBC, generic) + PDF regex extraction
- Dashboard: charts, AI summary, budget progress bars
- Budgets: per-category monthly limits with CRUD + progress tracking
- Reports: generate + CSV export
- Upload History: dedicated page for all uploaded files
- Settings: profile, preferences, accounts, change password, budget management
- Frontend: 8 pages, all data-connected and tested

## AI Integration Strategy
All AI functions are async, return plain dicts, and live in services/ai_service.py. The parser_service.py PDF extractor uses regex as a rule engine. When a local model (Ollama/vLLM) is connected, each function becomes a prompt+parse call with the current implementation as fallback.

## Prioritised Backlog
### P1
- Connect real AI model (Ollama) for categorisation + summaries
- Multi-currency display honouring user settings
- Dark mode
### P2
- Natural language queries (requires LLM)
- Merchant rules (user_rules collection)
- Transaction splitting
- Bulk category editing UI

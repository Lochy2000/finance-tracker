# LedgerLens

**AI-powered personal finance tracker** — Upload bank statements (CSV/PDF), get intelligent categorisation, and view clean dashboards and reports.

> **Project status: MVP scaffold.** Core structure is in place. Several backend routes and the full frontend exist, but there are [known bugs and incomplete features](docs/status-and-roadmap.md) that need fixing before the app is production-ready.

---

## Quick links

| Document | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | System diagram, tech stack, how the pieces connect |
| [Backend API](docs/backend-api.md) | Every endpoint, request/response shapes, auth headers |
| [Frontend Structure](docs/frontend-structure.md) | Pages, components, routing, state management |
| [Auth Flow](docs/auth-flow.md) | JWT cookies, Google OAuth, token refresh, brute-force protection |
| [AI Service](docs/ai-service.md) | What's mocked, what each function does, how to plug in a real model |
| [File Parsing](docs/file-parsing.md) | Upload flow, CSV parsing logic, PDF placeholder, supported banks |
| [Database Models](docs/database-models.md) | MongoDB collections, document shapes, indexes |
| [Deployment](docs/deployment.md) | Environment variables, supervisor, how to run locally |
| [Status & Roadmap](docs/status-and-roadmap.md) | Known bugs, missing features, prioritised backlog |

---

## Running locally

```bash
# Backend
cd backend
pip install -r requirements.txt
# set env vars in .env (see docs/deployment.md)
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn install
yarn start   # runs on port 3000
```

Requires **MongoDB** running locally (default `mongodb://localhost:27017`).

---

## Project tree (abridged)

```
/app
├── backend/
│   ├── server.py               # FastAPI entry point, startup seeding
│   ├── routers/                 # One file per domain
│   │   ├── auth.py
│   │   ├── files.py
│   │   ├── transactions.py
│   │   ├── dashboard.py
│   │   ├── insights.py
│   │   ├── reports.py
│   │   └── settings.py
│   ├── services/
│   │   ├── ai_service.py        # Mock AI (categorisation, recurring detection, etc.)
│   │   └── parser_service.py    # CSV + PDF parsing
│   └── schemas/                 # Pydantic models (reference only — not all are wired in)
├── frontend/
│   ├── src/
│   │   ├── App.js               # Router, auth guards
│   │   ├── context/AuthContext.js
│   │   ├── lib/api.js           # Axios wrapper for every backend route
│   │   ├── lib/utils.js         # formatCurrency, formatDate, etc.
│   │   ├── components/Layout.js # Sidebar + mobile nav
│   │   └── pages/
│   │       ├── LoginPage.js
│   │       ├── DashboardPage.js
│   │       ├── UploadPage.js
│   │       ├── TransactionsPage.js
│   │       ├── InsightsPage.js
│   │       ├── ReportsPage.js
│   │       └── SettingsPage.js
│   └── tailwind.config.js
├── uploads/                     # Uploaded bank statement files (gitignored)
├── docs/                        # ← you are here
└── memory/
    └── test_credentials.md      # Seeded admin login for testing
```

---

## Test credentials

After the backend starts it seeds an admin account automatically:

| Field | Value |
|---|---|
| Email | `admin@ledgerlens.com` |
| Password | `Admin123!` |
| Role | admin |

~270 sample transactions (90 days of random spending + 3 salary payments) are also seeded on first run.

# Architecture

## High-level diagram

```
┌────────────────┐      HTTPS (cookies)      ┌─────────────────────┐
│  React SPA     │ ◄──────────────────────── │  FastAPI backend     │
│  (port 3000)   │ ────────────────────────► │  (port 8001)         │
│                │   /api/* prefixed routes   │                     │
│  Tailwind CSS  │                           │  Motor (async Mongo) │
│  Recharts      │                           │  bcrypt / PyJWT      │
│  Axios         │                           │  aiofiles            │
│  Shadcn/UI     │                           │  PyPDF2              │
└────────────────┘                           └──────────┬──────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  MongoDB         │
                                              │  (localhost:27017│
                                              │   DB: ledgerlens)│
                                              └─────────────────┘
                                                        ▲
                                              ┌─────────┘
                                              │
                                    ┌─────────────────────┐
                                    │  Local file storage  │
                                    │  /app/uploads/       │
                                    └─────────────────────┘
```

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 18 (CRA), Tailwind CSS, Shadcn/UI, Recharts, Axios | Single-page app. CRA (not Vite — the problem statement mentioned Vite but the scaffold uses CRA). |
| **Backend** | Python 3.11, FastAPI, Motor (async MongoDB driver) | Modular router pattern. Each domain is its own file. |
| **Database** | MongoDB 7 | Accessed via the `MONGO_URL` env var. Indexes created on startup. |
| **Auth** | JWT (HS256) in httpOnly cookies + Emergent-managed Google OAuth | Access token = 15 min, refresh token = 7 days. |
| **AI** | Mock / keyword-based (placeholder) | Designed as a swappable service layer. See [ai-service.md](ai-service.md). |
| **File storage** | Local disk (`/app/uploads/`) | Files are renamed to `{file_id}.{ext}` to avoid path traversal. |

## Request flow

1. Browser makes an `XMLHttpRequest` to `REACT_APP_BACKEND_URL/api/…`.
2. Kubernetes ingress routes any `/api/*` request to port 8001.
3. FastAPI CORS middleware validates the origin.
4. The router handler reads the `access_token` cookie (or `Authorization: Bearer` header).
5. `get_current_user()` decodes the JWT and loads the user document from MongoDB.
6. The handler runs business logic, queries MongoDB, and returns JSON.

## Design principles

- **Modular routers.** Each domain (auth, files, transactions, dashboard, insights, reports, settings) is a separate file with a factory function (`create_*_router(db, get_current_user)`).
- **AI as a service layer.** All AI-related logic lives in `services/ai_service.py`. Every function is `async` and returns plain dicts so that swapping in an HTTP call to Ollama or a local model is a one-line change per function.
- **User isolation.** Every database query includes `user_id` in the filter. Files on disk are stored by `file_id`, not by original filename.
- **No paid APIs.** The AI service is entirely local / mocked. The architecture is ready for a self-hosted open model (Ollama, vLLM, etc.) but doesn't call any external inference endpoint.

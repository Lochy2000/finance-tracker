# Deployment

## Environment variables

### Backend (`/app/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string. Default: `mongodb://localhost:27017` |
| `DB_NAME` | Yes | Database name. Default: `ledgerlens` |
| `CORS_ORIGINS` | No | Allowed origins. Default: `*` |
| `JWT_SECRET` | Yes | Secret key for JWT signing (HS256). Must be a long random string. |
| `ADMIN_EMAIL` | No | Seeded admin email. Default: `admin@ledgerlens.com` |
| `ADMIN_PASSWORD` | No | Seeded admin password. Default: `Admin123!` |
| `FRONTEND_URL` | No | Used for CORS and password reset links. Default: `http://localhost:3000` |

### Frontend (`/app/frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Full URL to the backend (e.g. `https://your-app.preview.emergentagent.com`). Used by Axios for all API calls. |
| `WDS_SOCKET_PORT` | No | WebSocket port for hot reload. Set to `443` when behind HTTPS proxy. |

---

## Supervisor (Emergent / production)

Both services are managed by supervisor:

```ini
# Backend: uvicorn on 0.0.0.0:8001
# Frontend: react-scripts start on port 3000
```

**Restart commands:**
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl status
```

**Logs:**
```bash
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log
```

**When to restart:**
- `.env` file changes → restart the affected service.
- New pip/yarn dependencies → restart after install.
- Code changes → **not needed** (hot reload handles it).

---

## Running locally (outside Emergent)

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with required variables (see above)

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install

# Create .env
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

yarn start
```

### MongoDB

```bash
# Using Docker:
docker run -d -p 27017:27017 --name ledgerlens-mongo mongo:7

# Or install natively
```

---

## Kubernetes / Emergent ingress

In the Emergent environment:

- All paths starting with `/api` are routed to the backend (port 8001).
- All other paths are routed to the frontend (port 3000).
- HTTPS termination happens at the ingress.
- Cookies are set with `secure=False` and `samesite=lax` (works because the ingress handles HTTPS).

**Known issue:** FastAPI's `redirect_slashes` feature generates HTTP (not HTTPS) redirect URLs when behind an HTTPS-terminating proxy. This causes mixed-content errors. The workaround is `redirect_slashes=False` on the FastAPI app, but this means routes must be called with the exact path (with or without trailing slash) that was registered.

---

## File storage

Uploaded files are stored at `/app/uploads/` on disk. This directory is:
- Created automatically on first upload.
- Not persisted across container restarts (unless a volume is mounted).
- Not backed up.

For production, consider mounting a persistent volume or migrating to object storage.

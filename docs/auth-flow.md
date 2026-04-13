# Auth Flow

LedgerLens supports two authentication methods:

1. **Email + password** (JWT in httpOnly cookies)
2. **Google OAuth** via Emergent-managed auth

Both methods result in the same outcome: two httpOnly cookies (`access_token`, `refresh_token`) set on the browser.

---

## 1. Email + Password

### Registration

```
POST /api/auth/register
Body: { email, password (min 6 chars), name }
```

1. Backend lower-cases the email.
2. Checks for existing user — returns 400 if duplicate.
3. Hashes password with `bcrypt.gensalt()`.
4. Creates user document in `users` collection.
5. Creates access token (15 min) and refresh token (7 days).
6. Sets both as httpOnly cookies (`samesite=lax`, `secure=false`).
7. Returns user object (no password hash).

### Login

```
POST /api/auth/login
Body: { email, password }
```

1. Checks brute-force lockout (see below).
2. Finds user by email.
3. Verifies password with `bcrypt.checkpw()`.
4. On failure: records attempt. On success: clears attempts.
5. Creates and sets JWT cookies.
6. Returns user object.

### Brute-force protection

- Tracked per `{IP}:{email}` in the `login_attempts` collection.
- After **5 consecutive failures**, the account is locked for **15 minutes**.
- Successful login clears the counter.

### Token structure

**Access token** (15 min expiry):
```json
{ "sub": "user_abc123", "email": "user@example.com", "exp": 1776090033, "type": "access" }
```

**Refresh token** (7 day expiry):
```json
{ "sub": "user_abc123", "exp": 1776694833, "type": "refresh" }
```

### Token refresh

```
POST /api/auth/refresh
```

Reads `refresh_token` cookie → validates → issues a new `access_token` cookie.

The frontend does **not** currently call this automatically. If the access token expires mid-session, API calls will return 401 and the user will be redirected to login.

### Forgot / reset password

```
POST /api/auth/forgot-password   → { email }
POST /api/auth/reset-password    → { token, new_password }
```

- Generates a `secrets.token_urlsafe(32)` token stored in `password_reset_tokens` collection (1 hour expiry).
- In MVP, the reset link is **printed to stdout** (no email service connected).
- The frontend has a `/forgot-password` route but it just renders the login page (no dedicated reset UI yet).

---

## 2. Google OAuth (Emergent-managed)

### Flow

1. User clicks "Continue with Google" on the login page.
2. Frontend redirects to: `https://auth.emergentagent.com/?redirect={origin}/dashboard`
3. User authenticates with Google on the Emergent auth page.
4. Emergent redirects back to `{origin}/dashboard#session_id={SESSION_ID}`
5. Frontend detects `#session_id=` in the URL hash.
6. `LoginPage` extracts the session ID and calls `POST /api/auth/google/session`.
7. Backend exchanges the session ID with Emergent's session-data endpoint:
   ```
   GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data
   Header: X-Session-ID: {session_id}
   ```
8. Returns Google profile: `{ email, name, picture }`.
9. Backend finds-or-creates user in `users` collection (with `auth_provider: "google"`).
10. Creates and sets JWT cookies.
11. Frontend navigates to `/dashboard`.

### Important notes

- Google OAuth users have **no password**. They cannot use the email+password login flow.
- The `auth_provider` field on the user document distinguishes Google users from email users.
- The Emergent auth URL must **not** be hardcoded or have fallbacks — it must be exactly `https://auth.emergentagent.com/?redirect=…`.

---

## How auth is checked on protected routes

### Backend (`get_current_user` in `routers/auth.py`)

1. Read `access_token` from cookies.
2. If not present, check `Authorization: Bearer <token>` header.
3. Decode JWT with `HS256` algorithm and the `JWT_SECRET` env var.
4. Verify `type === "access"`.
5. Load user from `users` collection by `user_id` from the `sub` claim.
6. Strip `password_hash` from the result.
7. Return the user dict.

### Frontend (`AuthContext`)

- On app load, calls `GET /api/auth/me`.
- If successful, sets `user` state.
- If 401, sets `user = false`.
- `ProtectedRoute` component checks `user` and redirects to `/login` if falsy.
- OAuth callbacks (`#session_id=`) skip the initial `/me` check.

---

## Logout

```
POST /api/auth/logout
```

Deletes both cookies. Frontend sets `user = false`.

---

## Admin seeding

On startup, `server.py` calls `seed_admin()`:

- Creates user with email from `ADMIN_EMAIL` env var and password from `ADMIN_PASSWORD`.
- If the user already exists but the password doesn't match, it **updates** the hash (idempotent).
- Writes credentials to `/app/memory/test_credentials.md`.

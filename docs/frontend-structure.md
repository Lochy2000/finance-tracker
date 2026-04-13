# Frontend Structure

## Tech

- **React 18** (Create React App)
- **Tailwind CSS** with a custom design-token palette (see `tailwind.config.js`)
- **Shadcn/UI** components from `/src/components/ui/`
- **Recharts** for charts (PieChart, LineChart, BarChart)
- **Axios** for API calls (`/src/lib/api.js`)
- **Lucide React** for icons

## Fonts

| Role | Font | Loaded from |
|---|---|---|
| Headings | Manrope 500/600/700 | Google Fonts (in `index.css`) |
| Body | IBM Plex Sans 400/500/600 | Google Fonts |
| Monospace | JetBrains Mono 400/500 | Google Fonts |

## Colour palette (custom Tailwind classes)

| Token | Hex | Usage |
|---|---|---|
| `bg-default` | `#F9F9F8` | Page background |
| `bg-surface` | `#FFFFFF` | Cards, modals |
| `bg-subtle` | `#F0F0EE` | Muted backgrounds, table headers |
| `fg-default` | `#1A2E25` | Primary text |
| `fg-secondary` | `#68736E` | Secondary text |
| `fg-muted` | `#9CA39F` | Placeholder text, disabled |
| `accent-primary` | `#1A2E25` | Buttons, active nav, links |
| `accent-ai` | `#C86A58` | AI-related accents, negative amounts |
| `accent-positive` | `#6A7A62` | Income, success states |
| `accent-warning` | `#D4A373` | Warnings, pending states |
| `border-color` | `#E5E5E2` | All borders |

Shadcn CSS variables (`--primary`, `--background`, etc.) are also defined in `index.css` for component compatibility.

---

## Routing (`App.js`)

| Path | Component | Auth required? |
|---|---|---|
| `/login` | `LoginPage` | No (redirects to `/dashboard` if already logged in) |
| `/forgot-password` | `LoginPage` | No |
| `/dashboard` | `DashboardPage` | Yes |
| `/upload` | `UploadPage` | Yes |
| `/transactions` | `TransactionsPage` | Yes |
| `/insights` | `InsightsPage` | Yes |
| `/reports` | `ReportsPage` | Yes |
| `/settings` | `SettingsPage` | Yes |
| `/` | Redirect → `/dashboard` | — |
| `*` | Redirect → `/dashboard` | — |

Protected routes are wrapped in `<ProtectedRoute>` which checks `useAuth().user`. If not authenticated it redirects to `/login`. While checking (`loading === true`) it shows a spinner.

OAuth callbacks arrive at any route with a `#session_id=…` hash fragment. `AppRouter` detects this and renders `<LoginPage>` directly (bypassing the auth guard). `LoginPage` picks up the hash, exchanges the session, and navigates to `/dashboard`.

---

## Pages

### LoginPage (`/login`)
- Tabbed Sign In / Sign Up form.
- "Continue with Google" button (Emergent OAuth).
- Password visibility toggle.
- Handles OAuth callback (`#session_id=` in URL hash).
- Right half shows a background image with an overlay blurb (desktop only).

### DashboardPage (`/dashboard`)
- Month/year selector (dropdowns).
- 4 stat cards: Total Spending, Total Income, Transactions, Files Uploaded.
- Pie chart: spending by category.
- Line chart: daily spending trend.
- Top merchants list (top 5).
- AI Summary panel (mock text generated server-side).
- Recent uploads list.

### UploadPage (`/upload`)
- Drag-and-drop + file picker for CSV/PDF.
- Shows parsing status and result.
- Transaction preview table (first 10 rows) with suggested categories and confidence scores.
- "Import" button to commit transactions to the database.
- Supported formats info cards (Monzo CSV, Generic CSV, PDF — coming soon).

### TransactionsPage (`/transactions`)
- Search input + category filter dropdown.
- Sortable columns (date, amount).
- Paginated table with: date, merchant (raw + clean), category badge, amount, confidence score, edit button.
- Edit modal: change merchant name, category (dropdown), notes.
- Pagination controls.

### InsightsPage (`/insights`)
- Month-over-month comparison panel (current vs previous totals + category changes).
- Recurring payments card (detected subscriptions with amounts and confidence).
- Unusual spending card (flagged transactions with severity).
- Savings suggestions grid (prioritised tips with potential savings amounts).
- AI disclaimer footer.

### ReportsPage (`/reports`)
- Left panel: date range pickers (Shadcn Calendar), category checkboxes, "Generate Report" button.
- Saved reports list with click-to-view and delete.
- Right panel: report view with stat cards, AI summary, pie chart (categories), bar chart (daily spending), category table.
- Export button (placeholder — shows toast "coming soon").

### SettingsPage (`/settings`)
- Profile card: edit name, email (read-only).
- Preferences card: currency, date format, notifications toggle.
- Accounts card: add/remove bank accounts.
- Security card: data privacy info, change password (disabled), delete account (disabled).

---

## State management

- **Auth state:** `AuthContext` (`/src/context/AuthContext.js`) — provides `user`, `loading`, `login()`, `register()`, `logout()`, `loginWithGoogle()`, `handleGoogleCallback()`.
- **Page-level state:** Each page uses local `useState` + `useEffect` to fetch data. No global store (Redux, Zustand, etc.).

## API layer (`/src/lib/api.js`)

A single Axios instance with `baseURL = {REACT_APP_BACKEND_URL}/api` and `withCredentials: true` (for cookies). Organised into named exports:

- `authApi` — register, login, logout, me, refresh, forgotPassword, resetPassword, googleSession
- `filesApi` — upload, list, preview, import, delete
- `transactionsApi` — list, get, update, delete, categories, bulkUpdate
- `dashboardApi` — get, stats
- `insightsApi` — getAll, recurring, unusual, savings, compare
- `reportsApi` — generate, list, get, delete
- `settingsApi` — get, update, getProfile, updateProfile, listAccounts, createAccount, deleteAccount

## Utilities (`/src/lib/utils.js`)

- `cn()` — Tailwind class merge (clsx + twMerge)
- `formatCurrency(amount, currency)` — Intl.NumberFormat for GBP/USD/EUR
- `formatDate(dateString, format)` — short / long / ISO date formatting
- `formatApiErrorDetail(detail)` — Normalises FastAPI error responses into a string
- `getCategoryColor(category)` — Maps category names to hex colours for charts
- `getMonthName(month)` — 1-indexed month to name

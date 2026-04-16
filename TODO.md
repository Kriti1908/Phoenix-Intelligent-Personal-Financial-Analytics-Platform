# Phoenix Platform — TODO / Remaining Work

> Organized by the **user journey**: What does a user experience after registering, and what's broken or missing at each step?

---

## 🔴 P0 — Core User Journey (Platform is unusable without these)

### 1. Transaction Input (User has no way to add data)
After registering, the user lands on an empty Dashboard with no way to get data into the system. This is the #1 gap.

- [ ] **Add Manual Transaction Entry form in frontend** — let users add a transaction (amount, description, merchant, date, category) from the Dashboard or Transactions page
- [ ] **Add CSV Upload UI** — file picker + drag-and-drop, column mapping preview, upload progress, success/error feedback
- [ ] **Show empty state / onboarding prompt** — when Dashboard has zero transactions, show a "Get Started: Upload CSV or Add Transaction" card instead of empty charts
- [ ] **Wire the CSV upload to the Ingestion Service `POST /transactions/ingest`** — frontend currently has no upload component calling this endpoint

### 2. End-to-End Pipeline Wiring (Verify services talk to each other)
The Observer pattern is implemented and `NOTIFICATION_OBSERVERS` is configured in docker-compose, but the full chain hasn't been verified end-to-end.

- [x] **Verify Ingestion → Analytics trigger** — `NOTIFICATION_OBSERVERS` in docker-compose points to `phoenix-analytics:8003/internal/trigger` to trigger categorization + FHS pipeline
- [x] **Wire Analytics completion → Anomaly Detection** — after analytics runs categorization + FHS, it calls the Anomaly service's `/internal/events/analytics-complete` endpoint via `ANOMALY_SERVICE_URL`
- [x] **Verify Anomaly → Notification push** — anomaly `internal_router` calls Notification `/internal/push-alert` → WebSocket push to frontend
- [x] **Test the full pipeline** — 21 integration tests verify: Upload CSV → Ingestion stores → Analytics categorizes + computes FHS → Anomaly checks Z-scores → Notification pushes alert

### 3. Dashboard Shows Real Data (Currently shows empty/zeroed out)
`transaction_categories` seed data exists, but Dashboard Facade queries may still return empty due to missing FHS data and RLS policy interference.

- [ ] **Seed initial `financial_health_scores` row** for the test user so the FHS gauge shows a real value instead of 0
- [ ] **Seed initial `budgets` rows** for common categories so the budget progress bars render on Dashboard
- [ ] **Verify RLS doesn't block service queries** — services use direct SQL without setting `app.current_user_id`; ensure RLS policies (with `current_setting(..., true)`) return rows correctly for superuser/service connections
- [ ] **Handle empty state gracefully** in all Dashboard components (FHS gauge, pie chart, budget bars) — show "No data yet" instead of broken charts

### 4. Transactions Page Shows Categories (Currently missing)
The Transactions page shows amount/date/description but NOT the category — the most important analytical output.

- [x] **Add category column** to the Transactions list API response (join `transaction_categories` + `categories`)
- [x] **Display category badge** in the Transactions page table (color-coded per category with icon)
- [x] **Add search/filter** — filter transactions by category, date range, amount range, and text search

---

## 🟡 P1 — Essential Features (Platform works but is incomplete)

### 5. Alerts Page (Frontend missing)
Anomaly Detection creates alerts in the DB, but there's no page to view them.

- [ ] **Create Alerts page** (`/alerts`) — list anomaly alerts with Z-score, category, description, timestamp
- [ ] **Add acknowledge button** per alert (calls `POST /alerts/{id}/acknowledge`)
- [ ] **Add Alerts link to sidebar** navigation in `App.tsx`
- [ ] **Show alert count badge** on the sidebar Alerts link (unread count from Dashboard overview)
- [ ] **WebSocket toast notifications** — show a popup when a real-time alert arrives via WebSocket (currently just invalidates the query cache silently)

### 6. Budget Management (API-only, no UI)
Users can't set or override budgets from the frontend.

- [ ] **Create Budget page** (`/budgets`) — show recommended vs. actual budget per category with progress bars
- [ ] **Add budget limit override form** — let users manually set/adjust limits per category
- [ ] **Budget alert notifications** — warn users when spending in a category approaches the limit (80%, 100%)

### 7. Spending Trends Visualization (API exists, frontend doesn't use it)
The `/analytics/trends` endpoint and `TrendAnalyzer` processor exist, but no chart in the frontend.

- [ ] **Add monthly spending trend line chart** to Dashboard (using Recharts `LineChart`/`AreaChart`)
- [ ] **Add FHS history line chart** — show score progression over months (API: `/analytics/fhs/history`)
- [ ] **Add month-over-month comparison** — highlight months where spending increased vs. decreased

### 8. User Profile & Settings
No way for users to view/edit their profile or configure preferences.

- [ ] **Create Settings page** — display name, email, change password
- [ ] **Notification preferences** — toggle email/push/WebSocket alerts per category
- [ ] **Data export** — download transactions as CSV

---

## 🟢 P2 — Polish & Production Readiness

### 9. Testing the Pipeline
- [ ] **Integration test**: Register → Upload CSV → verify categorization runs → verify FHS updates → verify anomaly detection fires
- [ ] **Integration test**: Auth flow (register → login → refresh → protected route → 401 on expired token)
- [ ] **Frontend component tests** with React Testing Library
- [ ] **Run Locust load test** and document results (p50/p95 latencies, throughput)

### 10. Security Hardening
- [ ] Configure proper CORS origins (replace `*` with actual frontend domain)
- [ ] JWT refresh token rotation (one-time-use)
- [ ] Brute-force login protection (rate limit + account lockout)
- [ ] Encrypt PII fields in database (email, merchant names)

### 11. Frontend UX Polish
- [ ] Responsive mobile layout (sidebar → bottom nav on mobile)
- [ ] Loading skeletons instead of spinner (content layout shift prevention)
- [ ] Error boundaries with retry buttons
- [ ] Active sidebar link highlighting based on current route (currently hardcoded `.active` on Dashboard)
- [ ] Dark/light mode toggle

### 12. Backend Improvements
- [ ] Kafka publisher (replace REST webhooks for scalability)
- [ ] OpenTelemetry distributed tracing across services
- [ ] Prometheus `/metrics` endpoints
- [ ] Circuit breaker for inter-service HTTP calls
- [ ] Database migrations with Alembic (currently raw SQL init)

---

## Done ✅
- [x] Docker Compose + infrastructure (PostgreSQL, Redis, ClickHouse)
- [x] Auth Service (JWT RS256, registration, login, refresh, token validation)
- [x] Ingestion Service (Adapter pattern: CSV, ICICI, Manual adapters + Observer pattern)
- [x] Analytics Engine (Strategy + Factory + Facade patterns, categorization, FHS, trends)
- [x] Anomaly Detection Service (Welford Z-score, Redis state, alert creation)
- [x] Recommendation Service (Strategy: 50/30/20 + Statistical percentile)
- [x] Notification Service (WebSocket connection manager)
- [x] nginx Gateway (TLS, JWT auth_request, rate limiting, upstream routing)
- [x] React Frontend (Dashboard, Transactions, Recommendations, Login pages)
- [x] Unit tests (categorizer, anomaly detector, adapters)
- [x] Locust load test script
- [x] README.md + TODO.md documentation

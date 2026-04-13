# Phoenix Platform — Engineering & Architecture Improvements

> **Scope**: Non-user-facing improvements. These won't change what a user sees, but they make the codebase more robust, maintainable, scalable, and production-ready. Skip any of these and the platform still works — do them and it works *better*.

---

## 🏗️ Code Quality & Architecture

### Design Pattern Completeness
- [ ] **Add `__init__.py` to service root packages** — `services/anomaly/`, `services/recommendation/`, `services/notification/`, etc. are missing root `__init__.py` (only sub-packages have them)
- [ ] **Standardize import style** — currently mixed between relative (`from .module`) and absolute (`from module`) imports across services; pick one convention and enforce it
- [ ] **Extract shared DB session boilerplate** — every service duplicates `engine = create_async_engine(...)` + `async_session = ...` + `get_db()` generator; extract into a shared `phoenix_common` package
- [ ] **Add Pydantic response models to all endpoints** — Anomaly, Notification, and Recommendation services return raw dicts instead of typed Pydantic `response_model` schemas
- [ ] **Type hints coverage** — several functions use `dict` returns instead of typed dataclasses/Pydantic models (e.g., `anomaly_router.list_alerts`, `recommendation_router.get_budget_recommendations`)

### Error Handling & Resilience
- [ ] **Add structured error responses** — services return inconsistent error shapes; standardize on `{"error": {"code": str, "message": str, "detail": ...}}` across all services
- [ ] **Add retry logic for inter-service HTTP calls** — `httpx` calls in `rest_webhook_publisher.py` and `anomaly/internal_router.py` have no retry on transient failures (503, timeout)
- [ ] **Add circuit breaker** for inter-service calls — prevent cascade failures when Analytics or Notification is down
- [ ] **Handle ClickHouse write failures gracefully** — `clickhouse_writer.py` fires-and-forgets; add a dead-letter queue or retry buffer
- [ ] **Add request timeout configuration** — hardcoded `timeout=5.0` in various httpx clients; make configurable via env vars

### Logging & Observability
- [ ] **Structured JSON logging** — replace `logging.basicConfig()` with structured JSON log format for log aggregation (ELK/Loki)
- [ ] **Add request ID correlation** — generate a `X-Request-ID` header at the gateway and propagate it through all inter-service calls for tracing
- [ ] **OpenTelemetry instrumentation** — add distributed tracing spans across service boundaries
- [ ] **Add Prometheus `/metrics` endpoint** to each service — expose request count, latency histograms, error rates, FHS computation time, categorization latency
- [ ] **Health check depth** — current `/health/ready` just returns `{"status": "ok"}`; add DB connectivity and Redis ping checks to make health checks meaningful

---

## 🗄️ Database & Data Layer

### Schema & Migrations
- [ ] **Add Alembic migration tooling** — currently using raw `init.sql`; Alembic enables version-controlled schema changes and rollbacks
- [ ] **Add database indexes for common queries** — the Transactions table is queried by `user_id + ts` frequently but only has individual column indexes
- [ ] **Add composite index** on `transaction_categories(transaction_id, category_id)` for faster joins
- [ ] **Add `created_at` default** to `anomaly_alerts` — verify that the `DEFAULT NOW()` trigger works for auto-timestamping

### Data Integrity
- [ ] **Add foreign key constraints** between `anomaly_alerts.transaction_id` → `transactions.id` (currently unchecked)
- [ ] **Add CHECK constraints** — e.g., `amount > 0`, `z_score IS NOT NULL`, `confidence BETWEEN 0 AND 1`
- [ ] **Validate seed data UUIDs** — some seed UUIDs were malformed and user had to fix them manually (e.g., `6ga0` → `6aa0`, `5fg9` → `5ff9`); add a validation step or use `gen_random_uuid()`
- [ ] **Add `ON DELETE CASCADE`** for dependent tables — if a user is deleted, their transactions, alerts, and FHS scores should cascade

### ClickHouse Sync
- [ ] **Add periodic ClickHouse sync job** — currently relies on real-time writes from analytics service; add a cron/batch job to backfill missed writes
- [ ] **Verify ClickHouse `ReplacingMergeTree` deduplication** — ensure the version column properly deduplicates on re-inserts

---

## 🔒 Security Enhancements

- [ ] **JWT refresh token rotation** — current refresh tokens are reusable; implement one-time-use rotation where each refresh issues a new refresh token and invalidates the old one
- [ ] **Rate limit login endpoint** — separate rate limit zone for `/api/v1/auth/login` (stricter than general API: e.g., 10 req/min per IP)
- [ ] **Add CSRF protection** for cookie-based auth (if/when switching from Authorization header to HTTP-only cookies)
- [ ] **Encrypt PII at rest** — email addresses and merchant names in PostgreSQL should use pgcrypto column-level encryption
- [ ] **Audit log completeness** — verify that all write operations (transaction insert, alert creation, budget override) are captured in `audit_log`
- [ ] **Input sanitization** — add server-side validation for all user inputs (merchant names, descriptions) to prevent XSS in stored data
- [ ] **Secrets management** — move from `.env` files to a proper secrets manager (HashiCorp Vault / Docker Secrets) for production

---

## 🚀 Performance & Scalability

- [ ] **Replace OFFSET pagination with cursor-based pagination** — OFFSET is O(n) on large tables; keyset pagination using `id > last_seen_id` is O(1)
- [ ] **Add Redis caching for Dashboard overview** — the Facade endpoint hits PostgreSQL on every request; cache the aggregated result for 30s
- [ ] **Batch ClickHouse writes** — current async writer sends individual INSERT per transaction; batch them (e.g., every 100 rows or 5 seconds)
- [ ] **Add connection pool metrics** — monitor SQLAlchemy pool size, overflow, and checked-out connections
- [ ] **API response compression** — enable gzip/brotli in nginx for JSON responses
- [ ] **Frontend bundle optimization** — code-split pages with React.lazy(), tree-shake unused Recharts components
- [ ] **Add CDN for static assets** — frontend JS/CSS should be served from a CDN, not through nginx

---

## 🧪 Testing Improvements

- [ ] **Increase unit test coverage to ≥80%** — currently only categorizer, anomaly detector, and adapters are tested
- [ ] **Add unit tests for FHS processor edge cases** — negative savings rate, zero income, 100% debt
- [ ] **Add unit tests for recommendation strategies** — both 50/30/20 and statistical with various history lengths
- [ ] **Add mock-based tests for LLM categorizer** — test OpenAI API integration without real API calls
- [ ] **Add WebSocket connection tests** — test connect/disconnect/reconnect scenarios
- [ ] **Add database fixture factory** — use `factory_boy` or similar for generating test data instead of hardcoded seed SQL
- [ ] **Add contract tests** — verify inter-service API contracts don't break when services are updated independently

---

## 🐳 DevOps & Infrastructure

- [ ] **GitHub Actions CI pipeline** — lint (ruff/flake8), test (pytest), build (Docker), push (registry) on every PR
- [ ] **Multi-stage Docker builds** — backend Dockerfiles currently copy all source; add `.dockerignore` and use multi-stage builds for smaller images
- [ ] **Add `.dockerignore` files** — prevent `__pycache__`, `.git`, `tests/`, `*.md` from being copied into containers
- [ ] **Docker Compose profiles** — add profiles for `dev` (with seed data + hot reload) vs. `prod` (no seed, optimized builds)
- [ ] **Add `docker-compose.override.yml`** for local development with volume mounts for hot-reload
- [ ] **Add container resource limits** — set `mem_limit` and `cpus` for each service to prevent one service from starving others
- [ ] **Kubernetes manifests** — Helm charts for production deployment with HPA, PDB, and resource quotas
- [ ] **Log aggregation** — add Grafana Loki or ELK stack to docker-compose for centralized log viewing
- [ ] **Add Grafana dashboard** — pre-configured dashboards for service health, request latency, and error rates

---

## 📝 Documentation & Developer Experience

- [ ] **Add API documentation** — generate OpenAPI/Swagger docs for each service (FastAPI auto-generates at `/docs`, but they're not linked from README)
- [ ] **Add architecture decision records (ADRs)** — document why each design pattern was chosen (Adapter vs. plugin, Welford vs. batch Z-score, etc.)
- [ ] **Add `CONTRIBUTING.md`** — how to set up local dev, run tests, add a new adapter/strategy
- [ ] **Add service dependency diagram** — Mermaid diagram showing which services call which endpoints
- [ ] **Add `.env.example` validation script** — verify all required env vars are set before `docker compose up`
- [ ] **Document the Observer webhook contract** — which events trigger which endpoints, expected payload schemas

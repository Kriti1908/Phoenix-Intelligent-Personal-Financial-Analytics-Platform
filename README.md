# 🔥 Phoenix — Intelligent Personal Financial Analytics Platform

A microservices-based personal finance analytics platform that transforms raw transaction data into actionable financial insights through intelligent categorization, anomaly detection, and personalized recommendations.

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐
│  React   │────▶│  nginx GW    │────▶│  Auth Service  │
│ Frontend │     │ (TLS + JWT)  │     │  (RS256 JWT)   │
└──────────┘     └──────┬───────┘     └────────────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
    ┌─────────────┐ ┌──────────┐ ┌───────────────┐
    │ Ingestion   │ │Analytics │ │ Anomaly       │
    │ (Adapter)   │─│(Strategy)│─│ (Welford Z)   │
    └─────────────┘ └──────────┘ └───────────────┘
           │            │                │
    ┌──────┴──────┐     │         ┌──────┴──────┐
    │Recommendation│    │         │Notification │
    │ (Strategy)  │     │         │ (WebSocket) │
    └─────────────┘     │         └─────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │PostgreSQL│  │  Redis   │  │  ClickHouse  │
    │  (OLTP)  │  │ (Cache)  │  │ (Analytics)  │
    └──────────┘  └──────────┘  └──────────────┘
```

## Design Patterns

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Adapter** | `services/ingestion/adapters/` | Normalize diverse bank/CSV/manual data into `UnifiedTransaction` |
| **Observer** | `services/ingestion/publishers/` | Notify Analytics/Anomaly services after ingestion |
| **Strategy** | `services/analytics/categorization/` | Switch between rule-based and LLM categorization |
| **Strategy** | `services/recommendation/strategies/` | Switch between 50/30/20 and statistical budget recommendations |
| **Factory Method** | `services/analytics/factory.py` | Create analytics processors without knowing concrete types |
| **Facade** | `services/analytics/service.py` | Unified dashboard overview aggregating multiple data sources |

## Services

| Service | Port | Description |
|---------|------|-------------|
| Auth | 8001 | JWT RS256 token issuance, user registration/login, RBAC |
| Ingestion | 8002 | CSV upload, manual entry, bank API ingestion with deduplication |
| Analytics | 8003 | Transaction categorization, FHS computation, spending trends |
| Anomaly | 8004 | Z-score anomaly detection with Welford's online algorithm |
| Recommendation | 8005 | Personalized budget recommendations (50/30/20 + statistical) |
| Notification | 8006 | Real-time WebSocket alerts |
| Gateway | 443 | nginx reverse proxy with TLS, JWT validation, rate limiting |
| Frontend | 3000 | React SPA with dashboard, transactions, and recommendations |

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy (async), Pydantic
- **Frontend**: React 18, TypeScript, Vite, Recharts, Zustand, React Query
- **Databases**: PostgreSQL 15 (OLTP), ClickHouse (analytics), Redis (cache/Welford state)
- **Infrastructure**: Docker, nginx, Locust (load testing)
- **Security**: JWT RS256, bcrypt password hashing, Row-Level Security (RLS)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend development)

### Setup
```bash
# 1. Clone and configure
cd infra
cp .env.example .env

# 2. Generate RSA keys for JWT
# Generate the private key
openssl genrsa -out jwt_private.pem 2048

# Generate the public key
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Base64 encode the Private Key (copy the output and paste into .env as JWT_PRIVATE_KEY="<output>")
cat jwt_private.pem | base64 | tr -d '\n'
echo "" # Adds a newline for readability

# Base64 encode the Public Key (copy the output and paste into .env as JWT_PUBLIC_KEY="<output>")
cat jwt_public.pem | base64 | tr -d '\n'
echo "" # Adds a newline for readability

# Clean up the temporary key files (optional)
rm jwt_private.pem jwt_public.pem

# 3. Start all services
sudo docker compose up --build -d

# 4. Access the platform
# Frontend: https://localhost
# API docs: https://localhost/api/v1/auth/docs

# 5. Stop docker containers safely
sudo docker compose down
```

### Development

```bash
# Frontend development
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000

# Run unit tests
cd ..
python -m pytest tests/unit/ -v

# Run load tests
locust -f tests/load/locustfile.py --host=https://localhost
```

## Transaction Categorization

Three-tier rule-based categorization with optional LLM upgrade:

1. **MCC Code** (confidence: 0.95) — ~250 ISO 18245 codes mapped
2. **Merchant Name** (confidence: 0.90) — ~150 Indian merchants mapped
3. **Keyword/Regex** (confidence: 0.70) — 28 regex patterns

When `ENABLE_LLM_CATEGORIZATION=true` and rule-based confidence < 0.7, the system uses GPT-4o-mini with Redis caching (24h TTL).

## Financial Health Score (FHS)

0–100 composite metric from four equally-weighted (25 pts each) components:

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Savings Rate | 25 pts | `min(savings_rate / 0.20, 1.0)` |
| Debt-to-Income | 25 pts | `max(0, 1 - DTI / 0.36)` |
| Spending Volatility | 25 pts | `max(0, 1 - CV / 0.50)` |
| Emergency Fund | 25 pts | `min(months / 3, 1.0)` |

## Anomaly Detection

Uses **Welford's Online Algorithm** for O(1) incremental running mean and standard deviation per user per category:

- **Z-score threshold**: 2.5 (configurable via `ANOMALY_Z_THRESHOLD`)
- **Bootstrap suppression**: No alerts until ≥10 transactions per category
- **Real-time delivery**: WebSocket push to connected clients

## Project Structure

```
├── infra/                    # Infrastructure configs
│   ├── docker-compose.yml    # All services orchestration
│   ├── postgres/init.sql     # Full schema & triggers
│   ├── postgres/seed.sql     # 50 transactions dev data
│   ├── clickhouse/init.sql   # Analytical tables
│   └── .env.example          # Environment template
├── services/
│   ├── auth/                 # JWT authentication
│   ├── ingestion/            # Transaction ingestion (Adapter pattern)
│   │   ├── adapters/         # CSV, ICICI, Manual adapters
│   │   └── publishers/       # REST webhook, Kafka stub
│   ├── analytics/            # Analytics engine
│   │   ├── categorization/   # Strategy pattern (Rule + LLM)
│   │   │   └── rules/        # MCC codes, merchants, keywords
│   │   └── processors/       # FHS, category aggregator, trends
│   ├── anomaly/              # Z-score anomaly detection
│   ├── recommendation/       # Budget recommendations
│   │   └── strategies/       # 50/30/20 + statistical
│   ├── notification/         # WebSocket alerts
│   └── gateway/              # nginx reverse proxy
├── frontend/                 # React SPA
│   └── src/
│       ├── api/              # API hooks (React Query)
│       ├── pages/            # Dashboard, Transactions, etc.
│       └── store/            # Zustand auth state
└── tests/
    ├── unit/                 # pytest unit tests
    └── load/                 # Locust load tests
```

## Security

- **JWT RS256**: Asymmetric key signing (private key for Auth Service only, public key for all services)
- **bcrypt**: Password hashing with 12 rounds
- **Row-Level Security**: PostgreSQL RLS policies ensure users can only access their own data
- **Audit Log**: Immutable `audit_log` table with SHA-256 payload hashes
- **TLS**: nginx handles HTTPS termination
- **Rate Limiting**: 100 req/min per IP with burst allowance

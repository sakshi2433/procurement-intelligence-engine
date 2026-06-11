# Procurement Intelligence Engine

A production-grade procurement analytics platform with RAG-powered natural language querying, statistical anomaly detection, and an Odoo ERP connector.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│        (Spend Analytics + NL Query + Alert Feed)        │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                   FastAPI Backend                        │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  RAG Engine │ │   Anomaly    │ │  Spend Analytics │  │
│  │ LangChain + │ │  Detection   │ │   (Z-score,IQR,  │  │
│  │    FAISS    │ │  (Z-score,   │ │   Concentration) │  │
│  │  LLM(conf) │ │   IQR, dup)  │ │                  │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Data Layer (PostgreSQL)                     │
│  ┌─────────────────────┐  ┌───────────────────────────┐  │
│  │  Synthetic Data Gen │  │   Odoo XML-RPC Connector  │  │
│  │ (vendors, POs, inv) │  │  (optional, configurable) │  │
│  └─────────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Docker + Docker Compose
- An LLM API key (OpenAI, Groq, or Anthropic — configurable)

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env with your LLM API key
```

### 2. Launch everything
```bash
docker-compose up --build
```

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs
- **API**: http://localhost:8000

### 3. Seed synthetic data
```bash
docker-compose exec backend python -m data.synthetic.seed
```

## LLM Configuration

Edit `.env` to switch providers:

```env
# OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...

# Groq (fast + free tier)
LLM_PROVIDER=groq
LLM_MODEL=llama3-70b-8192
GROQ_API_KEY=gsk_...

# Anthropic
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (local)
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Odoo Connector (Optional)

```env
USE_ODOO=true
ODOO_URL=https://your-instance.odoo.com
ODOO_DB=your_db
ODOO_USERNAME=admin@company.com
ODOO_PASSWORD=your_password
```

Then run:
```bash
docker-compose exec backend python -m data.odoo.sync
```

## Project Structure

```
procurement-engine/
├── backend/
│   ├── api/          # FastAPI route handlers
│   ├── rag/          # RAG pipeline (FAISS + LangChain)
│   ├── anomaly/      # Statistical anomaly detection
│   ├── models/       # SQLAlchemy ORM models
│   └── db/           # Database connection + migrations
├── data/
│   ├── synthetic/    # Faker-based data generator
│   └── odoo/         # XML-RPC Odoo connector
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       └── hooks/
└── docker-compose.yml
```

## Key Features

| Feature | Implementation |
|---------|----------------|
| NL Query over procurement data | LangChain + FAISS + configurable LLM |
| Vendor invoice anomaly detection | Z-score (μ ± 2σ per vendor) |
| Duplicate invoice detection | Amount + date + vendor within 7 days |
| Contract expiry alerts | Daily cron scan, <30 day warnings |
| Spend concentration risk | Herfindahl index on vendor spend |
| Odoo ERP integration | XML-RPC with auto-sync |

## Interview Talking Points

- **Why FAISS over pgvector?** FAISS is faster for pure ANN search; pgvector wins when you need SQL joins on metadata. This project uses FAISS for query speed, PostgreSQL for structured analytics.
- **Why Z-score AND IQR?** Z-score assumes normal distribution; IQR is robust to skew. Invoices are often skewed (few huge invoices), so IQR catches what Z-score misses.
- **Scaling to 50,000 POs**: Batch embed on ingest, partition FAISS index by vendor category, add Redis caching for frequent queries, async Celery for anomaly scans.

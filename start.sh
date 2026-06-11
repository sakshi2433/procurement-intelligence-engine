#!/usr/bin/env bash
set -e

echo "═══════════════════════════════════════════"
echo "  Procurement Intelligence Engine — Setup  "
echo "═══════════════════════════════════════════"

# 1. Copy env if needed
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo ""
  echo "  ➜ Edit .env and set your LLM_PROVIDER + API key, then re-run this script."
  echo ""
  exit 0
fi

# 2. Build + start services
echo "Building and starting services..."
docker-compose up --build -d

# 3. Wait for backend
echo "Waiting for backend to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Backend is up"
    break
  fi
  sleep 3
done

# 4. Seed data
echo "Seeding synthetic procurement data..."
docker-compose exec backend python -m data.synthetic.seed

# 5. Build FAISS index
echo "Building vector index..."
curl -sf -X POST http://localhost:8000/api/rag/rebuild-index > /dev/null

# 6. Run initial anomaly scan
echo "Running initial anomaly scan..."
curl -sf -X POST http://localhost:8000/api/anomalies/scan > /dev/null

echo ""
echo "═══════════════════════════════════════════"
echo "  Ready!"
echo "  Frontend:  http://localhost:3000"
echo "  API docs:  http://localhost:8000/docs"
echo "═══════════════════════════════════════════"

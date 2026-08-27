#!/bin/sh
set -e

# processed/ is a Docker volume (see docker-compose.yml) — persists across
# container restarts on the VPS, unlike an ephemeral-disk PaaS. Only the
# very first boot pays the ingest+embed+graph cost (~1-2 min, per README).
if [ ! -f processed/entities.parquet ]; then
    echo "[entrypoint] processed/ not found — building it from data/raw (first boot only)..."
    python -m saberlink.ingest
    python -m saberlink.domain_vocab
    python -m saberlink.vector_store
    python -m saberlink.graph_build
else
    echo "[entrypoint] processed/ already present — skipping ingest."
fi

exec uvicorn api.main:app --host 0.0.0.0 --port 8000

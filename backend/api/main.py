"""Thin FastAPI layer over saberlink.pipeline.run_query.

Strictly additive, same isolation principle as saberlink/plus/: this module
imports from saberlink.* but nothing in saberlink/ (núcleo or plus) imports
from here — deleting backend/api/ never breaks the pipeline, notebooks,
Streamlit or the pyvis exports. Every response is built straight from
pipeline.run_query()'s own dict, or from saberlink.graph_query's own
build_discovery_graph_data — there is no separate "API version" of the
business logic, only serialization.

Run with (from backend/):
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from saberlink import config, entity_lookup as entity_lookup_mod, graph_build, graph_query, pipeline, schema, viz

app = FastAPI(title="SaberLink API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    entity_id: str | None = None
    raw_text_profile: dict | None = None
    top_k: int = config.DEFAULT_TOP_K


# Cached the same way saberlink.pipeline caches its own module-level state:
# these are read-only indexes over fixed processed/ artifacts, rebuilt only
# if the process restarts (call the /admin/reload-equivalent — here, just
# restart uvicorn — after re-running ingest/graph_build).
@lru_cache(maxsize=1)
def _entities_df() -> pd.DataFrame:
    return pd.read_parquet(config.ENTITIES_PARQUET)


@lru_cache(maxsize=1)
def _entity_lookup() -> dict[str, dict]:
    return entity_lookup_mod.build(_entities_df())


@lru_cache(maxsize=1)
def _graph():
    return graph_build.load_graph()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/query")
def query(body: QueryRequest) -> dict:
    if not body.entity_id and not body.raw_text_profile:
        raise HTTPException(status_code=400, detail="entity_id o raw_text_profile es requerido")
    try:
        return pipeline.run_query(
            entity_id=body.entity_id,
            raw_text_profile=body.raw_text_profile,
            top_k=body.top_k,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/graph")
def graph(
    entity_id: str = Query(..., description="ID de entidad existente, ej. NEED-001"),
    top_k: int = Query(config.DEFAULT_TOP_K, ge=1, le=50),
) -> dict:
    """Same discovery-subgraph data saberlink.plus.pyvis_export renders to
    HTML, returned as JSON nodes/edges for the frontend's Cytoscape view.
    Only accepts an existing entity_id (not raw_text_profile) — a temporary
    NEED's TEMP-xxxxxxxx id can't be looked up a second time, same
    constraint pyvis_export.export_discovery_graph documents."""
    try:
        out = pipeline.run_query(entity_id=entity_id, top_k=top_k)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    g = _graph()
    pre = graph_query.precompute_source(g, out["source"]["id"])
    return graph_query.build_discovery_graph_data(out["source"]["id"], out["results"], g, pre, _entity_lookup())


@app.get("/entities")
def list_entities(
    type: str | None = Query(None, description="Filtro por tipo, ej. NEED, PRJ"),
    q: str | None = Query(None, description="Búsqueda por substring en ID o nombre"),
    limit: int = Query(20, ge=1, le=100),
) -> list[dict]:
    """Backs the frontend's search/autocomplete — replaces Streamlit's plain
    st.text_input with a guided picker."""
    df = _entities_df()
    if type:
        df = df[df["entity_type"] == type]

    q_lower = q.strip().lower() if q else None
    results: list[dict] = []
    for rec in df.to_dict("records"):
        entity_id = rec["entity_id"]
        entity_type = rec["entity_type"]
        spec = schema.ENTITY_SPECS.get(entity_type)
        name_field = spec.name_field if spec else None
        raw_name = rec.get(name_field) if name_field else None
        name = str(raw_name) if pd.notna(raw_name) else entity_id

        if q_lower and q_lower not in entity_id.lower() and q_lower not in name.lower():
            continue

        results.append(
            {
                "id": entity_id,
                "type": entity_type,
                "type_label": viz.ENTITY_TYPE_LABELS.get(entity_type, entity_type),
                "name": name,
            }
        )
        if len(results) >= limit:
            break
    return results


@app.get("/meta/legend")
def legend() -> dict:
    """Entity-type and score-band palette — single source of truth shared
    with saberlink.viz, so the frontend never hardcodes its own colors."""
    return {
        "entity_types": [
            {"type": t, "label": label, "color": viz.ENTITY_TYPE_COLORS.get(t, viz.DEFAULT_COLOR)}
            for t, label in viz.ENTITY_TYPE_LABELS.items()
        ],
        "score_bands": [{"band": band, "color": color} for band, color in viz.SCORE_BAND_COLORS.items()],
    }

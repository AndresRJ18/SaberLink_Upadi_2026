"""[PLUS] Generative phrasing for thesis-topic opportunities, via AWS
Bedrock (Nova 2 Lite).

Strictly cosmetic and strictly additive: the model NEVER discovers a
connection, computes a score, or decides which entities are related — all
of that already happened in saberlink/opportunities.py + scoring.py before
this module is ever called. Bedrock only rephrases evidence the rule-based
pipeline already retrieved and verified into a natural-sounding thesis-topic
title. If Bedrock is unavailable, misconfigured, throttled, or fails for any
reason, callers get back the existing template text with
generated_by_ai=False instead — a live demo should never break because an
external model call failed (see DOCUMENTO_TECNICO §"¿Qué ocurre si una API
externa falla?").

No non-plus module imports from here.
"""

from __future__ import annotations

import os
import threading

_client = None
_client_lock = threading.Lock()

SOURCE_FIELDS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "NEED": ("title", "description", "context", "expected_impact"),
    "PRJ": ("title", "problem_statement", "abstract"),
    "THS": ("title", "abstract", "problem_statement"),
}
DEFAULT_SOURCE_FIELDS = ("title", "description")
THESIS_FIELDS = ("title", "abstract", "problem_statement", "methodology")

PROMPT_TEMPLATE = (
    "Sos un asistente académico. A partir ÚNICAMENTE de la información "
    "institucional provista abajo, proponé UN título breve (máximo 20 "
    "palabras) para un posible trabajo de grado. No inventes datos, "
    "nombres, cifras ni instituciones que no estén en el texto dado. No "
    "agregues explicación, comillas ni markdown — devolvé solo el título, "
    "en español.\n\n"
    "--- Necesidad/fuente ({source_id}) ---\n{source_text}\n\n"
    "--- Antecedente relacionado ({thesis_id}) ---\n{thesis_text}\n"
)


def _get_client():
    # Double-checked locking — same reasoning as vector_store.get_client():
    # this is called from a FastAPI sync route (thread pool), so two
    # requests could race into first-time client creation concurrently.
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                import boto3

                _client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _client


def _entity_text(entity_lookup: dict, entity_id: str, fields: tuple[str, ...]) -> str:
    row = entity_lookup.get(entity_id) or {}
    parts = []
    for field in fields:
        value = row.get(field)
        if value:
            parts.append(f"{field}: {str(value)[:400]}")
    return "\n".join(parts)


def generate_thesis_topic(source_id: str, opportunity: dict, entity_lookup: dict) -> dict:
    """Only handles THESIS_OPPORTUNITY — every other type falls back
    immediately, unchanged, so this is safe to call speculatively."""
    fallback = {"title": opportunity.get("opportunity", ""), "generated_by_ai": False, "model": None}

    if opportunity.get("type") != "THESIS_OPPORTUNITY" or not opportunity.get("evidence"):
        return fallback

    thesis_id = opportunity["evidence"][0]["id"]
    source_type = (entity_lookup.get(source_id) or {}).get("entity_type")
    source_fields = SOURCE_FIELDS_BY_TYPE.get(source_type, DEFAULT_SOURCE_FIELDS)

    source_text = _entity_text(entity_lookup, source_id, source_fields)
    thesis_text = _entity_text(entity_lookup, thesis_id, THESIS_FIELDS)
    if not source_text or not thesis_text:
        return fallback

    prompt = PROMPT_TEMPLATE.format(
        source_id=source_id, source_text=source_text, thesis_id=thesis_id, thesis_text=thesis_text
    )
    model_id = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-2-lite-v1:0")

    try:
        client = _get_client()
        response = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 60, "temperature": 0.4},
        )
        title = response["output"]["message"]["content"][0]["text"].strip().strip('"')
        if not title:
            return fallback
        return {"title": title, "generated_by_ai": True, "model": model_id}
    except Exception:
        # Broad on purpose: network errors, throttling, missing/expired
        # credentials, malformed responses — none of these should ever
        # surface as a broken demo. The template fallback is always correct,
        # just less natural-sounding.
        return fallback

"""[PLUS] Generative phrasing for any opportunity type, via AWS Bedrock
(Nova 2 Lite).

Strictly cosmetic and strictly additive: the model NEVER discovers a
connection, computes a score, or decides which entities are related — all
of that already happened in saberlink/opportunities.py + scoring.py before
this module is ever called. Bedrock only rephrases evidence the rule-based
pipeline already retrieved and verified — the entities named in the
opportunity's own `related_entities`, read via schema.ENTITY_SPECS so this
works for any of the 15 entity types without a type-by-type special case —
into a natural-sounding sentence or two. If Bedrock is unavailable,
misconfigured, throttled, or fails for any reason, callers get back the
existing template text with generated_by_ai=False — a live demo should
never break because an external model call failed (see DOCUMENTO_TECNICO
§"¿Qué ocurre si una API externa falla?").

No non-plus module imports from here.
"""

from __future__ import annotations

import os
import threading

from saberlink import schema

_client = None
_client_lock = threading.Lock()

PROMPT_TEMPLATE = (
    "Eres un asistente académico. A partir ÚNICAMENTE de la información "
    "institucional provista abajo, redacta en 1 o 2 frases (máximo 35 "
    "palabras) una versión natural y atractiva de esta oportunidad de tipo "
    '"{opp_type}". La razón técnica ya calculada es: "{reason}". No '
    "inventes datos, nombres, cifras ni instituciones que no estén en el "
    "texto dado. Escribe en tercera persona o con la forma \"tú\", nunca "
    "con \"vos\" ni voseo. No agregues explicación adicional, comillas ni "
    "markdown — devuelve solo el texto final, en español neutro "
    "latinoamericano.\n\n"
    "--- Entidades involucradas ---\n{context}\n"
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


def _entity_text(entity_lookup: dict, entity_id: str) -> str:
    row = entity_lookup.get(entity_id)
    if not row:
        return ""
    entity_type = row.get("entity_type")
    spec = schema.ENTITY_SPECS.get(entity_type)
    fields = spec.text_fields if spec else ()
    parts = [f"{entity_id} ({entity_type or '?'})"]
    for field in fields:
        value = row.get(field)
        if value:
            parts.append(f"  {field}: {str(value)[:400]}")
    return "\n".join(parts)


def generate_opportunity_phrasing(opportunity: dict, entity_lookup: dict) -> dict:
    """Works for any opportunity dict shape produced by
    saberlink.opportunities.generate() — RESEARCH_CONTINUITY,
    COLLABORATION, CURRICULAR_INTEGRATION, CAPABILITY_ACTIVATION,
    NEW_RESEARCH, KNOWLEDGE_TRANSFER, THESIS_OPPORTUNITY — since it only
    ever reads `type`, `reason` and whichever ids are in
    `related_entities`, never a type-specific field."""
    fallback = {"title": opportunity.get("opportunity", ""), "generated_by_ai": False, "model": None}

    related_entities = [e for e in (opportunity.get("related_entities") or []) if e]
    if not related_entities:
        return fallback

    blocks = [b for b in (_entity_text(entity_lookup, eid) for eid in related_entities) if b]
    if not blocks:
        return fallback

    prompt = PROMPT_TEMPLATE.format(
        opp_type=opportunity.get("type", ""),
        reason=opportunity.get("reason", ""),
        context="\n\n".join(blocks),
    )
    model_id = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-2-lite-v1:0")

    try:
        client = _get_client()
        response = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 80, "temperature": 0.4},
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

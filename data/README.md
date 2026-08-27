# Dataset — Knowledge Nexus LATAM Data V1.0

Este repo **no** incluye el dataset oficial (`data/raw/`) por defecto — queda
gitignorado. Es sintético y de bajo peso (~1.7 MB), pero al ser material
entregado por la organización del hackathon, no se redistribuye en un repo
público a menos que las bases del evento lo permitan explícitamente.

## Cómo colocarlo

Copiá las tres carpetas oficiales dentro de `data/raw/`, de forma que quede:

```
data/raw/
├── 01_institution/
├── 02_people_curriculum/
└── 03_knowledge_needs/
```

`backend/saberlink/config.py::DATA_ROOT` apunta exactamente a `data/raw/`. Una
vez colocado, regenerá `backend/processed/` (también gitignorado, 100%
derivable) desde `backend/`:

```powershell
python -m saberlink.ingest
python -m saberlink.domain_vocab
python -m saberlink.vector_store   # descarga el modelo de embeddings, 1-2 min
python -m saberlink.graph_build
```

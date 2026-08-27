# SaberLink — Knowledge Nexus LATAM

Dado el ID de una necesidad institucional (o cualquier entidad de Data V1.0),
SaberLink descubre conexiones relevantes entre las 3 capas del dataset, las
prioriza con un score explicado, las sustenta con evidencia trazable a
archivo/registro/campo, y genera una oportunidad accionable — en vivo, sobre
consultas nuevas, no precargadas.

Arquitectura completa y decisiones de diseño: [`docs/architecture.md`](docs/architecture.md).

## Estructura del repositorio

```
saberlink/
├── docs/            arquitectura, capturas
├── backend/         núcleo Python (saberlink/) + API FastAPI (api/) + notebooks + tests
├── frontend/        interfaz web (React + Vite + Cytoscape.js)
└── data/            dataset oficial (gitignorado — ver data/README.md)
```

## Stack

| Etapa | Herramienta |
|---|---|
| Ingesta + normalización | pandas |
| Embeddings | sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) |
| Guardado de vectores | ChromaDB (persistente local, 1 colección) |
| Grafo de relaciones explícitas | networkx |
| Descubrimiento + scoring | Python propio, sin librería externa |
| Generador de oportunidades | reglas en Python (if/else), sin IA generativa |
| API | FastAPI + uvicorn |
| Frontend | React + Vite + Tailwind + Cytoscape.js |
| Interfaz alternativa [PLUS] | Streamlit + pyvis, Jupyter Notebook |
| PDF de usuario [PLUS] | Docling |
| IA generativa [PLUS], opcional | AWS Bedrock — Amazon Nova 2 Lite |

El descubrimiento, scoring y generación de oportunidades no usan ningún LLM
— la explicación y la oportunidad son 100% templates de string sobre el
breakdown ya calculado. Un modelo generativo (AWS Bedrock, opcional, ver
sección [PLUS]) solo puede redactar de nuevo una oportunidad ya calculada,
bajo pedido explícito del usuario.

## Instalación

```powershell
cd backend
python -m venv .venv        # opcional, recomendado
pip install -r requirements.txt
```

Requiere Python 3.11+. La primera vez que se use el modelo de embeddings,
`sentence-transformers` lo descarga de Hugging Face (~470 MB) — no requiere
`HF_TOKEN` para uso anónimo (con límite de tasa más bajo).

Colocá el dataset oficial en `data/raw/` — ver [`data/README.md`](data/README.md).

Para el botón opcional "Generar con IA" (AWS Bedrock), copiá
`backend/.env.example` a `backend/.env` y completá tu API key — sin esto,
ese botón simplemente cae al texto de plantilla, el resto de la solución
funciona igual.

## Cómo reproducir la demo, de cero

```powershell
cd backend

# 1. Construir todo processed/ desde los datos crudos (o correr notebooks/02_ingest_and_graph.ipynb)
python -m saberlink.ingest
python -m saberlink.domain_vocab
python -m saberlink.vector_store   # tarda 1-2 min: descarga el modelo + embebe ~10.7k campos
python -m saberlink.graph_build

# 2. Probar una consulta por ID existente
python -m saberlink.demo NEED-001

# 2b. O sin ID: describir una necesidad en texto libre (se trata como
#     necesidad temporal, nunca se persiste — mismo mecanismo que el PDF
#     vía Docling, ver sección [PLUS])
python -m saberlink.demo --title "Detección temprana de plagio" --text "Necesitamos identificar similitud entre entregas de estudiantes..."
```

La primera consulta de un proceso tarda ~20s (carga el modelo de embeddings y
los índices en memoria). Las siguientes consultas del mismo proceso corren en
1-2s — para la demo en vivo, dejar el proceso corriendo desde antes de que el
evaluador dé el ID, no reiniciarlo por cada consulta.

## Interfaz web (backend + frontend)

```powershell
# Terminal 1 — API
cd backend
uvicorn api.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Permite buscar por ID, texto libre o subir un
PDF; el resultado principal es el grafo de descubrimiento (Cytoscape.js,
estilo mapa bibliométrico — círculos por tipo de entidad, tamaño por score).
Hacer click en cualquier nodo (o en el ranking compacto de la izquierda)
abre el panel de detalle con explicación, evidencia y oportunidades
generadas, con el botón opcional "Generar con IA" sobre cada oportunidad.

## Mecanismo de descubrimiento y priorización

Cuatro señales, combinadas en una fórmula compuesta transparente
(`backend/saberlink/scoring.py`):

- **Semántica** (`w1=0.35`): similitud coseno máxima sobre una tabla explícita
  de pares de campos por tipo de entidad (ej. NEED.description ↔
  PRJ.problem_statement). Usa la similitud cruda, no reescalada, para que sea
  comparable entre distintos tipos de candidato en un mismo ranking.
- **Dominio** (`w2=0.30`): coeficiente de solape entre los términos de dominio
  de la fuente y del candidato, ponderado por frecuencia inversa de documento
  (un término genérico compartido por decenas de registros pesa poco; uno
  específico compartido por pocos, pesa mucho). Necesario porque
  `institutional_needs.csv` no tiene columna de dominio propia — los términos
  se extraen léxicamente contra un vocabulario controlado construido desde
  las columnas estructuradas del resto del dataset.
- **Método** (`w3=0.20`): similitud coseno entre campos de metodología
  (`PRJ.methodology`, `THS.methodology`, `INV.methodological_expertise`). No
  aplica cuando la fuente es NEED (sin campo de metodología, por diseño) — en
  ese caso el peso se redistribuye entre las demás señales, nunca se pone en 0.
- **Estructural** (`w4=0.15`, deliberadamente bajo): distancia de camino +
  solape de vecinos en el grafo de relaciones explícitas. Peso bajo a
  propósito para no premiar "misma facultad" por sí solo.

Un campo vacío en una entidad puntual se marca `not_available` y se excluye
(con renormalización de pesos) — nunca se trata como 0, porque vacío no
significa "el atributo no existe".

## Evidencia y explicabilidad

Cada resultado expone `evidence: [...]` con `{file, id, field, snippet}`,
releído de `entities.parquet` en el momento de la consulta (nunca de una
copia guardada, para que la evidencia no pueda desactualizarse). La
`explanation` es un template de string que solo inserta valores ya presentes
en el breakdown — no puede introducir una afirmación no sustentada, y se
marca `generated_text: true` para distinguirla visualmente de la evidencia.

## Validación técnica

`backend/notebooks/05_validation.ipynb` construye un set de 3 casos etiquetados
a mano, de dominios distintos (educación, salud, finanzas), con relevancia
determinada por **keyword matching independiente del ranking del pipeline**
(no circular). Reporta Precision@5, Recall@5, cobertura de evidencia
(verificación de que cada snippet citado existe verbatim en el dato crudo) y
latencia por consulta. `backend/tests/test_pipeline_live.py` prueba de forma
automatizada que no existe una respuesta cacheada: dos llamadas con el mismo
ID re-embeben y re-computan ambas veces.

## Features [PLUS]

Estrictamente aditivas — nada en `backend/saberlink/` (fuera de
`backend/saberlink/plus/`) importa de `saberlink/plus/`, y nada del núcleo
importa de `backend/api/` tampoco (verificado por
`backend/tests/test_plus_isolation.py`). Si el tiempo aprieta, tanto
`saberlink/plus/` como `frontend/` se pueden borrar enteros sin romper el
núcleo — el flujo por notebook/CLI sigue funcionando.

**PDF subido → necesidad temporal (Docling)**

```python
from saberlink.plus.docling_intake import pdf_to_temp_need
from saberlink import pipeline

profile = pdf_to_temp_need("ruta/al/documento.pdf")
out = pipeline.run_query(raw_text_profile=profile, top_k=5)
print(out["source"])  # {"id": "TEMP-xxxxxxxx", "type": "NEED", "official": False}
```

El perfil extraído nunca se escribe en `institutional_needs.csv` ni en
`entities.parquet` — vive solo en memoria durante esa llamada.

**Subgrafo interactivo (pyvis, respaldo offline)**

```powershell
cd backend
python -m saberlink.plus.pyvis_export NEED-001
# escribe processed/subgraphs/NEED-001_discovery.html — abrir en el navegador

python -m saberlink.plus.pyvis_export NEED-001 ego
# vista alterna: vecindario crudo del grafo institucional (radio 2, sin filtrar)
```

**Redacción de oportunidades con IA (AWS Bedrock, opcional)**

```python
from saberlink.plus.opportunity_phrasing import generate_opportunity_phrasing

result = generate_opportunity_phrasing(opportunity, entity_lookup)
print(result)  # {"title": "...", "generated_by_ai": True, "model": "us.amazon.nova-2-lite-v1:0"}
```

Botón "✨ Generar con IA" en cualquier tarjeta de oportunidad del frontend.
El modelo (Amazon Nova 2 Lite vía Bedrock) **nunca decide una conexión ni un
score** — solo redacta en 1-2 frases una oportunidad que `opportunities.py`
ya calculó, a partir únicamente de los campos de texto de las entidades en
`related_entities` (vía `schema.ENTITY_SPECS`). Si Bedrock falla o no está
configurado, cae al texto de plantilla (`generated_by_ai: false`) sin
romper nada. Requiere `AWS_BEARER_TOKEN_BEDROCK` en `backend/.env` — ver
`backend/.env.example`.

**Interfaz Streamlit (respaldo si el frontend React no está disponible)**

```powershell
cd backend
streamlit run saberlink/plus/streamlit_app.py
```

Permite escribir cualquier ID, ver el ranking, la explicación/evidencia del
resultado #1, las oportunidades generadas, y opcionalmente el subgrafo
(pyvis) embebido. Si ni Streamlit ni el frontend React están disponibles,
`backend/notebooks/06_live_demo.ipynb` cubre exactamente el mismo flujo.

## Ejecutar los tests

```powershell
cd backend
python -m pytest -q
```

## Limitaciones conocidas

- Las 7 reglas del generador de oportunidades están redactadas pensando en el
  flujo principal (consulta por `NEED-*`); funcionan también con otros tipos
  de fuente (`INV-*`, `PRJ-*`, `GRP-*`) pero el texto generado puede sonar
  menos natural en esos casos.
- El vocabulario de dominio es puramente léxico (substring matching), no usa
  sinónimos ni stemming — un término con una variante morfológica distinta a
  las del vocabulario no se detecta.
- No se cubren a fondo las 42 necesidades; el pipeline procesa toda la data
  igual, pero la validación profunda se enfoca en 2-4 casos de dominios
  distintos (según la guía oficial de alcance).

## Declaración de tecnologías y componentes externos

- Modelo preentrenado (núcleo): `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  (Hugging Face, descarga anónima, sin fine-tuning).
- Modelos preentrenados (PLUS, solo si se usa `docling_intake.py`): modelos de
  layout/OCR de Docling (`docling-project/docling-layout-heron`, RapidOCR
  vía ONNX Runtime) — usados únicamente para extraer texto de un PDF subido
  por el usuario, nunca para inferir relaciones institucionales.
- **IA generativa (PLUS, opcional): AWS Bedrock, `Amazon Nova 2 Lite`**
  (`backend/saberlink/plus/opportunity_phrasing.py`), usada **exclusivamente**
  para redactar en lenguaje natural una oportunidad **ya calculada** por
  `opportunities.py` (cualquier tipo: continuidad de investigación,
  colaboración, integración curricular, tema de tesis, etc.) — nunca decide
  qué está conectado con qué, nunca calcula un score, nunca corre en el
  descubrimiento/scoring/ranking del núcleo. Recibe solo texto ya verificado
  de las entidades en `related_entities` y no se activa salvo que el usuario
  lo pida explícitamente en la interfaz. Si falla o no está configurado, cae
  automáticamente al texto de plantilla existente. En la respuesta y en la
  UI queda marcado `generated_by_ai: true` / etiqueta "generado por IA",
  distinto de `generated_text: true` (que es texto de plantilla, no
  generativo) — para que evidencia institucional y contenido generado nunca
  se confundan.
- Fuera de eso: sin APIs externas, sin servicios cloud, sin LLM en el
  descubrimiento, scoring, evidencia u oportunidades del núcleo.
- Sin datasets complementarios — todo el conocimiento viene de Data V1.0.

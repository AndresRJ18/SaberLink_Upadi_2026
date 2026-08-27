# Deploy en CubePath (o cualquier VPS con Docker)

El repo corre en dos contenedores (`docker-compose.yml`): `backend` (FastAPI,
puerto 8000) y `frontend` (build estático servido por Nginx, puerto 80). El
dataset y los artefactos derivados (`processed/`) **nunca van dentro de la
imagen ni del repo** — viven en el disco del VPS, montados como volúmenes.

## 1. En tu máquina: push a GitHub

Esto lo hacés vos con tus propios comandos de git (crear el repo, `git remote
add origin ...`, `git push`).

## 2. En el VPS: clonar y preparar Docker

```bash
ssh tu-usuario@tu-vps
git clone <url-de-tu-repo> saberlink
cd saberlink

# Si el VPS no tiene Docker todavía:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # cerrar sesión y volver a entrar después de esto
```

## 3. Subir el dataset al VPS (no va por git)

Desde tu máquina local, no desde el VPS:

```bash
scp -r data/raw tu-usuario@tu-vps:~/saberlink/data/raw
```

(o `rsync -av data/raw/ tu-usuario@tu-vps:~/saberlink/data/raw/` si preferís)

## 4. Configurar el `.env` de producción

En el VPS, dentro de `saberlink/`:

```bash
cp .env.example .env
nano .env
```

Completá con la IP o dominio real del VPS:

```
VITE_API_BASE=http://TU_IP_O_DOMINIO:8000
CORS_ORIGINS=http://TU_IP_O_DOMINIO
```

**Importante:** `VITE_API_BASE` se hornea en el bundle de JS durante el build
del frontend — si lo cambiás después, hay que reconstruir la imagen del
frontend (`docker compose build frontend`), no alcanza con reiniciar.

## 5. Levantar todo

```bash
docker compose up -d --build
```

La primera vez, el backend tarda 1-2 minutos extra en arrancar: no encuentra
`processed/` en el volumen recién creado, así que corre
`ingest → domain_vocab → vector_store → graph_build` automáticamente antes de
levantar la API (ver `backend/entrypoint.sh`). Las próximas veces que
reinicies el contenedor, ese paso se salta — `processed/` queda persistido en
el volumen de Docker.

Ver logs mientras arranca:

```bash
docker compose logs -f backend
```

## 6. Verificar

```bash
curl http://localhost:8000/health
```

Y abrir `http://TU_IP_O_DOMINIO` en el navegador.

## Actualizar después de un cambio de código

```bash
git pull
docker compose up -d --build
```

`processed/` no se toca (sigue en el volumen) salvo que borres el volumen
explícitamente (`docker compose down -v`) o cambies el dataset en
`data/raw/` — en ese caso hay que borrar el volumen para que se regenere:

```bash
docker compose down
docker volume rm saberlink_backend_processed
docker compose up -d --build
```

## Notas

- **Docling (modo PDF):** los modelos de layout/OCR se descargan la primera
  vez que alguien sube un PDF, no al construir la imagen. La primera subida
  va a tardar más que las siguientes.
- **Nada de esto toca las revisiones en vivo del hackathon** — seguís
  pudiendo correr todo local con `uvicorn` + `npm run dev` como hasta ahora
  (ver el README principal). Esto es un link público adicional.

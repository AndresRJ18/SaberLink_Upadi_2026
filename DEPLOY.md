# Deploy en CubePath vía Dokploy

Tu VPS (`vps23841.cubepath.net`) corre **Dokploy** — un panel que despliega
`docker-compose.yml` directo desde GitHub, en vez de entrar por SSH a correr
`docker compose up` a mano. Esta guía usa ese flujo.

El repo tiene dos servicios (`docker-compose.yml`): `backend` (FastAPI,
puerto interno 8000) y `frontend` (build estático servido por Nginx, puerto
interno 80). El dataset y `processed/` (embeddings, grafo) **nunca van en la
imagen ni en el repo** — viven en el disco del VPS.

## Cómo maneja Dokploy los archivos (importante)

Dokploy clona tu repo en `/etc/dokploy/compose/<nombre-app>/code/` — esa
carpeta **se borra y se re-clona en cada deploy**. Lo único que sobrevive
entre deploys es:

- `/etc/dokploy/compose/<nombre-app>/files/` — carpeta persistente que provee
  Dokploy (por eso el bind mount del dataset usa `../files/...`, nunca una
  ruta absoluta).
- Los **volúmenes con nombre** de Docker (nuestro `backend_processed` ya está
  definido así en `docker-compose.yml` — sobrevive sin hacer nada extra).

## 1. Crear el proyecto en Dokploy

En `http://vps23841.cubepath.net:3000`:

1. **Create Project** → dentro, **Create Service → Compose**.
2. Conectá el repo de GitHub: `AndresRJ18/SaberLink_Upadi_2026`, rama `dev`.
3. Compose Path: `docker-compose.yml` (está en la raíz del repo).
4. Anotá el **nombre** que le pusiste al servicio — lo vas a necesitar para
   el paso 3 (define la carpeta `/etc/dokploy/compose/<ese-nombre>/`).

## 2. Configurar dominios (antes de las env vars — el orden importa)

En la pestaña **Domains** del servicio, asigná un dominio/subdominio a cada
contenedor:

- `frontend` → puerto interno **80**
- `backend` → puerto interno **8000**

Dokploy te da la URL final (con HTTPS via Let's Encrypt) para cada uno.
Anotá las dos URLs — las necesitás en el paso siguiente.

## 3. Variables de entorno

En la pestaña **Environment** del servicio Compose, agregá:

```
VITE_API_BASE=https://<url-que-dokploy-asignó-al-backend>
CORS_ORIGINS=https://<url-que-dokploy-asignó-al-frontend>
SABERLINK_DATA_DIR=../files/data_raw

# [PLUS] opcional — sin esto, el botón "Generar con IA" simplemente cae al
# texto de plantilla; nada más depende de estas tres.
AWS_BEARER_TOKEN_BEDROCK=<tu-api-key-de-bedrock>
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0
```

**Importante:** `VITE_API_BASE` se hornea en el bundle de JS al momento del
build del frontend — si la cambiás después de un primer deploy, hay que
volver a deployar (no alcanza con reiniciar) para que tome efecto.

## 4. Subir el dataset (no va por git ni por la UI de Dokploy)

Hacé un primer **Deploy** desde el dashboard (va a fallar al armar
`processed/` porque todavía no hay dataset — es esperado). Eso crea la
carpeta `/etc/dokploy/compose/<nombre-app>/`. Ahora, por SSH, creá la carpeta
persistente:

```bash
ssh root@144.225.147.4
mkdir -p /etc/dokploy/compose/<nombre-app>/files/data_raw
exit
```

Y desde tu máquina local (no desde el VPS):

```bash
scp -r data/raw/* root@144.225.147.4:/etc/dokploy/compose/<nombre-app>/files/data_raw/
```

## 5. Redeploy

Botón **Deploy** de nuevo en Dokploy. Esta vez el backend encuentra el
dataset en `../files/data_raw` y arma `processed/` (1-2 min: descarga el
modelo de embeddings + reembebe ~10.7k campos) antes de levantar la API. Se
ve en la pestaña **Deployments** del servicio, en vivo.

Los próximos deploys (por cambios de código) no repiten ese paso —
`processed/` queda en el volumen `backend_processed`, que Dokploy no toca.

## 6. Verificar

```bash
curl https://<url-del-backend>/health
```

Y abrir la URL del frontend en el navegador.

## Si cambiás el dataset más adelante

Hay que borrar el volumen para que se regenere (si no, el backend sigue
usando el `processed/` viejo):

```bash
ssh root@144.225.147.4
docker volume ls | grep backend_processed   # confirmar el nombre exacto
docker volume rm <nombre-del-volumen>
```

Y volver a **Deploy** desde Dokploy.

## Notas

- **Docling (modo PDF):** los modelos de layout/OCR se descargan la primera
  vez que alguien sube un PDF, no al construir la imagen — la primera subida
  va a tardar más que las siguientes.
- **Nada de esto toca las revisiones en vivo del hackathon** — seguís
  pudiendo correr todo local con `uvicorn` + `npm run dev` (ver el README
  principal). Esto es un link público adicional.
- Si en algún momento preferís saltarte Dokploy y correr `docker compose up`
  directo por SSH (sin pasar por su UI), el `docker-compose.yml` y
  `.env.example` del repo ya sirven para eso tal cual — solo que ahí
  `SABERLINK_DATA_DIR` sería `./data/raw` (el default) en vez de
  `../files/data_raw`.

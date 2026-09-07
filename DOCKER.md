# Docker en Orion Backend — no rompe lo existente
#
## Qué hace
- Añade `Dockerfile` + `docker-compose.yml` para correr la API en un contenedor.
- **No cambia** `pnpm dev`, Render, Neon, ni el código de trading.

## Qué NO va en Docker (sigue igual)
| Pieza | Dónde |
|--------|--------|
| MetaTrader 5 + EA | Tu PC Windows (`MT_ENABLED=false` en el contenedor) |
| Firebase | Solo variables de entorno |
| Neon/Render Postgres | `DATABASE_URL` apunta fuera (recomendado) |
| Frontend Next | Repo `orion-frontend` (su propio Docker) |

## Arranque
```bash
# En autotrading-back/backend, con .env ya configurado (JWT_SECRET, DATABASE_URL, etc.)
docker compose up --build
```
API: http://localhost:3008/api/health

## Desarrollo normal (sin Docker)
```bash
pnpm install
pnpm dev
```
Igual que antes.

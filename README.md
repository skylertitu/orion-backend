# Orion Backend

API Express + TypeScript (puerto **3008**). Sirve autenticación, brokers, órdenes, wallets y Lucy.

## Arranque

En Windows, `cd` y el comando van **en líneas distintas** (o unidos con `&&`):

```bat
cd C:\PROYECTOS\orion\autotrading-back\backend
pnpm install
pnpm run dev
```

Equivale a `tsx watch src/app.ts`. Si `pnpm install` pide aprobar builds (`ERR_PNPM_IGNORED_BUILDS`), deja `true`/`false` reales en `pnpm-workspace.yaml` (`allowBuilds`) y vuelve a instalar.

Copia `.env.example` a `.env` y completa `DATABASE_URL` y `JWT_SECRET`.

Por defecto **no** se hace `ALTER TABLE` en cada arranque (`DB_SYNC=safe`). Si cambias modelos y falta una columna:

```
DB_SYNC=alter
```

Eso puede tardar 20–60s en Neon. Luego vuelve a `safe`.

Swagger (solo desarrollo): http://localhost:3008/api/docs

## Login con Google (Firebase)

El frontend abre el popup de Google. El backend **verifica** el ID token con Firebase Admin y crea o vincula el usuario en Postgres.

1. Firebase Console → Authentication → Get started → activa **Google**.
2. Authentication → Settings → Authorized domains → `localhost`.
3. Project settings → Service accounts → Generate new private key.
4. Guarda el JSON en `secrets/serviceAccountKey.json` (no se sube a git).
5. En `.env`:

```
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/serviceAccountKey.json
CORS_ORIGIN=http://localhost:3000
```

Al arrancar deberías ver:

```
[Firebase] Admin SDK inicializado
[Firebase] Authentication habilitada en el proyecto
```

Si Authentication no está activa, el backend avisa en la terminal y el botón de Google no podrá verificar usuarios.

## Qué ver en la terminal

Tras crear o entrar un usuario:

```
[auth] Nuevo usuario creado id=12 email=ana@gmail.com username=ana
[auth] Nuevo usuario creado vía Google id=12 email=ana@gmail.com username=ana
[auth] Login Google (usuario existente) id=12 email=ana@gmail.com
[auth] Login id=12 email=ana@gmail.com
```

Errores de creación o de Google:

```
[auth] Error al crear usuario email=...: Este correo ya está registrado
[auth] Error en login Google (401): ...
[Firebase] verifyIdToken falló: ...
[http] POST /api/auth/google → 401
```

Errores de envío (órdenes, Lucy, wallet):

```
[engine] Envío buy BTCUSDT → binance ticket=...
[engine] Error al enviar orden buy BTCUSDT en binance: ...
[lucy] Envío /analyze fallido: ...
[wallet] Retiro solicitado user=12 amount=0.5 SOL
[wallet] Saldo insuficiente
```

Si el popup de Google falla **antes** de llegar al API (dominio no autorizado, popup cerrado), no hay línea en el backend: el error queda en el navegador.

## Recuperación de contraseña

El correo de Firebase abre `*.firebaseapp.com` (página blanca). Gmail suele escanear ese enlace y lo deja **usado**. No restablece la contraseña de AutoTrade.

Usa el botón **Restablecer contraseña en AutoTrade** en `/forgot-password`. Eso abre `/reset-password?token=...`.

`POST /api/auth/forgot-password` genera un token de 1 hora. Con SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) el correo lleva ese enlace. Sin SMTP, en desarrollo la app y la terminal muestran el enlace.

Para que el correo de Firebase abra AutoTrade: Firebase Console → Authentication → Templates → Password reset → Action URL = `http://localhost:3000/reset-password`. Esa página no consume el código hasta que el usuario guarda la clave.

```
[auth] Recuperación solicitada id=12 email=ana@gmail.com google=true
[auth] Enlace de recuperación (desarrollo): http://localhost:3000/reset-password?token=...
```

Si la cuenta es solo Google, el usuario puede seguir entrando con **Continuar con Google**.

## Mercados (público)

Cualquier usuario autenticado ve los mismos precios. No hace falta cuenta de broker.

- `GET /api/market/tickers`
- `GET /api/market/klines?symbol=BTCUSDT&interval=1h&limit=100`
- `GET /api/market/price?symbol=BTCUSDT`
- `GET /api/market/pairs`

El backend consulta primero `data-api.binance.vision` (datos públicos, menos bloqueos geográficos) y si falla prueba `api.binance.com`.

## Health

`GET http://localhost:3008/api/health` incluye `firebaseAdmin` y `firebaseAuth`.

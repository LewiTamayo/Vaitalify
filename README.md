# Vitalify API

Web API REST de Vitalify (Entregable 2 – Emprendimiento de Base Tecnológica, Politécnico Grancolombiano).
Ayuda a personas que estudian y trabajan a sostener hábitos de sueño y micro-pausas activas.

- Especificación: [.claude/spec.md](.claude/spec.md)
- Decisiones de diseño: [docs/DECISIONES.md](docs/DECISIONES.md)

## Stack

Node 24 · TypeScript · Express 5 · Prisma 7 + PostgreSQL (Neon) · Zod · OpenAPI 3.1 · Vitest · ESLint + SonarQube · Vercel.

## Correr en local (< 5 minutos)

Requisitos: Node 24 y una base de datos PostgreSQL. El flujo recomendado usa una **rama `dev` de Neon**.

```bash
npm install                     # también genera el cliente de Prisma
cp .env.example .env            # pega en DATABASE_URL (pooled) y DIRECT_URL (direct) las URLs de la rama dev
npx prisma migrate deploy       # crea las tablas
npm run dev                     # http://localhost:3000/api/v1/docs
```

Comprobación rápida: `curl http://localhost:3000/api/v1/health` → `{"status":"ok","db":"up"}`.

## Tests

```bash
npm run test:unit               # unitarios (no necesitan BD)
npm test                        # unitarios + integración (usa .env.test → rama test de Neon)
npm run test:coverage           # con cobertura (coverage/lcov.info para SonarQube)
npm run lint && npm run typecheck
```

Para los tests de integración, crea `.env.test` con `DATABASE_URL`/`DIRECT_URL` de una rama `test` de Neon
y ejecuta `npm run db:migrate:test` antes de la primera corrida.

## Despliegue

- **Vercel**: Production desde `main`, Preview por cada PR. El entry es `src/app.ts` (`export default app`).
  `vercel-build` ejecuta `prisma generate && prisma migrate deploy`.
- **SonarQube Cloud**: el job `ci` de GitHub Actions analiza cada PR y espera el Quality Gate (secreto `SONAR_TOKEN`).

## Endpoints disponibles

| Ruta | Descripción |
|---|---|
| `GET /api/v1/health` | Estado de la API y de la base de datos |
| `GET /api/v1/docs` | Swagger UI |
| `GET /api/v1/openapi.json` | Especificación OpenAPI 3.1 |
| `POST /api/v1/auth/registro` | Crea una cuenta (`aceptaDatos` debe ser `true`) |
| `POST /api/v1/auth/login` | Inicia sesión → `accessToken` (15 min) + `refreshToken` (7 días) |
| `POST /api/v1/auth/refresh` | Rota el refresh token |
| `POST /api/v1/auth/logout` | Revoca el refresh token |
| `GET/PATCH/DELETE /api/v1/usuarios/me` | Cuenta propia (consultar, editar, eliminar con todos sus datos) |
| `GET /api/v1/usuarios/me/exportar` | Descarga todos los datos propios en JSON |
| `POST/GET/PUT/PATCH/DELETE /api/v1/perfil` | Perfil de hábitos (uno por usuario) |
| `POST/GET /api/v1/bloques` | Crear y listar bloques de horario (`?tipo`, `?diaSemana`, `?page`, `?pageSize`) |
| `GET/PUT/PATCH/DELETE /api/v1/bloques/:id` | Un bloque propio (los ajenos responden 404) |
| `POST /api/v1/bloques/importar` | Importa hasta 200 bloques de una vez (todos o ninguno) |
| `GET /api/v1/actividades`, `GET /api/v1/actividades/:id` | Catálogo de actividades (`?categoria`, `?maxDuracionMin`); escritura solo `admin` |
| `POST /api/v1/micro-ventanas/recalcular` | Recalcula las micro-ventanas (se hace solo al cambiar bloques o perfil) |
| `GET /api/v1/micro-ventanas`, `GET/DELETE /api/v1/micro-ventanas/:id` | Micro-ventanas libres (`?desde`, `?hasta`, `?conPausa`) |
| `POST /api/v1/micro-ventanas/:id/micro-pausa` | Recomienda una micro-pausa para la ventana |
| `GET /api/v1/micro-pausas`, `GET /api/v1/micro-pausas/hoy` | Micro-pausas (todas o las de hoy) |
| `PATCH /api/v1/micro-pausas/:id` | Registra el cumplimiento (`{ "estado": "hecha" }`); admite `Idempotency-Key` |
| `PUT/DELETE /api/v1/micro-pausas/:id` | Cambia la actividad (si está pendiente) o elimina |

| `POST/GET /api/v1/registros-sueno`, `GET/PUT/DELETE /api/v1/registros-sueno/:id` | Horas dormidas por fecha (admite `Idempotency-Key`) |
| `GET /api/v1/sueno/recomendacion?fecha=` | Hora sugerida para acostarse y checklist "Antes de dormir" |
| `GET/POST /api/v1/config-notificaciones`, `GET/PUT/DELETE /api/v1/config-notificaciones/:tipo` | Activar tipos (`sueno`, `pausa`, `logros`) y horario de silencio |
| `POST /api/v1/recordatorios/generar` | Genera (idempotente) los recordatorios de un día |
| `GET /api/v1/recordatorios`, `GET /api/v1/recordatorios/pendientes?horas=24` | Recordatorios; los pendientes son los que la app programa como notificaciones locales |
| `GET/PATCH/DELETE /api/v1/recordatorios/:id` | Detalle, edición o acuse `{ "enviado": true }` |
| `GET /api/v1/jobs/generar-recordatorios`, `GET /api/v1/jobs/limpieza` | Solo Vercel Cron (`Authorization: Bearer <CRON_SECRET>`) |

### Recordatorios y notificaciones

1. El servidor genera los recordatorios de cada día (cron diario a las 04:00 de Bogotá y, al momento,
   cuando cambian el horario, el perfil, las micro-pausas o la configuración).
2. La app consulta `GET /recordatorios/pendientes` al abrirse y programa **notificaciones locales**;
   luego confirma cada una con `PATCH /recordatorios/:id { "enviado": true }`.
3. Así las notificaciones llegan aunque el teléfono no tenga conexión (RNF-09) y sin conexiones
   abiertas (RNF-04).

### Reintentos sin conexión

`PATCH /micro-pausas/:id` y `POST/PUT /registros-sueno` aceptan la cabecera opcional `Idempotency-Key`. Si la app reenvía la misma
petición con la misma clave (p. ej. al recuperar la conexión), recibe la respuesta original con
`Idempotent-Replayed: true` y la operación no se repite.

Todas las rutas salvo `/health`, `/docs`, `/openapi.json`, registro, login y refresh exigen
`Authorization: Bearer <accessToken>`.

## Variables en Vercel

Además de las de Neon (las inyecta la integración) y las de `.env.example`, en **Production** y **Preview**:
`CRON_SECRET` (≥ 32 caracteres aleatorios; Vercel Cron lo envía a `/jobs/*`),
`JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (≥ 32 caracteres aleatorios) y
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limiting; obligatorias).

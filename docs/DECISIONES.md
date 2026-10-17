# Decisiones de diseño

Registro de las decisiones no cubiertas por la especificación (`.claude/spec.md`) o que la ajustan.
Las desviaciones respecto al modelo ER del Entregable 2 (S-01 … S-17) están en el spec, §14.

## Decisiones de requisitos (con el estudiante)

| ID | Decisión | Justificación / efecto |
|---|---|---|
| U-1 | Se aceptan las desviaciones S-01…S-17 (PostgreSQL/Neon y campos añadidos al ER). | Se justifican en el informe. |
| U-2 | Sin Docker: desarrollo, tests locales y pruebas JMeter contra **ramas de Neon** (`dev`, `test`, `perf`). | El equipo de desarrollo no tiene Docker. `docker-compose*.yml` y `Dockerfile` quedan como referencia. Las mediciones de rendimiento incluyen la latencia de red a Neon y no limitan CPU/RAM. |
| U-3 | Se implementan las 8 fases del spec. | — |
| U-4 | Avance continuo; pausas solo para cuentas, secretos o instalaciones. | — |
| U-5 | Una rama y un PR por fase. | Deja evidencia de CI y Quality Gate por fase. |
| U-6 | Solo documentación técnica en el repo; el informe se redacta aparte. | — |
| U-7 | La racha cuenta el día de la micro-ventana (no el día en que se sincroniza). | Coherente con el uso sin conexión (RNF-09). La racha se recalcula con una función pura sobre los días activos; `Progreso` actúa como caché. Una ventana futura no se puede marcar como hecha (422). |
| U-8 | Neon se instala desde el Marketplace de Vercel, con una rama de BD por cada Preview. | `DIRECT_URL` acepta `DATABASE_URL_UNPOOLED` (nombre que inyecta la integración). Las migraciones corren en `vercel-build` (`prisma migrate deploy`), así cada Preview y Production migra al desplegarse; no hay job `migrate` en GitHub Actions. |
| U-9 | Los Preview siguen protegidos; JMeter usa el token de bypass de Vercel para la prueba smoke. | Header `x-vercel-protection-bypass`, secreto pasado por línea de comandos, nunca versionado. |

## Decisiones técnicas

| Decisión | Justificación |
|---|---|
| Proyecto en la raíz del repo (no en `vitalify-api/`). | El repo contiene solo la API. |
| SonarQube Cloud. | Repo público (gratuito) y sin Docker para SonarQube local. |
| Node 24.x. | Versión instalada localmente; soportada por Vercel y permitida por el spec. |
| Prisma 7.10 (no la RC de Prisma 8 que npm publica como `latest`). | Versión estable. Prisma 7 exige `prisma.config.ts`, generador `prisma-client` con `output` y *driver adapter*. |
| `@prisma/adapter-pg` en lugar de `@prisma/adapter-neon`. | Un único adapter para Neon (URL con pooling) y para el PostgreSQL del CI. |
| TypeScript 6.0. | `typescript-eslint` aún no admite TypeScript 7. |
| Enums de `schema.prisma` en formato multilínea. | Prisma no admite enums en una sola línea (el spec los muestra así por brevedad); el contenido es idéntico. |
| Variables de entorno vacías se tratan como no definidas. | `.env.example` deja varias vacías; así la app arranca copiándolo tal cual. |
| `RATE_LIMIT_ENABLED=false` solo con `APP_ENV=perf`; secretos JWT ≥ 32 caracteres en `preview`/`production`. | Spec §9. El error de arranque lista los nombres de las variables, nunca sus valores. |
| El script de arranque de Swagger UI se sirve en `/api/v1/docs-init.js`. | Evita `'unsafe-inline'` en la CSP de `/docs`; las demás rutas conservan la CSP estricta de `helmet`. |
| `/health` responde `503 {status:"degraded", db:"down"}` si la BD no contesta en 3 s. | Evita que la función quede colgada hasta el *timeout* de Vercel (Neon puede estar suspendida). |
| Los `crons` de `vercel.json` se agregan en la Fase 5. | Los endpoints `/jobs/*` aún no existen. |
| Si falta `APP_ENV`, se deduce de `VERCEL_ENV` (`production`, `preview`; `development` → `local`). | Evita que un despliegue sin `APP_ENV` arranque con secretos de ejemplo. |
| Timeout de conexión a PostgreSQL de 5 s. | Una BD inalcanzable no deja peticiones colgadas hasta el límite de Vercel (§17.2). |
| En un build de Vercel, las migraciones exigen `DIRECT_URL` o `DATABASE_URL_UNPOOLED`. | `migrate deploy` a través del pooler puede fallar; nunca se usa la URL con pooling para migrar en Vercel. |
| Bloques de horario: si la hora de dormir es posterior a medianoche, no se buscan micro-ventanas después de las 00:00 en el MVP. | Simplificación coherente con S-11. |

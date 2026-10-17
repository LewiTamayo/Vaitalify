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

## Fase 2 — Identidad

| Decisión | Justificación |
|---|---|
| El refresh token es un JWT (firmado con `JWT_REFRESH_SECRET`, con `jti` aleatorio) y en la BD solo se guarda su SHA-256. | Si la BD se filtra, los tokens guardados no sirven. |
| Reutilizar un refresh token ya rotado responde 401 y **revoca todas** las sesiones del usuario. | Indica un posible robo del token (detección de reutilización). La rotación usa una actualización condicional, así que dos peticiones simultáneas no pueden rotar el mismo token. |
| Cambiar la contraseña cierra todas las sesiones. | Protege ante un dispositivo perdido o una sesión comprometida. |
| Contraseña de 8 a 72 **bytes**, con al menos una letra y un número. | bcrypt ignora lo que pasa de 72 bytes; se rechaza para evitar colisiones silenciosas. |
| El login ejecuta bcrypt incluso si el correo no existe (contra un hash ficticio) y responde siempre `Credenciales inválidas`. | No revela qué correos están registrados (§9). El registro con correo duplicado sí responde 409, como exige §6.1. |
| El correo se normaliza (`trim` + minúsculas) antes de guardar y buscar. | `" Ana@Mail.com "` y `"ana@mail.com"` son la misma cuenta. |
| `aceptaDatos: false` → 422 (regla de negocio), no 400. | El dato es válido en forma; incumple la Ley 1581/2012 (§6.1). |
| Una cuenta eliminada con access token aún vigente recibe 401 en `/usuarios/me`. | El access token no consulta la BD (stateless); la cuenta se verifica al usarla. |
| Rate limiting: login 5/min por IP; resto de `/auth/*` 10/min por IP; global 100/min por usuario (si trae un access token válido) o por IP. La IP es el primer valor de `x-forwarded-for` (Vercel lo fija). | §6.1 y §9. `/health` y la documentación quedan fuera del límite global. |
| Upstash Redis con cuenta directa (upstash.com), no desde el Marketplace de Vercel. | La integración no estaba disponible en el panel del proyecto. En `preview`/`production` las credenciales son obligatorias (la app no arranca sin ellas si el rate limit está activo). |
| El limitador es inyectable en `createApp({ fabricaLimitador })`. | Los tests de integración no chocan con los límites; un test dedicado verifica el 429 real. |
| `crearAuthRouter` y `usuarios.service` comparten `auth/sesiones.service.ts`. | Evita una dependencia circular entre los servicios de `auth` y `usuarios` (§0.3). |
| Presentar un refresh token ya revocado (rotado, cerrado con logout o por cambio de contraseña) cierra **todas** las sesiones. | No se distingue un cliente desactualizado de un token robado; ante la duda se protege la cuenta. |
| Una contraseña de más de 72 bytes nunca verifica (login y `contrasenaActual`), aunque sus primeros 72 coincidan. | bcrypt solo compara los primeros 72 bytes; sin esto, «contraseña + cualquier texto» entraría. |
| Al cambiar la contraseña, las sesiones se cierran **antes** de guardar el nuevo hash. | Si el cierre falla, la contraseña no cambia; nunca queda una contraseña nueva con sesiones viejas vivas. |
| `PATCH /usuarios/me` con `contrasena` se limita como el login: 5/min por usuario. | Un access token robado no sirve para adivinar `contrasenaActual` por fuerza bruta. |
| Si Upstash no responde: el límite global deja pasar el tráfico (y lo registra); los límites de autenticación responden 503. | Una caída de Upstash no tumba toda la API, pero tampoco abre la puerta a la fuerza bruta. |

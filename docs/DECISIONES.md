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

## Fase 3 — Perfil y horario

| Decisión | Justificación |
|---|---|
| `PUT /perfil` sin perfil previo → 404 (no crea). | Mantiene la semántica de §6.3: `POST` crea y `PUT` reemplaza. |
| `PATCH` (perfil y bloques) valida las reglas sobre el resultado combinado con lo guardado. | Un cambio de un solo campo puede romper una regla entre campos (p. ej., dejar `horaFin` antes de `horaInicio`). |
| `horaDormir` debe ser distinta de `horaDespertar`. | Con horas iguales no hay intervalo de sueño ni día despierto (S-12). |
| Los `:id` se limitan al rango de `INT` de PostgreSQL (1…2 147 483 647); fuera de rango → 400. | Un id mayor provocaría un error de la BD (500). |
| Un bloque que termina a medianoche se registra hasta `23:59`. | `24:00` no es una hora válida y los bloques no cruzan medianoche (S-11). |
| El orden de horas se compara como texto `HH:mm`. | Con ceros a la izquierda el orden de texto coincide con el horario y no falla aunque el formato sea inválido. |
| `pageSize > 100` → 400 en lugar de recortarlo. | El cliente sabe que pidió algo inválido (§5: máx. 100). |
| Importación: una sola sentencia `INSERT` (`createManyAndReturn`) y validación previa de todo el lote. | Todo o nada (§6.4). El error indica la posición: `bloques.149.horaFin`. |
| El parser JSON de 1 MB aplica solo a `POST /bloques/importar`; el resto mantiene 100 kB. | §9. |
| El recálculo de micro-ventanas tras modificar bloques se añade en la Fase 4. | Depende del algoritmo de ventanas (RF-04). |

## Fase 4 — Núcleo adaptativo

| Decisión | Justificación |
|---|---|
| Las micro-ventanas se recalculan (hoy … hoy+6) en la misma petición tras crear, importar, reemplazar, actualizar o eliminar un bloque, y tras crear o cambiar el perfil. | RNF-03 y §7.7.3. El día despierto del perfil también define las ventanas. Sin perfil, el recálculo automático se omite (no falla la operación sobre bloques). |
| Reconciliación por clave `fecha + horaInicio`: las ventanas con pausa `hecha`/`omitida` se conservan siempre; una `pendiente` se conserva si su ventana sigue existiendo y la actividad cabe en la nueva duración; las demás se eliminan y se crean las nuevas. | §7.1 paso 5: no se pierde el historial y no quedan pausas en huecos que ya no existen. |
| Si `horaDormir` es anterior o igual a `horaDespertar` (se duerme después de medianoche), el día despierto termina a las 24:00. | Simplificación del MVP coherente con S-11. |
| `micro-ventanas.repository` lee perfil y bloques con sus propias consultas (solo lectura). | Evita un ciclo de imports: los servicios de bloques y perfil llaman al de micro-ventanas. |
| El desempate de la recomendación usa un PRNG con semilla (mulberry32) iniciado con `crypto.randomInt`. | §7.2: tests deterministas sin `Math.random`. No se usa con fines de seguridad (hotspot de Sonar revisado como seguro). |
| Marcar `hecha` una micro-pausa de un día futuro → 422. | U-7: la racha cuenta el día de la ventana. |
| `PATCH /micro-pausas/:id` responde con la micro-pausa; los campos de gamificación se añaden en la Fase 6. | La gamificación (§7.4) es de la Fase 6. |
| Idempotencia: `Idempotency-Key` (1–64 caracteres `[A-Za-z0-9_-]`) por usuario; se guardan solo respuestas 2xx durante 24 h, **antes** de enviarlas. La misma clave en otra ruta → 422. | RNF-09. Vercel puede congelar la función tras responder, así que guardar después no sería fiable. Un 4xx no se guarda para que el cliente pueda corregir y reintentar. |
| El seed del catálogo (8 actividades y 3 insignias) es idempotente y se ejecuta en cada `vercel-build` (`prisma db seed`). Los usuarios admin/demo solo se crean si existen `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD`. | No hace falta ningún paso manual tras desplegar (cada Preview tiene su catálogo). |
| Borrar una actividad con micro-pausas → 409 (restricción de clave foránea). | §6.7. |

## Fase 5 — Sueño y recordatorios

| Decisión | Justificación |
|---|---|
| Hora para acostarse (§7.3): `despertar = primera actividad de D+1 − MARGEN_PREPARACION_MIN`; `acostarse = despertar − metaHorasSueno`. Sin bloques en D+1 se usan `horaDormir`/`horaDespertar` del perfil. `horasDeSuenoLogradas` se redondea a 1 decimal. | Reproduce el ejemplo del mockup (07:00 → 22:45) y no inventa una actividad si no la hay. |
| Una hora "de la noche" anterior a las 12:00 (p. ej. acostarse 00:30) pertenece al día siguiente. | Los recordatorios de sueño nunca quedan en la madrugada del día anterior. |
| Cada recordatorio guarda su **día lógico** (`fecha`, la noche de D aunque se envíe en la madrugada de D+1) y su **clave de origen** (`tipo|instante generado`). La regeneración sincroniza por día lógico y clave de origen; solo toca los **no enviados**. | Un día que empieza por la tarde (acostarse 05:45 de D+1) no pierde sus recordatorios con la generación de D+1, y una hora editada por el usuario no se deshace ni se duplica. El día lógico corta a las 04:00 locales (`diaLogico()`). |
| Unicidad natural `(idUsuario, claveOrigen)` en `recordatorio` y generación bajo un *advisory lock* por usuario. | §7.7.1: el cron repetido o dos regeneraciones simultáneas no duplican ni dejan recordatorios obsoletos. |
| Horario de silencio: el recordatorio se mueve al final del silencio solo si sigue antes de su límite (pausa → inicio de la ventana; sueño → hora de despertar); si no, se descarta. | §7.7.4: "se mueven al final del silencio o se descartan si ya no tienen sentido". |
| Los recordatorios del día se regeneran en la misma petición tras cambios en bloques, perfil, micro-pausas o configuración, sin hacer fallar la operación (datos derivados). | §7.7.3. Mismo criterio que el recálculo de micro-ventanas. |
| `GET /recordatorios/pendientes` filtra de nuevo por tipos activos. | La configuración pudo cambiar después de generar. |
| Jobs: `cronAuth` compara los SHA-256 en tiempo constante; sin `CRON_SECRET` configurado responde 401 siempre. Los jobs quedan fuera del límite global. | §9. `timingSafeEqual` exige longitudes iguales: con hashes nunca lanza. |
| La limpieza borra refresh tokens **vencidos**, no los revocados aún vigentes. | Borrar los revocados anularía la detección de reutilización (Fase 2): se conservan hasta su vencimiento (máx. 7 días). |
| El job diario procesa usuarios con perfil por lotes de 100 (cursor por id); el fallo de un usuario no detiene el resto. | §7.7.1. |
| `NotificationSender` + `LogSender` como punto de extensión; ningún flujo envía push desde el servidor. | S-13 y S-15: la app programa notificaciones locales con `/recordatorios/pendientes`. |
| El repositorio de recordatorios lee micro-pausas y configuración con sus propias consultas (solo lectura). | Esos servicios regeneran recordatorios: usarlos crearía un ciclo de imports. |

## Fase 6 — Gamificación y progreso

| Decisión | Justificación |
|---|---|
| **Libro de puntos** (`puntos_otorgados`, único por usuario + concepto + referencia): +10 la primera vez que la micro-pausa de una **ventana** (clave natural `fecha|horaInicio`) pasa a `hecha`; +5 la primera vez que una fecha cumple la meta de sueño (aunque luego se edite a menos horas). | Alternar estados, borrar y recrear la pausa en la misma ventana o borrar y recrear un registro de sueño no cobra dos veces; borrar no revierte (S-09). Es idempotente aunque lleguen reintentos o peticiones simultáneas. |
| La racha se **recalcula** sobre todos los días activos (fecha de la ventana) con la regla de §7.4; `Progreso` guarda el resultado como caché. | U-7: una sincronización tardía o desordenada da la misma racha que en orden. |
| Comodines: 2 por semana ISO, con reinicio perezoso según la semana del **nuevo** día activo. | §7.4 paso 2 y S-08. |
| Racha **vigente** al consultar: si los días perdidos desde la última actividad superan los comodines disponibles hoy, se muestra 0; si no, `comodinesRestantes` descuenta los días ya perdidos. | Un usuario inactivo no ve una racha vieja como actual; la regla de §7.4 solo se aplica al registrar actividad. |
| Puntos, racha e insignias se aplican en **una transacción con bloqueo por usuario**. | §7.4 ("toda operación de gamificación en una transacción") y sin carreras entre PATCH simultáneos. |
| `PATCH /micro-pausas/:id` responde la micro-pausa + `puntosGanados`, `rachaActual` (vigente) e `insigniasNuevas`. Si la gamificación falla, el error se propaga (un reintento es seguro: el libro es idempotente). | §6.6. |
| La gamificación del sueño no hace fallar el registro. | El registro ya se guardó y un reintento respondería 409. |
| Insignias por **estrategia según `codigo`** (`PRIMERA_SEMANA`, `DIEZ_PAUSAS`, `SUENO_7H_5N`); idempotentes por la PK compuesta. `DIEZ_PAUSAS` cuenta las pausas puntuadas del libro (no se pierde al borrar). Las insignias creadas por el admin sin estrategia no se otorgan solas. | §7.6 y S-05. |
| `/progreso/semanal`: el promedio de sueño usa solo los días con registro (`null` si no hay); `porcentajeMeta` es `null` sin meta de actividad. | §7.5. |
| `DIEZ_PAUSAS` cuenta ventanas con pausa puntuada en el libro (incluye pausas luego borradas o revertidas). | Coherente con S-09: lo ganado no se pierde. |
| El admin puede cambiar el `codigo` de una insignia; una insignia sin estrategia para su código no se otorga sola. Borrar una insignia borra también sus asignaciones a usuarios (cascada). | Catálogo administrable (§6.11); el código enlaza la insignia con su regla (S-05). |

# Vitalify Web API — Especificación para Claude Code

> **Origen:** Entregable 2 – Vitalify (Emprendimiento de Base Tecnológica, Politécnico Grancolombiano).
> **Propósito de este archivo:** guía ejecutable para que Claude Code construya la "versión web" de Vitalify como una **Web API REST** con CRUD completo de las entidades del modelo entidad-relación y la lógica de negocio mínima del MVP.
> **Idioma:** documentación en español; identificadores de código en español (como en el modelo ER) para trazabilidad con el entregable.
> **Despliegue:** Vercel (`*.vercel.app`, función serverless) · **Calidad estática:** SonarQube · **Rendimiento:** Apache JMeter. Ver §17, §18 y §19.

---

## 0. Instrucciones para Claude Code (leer primero)

1. Implementa **por fases** (sección 13). Al terminar cada fase: ejecuta tests, linter y typecheck; no avances si algo falla.
2. Esta spec es la fuente de verdad. Si algo es ambiguo, aplica el **supuesto** documentado en la sección 14; si no hay supuesto, elige la opción más simple y regístrala en `docs/DECISIONES.md`.
3. Respeta la arquitectura modular (RNF-10): un módulo por dominio, sin imports cruzados entre `controller`/`repository` de módulos distintos (solo vía `service`).
4. Nunca expongas `contrasenaHash` ni tokens en respuestas ni logs.
5. Todo recurso es **propiedad de un usuario**: un usuario jamás puede leer/modificar recursos de otro (responder `404`, no `403`, para no filtrar existencia).
6. Cada endpoint debe tener: validación de entrada (Zod), documentación OpenAPI y al menos un test de integración (camino feliz + un error).
7. **El código corre en Vercel (serverless):** debe ser *stateless*. Prohibido guardar estado entre peticiones en memoria (rate limit, idempotencia, colas, cachés) y prohibidos los procesos en segundo plano (`setInterval`, `node-cron`, `app.listen` en el entry de Vercel). Todo lo programado va por Vercel Cron (§17).
8. **El código se analiza con SonarQube (§18):** funciones con complejidad cognitiva ≤ 15, sin código duplicado, sin secretos ni contraseñas en el código, sin `console.log` (usar `pino`), sin `Math.random()` para nada que afecte seguridad.
9. **Toda fecha/hora del usuario se calcula en `APP_TZ` (America/Bogota)**: los servidores de Vercel y sus cron jobs funcionan en UTC.

---

## 1. Resumen del producto

Vitalify ayuda a personas que **estudian y trabajan a la vez** a sostener hábitos de **sueño** y **actividad física ligera**. El usuario registra su horario semanal; el sistema detecta **micro-ventanas** libres (5–15 min), recomienda **micro-pausas activas**, calcula **recordatorios de higiene del sueño** según la primera actividad del día siguiente y premia el progreso con **gamificación tolerante** (la racha no se rompe por omitir un día).

**Alcance de esta entrega:** únicamente el backend (Web API). La app móvil (Android/iOS) y cualquier cliente web consumirán esta API. No se construye UI.

### Fuera de alcance del MVP
- OAuth/sincronización real con Google Calendar u Outlook (RF-03 se cubre con importación por lote JSON; ver §14, S-04).
- Envío real de push (FCM/APNs): se define una interfaz `NotificationSender` con implementación *stub*/log.
- Panel de administración (solo endpoints protegidos por rol).

---

## 2. Stack tecnológico

> Ajustado para desplegar en **Vercel**. Vercel no ofrece MySQL nativo, por eso se usa PostgreSQL serverless (ver S-14); los contratos de la API y la estructura del modelo ER no cambian.

| Capa | Tecnología |
|---|---|
| Runtime / lenguaje | Node.js 22.x LTS (o 24.x) + TypeScript (strict). Fijar `"engines": { "node": "22.x" }` en `package.json` |
| Framework HTTP | Express 4/5 exportado como `export default app` (detección *zero-config* de Vercel; toda la app es **una** Vercel Function) |
| Base de datos | PostgreSQL serverless (**Neon**, instalado desde el Vercel Marketplace) |
| ORM / migraciones | Prisma, con **dos URLs**: `DATABASE_URL` con *pooling* (runtime) y `DIRECT_URL` sin pooling (migraciones). Si la versión estable vigente de Prisma exige `prisma.config.ts` o *driver adapters* (`@prisma/adapter-neon`), seguir su documentación manteniendo las dos URLs |
| Validación | Zod |
| Autenticación | JWT (access 15 min + refresh 7 días rotatorio) · `bcryptjs` (cost 12; versión JS pura, evita binarios nativos en el bundle) |
| Documentación API | OpenAPI 3.1 generado desde Zod (`@asteasolutions/zod-to-openapi`), servido en `/openapi.json`; Swagger UI cargado desde CDN en `/docs` (no usar `swagger-ui-express` con archivos estáticos: falla en serverless) |
| Tareas programadas | **Vercel Cron** → endpoints `GET /api/v1/jobs/*` protegidos con `CRON_SECRET` |
| Rate limiting | `@upstash/ratelimit` + Upstash Redis (Vercel Marketplace). Store en memoria **solo** en `local`/`test` |
| Fechas y zona horaria | Luxon (`APP_TZ=America/Bogota`) |
| Logs | `pino` (JSON a stdout; Vercel los recoge en *Logs*) |
| Seguridad HTTP | `helmet`, `cors` con lista blanca |
| Tests | Vitest + Supertest + `@vitest/coverage-v8` (reporte `lcov`) + `vitest-sonar-reporter` |
| Calidad | ESLint + `eslint-plugin-sonarjs` + Prettier + `tsc --noEmit` · **SonarQube** (§18) |
| Rendimiento | **Apache JMeter** 5.6.x o superior, modo no-GUI (§19) |
| CI | GitHub Actions (tests + SonarQube) · Vercel Git Integration (Preview por PR, Production desde `main`) |
| Entorno local | `docker-compose.yml` (PostgreSQL) + `docker-compose.perf.yml` (API limitada en CPU/RAM para JMeter) |

---

## 3. Arquitectura y estructura de carpetas

Arquitectura en capas por módulo: `routes → controller → service → repository (Prisma)`.

```
vitalify-api/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  ├─ seed.ts                 # datos base (actividades, insignias, admin, demo)
│  └─ seed-perf.ts            # N usuarios de prueba para JMeter (§19)
├─ src/
│  ├─ app.ts                  # ENTRY DE VERCEL: construye Express y hace `export default app` (sin listen)
│  ├─ local.ts                # solo desarrollo local: importa app y hace app.listen(PORT)
│  ├─ config/env.ts           # validación de variables con Zod
│  ├─ config/gamificacion.ts
│  ├─ common/
│  │  ├─ db/prisma.ts         # PrismaClient singleton (reutilizado entre invocaciones)
│  │  ├─ errors/              # AppError, handler global (RFC 7807)
│  │  ├─ middleware/          # auth, validate, rateLimit, requireRole, idempotency, cronAuth
│  │  ├─ ratelimit/           # adaptador Upstash | memoria
│  │  ├─ openapi/             # registro de esquemas y página /docs (CDN)
│  │  ├─ utils/               # time.ts (HH:mm), dates.ts (Luxon + APP_TZ), pagination.ts, random.ts (PRNG con seed)
│  │  └─ notifications/       # NotificationSender (interfaz) + LogSender
│  └─ modules/
│     ├─ auth/  usuarios/  perfil/  bloques/  micro-ventanas/  micro-pausas/
│     ├─ actividades/  sueno/  recordatorios/  notificaciones/  progreso/  insignias/
│     └─ jobs/                # endpoints invocados por Vercel Cron
├─ tests/
│  ├─ unit/                   # algoritmos puros (espeja src/modules)
│  ├─ integration/            # Supertest contra la app + PostgreSQL de prueba
│  └─ performance/            # JMeter: vitalify.jmx, escenarios/*.properties, data/usuarios.csv
├─ .github/workflows/ci.yml
├─ docs/  (DECISIONES.md, PRIVACIDAD.md, RENDIMIENTO.md)
├─ vercel.json
├─ sonar-project.properties
├─ vitest.config.ts
├─ .env.example
├─ Dockerfile                 # solo para el entorno de rendimiento local (Vercel no lo usa)
├─ docker-compose.yml
└─ docker-compose.perf.yml
```

Cada módulo contiene: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schemas.ts` (Zod) y, si tiene lógica pura, `*.domain.ts`. **Los tests viven en `tests/`, no junto al código**, para que SonarQube separe con claridad código fuente y código de prueba.

> ⚠️ No crear `src/server.ts` ni `src/index.ts`: Vercel reconoce esos nombres como posibles entry points y podría tomar el archivo equivocado. El único entry de Vercel es `src/app.ts`.

---

## 4. Modelo de datos

Basado en el diagrama ER del Entregable 2, implementado en **PostgreSQL** (S-14: `TINYINT` → `SMALLINT`, `ENUM` → tipo enum nativo; el resto es equivalente). Las **desviaciones** respecto al diagrama están marcadas con `// +` y justificadas en §14.

### 4.1 Diagrama (Mermaid)

```mermaid
erDiagram
    USUARIO ||--|| PERFIL_HABITOS : tiene
    USUARIO ||--o{ BLOQUE_HORARIO : registra
    USUARIO ||--o{ MICRO_VENTANA : dispone_de
    USUARIO ||--o{ REGISTRO_SUENO : registra
    USUARIO ||--o{ RECORDATORIO : recibe
    USUARIO ||--o{ CONFIG_NOTIFICACION : configura
    USUARIO ||--|| PROGRESO : acumula
    USUARIO ||--o{ USUARIO_INSIGNIA : obtiene
    INSIGNIA ||--o{ USUARIO_INSIGNIA : corresponde_a
    MICRO_VENTANA ||--o| MICRO_PAUSA : se_asigna
    ACTIVIDAD ||--o{ MICRO_PAUSA : usa
```

### 4.2 `prisma/schema.prisma`

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // con pooling (runtime en Vercel)
  directUrl = env("DIRECT_URL")     // sin pooling (prisma migrate)
}

enum Rol                    { user admin }                                  // +
enum TipoBloque             { trabajo estudio viaje }
enum OrigenBloque           { manual importado }
enum EstadoMicroPausa       { pendiente hecha omitida }
enum TipoRecordatorio       { sueno pausa }
enum TipoConfigNotificacion { sueno pausa logros }

model Usuario {
  idUsuario      Int       @id @default(autoincrement()) @map("id_usuario")
  nombre         String    @db.VarChar(80)
  correo         String    @unique @db.VarChar(120)
  contrasenaHash String    @map("contrasena_hash") @db.VarChar(255)
  fechaRegistro  DateTime  @default(now()) @map("fecha_registro")
  aceptaDatos    Boolean   @map("acepta_datos")                    // Ley 1581/2012
  rol            Rol       @default(user)                          // +

  perfil          PerfilHabitos?
  bloques         BloqueHorario[]
  microVentanas   MicroVentana[]
  registrosSueno  RegistroSueno[]
  recordatorios   Recordatorio[]
  configs         ConfigNotificacion[]
  progreso        Progreso?
  insignias       UsuarioInsignia[]
  refreshTokens   RefreshToken[]                                   // +
  @@map("usuario")
}

model RefreshToken {                                               // + (logout / rotación)
  idToken     Int      @id @default(autoincrement()) @map("id_token")
  idUsuario   Int      @map("id_usuario")
  tokenHash   String   @unique @map("token_hash") @db.VarChar(64)
  expiraEn    DateTime @map("expira_en")
  revocado    Boolean  @default(false)
  usuario     Usuario  @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@map("refresh_token")
}

model PerfilHabitos {
  idPerfil        Int      @id @default(autoincrement()) @map("id_perfil")
  idUsuario       Int      @unique @map("id_usuario")
  horaDormir      DateTime @map("hora_dormir")      @db.Time(0)
  horaDespertar   DateTime @map("hora_despertar")   @db.Time(0)
  metaHorasSueno  Decimal  @map("meta_horas_sueno") @db.Decimal(3, 1)
  metaMinActividad Int     @map("meta_min_actividad")
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@map("perfil_habitos")
}

model BloqueHorario {
  idBloque   Int           @id @default(autoincrement()) @map("id_bloque")
  idUsuario  Int           @map("id_usuario")
  tipo       TipoBloque
  titulo     String        @db.VarChar(80)
  diaSemana  Int           @map("dia_semana") @db.SmallInt          // 1=Lunes … 7=Domingo (ISO)
  horaInicio DateTime      @map("hora_inicio") @db.Time(0)
  horaFin    DateTime      @map("hora_fin")    @db.Time(0)
  origen     OrigenBloque  @default(manual)
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@index([idUsuario, diaSemana])
  @@map("bloque_horario")
}

model MicroVentana {
  idVentana   Int      @id @default(autoincrement()) @map("id_ventana")
  idUsuario   Int      @map("id_usuario")
  fecha       DateTime @db.Date
  horaInicio  DateTime @map("hora_inicio") @db.Time(0)
  duracionMin Int      @map("duracion_min") @db.SmallInt
  usuario   Usuario     @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  microPausa MicroPausa?
  @@unique([idUsuario, fecha, horaInicio])
  @@map("micro_ventana")
}

model Actividad {
  idActividad  Int    @id @default(autoincrement()) @map("id_actividad")
  nombre       String @db.VarChar(80)
  categoria    String @db.VarChar(40)               // estiramiento | caminata | bajo_impacto
  duracionMin  Int    @map("duracion_min") @db.SmallInt
  instrucciones String @db.Text
  microPausas  MicroPausa[]
  @@map("actividad")
}

model MicroPausa {
  idPausa       Int              @id @default(autoincrement()) @map("id_pausa")
  idVentana     Int              @unique @map("id_ventana")
  idActividad   Int              @map("id_actividad")
  estado        EstadoMicroPausa @default(pendiente)
  fechaRegistro DateTime?        @map("fecha_registro")
  ventana   MicroVentana @relation(fields: [idVentana], references: [idVentana], onDelete: Cascade)
  actividad Actividad    @relation(fields: [idActividad], references: [idActividad], onDelete: Restrict)
  @@map("micro_pausa")
}

model RegistroSueno {
  idRegistro   Int      @id @default(autoincrement()) @map("id_registro")
  idUsuario    Int      @map("id_usuario")
  fecha        DateTime @db.Date                    // noche que se reporta (fecha del despertar)
  horasDormidas Decimal @map("horas_dormidas") @db.Decimal(3, 1)
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@unique([idUsuario, fecha])                                     // +
  @@map("registro_sueno")
}

model Recordatorio {
  idRecordatorio Int              @id @default(autoincrement()) @map("id_recordatorio")
  idUsuario      Int              @map("id_usuario")
  tipo           TipoRecordatorio
  mensaje        String           @db.VarChar(160)
  fechaHoraEnvio DateTime         @map("fecha_hora_envio")
  enviado        Boolean          @default(false)
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@index([enviado, fechaHoraEnvio])
  @@map("recordatorio")
}

model ConfigNotificacion {
  idConfig      Int                    @id @default(autoincrement()) @map("id_config")
  idUsuario     Int                    @map("id_usuario")
  tipo          TipoConfigNotificacion
  activa        Boolean                @default(true)
  silencioInicio DateTime?             @map("silencio_inicio") @db.Time(0)
  silencioFin    DateTime?             @map("silencio_fin")    @db.Time(0)
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@unique([idUsuario, tipo])                                      // +
  @@map("config_notificacion")
}

model Progreso {
  idProgreso        Int       @id @default(autoincrement()) @map("id_progreso")
  idUsuario         Int       @unique @map("id_usuario")
  puntosTotales     Int       @default(0) @map("puntos_totales")
  rachaActual       Int       @default(0) @map("racha_actual")  @db.SmallInt
  rachaMaxima       Int       @default(0) @map("racha_maxima")  @db.SmallInt
  diasComodin       Int       @default(2) @map("dias_comodin")  @db.SmallInt
  ultimaFechaActiva DateTime? @map("ultima_fecha_activa") @db.Date   // +
  semanaComodin     String?   @map("semana_comodin") @db.VarChar(8)  // + "2026-W41"
  usuario Usuario @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  @@map("progreso")
}

model IdempotencyKey {                                             // + (reintentos offline, RNF-09)
  clave       String   @id @db.VarChar(100)   // "<idUsuario>:<Idempotency-Key>"
  metodoRuta  String   @map("metodo_ruta") @db.VarChar(120)
  codigo      Int                                // status HTTP devuelto
  respuesta   Json
  creadaEn    DateTime @default(now()) @map("creada_en")
  @@index([creadaEn])
  @@map("idempotency_key")
}

model Insignia {
  idInsignia  Int    @id @default(autoincrement()) @map("id_insignia")
  codigo      String @unique @db.VarChar(40)                       // +
  nombre      String @db.VarChar(60)
  descripcion String @db.VarChar(160)
  criterio    String @db.VarChar(120)
  usuarios    UsuarioInsignia[]
  @@map("insignia")
}

model UsuarioInsignia {
  idUsuario      Int      @map("id_usuario")
  idInsignia     Int      @map("id_insignia")
  fechaObtencion DateTime @default(now()) @map("fecha_obtencion") @db.Date
  usuario  Usuario  @relation(fields: [idUsuario], references: [idUsuario], onDelete: Cascade)
  insignia Insignia @relation(fields: [idInsignia], references: [idInsignia], onDelete: Cascade)
  @@id([idUsuario, idInsignia])
  @@map("usuario_insignia")
}
```

> **Nota Prisma/PostgreSQL `TIME`:** Prisma devuelve `Date` (1970-01-01THH:mm:ss). Crear `common/utils/time.ts` con `parseHHmm(str): Date` y `formatHHmm(date): string`. **La API siempre expone horas como `"HH:mm"`** y fechas como `"YYYY-MM-DD"`.

---

## 5. Convenciones de la API

- **Base URL:** `/api/v1` · **Formato:** JSON UTF-8 · **JSON en `camelCase`** (`horaDormir`, `metaHorasSueno`).
- **Auth:** `Authorization: Bearer <accessToken>` en todo excepto `/auth/registro`, `/auth/login`, `/auth/refresh`, `/health`.
- **Zona horaria:** las fechas/horas del usuario son *locales* (sin zona) y se interpretan en `APP_TZ=America/Bogota`. Los instantes (`fechaHoraEnvio`, `fechaRegistro`) se guardan y serializan en ISO-8601 UTC. **Nunca usar `new Date()` para decidir "hoy"**: usar `hoyEnZona()` de `utils/dates.ts`, porque Vercel corre en UTC (entre las 19:00 y 23:59 de Bogotá, UTC ya es el día siguiente).
- **Códigos:** `200` OK · `201` creado (+ `Location`) · `204` sin contenido (DELETE) · `400` validación · `401` no autenticado · `403` sin rol · `404` no existe/no es suyo · `409` conflicto (duplicado) · `422` regla de negocio · `429` rate limit.
- **Errores (RFC 7807, `application/problem+json`):**
  ```json
  { "type": "https://vitalify.app/errors/validation", "title": "Datos inválidos",
    "status": 400, "detail": "horaFin debe ser posterior a horaInicio",
    "errors": [{ "campo": "horaFin", "mensaje": "..." }] }
  ```
- **Paginación** (listados): `?page=1&pageSize=20` (máx. 100) → `{ "data": [...], "meta": { "page":1, "pageSize":20, "total":57 } }`.
- **Filtros por rango de fechas:** `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.
- **Idempotencia (soporte offline, RNF-09):** `POST`/`PATCH` de registros (`registros-sueno`, estado de `micro-pausas`) aceptan el header opcional `Idempotency-Key`. La respuesta se guarda en la tabla `idempotency_key` (no en memoria) durante 24 h; un reenvío con la misma clave devuelve la respuesta guardada sin repetir efectos.

---

## 6. Endpoints (CRUD por módulo)

Leyenda: 🔓 público · 🔒 usuario autenticado · 🛡️ solo `admin`.

### 6.1 Auth — RF-01
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | 🔓 | Crea cuenta. Body: `{ nombre, correo, contrasena, aceptaDatos }`. `aceptaDatos` debe ser `true` (422 si no). Crea también `Progreso` y `ConfigNotificacion` por defecto (3 tipos). Responde `201` con usuario + tokens. |
| POST | `/auth/login` | 🔓 | `{ correo, contrasena }` → `{ accessToken, refreshToken, usuario }`. Mensaje genérico en fallo (401). |
| POST | `/auth/refresh` | 🔓 | `{ refreshToken }` → nuevo par (rotación; el anterior queda revocado). |
| POST | `/auth/logout` | 🔒 | `{ refreshToken }` → revoca. `204`. |

Reglas: contraseña ≥ 8 caracteres, con letra y número; correo único (409); rate limit estricto en login (5/min/IP).

### 6.2 Usuarios (cuenta propia)
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/usuarios/me` | 🔒 | Datos de la cuenta (sin hash). |
| PATCH | `/usuarios/me` | 🔒 | Actualiza `nombre`, `correo`, `contrasena` (exige `contrasenaActual` para cambiarla). |
| DELETE | `/usuarios/me` | 🔒 | Elimina la cuenta y **todos** sus datos (derecho de supresión, Ley 1581). `204`. |
| GET | `/usuarios/me/exportar` | 🔒 | Descarga JSON con todos los datos del usuario (derecho de acceso). |

### 6.3 Perfil de hábitos — RF-02 (relación 1:1)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/perfil` | Crea perfil. `409` si ya existe. |
| GET | `/perfil` | Obtiene perfil (`404` si aún no existe). |
| PUT | `/perfil` | Reemplaza perfil. |
| PATCH | `/perfil` | Actualización parcial. |
| DELETE | `/perfil` | Elimina perfil. |

Body: `{ horaDormir: "22:45", horaDespertar: "06:15", metaHorasSueno: 7.5, metaMinActividad: 150 }`
Validaciones: `metaHorasSueno` ∈ [4, 12] (paso 0.5); `metaMinActividad` ∈ [0, 1500]. Defaults sugeridos en la respuesta de `404`/docs: 7.5 h y 150 min (recomendación OMS citada en el entregable: 150–300 min/sem y 7–9 h/día).

### 6.4 Bloques de horario — RF-03
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/bloques` | Crea un bloque. |
| GET | `/bloques` | Lista (filtros `tipo`, `diaSemana`). |
| GET | `/bloques/:id` | Detalle. |
| PUT | `/bloques/:id` | Reemplaza. |
| PATCH | `/bloques/:id` | Parcial. |
| DELETE | `/bloques/:id` | Elimina. `204`. |
| POST | `/bloques/importar` | Importación por lote (`origen=importado`). Body: `{ bloques: [...] }` (máx. 200). Atómico: todo o nada. |

Body: `{ tipo: "estudio", titulo: "Clase de Cálculo", diaSemana: 2, horaInicio: "07:00", horaFin: "09:00" }`
Validaciones: `horaFin > horaInicio` (sin cruzar medianoche en MVP); `diaSemana` 1–7. **Los bloques pueden solaparse** (se fusionan al calcular ventanas); no es error.
Efecto secundario: toda mutación dispara `MicroVentanasService.recalcular(usuario, próximos 7 días)` (RNF-03).

### 6.5 Micro-ventanas — RF-04
Son **derivadas**: las genera el sistema, el usuario no las crea a mano.
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/micro-ventanas/recalcular` | Body opcional `{ desde, hasta }` (por defecto hoy → +6 días; máx. 31 días). Responde `{ generadas, eliminadas, conservadas }`. |
| GET | `/micro-ventanas` | Lista con filtros `desde`, `hasta`, `conPausa` (bool). |
| GET | `/micro-ventanas/:id` | Detalle (incluye `microPausa` si existe). |
| DELETE | `/micro-ventanas/:id` | Descarta una ventana (cascada a su micro-pausa). `204`. |

### 6.6 Micro-pausas activas — RF-05, RF-07
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/micro-ventanas/:idVentana/micro-pausa` | Genera la **recomendación** para esa ventana (algoritmo §7.2). Body opcional `{ idActividad }` para forzar una actividad (debe caber). `409` si la ventana ya tiene pausa. `201`. |
| GET | `/micro-pausas` | Lista (filtros `estado`, `desde`, `hasta`). Incluye `ventana` y `actividad`. |
| GET | `/micro-pausas/hoy` | Atajo: pausas de hoy ordenadas por hora (pantalla "Hoy" del mockup). |
| GET | `/micro-pausas/:id` | Detalle. |
| PATCH | `/micro-pausas/:id` | `{ estado: "hecha" \| "omitida" \| "pendiente" }` → fija `fechaRegistro = now()`. Si pasa a `hecha` dispara gamificación (§7.4). Respuesta incluye `{ puntosGanados, rachaActual, insigniasNuevas[] }`. |
| PUT | `/micro-pausas/:id` | Cambia `idActividad` (solo si `estado=pendiente` y cabe en la ventana). |
| DELETE | `/micro-pausas/:id` | Elimina. Si estaba `hecha`, **no** se revierten puntos (supuesto S-09). |

RNF-02: marcar como hecha = **1 llamada** (`PATCH` con un campo).

### 6.7 Actividades (catálogo)
| Método | Ruta | Acceso |
|---|---|---|
| GET | `/actividades` | 🔒 (filtros `categoria`, `maxDuracionMin`) |
| GET | `/actividades/:id` | 🔒 |
| POST | `/actividades` | 🛡️ |
| PUT / PATCH | `/actividades/:id` | 🛡️ |
| DELETE | `/actividades/:id` | 🛡️ (`409` si tiene micro-pausas asociadas) |

Validaciones: `duracionMin` ∈ [1, 15]; `categoria` ∈ {`estiramiento`, `caminata`, `bajo_impacto`}.

### 6.8 Sueño — RF-06, RF-07
**Registro de sueño**
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/registros-sueno` | `{ fecha, horasDormidas }` → `201`; `409` si ya hay registro ese día. |
| GET | `/registros-sueno` | Lista (`desde`, `hasta`). |
| GET | `/registros-sueno/:id` | Detalle. |
| PUT | `/registros-sueno/:id` | Reemplaza `horasDormidas`/`fecha`. |
| DELETE | `/registros-sueno/:id` | Elimina. |

Validación: `horasDormidas` ∈ [0, 16], paso 0.5; `fecha` no futura.

**Recomendación de higiene del sueño**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/sueno/recomendacion?fecha=YYYY-MM-DD` | Calcula hora sugerida para acostarse (§7.3). Por defecto, el día de hoy (noche que sigue). Responde `{ horaSugeridaAcostarse, primeraActividad: {titulo, horaInicio}, horasDeSuenoLogradas, checklist: [...] }`. |

### 6.9 Recordatorios — RF-06
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/recordatorios/generar` | `{ fecha }` genera (idempotente) los recordatorios de sueño y de pausas de ese día respetando `ConfigNotificacion`. |
| GET | `/recordatorios` | Lista (`tipo`, `enviado`, `desde`, `hasta`). |
| GET | `/recordatorios/:id` | Detalle. |
| GET | `/recordatorios/pendientes?horas=24` | Recordatorios no enviados de las próximas *n* horas (máx. 72), filtrados por `ConfigNotificacion`. **Es lo que la app móvil usa para programar notificaciones locales** (S-15). |
| PATCH | `/recordatorios/:id` | Edita `mensaje` / `fechaHoraEnvio` (solo si `enviado=false`) o marca `{ "enviado": true }` como acuse del cliente. |
| DELETE | `/recordatorios/:id` | Elimina. |

### 6.10 Configuración de notificaciones — RF-10
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/config-notificaciones` | Los 3 tipos (`sueno`, `pausa`, `logros`) con su estado. |
| POST | `/config-notificaciones` | Crea config para un `tipo` (409 si existe). |
| GET | `/config-notificaciones/:tipo` | Detalle. |
| PUT | `/config-notificaciones/:tipo` | `{ activa, silencioInicio, silencioFin }`. Se permite horario de silencio que cruza medianoche (22:00→07:00). |
| DELETE | `/config-notificaciones/:tipo` | Restablece a valores por defecto (`activa=true`, sin silencio). |

### 6.11 Progreso y gamificación — RF-08, RF-09
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/progreso` | `{ puntosTotales, rachaActual, rachaMaxima, diasComodin, ultimaFechaActiva }`. |
| GET | `/progreso/semanal?semana=YYYY-MM-DD` | Resumen de la semana ISO que contiene esa fecha (default: actual). Ver §7.5. |
| GET | `/insignias` | Catálogo con campo `obtenida` + `fechaObtencion` para el usuario. |
| GET | `/usuarios/me/insignias` | Solo las obtenidas. |
| POST / PUT / DELETE | `/insignias`, `/insignias/:id` | 🛡️ CRUD del catálogo. |

`Progreso` es **solo lectura** para el cliente: se modifica exclusivamente por reglas de negocio.

### 6.12 Utilidad
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | `{ status: "ok", db: "up" }` (liveness/readiness). |
| GET | `/docs` | Swagger UI (assets desde CDN). |
| GET | `/openapi.json` | Especificación OpenAPI 3.1 (la usa también JMeter/Postman). |
| GET | `/jobs/generar-recordatorios` | 🤖 Solo Vercel Cron (`Authorization: Bearer ${CRON_SECRET}`; `401` si no coincide). Ver §7.7. |
| GET | `/jobs/limpieza` | 🤖 Solo Vercel Cron. Borra `idempotency_key` > 24 h y `refresh_token` vencidos/revocados. |

---

## 7. Reglas de negocio y algoritmos

Implementar como **funciones puras** en `*.service` o `*.domain.ts` para poder testearlas sin BD.

### 7.1 Detección de micro-ventanas (RF-04, RNF-03)
Para cada `fecha` en el rango:
1. Tomar los bloques con `diaSemana == isoWeekday(fecha)`; **fusionar solapados** y ordenar por `horaInicio`.
2. Definir el intervalo despierto: `[horaDespertar, horaDormir]` del perfil. Si no hay perfil → `422` ("Configura tu perfil primero").
3. Calcular los **huecos** entre el inicio del día despierto, cada bloque y el fin del día despierto.
4. Por cada hueco con `duración ≥ 5 min`: crear una `MicroVentana` con `horaInicio = inicio del hueco` y `duracionMin = min(duración, 15)` (S-03).
5. **Reconciliar** contra las existentes: eliminar ventanas obsoletas sin pausa; **conservar** las que ya tienen `micro_pausa` en estado `hecha`/`omitida` (historial) y las `pendiente` que sigan siendo válidas; insertar las nuevas (usar `@@unique`).
6. Rendimiento: ≤ 200 ms para 7 días y ≤ 30 bloques (test de humo).

### 7.2 Recomendación de micro-pausa (RF-05)
1. Candidatas: `Actividad` con `duracionMin ≤ ventana.duracionMin`.
2. Ordenar por `ventana.duracionMin − actividad.duracionMin` ascendente (la que mejor aprovecha el tiempo).
3. Excluir la actividad usada en la **última** micro-pausa del usuario (variedad) si hay otra candidata.
4. Desempate aleatorio con *seed* inyectable (para tests deterministas).
5. Sin candidatas → `422`.

### 7.3 Hora sugerida para acostarse (RF-06)
```
primeraActividad(D+1) = bloque con menor horaInicio del día D+1
horaDespertarNecesaria = primeraActividad.horaInicio − MARGEN_PREPARACION   (default 45 min)
horaAcostarse          = horaDespertarNecesaria − perfil.metaHorasSueno
```
Ejemplo del mockup: primera actividad 07:00, margen 0:45, meta 7 h 30 → despertar 06:15 → acostarse **22:45**. ✔
- Si el día siguiente no tiene bloques → usar `perfil.horaDormir`.
- `checklist` (pantalla "Antes de dormir"): `[{texto:"Deja las pantallas", hora: acostarse − 30 min}, {texto:"Prepara lo de mañana", hora: acostarse − 45 min}, {texto:"Última cafeína antes de las 16:00"}]`.
- Recordatorios de tipo `sueno`: uno a `acostarse − 30 min` (pantallas) y otro a `acostarse`.
- Recordatorios de tipo `pausa`: uno `5 min` antes de cada micro-pausa `pendiente`.

### 7.4 Gamificación tolerante (RF-08)
Constantes en `config/gamificacion.ts`: `PUNTOS_PAUSA=10`, `PUNTOS_SUENO_META=5`, `COMODINES_SEMANA=2`.
- **Día activo** = al menos 1 micro-pausa `hecha` ese día.
- Al marcar una pausa `hecha` (solo la primera del día mueve la racha; las demás solo suman puntos):
  1. `puntosTotales += 10`.
  2. Si `semanaComodin ≠ semana ISO actual` → `diasComodin = 2`, `semanaComodin = actual` (reinicio perezoso semanal).
  3. `diasPerdidos = diasEntre(ultimaFechaActiva, hoy) − 1`.
     - `ultimaFechaActiva` nulo → `rachaActual = 1`.
     - `diasPerdidos ≤ 0` → `rachaActual += 1`.
     - `0 < diasPerdidos ≤ diasComodin` → `diasComodin −= diasPerdidos`; `rachaActual += 1` (**no se reinicia**).
     - `diasPerdidos > diasComodin` → `rachaActual = 1` (reinicio solo si se agotan comodines).
  4. `rachaMaxima = max(rachaMaxima, rachaActual)`; `ultimaFechaActiva = hoy`.
- Registrar sueño con `horasDormidas ≥ metaHorasSueno` → `+5` puntos (una vez por fecha).
- Tras cada cambio, evaluar **insignias** (§7.6) y devolver las nuevas.
- Toda operación de gamificación en **una transacción**.

### 7.5 Resumen semanal (RF-09)
Semana ISO (lunes–domingo) que contiene `semana`:
```json
{
  "semana": { "inicio": "2026-10-05", "fin": "2026-10-11" },
  "sueno": {
    "promedioHoras": 6.8, "metaHoras": 7.5,
    "porDia": [{ "fecha": "2026-10-05", "horas": 7.0 }, "..."]
  },
  "actividad": {
    "minutosAcumulados": 96, "metaMinutos": 150, "porcentajeMeta": 64,
    "pausasHechas": 14, "pausasOmitidas": 3
  },
  "racha": { "actual": 4, "comodinesRestantes": 1 },
  "insignias": [{ "codigo": "PRIMERA_SEMANA", "nombre": "Primera semana" }]
}
```
`minutosAcumulados` = suma de `actividad.duracionMin` de las micro-pausas `hecha` de la semana. `promedioHoras` promedia solo los días con registro (`null` si no hay ninguno).

### 7.6 Insignias (seed)
| `codigo` | Nombre | Criterio |
|---|---|---|
| `PRIMERA_SEMANA` | Primera semana | ≥ 7 días activos acumulados |
| `DIEZ_PAUSAS` | 10 pausas | ≥ 10 micro-pausas `hecha` en total |
| `SUENO_7H_5N` | 7 h por 5 noches | ≥ 5 noches con ≥ 7 h en una misma semana ISO |

Implementar como estrategia por `codigo` (`Record<string, (ctx) => boolean>`), idempotente (`PK compuesta` evita duplicados).

### 7.7 Recordatorios y tareas programadas (Vercel Cron)
En el plan **Hobby** de Vercel los cron jobs solo pueden ejecutarse **una vez al día** y con precisión de ±59 min; un despacho "cada minuto" no es viable. Por eso el diseño es:

1. **Generación diaria (servidor):** Vercel Cron llama `GET /api/v1/jobs/generar-recordatorios` a las `0 9 * * *` UTC (04:00 Bogotá, aunque puede ejecutarse hasta 04:59). El job genera los recordatorios del día para cada usuario con perfil, procesando **por lotes de 100 usuarios** y siendo **idempotente** (si se ejecuta dos veces no duplica: clave natural `idUsuario + tipo + fechaHoraEnvio`).
2. **Entrega (cliente):** la app móvil consulta `GET /recordatorios/pendientes` al abrirse o al sincronizar y **programa notificaciones locales** en el dispositivo; luego hace `PATCH { enviado: true }`. Esto además ahorra batería (RNF-04) y funciona sin conexión (RNF-09).
3. **Generación bajo demanda:** cualquier cambio en bloques, perfil o micro-pausas regenera los recordatorios del día afectado dentro de la misma petición (no se espera al cron).
4. **Respeto de configuración:** no se generan recordatorios de un tipo con `activa=false`, y los que caen en horario de silencio se mueven al final del silencio o se descartan si ya no tienen sentido (p. ej., una pausa ya pasada).
5. **Push del servidor (futuro):** `NotificationSender` queda como interfaz con implementación `LogSender`. Si se quiere envío push real con precisión de minutos, se requiere Vercel Pro (cron por minuto) o un programador externo que llame un endpoint protegido.

`vercel.json` (los cron jobs solo corren sobre el despliegue de **Production**):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/v1/jobs/generar-recordatorios", "schedule": "0 9 * * *" },
    { "path": "/api/v1/jobs/limpieza",              "schedule": "30 8 * * *" }
  ]
}
```

---

## 8. Requisitos no funcionales → decisiones técnicas

| RNF | Cómo se cubre en la API |
|---|---|
| RNF-01 Usabilidad (configuración sin ayuda) | Respuestas `404` de `/perfil` y `422` de ventanas incluyen `hint` claro del siguiente paso; defaults documentados; errores en español. |
| RNF-02 Mínima interacción | `PATCH /micro-pausas/:id` con un solo campo; `GET /micro-pausas/hoy`. |
| RNF-03 Recalcular rápido | Recalculo incremental (7 días) tras cada cambio de bloque; algoritmo O(n log n); índices en `bloque_horario(id_usuario, dia_semana)`. **Verificado con JMeter** (§19): p95 de `POST /bloques` ≤ 800 ms en el escenario de carga. |
| RNF-04 Batería | La app programa notificaciones locales con `/recordatorios/pendientes` en lugar de mantener conexiones abiertas; payloads ligeros y `ETag` en listados de lectura frecuente. |
| RNF-05 Compatibilidad iOS/Android | API REST agnóstica; CORS configurable por `.env`; versionada en `/api/v1`. |
| RNF-06 Seguridad en tránsito/reposo | HTTPS automático en `*.vercel.app` (HSTS con `helmet`); `bcryptjs`; refresh tokens guardados como hash SHA-256; conexión a Neon con `sslmode=require` y cifrado en reposo del proveedor; secretos solo en *Environment Variables* de Vercel. |
| RNF-07 Ley 1581/2012 | `aceptaDatos` obligatorio; `GET /usuarios/me/exportar` y `DELETE /usuarios/me`; logs sin PII; minimización de datos; `docs/PRIVACIDAD.md` con finalidad y tratamiento. |
| RNF-08 Disponibilidad | Escalado automático de Vercel Functions; `/health` para monitoreo externo; jobs idempotentes y tolerantes a ejecuciones tardías o repetidas; entrega de recordatorios en el dispositivo (no depende de que el servidor "despierte" a tiempo). |
| RNF-09 Uso sin conexión | `Idempotency-Key` + endpoints de lote permiten al cliente sincronizar cambios acumulados offline. |
| RNF-10 Mantenibilidad | Estructura modular (§3), capas, tests unitarios sobre funciones puras, ESLint/Prettier, CI y **Quality Gate de SonarQube** (§18) como criterio de merge. |

---

## 9. Seguridad (checklist)

- [ ] Validación Zod en **todo** body/query/params; rechazar campos desconocidos (`.strict()`).
- [ ] Autorización por propiedad en cada consulta (`where: { idUsuario }`).
- [ ] `requireRole('admin')` en escritura de `actividades` e `insignias`.
- [ ] Rate limiting global (100/min por usuario/IP) y específico en `/auth/*`, con store **Upstash Redis** (en serverless cada instancia tiene su propia memoria, así que un store en memoria no limita nada).
- [ ] Endpoints `/jobs/*` protegidos con `CRON_SECRET` (comparación en tiempo constante).
- [ ] `RATE_LIMIT_ENABLED=false` solo permitido cuando `APP_ENV=perf`; la app debe negarse a arrancar si se desactiva en `production`.
- [ ] `helmet`, CORS con lista blanca, límite de body 100 kB (1 MB en `/bloques/importar`).
- [ ] Sin secretos en el repo; `.env.example` completo; secretos de producción solo en Vercel (*Environment Variables* por entorno).
- [ ] Errores 500 sin stack trace en producción.
- [ ] Prevención de enumeración de usuarios en login/registro (mensajes genéricos donde aplique).

---

## 10. Datos semilla (`prisma/seed.ts`)

**Usuarios:** `admin@vitalify.dev` (rol `admin`) y `demo@vitalify.dev` (rol `user`, con perfil, bloques de ejemplo y progreso). Contraseñas desde variables de entorno, nunca fijas en código.

**Actividades (mínimo 8):**
| Nombre | Categoría | Min |
|---|---|---|
| Estiramiento de cuello y hombros | estiramiento | 6 |
| Estiramiento de espalda baja | estiramiento | 5 |
| Rotación de muñecas y tobillos | estiramiento | 5 |
| Caminata corta | caminata | 10 |
| Subir y bajar escaleras | bajo_impacto | 8 |
| Sentadillas suaves | bajo_impacto | 7 |
| Respiración y movilidad torácica | estiramiento | 5 |
| Caminata activa | caminata | 15 |

(`instrucciones` en pasos numerados, como en el mockup "Cómo hacerlo".)

**Insignias:** las 3 de §7.6.

---

## 11. Estrategia de pruebas

| Nivel | Qué cubre | Mínimo |
|---|---|---|
| Unitarias (puras) | `detectarMicroVentanas`, `recomendarActividad`, `calcularHoraAcostarse`, `actualizarRacha`, `evaluarInsignias`, utilidades de tiempo | Cobertura ≥ 90 % en esas funciones |
| Integración (Supertest + PostgreSQL) | Auth completo, CRUD de cada módulo, aislamiento entre usuarios, flujo end-to-end | 1 camino feliz + 1 error por endpoint |
| Contrato | La respuesta de cada endpoint valida contra el esquema OpenAPI | Todos |
| Estático | SonarQube Quality Gate (§18) | Aprobado en cada PR |
| Rendimiento | JMeter: smoke, carga, estrés y pico (§19) | Antes de cada entrega del curso |

**Casos obligatorios de algoritmos:**
- Ventanas: sin bloques; bloques solapados; hueco de 4 min (no genera); hueco de 40 min (genera 1 de 15); bloque que llena todo el día; recálculo conserva pausas `hecha`.
- Racha: primer día; día consecutivo; 1 día perdido con comodín; 3 días perdidos con 2 comodines (reinicia); cambio de semana restablece comodines; segunda pausa del mismo día no altera racha.
- Sueño: ejemplo del mockup (07:00 → 22:45); día siguiente sin bloques → `horaDormir`.
- Aislamiento: usuario B recibe `404` al pedir recursos de A en **todos** los módulos.

---

## 12. Variables de entorno (`.env.example`)

```
APP_ENV=local                 # local | test | perf | preview | production
PORT=3000                     # solo src/local.ts
APP_TZ=America/Bogota
DATABASE_URL=postgresql://vitalify:vitalify@localhost:5432/vitalify      # en Vercel: URL con pooling de Neon
DIRECT_URL=postgresql://vitalify:vitalify@localhost:5432/vitalify        # en Vercel: URL directa de Neon
JWT_ACCESS_SECRET=cambia-esto
JWT_REFRESH_SECRET=cambia-esto-tambien
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_COST=12
CORS_ORIGINS=http://localhost:5173
CRON_SECRET=                  # Vercel lo envía como Authorization: Bearer <CRON_SECRET>
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_ENABLED=true
SEED_ADMIN_PASSWORD=
SEED_DEMO_PASSWORD=
PERF_USERS=500                # seed-perf.ts
PERF_USER_PASSWORD=
MARGEN_PREPARACION_MIN=45
```

En Vercel se configuran por entorno (**Production**, **Preview**, **Development**). Preview debe apuntar a una **rama de base de datos distinta** (Neon branching) para no tocar datos de producción.

---

## 13. Plan de implementación por fases

La calidad (SonarQube) y el despliegue (Vercel) se configuran **desde la Fase 1** (*shift-left*): es más barato corregir deuda técnica cuando aparece que al final.

| Fase | Entregable | Criterio de aceptación |
|---|---|---|
| **1. Base y pipeline** | Scaffolding, `docker-compose.yml`, Prisma + migración inicial, `/health`, errores RFC 7807, validación de env, OpenAPI base, `ci.yml` (lint + typecheck + tests + SonarQube), `sonar-project.properties`, `vercel.json`, primer despliegue | `/health` responde en local y en `https://<proyecto>.vercel.app/api/v1/health`; Quality Gate aprobado |
| **2. Identidad** | Auth (registro/login/refresh/logout), `usuarios/me` (CRUD + exportar), middlewares auth/roles/rate limit (Upstash) | Tests de auth en verde; hash nunca expuesto; 409 en correo duplicado |
| **3. Perfil y horario** | CRUD `perfil` y `bloques` + importación por lote | Validaciones de rango y orden de horas; aislamiento por usuario |
| **4. Núcleo adaptativo** | Algoritmo de ventanas + `micro-ventanas` + `actividades` (CRUD + seed) + `micro-pausas` (recomendación + PATCH estado) + idempotencia | Casos obligatorios de §11 en verde; recálculo tras modificar bloques |
| **5. Sueño y recordatorios** | `registros-sueno`, `sueno/recomendacion`, `config-notificaciones`, `recordatorios` (+ `pendientes`), `jobs/*` + cron | Ejemplo 07:00 → 22:45 correcto; silencio respetado; job idempotente; `401` sin `CRON_SECRET` |
| **6. Gamificación y progreso** | Racha tolerante, puntos, insignias, `progreso`, `progreso/semanal` | Tests de racha completos; insignias sin duplicados |
| **7. Rendimiento** | `seed-perf.ts`, `docker-compose.perf.yml`, `tests/performance/vitalify.jmx` + escenarios, `docs/RENDIMIENTO.md` | Escenario de carga cumple umbrales de §19.5; punto de quiebre del escenario de estrés documentado |
| **8. Cierre** | Revisión de seguridad (§9), README (local, Vercel, SonarQube, JMeter), `docs/PRIVACIDAD.md` | Checklist §9 completo; cobertura global ≥ 80 %; 0 *issues* bloqueantes/críticos en SonarQube |

**Definition of Done global:** lint, typecheck y tests en verde; Quality Gate de SonarQube aprobado; OpenAPI actualizado; despliegue de Preview funcionando; README con pasos para correr en local en < 5 minutos.

---

## 14. Supuestos y desviaciones respecto al Entregable 2

| ID | Supuesto / desviación | Justificación |
|---|---|---|
| S-01 | Se añade `rol` a `USUARIO`. | El catálogo de actividades e insignias necesita administración; el ER no define quién lo gestiona. |
| S-02 | Se añade la tabla `REFRESH_TOKEN`. | RF-01 exige *cerrar sesión*; con JWT puro no se puede revocar. |
| S-03 | De un hueco libre ≥ 5 min se crea **una** micro-ventana de `min(hueco, 15)` min. | RF-04 dice "entre 5 y 15 min"; no define qué hacer con huecos mayores. |
| S-04 | RF-03: la importación desde Google/Outlook se sustituye por `POST /bloques/importar` (JSON). | OAuth con terceros excede el alcance del MVP del módulo; el endpoint de lote es el contrato que usaría un conector futuro. |
| S-05 | `INSIGNIA.codigo` (único) añadido. | Permite enlazar cada insignia con su regla de evaluación de forma estable. |
| S-06 | `PROGRESO.ultimaFechaActiva` y `semanaComodin` añadidos. | Necesarios para implementar la racha tolerante con `diasComodin` (RF-08). |
| S-07 | Unicidad `(idUsuario, fecha)` en `REGISTRO_SUENO` y `(idUsuario, tipo)` en `CONFIG_NOTIFICACION`. | Evita duplicados; el ER no lo declara pero la lógica lo exige. |
| S-08 | `diasComodin` = 2 por semana ISO; se reinicia de forma perezosa. | El entregable dice "no reiniciar la racha completa" sin cuantificar la tolerancia. |
| S-09 | Borrar una micro-pausa `hecha` no revierte puntos. | Evita manipulación y reglas de reversión complejas en el MVP. |
| S-10 | Margen de preparación matinal = 45 min (configurable). | Reproduce exactamente el ejemplo del mockup (07:00 → 22:45 con meta 7 h 30). |
| S-11 | Bloques no cruzan medianoche; un turno nocturno se registra como dos bloques. | Simplifica el MVP; documentado como mejora futura. |
| S-12 | `horaDormir`/`horaDespertar` definen el día "despierto" para detectar ventanas. | El entregable no precisa el intervalo en el que se buscan micro-ventanas. |
| S-13 | Envío de notificaciones mediante *stub*. | Integración con FCM/APNs pertenece a la app móvil / fase de producción. |
| S-14 | **PostgreSQL (Neon) en lugar de MySQL.** `TINYINT` → `SMALLINT`; enums nativos de PostgreSQL. | Vercel no ofrece MySQL nativo y Neon se integra desde su Marketplace. Si el curso exige MySQL, usar un MySQL serverless externo compatible con Prisma; el resto de la spec no cambia. |
| S-15 | Los recordatorios se generan en el servidor (cron diario + bajo demanda) y **se entregan como notificaciones locales del dispositivo**. | En Hobby, Vercel Cron solo corre una vez al día; además mejora RNF-04 y RNF-09. |
| S-16 | Docker solo se usa en local y para pruebas de rendimiento. | Vercel no ejecuta contenedores; despliega la app como función. |
| S-17 | Las pruebas de estrés con JMeter **no se ejecutan contra Vercel**, sino contra un entorno local equivalente. | La política de Vercel solo permite pruebas de carga en planes Enterprise (§19.1). |

> **Para el estudiante:** estas desviaciones son decisiones de diseño que conviene **justificar en el informe** (son trazables a RF/RNF). Si el docente espera el ER sin cambios, se pueden retirar S-01, S-05 y S-06 simplificando la lógica (admin por variable de entorno, insignias por `nombre`, racha calculada al vuelo).

---

## 15. Trazabilidad RF → API

| RF | Cubierto por |
|---|---|
| RF-01 Registro e inicio de sesión | `/auth/*`, `/usuarios/me` |
| RF-02 Perfil de hábitos | `/perfil` (CRUD) |
| RF-03 Carga del horario semanal | `/bloques` (CRUD) + `/bloques/importar` |
| RF-04 Detección de micro-ventanas | `/micro-ventanas/*` + §7.1 |
| RF-05 Recomendación de micro-pausas | `/micro-ventanas/:id/micro-pausa`, `/actividades`, §7.2 |
| RF-06 Recordatorios de higiene del sueño | `/sueno/recomendacion`, `/recordatorios`, §7.3, §7.7 |
| RF-07 Registro de cumplimiento | `PATCH /micro-pausas/:id`, `/registros-sueno` |
| RF-08 Gamificación tolerante | `/progreso`, `/insignias`, §7.4, §7.6 |
| RF-09 Panel de progreso | `/progreso/semanal`, §7.5 |
| RF-10 Configuración de notificaciones | `/config-notificaciones` (CRUD) |

### Cobertura CRUD por entidad del ER

| Entidad | C | R | U | D | Notas |
|---|:-:|:-:|:-:|:-:|---|
| USUARIO | ✔ `/auth/registro` | ✔ | ✔ | ✔ | Solo cuenta propia |
| PERFIL_HABITOS | ✔ | ✔ | ✔ | ✔ | 1:1 |
| BLOQUE_HORARIO | ✔ | ✔ | ✔ | ✔ | + lote |
| MICRO_VENTANA | ✔ (derivada) | ✔ | — | ✔ | Generada por el sistema |
| MICRO_PAUSA | ✔ (recomendación) | ✔ | ✔ | ✔ | Estado vía PATCH |
| ACTIVIDAD | ✔ 🛡️ | ✔ | ✔ 🛡️ | ✔ 🛡️ | Catálogo |
| REGISTRO_SUENO | ✔ | ✔ | ✔ | ✔ | |
| RECORDATORIO | ✔ (generar) | ✔ | ✔ | ✔ | |
| CONFIG_NOTIFICACION | ✔ | ✔ | ✔ | ✔ | |
| PROGRESO | auto | ✔ | auto | auto | Solo reglas de negocio |
| INSIGNIA | ✔ 🛡️ | ✔ | ✔ 🛡️ | ✔ 🛡️ | Catálogo |
| USUARIO_INSIGNIA | auto | ✔ | — | auto | Otorgada por reglas |

---

## 16. Flujo de calidad y despliegue

```mermaid
flowchart LR
    A[Commit / PR en GitHub] --> B[GitHub Actions<br/>lint · typecheck · tests + cobertura]
    B --> C[SonarQube<br/>análisis + Quality Gate]
    A --> D[Vercel Preview<br/>URL por PR]
    C -- Gate aprobado --> E[Merge a main]
    E --> F[Vercel Production<br/>*.vercel.app + Cron]
    G[Entorno perf local<br/>docker-compose.perf.yml] --> H[JMeter<br/>carga · estrés · pico]
    H --> I[docs/RENDIMIENTO.md]
```

Regla de rama: proteger `main` en GitHub exigiendo que el job `ci` y el Quality Gate pasen antes de permitir el merge. Así, Vercel solo despliega a Production código que ya pasó SonarQube.

---

## 17. Despliegue en Vercel

### 17.1 Cómo ejecuta Vercel esta API
- Vercel detecta Express y empaqueta toda la app como **una sola Vercel Function** con *Fluid compute*. El archivo detectado es `src/app.ts`, que exporta `export default app` y **no** llama `listen`.
- Las rutas quedan en `https://<proyecto>.vercel.app/api/v1/...`.
- Una instancia puede atender varias peticiones y puede desaparecer en cualquier momento. Por eso no hay estado en memoria (§0, regla 7).
- **Arranque en frío (*cold start*):** la primera petición tras un periodo inactivo tarda más. Mitigaciones: crear el `PrismaClient` una sola vez a nivel de módulo, imports livianos y evitar trabajo pesado al cargar el módulo.

### 17.2 Requisitos de código específicos
| Tema | Requisito |
|---|---|
| Entry | `src/app.ts` con `export default app`; `src/local.ts` hace `listen` solo en local (`npm run dev`). |
| Prisma | Singleton en `common/db/prisma.ts` (guardado en `globalThis` en desarrollo); `prisma generate` en el `build`/`postinstall`. |
| Conexiones | `DATABASE_URL` con pooling (Neon) para evitar agotar conexiones cuando Vercel escala a muchas instancias. |
| Migraciones | `prisma migrate deploy` con `DIRECT_URL` desde GitHub Actions (job `migrate`, solo en `main`). Migraciones **compatibles hacia atrás** (primero agregar, luego eliminar en otra versión), porque código viejo y nuevo pueden convivir unos segundos. |
| Archivos estáticos | No usar `express.static`; Swagger UI se carga desde CDN. |
| Errores | El handler global responde RFC 7807 y registra con `pino`; nunca deja la promesa sin resolver (la función quedaría colgada hasta el *timeout*). |
| Duración | Ninguna petición de usuario debe superar 10 s. Los jobs procesan por lotes y paginan. |
| Región | Configurar la región de la función igual (o lo más cercana posible) a la región de la base de datos Neon; la latencia API↔BD domina el tiempo de respuesta. |
| Zona horaria | Todo cálculo de "hoy" con Luxon en `APP_TZ`. |

### 17.3 Configuración en Vercel
1. Importar el repositorio de GitHub en Vercel (framework detectado: Express).
2. Desde **Marketplace**, agregar **Neon** (PostgreSQL) y **Upstash** (Redis); Vercel inyecta sus variables de entorno.
3. Definir el resto de variables de §12 en *Settings → Environment Variables* para Production y Preview (`CRON_SECRET` con al menos 32 caracteres aleatorios).
4. Verificar que los cron jobs de `vercel.json` aparezcan en *Settings → Cron Jobs* (solo se ejecutan en Production).
5. Ejecutar `npm run db:seed` una vez contra Production usando `DIRECT_URL`.

### 17.4 Scripts de `package.json`
```json
{
  "scripts": {
    "dev": "tsx watch src/local.ts",
    "build": "prisma generate && tsc --noEmit",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:seed:perf": "tsx prisma/seed-perf.ts",
    "perf:up": "docker compose -f docker-compose.perf.yml up -d --build",
    "perf:down": "docker compose -f docker-compose.perf.yml down -v"
  }
}
```

---

## 18. Análisis estático con SonarQube

### 18.1 Modalidad
Cualquiera de las dos sirve; la configuración del proyecto es la misma:
- **SonarQube Cloud:** gratuito para repositorios públicos, se integra con GitHub Actions y comenta los PR. Recomendado si el repo es público.
- **SonarQube Community Build (local):** `docker run -d --name sonarqube -p 9000:9000 sonarqube:community`, crear el proyecto en `http://localhost:9000`, generar un token y analizar con `npx @sonar/scan`.

### 18.2 `sonar-project.properties`
```properties
sonar.projectKey=vitalify-api
sonar.projectName=Vitalify API
sonar.sourceEncoding=UTF-8

sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/node_modules/**,prisma/migrations/**,**/*.d.ts
sonar.test.inclusions=tests/**/*.ts
# Las pruebas de JMeter no son código fuente ni pruebas unitarias
sonar.coverage.exclusions=src/local.ts,src/config/**,src/common/openapi/**,tests/performance/**

sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=reports/sonar-report.xml
```

### 18.3 `vitest.config.ts` (lo necesario para Sonar)
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Reporte de ejecución en el formato genérico que lee SonarQube
    reporters: ['default', ['vitest-sonar-reporter', { outputFile: 'reports/sonar-report.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],   // lcov -> coverage/lcov.info
      include: ['src/**/*.ts'],
    },
  },
});
```
> La ruta de los archivos en `lcov.info` debe ser relativa a la raíz del repo; si SonarQube muestra 0 % de cobertura, casi siempre es por rutas que no coinciden.

### 18.4 Quality Gate esperado (sobre código nuevo)
| Métrica | Umbral |
|---|---|
| Cobertura | ≥ 80 % |
| Líneas duplicadas | ≤ 3 % |
| Calificación de Fiabilidad / Seguridad / Mantenibilidad | A |
| *Security Hotspots* revisados | 100 % |

### 18.5 Hallazgos frecuentes que el código debe evitar desde el inicio
| Regla típica de Sonar | Dónde aparecería en Vitalify | Cómo evitarla |
|---|---|---|
| Credenciales en el código | `seed.ts`, tests | Leer contraseñas de variables de entorno; en tests, generarlas. |
| PRNG débil (`Math.random`) como *hotspot* | Desempate en la recomendación (§7.2) | `utils/random.ts` con PRNG con seed inyectable; marcar el hotspot como "Safe" con justificación (no tiene uso de seguridad). |
| Complejidad cognitiva > 15 | `actualizarRacha`, `detectarMicroVentanas` | Dividir en funciones pequeñas puras (fusionar bloques, calcular huecos, recortar a 15 min). |
| Código duplicado | Controladores CRUD casi iguales | Helpers genéricos (`crudController`, paginación, verificación de propiedad). |
| Expresiones regulares vulnerables a ReDoS | Validaciones | Usar validadores de Zod (`.email()`) en lugar de regex propias. |
| Logs con datos sensibles | Auth | `pino` con `redact` para `contrasena`, `authorization`, tokens. |

### 18.6 `.github/workflows/ci.yml` (resumen de lo que debe hacer)
1. Disparadores: `push` a `main` y `pull_request`.
2. Servicio `postgres:16` como *service container* para los tests de integración.
3. Pasos: checkout con `fetch-depth: 0` (Sonar necesita el historial para detectar código nuevo) → setup Node 22 → `npm ci` → `prisma migrate deploy` → `lint` → `typecheck` → `test:coverage`.
4. Análisis: acción oficial de SonarSource para SonarQube con `SONAR_TOKEN` (y `SONAR_HOST_URL` si es servidor propio) en *GitHub Secrets*; esperar el resultado del Quality Gate y fallar el job si no se aprueba.
5. Job `migrate` (solo en `main`, después de `ci`): `prisma migrate deploy` contra Production con `DIRECT_URL`.

---

## 19. Pruebas de rendimiento con Apache JMeter

### 19.1 Dónde se ejecutan (importante)
La política de Vercel solo permite pruebas de carga en planes **Enterprise** y advierte que hacerlas sin aviso puede incumplir su política de uso justo; además, su protección contra DDoS puede bloquear el tráfico de prueba. Por eso:

| Entorno | Qué se ejecuta |
|---|---|
| **Local / perf** (`docker-compose.perf.yml`) | **Todas** las pruebas: carga, estrés, pico y resistencia. |
| **Vercel Preview** | Solo el escenario *smoke* (≤ 5 usuarios, ≤ 1 min) para verificar que la API desplegada responde. Nunca carga ni estrés. |
| **Vercel Production** | Ninguna prueba de JMeter. |

`docker-compose.perf.yml` debe imitar las restricciones de una función serverless: contenedor de la API con `cpus: "1"` y `mem_limit: 1g`, PostgreSQL 16 en otro contenedor, `APP_ENV=perf`, `RATE_LIMIT_ENABLED=false` (para medir la aplicación, no el limitador) y el **mismo** `BCRYPT_COST` que producción.

### 19.2 Conceptos (para el informe)
| Tipo | Pregunta que responde | Forma de la carga |
|---|---|---|
| **Smoke** | ¿Funciona bajo carga mínima? | Pocos usuarios, poco tiempo |
| **Carga (*load*)** | ¿Cumple los umbrales con la carga esperada? | Subida gradual, meseta estable |
| **Estrés (*stress*)** | ¿Dónde se rompe y cómo falla? | Escalones crecientes hasta superar la capacidad |
| **Pico (*spike*)** | ¿Aguanta una avalancha repentina y se recupera? | Salto brusco y caída |
| **Resistencia (*soak*)** | ¿Se degrada con el tiempo (fugas de memoria, conexiones)? | Carga moderada sostenida (opcional) |

Métricas: **throughput** (peticiones/s), **latencia por percentiles** (p50, p90, p95, p99, más representativos que el promedio), **tasa de error** y uso de recursos (CPU/RAM de la API, conexiones activas de PostgreSQL).

### 19.3 Datos de prueba
- `prisma/seed-perf.ts` crea `PERF_USERS` usuarios (`perf_0001@vitalify.test` …) con perfil, 10 a 15 bloques semanales, micro-ventanas y pausas pendientes para los próximos 7 días.
- Exporta `tests/performance/data/usuarios.csv` (`correo,contrasena`) y lo agrega a `.gitignore`.
- Cada hilo de JMeter usa un usuario distinto (*CSV Data Set Config*, `recycle=false`, `stopThread=true`), lo que evita conflictos entre hilos.

### 19.4 Estructura de `tests/performance/vitalify.jmx`
| Elemento JMeter | Configuración |
|---|---|
| Test Plan → *User Defined Variables* | `PROTOCOL=${__P(protocol,http)}`, `HOST=${__P(host,localhost)}`, `PORT=${__P(port,3000)}`, `USERS=${__P(users,10)}`, `RAMP=${__P(ramp,30)}`, `DURATION=${__P(duration,60)}` |
| *HTTP Request Defaults* | Protocolo/host/puerto desde variables; ruta base `/api/v1` |
| *HTTP Header Manager* | `Content-Type: application/json`, `Authorization: Bearer ${accessToken}`, `x-test-run: ${__P(run,local)}` |
| *CSV Data Set Config* | `data/usuarios.csv` → `correo`, `contrasena` |
| *Thread Group* | Hilos `${USERS}`, *ramp-up* `${RAMP}`, duración `${DURATION}` |
| *Once Only Controller* | `POST /auth/login` + *JSON Extractor* `accessToken = $.accessToken` |
| *Throughput Controllers* (mezcla realista) | `GET /micro-pausas/hoy` 30 % · `GET /progreso/semanal` 20 % · `PATCH /micro-pausas/{id}` 15 % (id tomado con *JSON Extractor* de la lista de hoy) · `GET /sueno/recomendacion` 10 % · `POST /registros-sueno` 10 % (fecha aleatoria del último año con `__RandomDate`; 409 se acepta) · `POST /bloques` + `DELETE /bloques/{id}` 15 % (dispara el recálculo, RNF-03) |
| *Uniform Random Timer* | 1 a 3 s entre peticiones (tiempo de "pensar" de un usuario real) |
| *Response Assertion* | Códigos esperados por petición (200/201/204; 409 válido en registros de sueño) |
| *Duration Assertion* | 2000 ms (cualquier respuesta más lenta cuenta como error) |
| Listeners | Ninguno en el `.jmx` final (consumen memoria); los resultados salen por `-l` y `-e -o` |

Los escenarios van en `tests/performance/escenarios/*.properties`:

| Archivo | `users` | `ramp` (s) | `duration` (s) | Notas |
|---|---|---|---|---|
| `smoke.properties` | 5 | 10 | 60 | Único permitido contra Vercel Preview |
| `carga.properties` | 100 | 120 | 600 | Carga esperada |
| `estres.properties` | 400 | 1200 | 1500 | Subida lenta y continua para encontrar el punto de quiebre (alternativa: *Ultimate Thread Group* del plugin *Custom Thread Groups* para escalones de +50 cada 2 min) |
| `pico.properties` | 300 | 5 | 180 | Salto brusco |
| `resistencia.properties` | 50 | 60 | 3600 | Opcional |

### 19.5 Umbrales de aceptación (escenario de carga)
| Métrica | Umbral |
|---|---|
| Tasa de error | < 1 % |
| p95 lecturas (`GET`) | ≤ 500 ms |
| p95 escrituras (`POST`/`PATCH`/`DELETE`) | ≤ 800 ms |
| p95 `POST /auth/login` | ≤ 1500 ms (bcrypt es costoso a propósito) |
| Throughput | Estable durante la meseta (sin caída progresiva) |

En **estrés** no se "aprueba" ni se "reprueba": se documenta el **punto de quiebre** (usuarios a partir de los cuales el error supera 5 % o el p95 supera 2 s), el **primer recurso en saturarse** y si el sistema **se recupera** al bajar la carga.

### 19.6 Ejecución (modo no-GUI)
```bash
npm run perf:up && npm run db:migrate && npm run db:seed && npm run db:seed:perf

jmeter -n -t tests/performance/vitalify.jmx \
  -q tests/performance/escenarios/carga.properties \
  -l tests/performance/resultados/carga.jtl \
  -e -o tests/performance/resultados/carga-reporte

# Smoke contra Vercel Preview (único caso permitido allí)
jmeter -n -t tests/performance/vitalify.jmx \
  -q tests/performance/escenarios/smoke.properties \
  -Jprotocol=https -Jhost=<preview>.vercel.app -Jport=443 -Jrun=smoke-preview \
  -l tests/performance/resultados/smoke-preview.jtl
```
La interfaz gráfica de JMeter se usa solo para **diseñar** el plan; las ejecuciones con carga siempre en modo `-n`. Durante el estrés, monitorear con `docker stats` y con la consulta de conexiones activas de PostgreSQL (`pg_stat_activity`).

### 19.7 Cuellos de botella esperados (hipótesis a verificar)
1. **`POST /auth/login`:** bcrypt con cost 12 consume CPU a propósito; será el primer endpoint en degradarse. Es el comportamiento correcto; se documenta, no se "arregla" bajando el cost.
2. **Pool de conexiones a PostgreSQL:** con muchas peticiones concurrentes, las consultas esperan conexión libre. Ajustar `connection_limit` y usar la URL con pooling.
3. **`POST /bloques`:** el recálculo de micro-ventanas y recordatorios es la escritura más costosa (RNF-03).
4. **`GET /progreso/semanal`:** agrega datos de varias tablas; candidato a índices compuestos por `(id_usuario, fecha)`.

### 19.8 `docs/RENDIMIENTO.md`
Plantilla que Claude Code debe dejar creada: entorno (CPU/RAM, versiones), escenario, tabla de resultados por endpoint (muestras, p50, p95, p99, % error, throughput), gráficas del reporte HTML de JMeter, punto de quiebre, cuello de botella identificado, mejora aplicada y comparación antes/después.

---

## 20. Prompt sugerido para iniciar en Claude Code

```text
Lee spec.md completo. Implementa la Fase 1 siguiendo §2, §3, §4.2, §17 y §18:
scaffolding, Prisma con PostgreSQL, /health, ci.yml con SonarQube,
sonar-project.properties, vercel.json y src/app.ts con export default.
Al terminar, ejecuta lint, typecheck y tests con cobertura, muéstrame el
resultado y espera mi confirmación antes de la Fase 2.
Registra cualquier decisión no cubierta por la spec en docs/DECISIONES.md.
```

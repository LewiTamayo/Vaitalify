# Fase 2 — Identidad · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registro, login, refresh rotatorio y logout con JWT; `GET/PATCH/DELETE /usuarios/me` y `GET /usuarios/me/exportar`; middlewares `requireAuth`, `requireRole` y rate limiting (Upstash en Vercel, memoria en local/test).

**Architecture:** Módulos `auth/` y `usuarios/` en capas `routes → controller → service → repository`. `auth.service` usa `usuarios.service` (nunca su repository). Primitivas de seguridad en `src/common/security/`. Rate limiting detrás de una interfaz `Limitador` inyectable en `createApp()` para que los tests no choquen con los límites.

**Tech Stack (nuevo):** `jose` 6 (JWT HS256, ESM puro) · `bcryptjs` 3 · `@upstash/ratelimit` 2 + `@upstash/redis` 1.

**Spec:** `.claude/spec.md` §0, §5, §6.1, §6.2, §8 (RNF-06/07), §9, §11 · `docs/superpowers/specs/2026-10-17-vitalify-api-design.md` · `docs/DECISIONES.md`.

## Global Constraints

- Todo lo de la Fase 1 sigue vigente (stateless, sin `console.log`, sin `Math.random`, complejidad ≤ 15, problem+json, tests en `tests/`).
- Nunca exponer `contrasenaHash` ni tokens en respuestas (salvo los propios tokens emitidos en registro/login/refresh) ni en logs.
- Access JWT: HS256 con `JWT_ACCESS_SECRET`, TTL `JWT_ACCESS_TTL` (15m), claims `sub` = `String(idUsuario)`, `rol`, `typ: 'access'`.
- Refresh JWT: HS256 con `JWT_REFRESH_SECRET`, TTL `JWT_REFRESH_TTL` (7d), claims `sub`, `jti` (32 bytes aleatorios `crypto.randomBytes` en base64url), `typ: 'refresh'`. En BD se guarda **solo** `sha256(token)` en hex (64 chars) en `refresh_token.token_hash`.
- bcrypt cost = `env.BCRYPT_COST` (12).
- Contraseña: 8–72 **bytes** UTF-8, al menos una letra y un número.
- Correo: `trim().toLowerCase()`, formato `z.email()`, máx. 120.
- Rate limits: login **5/min/IP**; resto de `/auth/*` **10/min/IP**; global **100/min** por usuario (si trae access token válido) o por IP. `429` problem+json `slug=demasiadas-peticiones` con header `Retry-After` (segundos).
- `RATE_LIMIT_ENABLED=false` → middlewares sin efecto (solo permitido en `perf`, ya validado).
- En `preview`/`production` con rate limit activo son obligatorias `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (validación en `env.ts`).
- Integración: cada test registra usuarios con correo único `${randomUUID()}@test.vitalify.dev`; `afterAll` borra `correo LIKE '%@test.vitalify.dev'`.

## Review Focus

1. **Contraseña de más de 72 bytes** (bcrypt trunca en silencio): dos contraseñas que difieren después del byte 72 serían iguales → se rechaza con 400. Test en Task 1 (`validarContrasena`) y Task 4 (registro).
2. **Reutilización de un refresh token ya rotado** (robo de token): debe responder 401 y **revocar todas** las sesiones del usuario. Test en Task 4.
3. **Access token de una cuenta eliminada** (sigue siendo válido 15 min): `GET /usuarios/me` → 401, no 500 ni datos. Test en Task 5.
4. **Correo con mayúsculas/espacios**: `" Ana@Mail.com "` y `"ana@mail.com"` son la misma cuenta (409 al duplicar, login funciona con ambas). Test en Task 4.
5. **IP detrás del proxy de Vercel**: la clave del limitador usa la IP del cliente (`x-forwarded-for`, primer valor; Vercel lo sobrescribe), no la del proxy; una IP bloqueada no bloquea a otra. Test en Task 2.

---

### Task 1: Primitivas de seguridad (contraseñas y tokens)

**Files:**
- Create: `src/common/security/passwords.ts`, `src/common/security/tokens.ts`
- Test: `tests/unit/common/security/passwords.test.ts`, `tests/unit/common/security/tokens.test.ts`

**Interfaces:**
- Produces (`passwords.ts`): `contrasenaSchema: z.ZodString` (8–72 bytes, letra y número; mensajes en español); `hashContrasena(plana: string): Promise<string>`; `verificarContrasena(plana: string, hash: string | null): Promise<boolean>` — si `hash` es `null` compara contra un hash ficticio precalculado perezosamente (mismo coste) y devuelve `false` (tiempo constante frente a enumeración).
- Produces (`tokens.ts`): `type Rol = 'user' | 'admin'`; `firmarAccess(idUsuario: number, rol: Rol): Promise<string>`; `verificarAccess(token: string): Promise<{ idUsuario: number; rol: Rol }>` (lanza `errores.noAutenticado()` si inválido/expirado/`typ` incorrecto); `firmarRefresh(idUsuario: number): Promise<{ token: string; expiraEn: Date }>`; `verificarRefresh(token: string): Promise<{ idUsuario: number }>` (lanza `noAutenticado`); `hashToken(token: string): string` (sha256 hex).

- [ ] **Step 1: Tests**
  - `contrasenaSchema`: acepta `'secreta123'`; rechaza `'corta1'`, `'solotexto'`, `'12345678'`, y `'a1' + 'ñ'.repeat(36)` (74 bytes).
  - `hashContrasena('secreta123')` ≠ texto plano y `verificarContrasena('secreta123', hash)` → `true`; con `'otra1234'` → `false`; con `hash=null` → `false`.
  - `verificarAccess(await firmarAccess(7, 'admin'))` → `{ idUsuario: 7, rol: 'admin' }`.
  - Un refresh token pasado a `verificarAccess` → rechaza (401); un access pasado a `verificarRefresh` → rechaza.
  - Token con firma alterada (último carácter cambiado) → rechaza; token expirado (firmar con `vi.setSystemTime` 16 min antes) → rechaza.
  - `firmarRefresh(7)` dos veces → tokens distintos; `expiraEn` ≈ ahora + 7 días (±1 min).
  - `hashToken('abc')` → `'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`.
- [ ] **Step 2:** `npx vitest run tests/unit/common/security` → FAIL (módulos no existen).
- [ ] **Step 3: Implementar** con `jose` (`SignJWT`, `jwtVerify`, `setExpirationTime(env.JWT_ACCESS_TTL)`), `bcryptjs` (`hash`, `compare`), `node:crypto` (`randomBytes`, `createHash`). Para tests, en `tests/setup-env.ts` fijar `BCRYPT_COST=10` si no está definido (más rápido; el mínimo permitido).
- [ ] **Step 4:** tests + lint + typecheck en verde.
- [ ] **Step 5: Commit** `feat: primitivas de seguridad (bcrypt, JWT access/refresh, hash de tokens)`.

---

### Task 2: Rate limiting (Upstash | memoria)

**Files:**
- Create: `src/common/ratelimit/limitador.ts`, `src/common/ratelimit/memoria.ts`, `src/common/ratelimit/upstash.ts`, `src/common/middleware/rate-limit.ts`, `src/common/http/ip.ts`
- Modify: `src/config/env.ts` (regla Upstash), `tests/unit/config/env.test.ts`
- Test: `tests/unit/common/ratelimit/memoria.test.ts`, `tests/unit/common/middleware/rate-limit.test.ts`

**Interfaces:**
- Produces (`limitador.ts`): `interface ResultadoLimite { permitido: boolean; restantes: number; reinicioMs: number }`; `interface Limitador { consumir(clave: string): Promise<ResultadoLimite> }`; `interface ReglaLimite { nombre: string; limite: number; ventanaSeg: number }`; `type FabricaLimitador = (regla: ReglaLimite) => Limitador`; `REGLAS = { global: { nombre: 'global', limite: 100, ventanaSeg: 60 }, login: { nombre: 'login', limite: 5, ventanaSeg: 60 }, auth: { nombre: 'auth', limite: 10, ventanaSeg: 60 } }`; `fabricaPorDefecto(): FabricaLimitador` (Upstash si hay credenciales; memoria si no — la validación de env impide llegar aquí sin Upstash en preview/production).
- Produces (`memoria.ts`): `crearLimitadorMemoria(regla: ReglaLimite, ahora?: () => number): Limitador` — ventana fija por clave en un `Map` (solo local/test; comentario explícito de que no sirve en serverless).
- Produces (`upstash.ts`): `crearLimitadorUpstash(regla: ReglaLimite): Limitador` — `Ratelimit.slidingWindow(limite, \`${ventanaSeg} s\`)`, `prefix: \`vitalify:${regla.nombre}\``, `Redis.fromEnv()` no: usar `new Redis({ url, token })` desde `env`. Sin test unitario (requiere red); cubierto por el deploy.
- Produces (`ip.ts`): `ipCliente(req: Request): string` — primer valor de `x-forwarded-for`, si no `req.socket.remoteAddress`, si no `'desconocida'`.
- Produces (`rate-limit.ts`): `rateLimit(limitador: Limitador, clave: (req: Request) => string | Promise<string>): RequestHandler` — si `!env.RATE_LIMIT_ENABLED` → `next()`; si no permitido → `Retry-After = ceil(reinicioMs/1000)` y `next(new AppError(429, 'demasiadas-peticiones', 'Demasiadas peticiones', { detail: 'Intenta de nuevo en unos segundos' }))`.
- `env.ts`: nueva regla cruzada — en `preview`/`production`, si `RATE_LIMIT_ENABLED` no es `'false'`, exigir `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 1: Tests**
  - Memoria: con regla `{limite: 2, ventanaSeg: 60}` y reloj inyectado, `consumir('a')` ×2 permitido, 3ª → `permitido: false` con `reinicioMs > 0`; `consumir('b')` sigue permitido; tras avanzar el reloj 60 s → permitido otra vez.
  - Middleware (mini-app con limitador de memoria `limite: 1`): 1ª petición 200; 2ª → 429 problem+json con `Retry-After` numérico; petición con `x-forwarded-for: 10.0.0.2, 10.0.0.9` usa clave `10.0.0.2` y no está bloqueada (Review Focus 5).
  - Env: `APP_ENV=production` sin `UPSTASH_*` → lanza mencionando `UPSTASH_REDIS_REST_URL`; con ambas → ok.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: rate limiting con Upstash y limitador en memoria para local/test`.

---

### Task 3: `requireAuth`, `requireRole` e inyección en `createApp`

**Files:**
- Create: `src/common/middleware/auth.ts`, `src/common/middleware/require-role.ts`
- Modify: `src/app.ts`
- Test: `tests/unit/common/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `verificarAccess` (Task 1), `rateLimit`, `REGLAS`, `FabricaLimitador`, `fabricaPorDefecto`, `ipCliente` (Task 2).
- Produces (`auth.ts`): `requireAuth: RequestHandler` — exige `Authorization: Bearer <token>`, verifica y asigna `req.usuario = { idUsuario, rol }`; sin header o inválido → 401 `no-autenticado`. `claveUsuarioOIp(req): Promise<string>` → `usuario:<id>` si el bearer es válido, si no `ip:<ip>` (no lanza).
- Produces (`require-role.ts`): `requireRole(rol: 'admin'): RequestHandler` — 403 `prohibido` si `req.usuario?.rol !== rol`.
- `app.ts`: `interface OpcionesApp { fabricaLimitador?: FabricaLimitador }`; `createApp(opciones: OpcionesApp = {})`; `app.set('trust proxy', true)`; límite global `rateLimit(fabrica(REGLAS.global), claveUsuarioOIp)` montado en `apiRouter` antes de los módulos (excepto `/health`, que va antes del límite). La fábrica se pasa a los routers que la necesiten como parámetro (`crearAuthRouter(fabrica)`).

- [ ] **Step 1: Tests** (mini-app): sin header → 401; `Bearer basura` → 401; token válido → 200 y `req.usuario` correcto; `requireRole('admin')` con rol `user` → 403, con `admin` → 200; `claveUsuarioOIp` → `usuario:7` con token válido, `ip:…` sin token.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** toda la suite unitaria en verde (los tests existentes de `app` siguen pasando con la fábrica por defecto en memoria).
- [ ] **Step 5: Commit** `feat: middlewares requireAuth, requireRole y límite global`.

---

### Task 4: Registro, login, refresh y logout (`/auth/*`)

**Files:**
- Create: `src/modules/usuarios/usuarios.repository.ts`, `src/modules/usuarios/usuarios.service.ts`, `src/modules/usuarios/usuarios.schemas.ts`, `src/modules/auth/auth.repository.ts`, `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.routes.ts`, `src/modules/auth/auth.schemas.ts`
- Modify: `src/app.ts` (montar `crearAuthRouter`)
- Test: `tests/integration/helpers.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- Produces (`usuarios.schemas.ts`): `UsuarioSchema` (OpenAPI `Usuario`: `idUsuario, nombre, correo, fechaRegistro (ISO), aceptaDatos, rol`); `correoSchema` (trim + lowercase + `z.email()` + máx. 120); `nombreSchema` (trim, 1–80).
- Produces (`usuarios.service.ts`): `type UsuarioDto = z.infer<typeof UsuarioSchema>`; `aDto(u: Usuario): UsuarioDto`; `crearConDefaults(datos: { nombre; correo; contrasenaHash; aceptaDatos }): Promise<UsuarioDto>` — una transacción crea `Usuario` + `Progreso` (defaults del esquema) + 3 `ConfigNotificacion` (`sueno`, `pausa`, `logros`; `activa=true`); `P2002` → `errores.conflicto('Ya existe una cuenta con ese correo')`. `buscarCredenciales(correo): Promise<{ idUsuario; rol; contrasenaHash; dto } | null>`; `obtener(idUsuario): Promise<UsuarioDto>` (lanza `noAutenticado('La cuenta ya no existe')` si no existe).
- Produces (`auth.repository.ts`): `guardarRefresh(idUsuario, tokenHash, expiraEn)`, `buscarRefresh(tokenHash)`, `revocarRefresh(idToken)`, `revocarTodos(idUsuario)`.
- Produces (`auth.service.ts`): `type Sesion = { usuario: UsuarioDto; accessToken: string; refreshToken: string }`; `registrar(datos): Promise<Sesion>` (`aceptaDatos !== true` → `errores.reglaNegocio('Debes aceptar el tratamiento de datos personales (Ley 1581 de 2012)')`); `login(correo, contrasena): Promise<Sesion>` (fallo → `noAutenticado('Credenciales inválidas')`, siempre ejecutando bcrypt); `refrescar(refreshToken): Promise<Sesion>` — verifica JWT, busca por hash; **revocado → `revocarTodos` + 401**; vencido o inexistente → 401; si válido, en transacción revoca el actual y emite uno nuevo; `logout(idUsuario, refreshToken): Promise<void>` (revoca si pertenece al usuario; idempotente).
- Rutas (`crearAuthRouter(fabrica: FabricaLimitador): Router`): `POST /auth/registro` (201 + `Location: /api/v1/usuarios/me`), `POST /auth/login` (200), `POST /auth/refresh` (200), `POST /auth/logout` (`requireAuth`, 204). `login` con `rateLimit(fabrica(REGLAS.login), ip)`; los otros con `REGLAS.auth`. Todos `validate({ body: … .strict() })` y registrados en OpenAPI (con `ProblemSchema` en 400/401/409/422/429).
- `tests/integration/helpers.ts`: `crearAppTest()` (= `createApp({ fabricaLimitador: () => ({ consumir: async () => ({ permitido: true, restantes: 99, reinicioMs: 0 }) }) })`); `correoUnico(): string`; `registrar(app, overrides?) → { usuario, accessToken, refreshToken, contrasena }`; `limpiarUsuariosDeTest()`.

- [ ] **Step 1: Tests de integración** (`auth.test.ts`):
  - Registro feliz → 201, `Location`, `body.usuario` valida con `UsuarioSchema`, sin `contrasenaHash` en `JSON.stringify(body)`; en BD existen `progreso` y 3 `config_notificacion` para ese usuario.
  - `aceptaDatos: false` → 422 `regla-negocio`; contraseña `'solotexto'` → 400 con `campo: 'contrasena'`; campo extra → 400.
  - Correo duplicado con otra capitalización y espacios (`' ' + correo.toUpperCase() + ' '`) → 409 (Review Focus 4).
  - Login con el correo en mayúsculas → 200; contraseña errónea → 401 `'Credenciales inválidas'`; correo inexistente → 401 con el **mismo** body.
  - Refresh feliz → 200 con tokens nuevos; reusar el refresh anterior → 401 **y** el refresh nuevo también deja de funcionar (401) (Review Focus 2).
  - Logout → 204; luego refresh con ese token → 401; logout sin bearer → 401.
  - Rate limit real: con `createApp()` por defecto (memoria), 6 logins fallidos desde la misma IP → el 6º es 429 con `Retry-After`.
- [ ] **Step 2:** `npx vitest run tests/integration/auth.test.ts` → FAIL (rutas 404).
- [ ] **Step 3: Implementar** repositorios, servicios, controller, rutas y OpenAPI.
- [ ] **Step 4:** `npm test` (unit + integración con `.env.test`) en verde + lint + typecheck. Si `.env.test` aún no existe: correr solo `test:unit` local, empujar la rama y verificar la integración en el CI.
- [ ] **Step 5: Commit** `feat: registro, login, refresh rotatorio y logout`.

---

### Task 5: `/usuarios/me` (consultar, editar, eliminar, exportar)

**Files:**
- Create: `src/modules/usuarios/usuarios.controller.ts`, `src/modules/usuarios/usuarios.routes.ts`, `src/modules/usuarios/usuarios.export.ts`
- Modify: `src/modules/usuarios/usuarios.service.ts`, `src/modules/usuarios/usuarios.repository.ts`, `src/modules/usuarios/usuarios.schemas.ts`, `src/app.ts`
- Test: `tests/integration/usuarios.test.ts`, `tests/unit/modules/usuarios/usuarios.export.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `hashContrasena`, `verificarContrasena`, `revocarTodos` (vía `auth.service.cerrarTodasLasSesiones(idUsuario)`, para no importar el repository de otro módulo).
- Produces (`usuarios.service.ts`): `actualizar(idUsuario, cambios: { nombre?; correo?; contrasena?; contrasenaActual? }): Promise<UsuarioDto>` — `contrasena` sin `contrasenaActual` → 400 `campo: 'contrasenaActual'`; `contrasenaActual` incorrecta → 422 `'La contraseña actual no es correcta'`; cambio de contraseña → `cerrarTodasLasSesiones`; correo duplicado → 409. `eliminar(idUsuario): Promise<void>` (cascada de BD). `exportar(idUsuario): Promise<ExportacionUsuario>`.
- Produces (`usuarios.export.ts`): `type ExportacionUsuario`; `construirExportacion(datos: UsuarioConRelaciones, generadoEn: Date): ExportacionUsuario` — función pura: `{ generadoEn (ISO), usuario: UsuarioDto, perfil, bloques, microVentanas (con microPausa), registrosSueno, recordatorios, configNotificaciones, progreso, insignias }`, horas `HH:mm`, fechas `YYYY-MM-DD`, `Decimal` → `number`, sin `contrasenaHash` ni `refreshTokens`.
- Rutas (`usuariosRouter`, todas con `requireAuth`): `GET /usuarios/me` (200), `PATCH /usuarios/me` (200; body `.strict()` con al menos un campo), `DELETE /usuarios/me` (204), `GET /usuarios/me/exportar` (200, `Content-Disposition: attachment; filename="vitalify-datos.json"`).

- [ ] **Step 1: Tests**
  - Unit `construirExportacion`: con un fixture que incluye `perfil.horaDormir = parseHHmm('22:45')`, `metaHorasSueno = new Prisma.Decimal(7.5)`, un bloque y un registro de sueño → `perfil.horaDormir === '22:45'`, `perfil.metaHorasSueno === 7.5`, `registrosSueno[0].fecha === 'YYYY-MM-DD'`, y `JSON.stringify(resultado)` no contiene `contrasenaHash` ni `tokenHash`.
  - Integración: `GET /usuarios/me` → 200 con `UsuarioSchema`; sin token → 401.
  - `PATCH` nombre → 200 actualizado; `PATCH {}` → 400; `PATCH { contrasena }` sin actual → 400; con actual errónea → 422; cambio correcto → 200, login con la nueva funciona y el refresh previo → 401.
  - `PATCH` correo al de otro usuario → 409.
  - `GET /usuarios/me/exportar` → 200, header `content-disposition` con `attachment`, `body.usuario.correo` correcto, `progreso` y 3 `configNotificaciones` presentes.
  - `DELETE /usuarios/me` → 204; luego `GET /usuarios/me` con el mismo access token → 401 (Review Focus 3); login → 401; en BD no quedan filas de `progreso`/`config_notificacion` de ese id.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde (o CI si no hay `.env.test`) + lint + typecheck.
- [ ] **Step 5: Commit** `feat: usuarios/me (consultar, editar, eliminar y exportar datos)`.

---

### Task 6: Documentación, verificación y PR

**Files:**
- Modify: `README.md` (tabla de endpoints + variables Upstash), `docs/DECISIONES.md`, `.env.example` (comentario Upstash obligatorio en preview/production)
- Create: `docs/PRIVACIDAD.md` (borrador: finalidad, datos tratados, derechos de acceso `GET /usuarios/me/exportar` y supresión `DELETE /usuarios/me`, Ley 1581/2012; se completa en Fase 8)

- [ ] **Step 1:** `docs/DECISIONES.md` — añadir: refresh como JWT firmado + hash SHA-256 en BD; detección de reutilización → revoca todas las sesiones; cambio de contraseña cierra sesiones; contraseña máx. 72 bytes; login con bcrypt contra hash ficticio; rate limit por IP del primer `x-forwarded-for`; límite global por usuario si hay bearer válido; `aceptaDatos=false` → 422; cuenta eliminada con access vigente → 401; Upstash por cuenta directa (no Marketplace).
- [ ] **Step 2: Verificación completa** `npm run lint && npm run typecheck && npm run test:coverage` → verde.
- [ ] **Step 3: Commit + push** `docs: endpoints de identidad, privacidad y decisiones de la Fase 2` → `git push -u origin fase-2-identidad`.
- [ ] **Step 4: ⛔ Usuario**: confirmar que `UPSTASH_REDIS_REST_URL`/`TOKEN` están en Vercel (Production y Preview) **antes** de mergear (sin ellas la app no arranca en preview/production por la validación de env); abrir PR.
- [ ] **Step 5:** tras el deploy de Preview/Production: registro → login → `GET /usuarios/me` con curl contra `https://vaitalify-beta.vercel.app/api/v1` y 6 logins fallidos → 429.

**Criterio de aceptación (spec §13):** tests de auth en verde; hash nunca expuesto; 409 en correo duplicado.

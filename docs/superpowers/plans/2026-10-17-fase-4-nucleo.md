# Fase 4 — Núcleo adaptativo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detección de micro-ventanas (RF-04) con recálculo automático, catálogo de actividades con seed, recomendación de micro-pausas (RF-05), registro de cumplimiento (RF-07) e idempotencia para clientes offline (RNF-09).

**Architecture:** Algoritmos como funciones puras en `*.domain.ts` (sin BD). Módulos nuevos `actividades/`, `micro-ventanas/`, `micro-pausas/`. `bloques.service` y `perfil.service` llaman a `microVentanas.service.recalcularSemana()` tras cada mutación. `micro-ventanas.repository` lee perfil y bloques con sus propias consultas (lectura) para no crear un ciclo de imports entre servicios.

**Spec:** `.claude/spec.md` §5 (idempotencia), §6.5, §6.6, §6.7, §7.1, §7.2, §10, §11 · `docs/superpowers/specs/2026-10-17-vitalify-api-design.md` (U-7) · `docs/DECISIONES.md`.

## Global Constraints

- Todo lo de las fases 1–3 sigue vigente (aislamiento 404, `:id` con `IdParamSchema`, paginación, problem+json, sin `Math.random`).
- Minutos desde medianoche como unidad interna; la API expone `HH:mm` y `YYYY-MM-DD`; "hoy" = `hoyEnZona()`.
- Micro-ventana: hueco libre ≥ **5** min → **una** ventana con `horaInicio` = inicio del hueco y `duracionMin = min(hueco, 15)` (S-03).
- Día despierto: `[horaDespertar, horaDormir]`; si `horaDormir <= horaDespertar` (se duerme después de medianoche) el día despierto termina a las 24:00 (decisión registrada en Fase 1).
- Rango de recálculo: por defecto `hoy … hoy+6`; máximo **31** días; `hasta < desde` → 400.
- Sin perfil: `POST /micro-ventanas/recalcular` → 422 `detail: 'Configura tu perfil primero'`, `hint: 'POST /perfil'`. El recálculo automático tras mutar bloques **no** falla si no hay perfil (se omite).
- Actividad: `duracionMin` 1–15; `categoria` ∈ {`estiramiento`,`caminata`,`bajo_impacto`}; nombre 1–80; instrucciones 1–2000.
- Escritura de `/actividades` solo `admin` (403 para `user`); `DELETE` con micro-pausas asociadas → 409.
- Marcar `hecha` una pausa cuya ventana es de una fecha **futura** → 422 (U-7). `fechaRegistro = now()` en cada cambio de estado.
- Idempotencia: header opcional `Idempotency-Key` (1–64 caracteres `[A-Za-z0-9_-]`) en `PATCH /micro-pausas/:id`; respuesta guardada 24 h en `idempotency_key`; misma clave con otra ruta/método → 422.
- La respuesta de `PATCH /micro-pausas/:id` en esta fase es la micro-pausa; los campos de gamificación (`puntosGanados`, `rachaActual`, `insigniasNuevas`) los añade la Fase 6.

## Review Focus

1. **Bloques que cubren todo el día despierto o lo desbordan** (antes de despertar / después de dormir) → cero ventanas, sin huecos negativos. Test en Task 1.
2. **Recálculo con historial**: una ventana cuya pausa está `hecha` u `omitida` se conserva aunque el nuevo horario ya no la contenga; una `pendiente` que ya no cabe se elimina (con su pausa). Test en Task 1 (puro) y Task 4 (integración).
3. **Rango de recálculo inválido**: 32 días, `hasta` anterior a `desde`, fechas mal formadas → 400, nunca 500 ni un bucle largo. Test en Task 3.
4. **Recomendación sin candidatas** (ventana de 5 min y ninguna actividad ≤ 5) → 422; `idActividad` forzado que no cabe → 422; inexistente → 404. Test en Task 4.
5. **Reintento offline con la misma `Idempotency-Key`** → misma respuesta sin repetir efectos (`fechaRegistro` no cambia); misma clave en otra pausa → 422. Test en Task 5.

---

### Task 1: Algoritmos puros (ventanas, reconciliación, recomendación, PRNG)

**Files:**
- Create: `src/modules/micro-ventanas/micro-ventanas.domain.ts`, `src/modules/micro-pausas/recomendacion.domain.ts`, `src/common/utils/random.ts`
- Test: `tests/unit/modules/micro-ventanas/micro-ventanas.domain.test.ts`, `tests/unit/modules/micro-pausas/recomendacion.domain.test.ts`, `tests/unit/common/utils/random.test.ts`

**Interfaces:**
- Produces (`micro-ventanas.domain.ts`):
  - `interface Intervalo { inicio: number; fin: number }` (minutos, `fin` exclusivo).
  - `fusionar(intervalos: Intervalo[]): Intervalo[]` — ordena y une solapados o contiguos.
  - `diaDespierto(horaDespertar: string, horaDormir: string): Intervalo` — `fin = 1440` si `horaDormir <= horaDespertar`.
  - `detectarVentanasDia(bloques: Intervalo[], despierto: Intervalo): { inicio: number; duracionMin: number }[]` — recorta bloques al día despierto, fusiona, calcula huecos y aplica S-03.
  - `interface VentanaCalculada { fecha: string; horaInicio: string; duracionMin: number }`; `interface VentanaExistente extends VentanaCalculada { idVentana: number; pausa: { estado: 'pendiente' | 'hecha' | 'omitida'; duracionActividad: number } | null }`.
  - `planificarReconciliacion(existentes: VentanaExistente[], calculadas: VentanaCalculada[]): { crear: VentanaCalculada[]; eliminar: number[]; actualizarDuracion: { idVentana: number; duracionMin: number }[]; conservadas: number }` — clave `fecha|horaInicio`. Reglas: pausa `hecha`/`omitida` → conservar siempre (sin tocar duración); pendiente o sin pausa que coincide con una calculada → conservar y actualizar duración si cambió, salvo pendiente cuya actividad ya no cabe → eliminar; sin coincidencia → eliminar; calculadas sin existente → crear.
- Produces (`random.ts`): `type Rng = () => number` (en [0,1)); `crearRng(semilla?: number): Rng` — mulberry32; sin semilla usa `crypto.randomInt(2 ** 31)`. Comentario: no se usa con fines de seguridad (hotspot Sonar "Safe").
- Produces (`recomendacion.domain.ts`): `interface Candidata { idActividad: number; duracionMin: number }`; `recomendarActividad(candidatas: Candidata[], duracionVentana: number, idUltimaActividad: number | null, rng: Rng): number | null` — §7.2 pasos 1–4.

- [ ] **Step 1: Tests (casos obligatorios §11 + Review Focus 1–2)**
  - `detectarVentanasDia`, con despierto 06:15–22:45 (`diaDespierto('06:15','22:45')` → `{inicio:375, fin:1365}`): sin bloques → `[{ inicio: 375, duracionMin: 15 }]`; bloques solapados 07:00–09:00 y 08:00–10:00 con 06:15–07:00 libre → un hueco 375 (15) y otro 600 (15); hueco de 4 min (bloque 06:19–22:45) → `[]`; hueco de 40 min (bloque 06:55–22:45) → `[{ inicio: 375, duracionMin: 15 }]`; bloque 00:00–23:59 → `[]`; bloque 05:00–06:20 → primera ventana en 380.
  - `diaDespierto('06:00','00:30')` → `{ inicio: 360, fin: 1440 }`.
  - `fusionar` con contiguos 07:00–08:00 y 08:00–09:00 → uno solo.
  - Rendimiento: 7 días × 30 bloques aleatorios con `crearRng(1)` → `detectarVentanasDia` ×7 en < 200 ms.
  - `planificarReconciliacion`: hecha no calculada → conservada; omitida → conservada; pendiente con actividad de 10 min y nueva duración 5 → eliminada; sin pausa no calculada → eliminada; sin pausa coincidente con duración nueva → `actualizarDuracion`; calculada nueva → `crear`; conteos correctos.
  - `crearRng(42)` produce la misma secuencia dos veces; valores en [0,1).
  - `recomendarActividad`: ventana 10 con candidatas 5, 8, 10, 12 → la de 10; empate entre dos de 10 → la elegida depende solo de la semilla (determinista con `crearRng(7)`); excluye `idUltimaActividad` si hay otra candidata con la misma o peor holgura; si es la única → la devuelve; sin candidatas → `null`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (funciones pequeñas: complejidad ≤ 15). **Step 4:** verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: algoritmos de micro-ventanas, reconciliación y recomendación`.

---

### Task 2: Catálogo de actividades y seed

**Files:**
- Create: `src/modules/actividades/actividades.{schemas,repository,service,controller,routes}.ts`, `prisma/seed.ts`, `prisma/seed-data.ts`, `tests/global-setup.ts`
- Modify: `src/app.ts`, `vitest.config.ts` (`globalSetup`), `package.json` (`vercel-build` añade `&& prisma db seed`), `tests/integration/helpers.ts` (`crearAdmin(app)`)
- Test: `tests/integration/actividades.test.ts`, `tests/unit/modules/actividades/actividades.schemas.test.ts`

**Interfaces:**
- Produces (`seed-data.ts`): `ACTIVIDADES` (las 8 de §10 con `instrucciones` en pasos numerados `1. … \n2. …`) e `INSIGNIAS` (las 3 de §7.6 con `codigo`, `nombre`, `descripcion`, `criterio`).
- Produces (`seed.ts`): `sembrarCatalogo(prisma): Promise<void>` — idempotente: actividades por `nombre` (crear si no existe), insignias `upsert` por `codigo`. `sembrarUsuarios(prisma)` — solo si `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` están definidas: `admin@vitalify.dev` (rol admin) y `demo@vitalify.dev` (perfil 22:45/06:15/7.5/150 y 5 bloques de ejemplo L–V), con `crearConDefaults`-equivalente; idempotente. El `main` ejecuta ambas y registra con `logger`.
- `tests/global-setup.ts`: ejecuta `sembrarCatalogo` contra la BD de test una vez por corrida.
- Produces (`actividades.service.ts`): `type ActividadDto`; `listar(filtros: { categoria?; maxDuracionMin?; page; pageSize })`; `obtener(id)` (404); `crear`, `reemplazar`, `actualizar` (parcial), `eliminar` (P2003 → 409 `'La actividad tiene micro-pausas asociadas'`); `candidatas(maxDuracion): Promise<Candidata[]>` y `existe(id): Promise<{ idActividad; duracionMin } | null>` (para Task 4).
- Rutas: `GET /actividades`, `GET /actividades/:id` (`requireAuth`); `POST`, `PUT`, `PATCH`, `DELETE` con `requireAuth` + `requireRole('admin')`.

- [ ] **Step 1: Tests** — schemas: `duracionMin` 0 y 16 fallan; categoría inválida falla. Integración: usuario lista (≥ 8 tras el seed) y filtra `?categoria=caminata&maxDuracionMin=10` (todas cumplen); `GET /actividades/:id` inexistente → 404; usuario `POST` → 403; admin `POST` → 201, `PATCH` → 200, `DELETE` → 204; sin token → 401.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Ejecutar `npx tsx prisma/seed.ts` con `.env.test` cargado (`DOTENV_CONFIG_PATH=.env.test`) una vez para verificar idempotencia (dos ejecuciones → mismos conteos). **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: catálogo de actividades (CRUD admin) y seed idempotente`.

---

### Task 3: Micro-ventanas (recalcular, listar, detalle, descartar) y recálculo automático

**Files:**
- Create: `src/modules/micro-ventanas/micro-ventanas.{schemas,repository,service,controller,routes}.ts`
- Modify: `src/modules/bloques/bloques.service.ts`, `src/modules/perfil/perfil.service.ts` (llamar `recalcularSemana` tras cada mutación), `src/app.ts`
- Test: `tests/integration/micro-ventanas.test.ts`, `tests/unit/modules/micro-ventanas/micro-ventanas.schemas.test.ts`

**Interfaces:**
- Consumes: Task 1 (`diaDespierto`, `detectarVentanasDia`, `planificarReconciliacion`).
- Produces (`micro-ventanas.repository.ts`): `cargarHorario(idUsuario)` → `{ perfil: { horaDespertar; horaDormir } | null; bloques: { diaSemana; horaInicio; horaFin }[] }` (strings `HH:mm`); `existentes(idUsuario, desde, hasta): Promise<VentanaExistente[]>`; `aplicar(idUsuario, plan)` (una `$transaction`: `deleteMany` ids, `createMany` con `skipDuplicates`, updates de duración); `listar`, `buscar(idUsuario, id)` (con `microPausa` + `actividad`), `eliminar(idUsuario, id)`.
- Produces (`micro-ventanas.service.ts`): `recalcular(idUsuario, rango?: { desde?: string; hasta?: string }): Promise<{ generadas: number; eliminadas: number; conservadas: number }>` (422 sin perfil); `recalcularSemana(idUsuario): Promise<void>` (hoy…hoy+6; sin perfil no hace nada); `listar(idUsuario, filtros)`; `obtener(idUsuario, id)`; `eliminar(idUsuario, id)`; `type MicroVentanaDto = { idVentana; fecha; horaInicio; duracionMin; microPausa: MicroPausaResumen | null }`.
- Produces (`micro-ventanas.schemas.ts`): `RangoRecalculoSchema` (`desde?`, `hasta?` como `YYYY-MM-DD` válidas; refinamientos: `hasta >= desde`, ≤ 31 días); `FiltrosVentanasSchema` (paginación + `desde?`, `hasta?`, `conPausa?` con `z.stringbool()`); `FechaSchema` (exportado a `common/utils/dates.ts` para reutilizar).
- Rutas (`requireAuth`): `POST /micro-ventanas/recalcular` (200), `GET /micro-ventanas`, `GET /micro-ventanas/:id`, `DELETE /micro-ventanas/:id` (204).

- [ ] **Step 1: Tests de integración**
  - Sin perfil → `POST /recalcular` 422 con `hint`.
  - Con perfil 06:15–22:45 y un bloque el `isoWeekday(hoy)` 07:00–22:45 → `recalcular` de hoy → `generadas: 1`; `GET /micro-ventanas?desde=hoy&hasta=hoy` → una ventana `{ fecha: hoy, horaInicio: '06:15', duracionMin: 15, microPausa: null }`.
  - Recalcular dos veces → la segunda `{ generadas: 0, eliminadas: 0, conservadas: N }`.
  - Crear un bloque (`POST /bloques`) que tapa el hueco → sin llamar a `recalcular`, las ventanas de ese día cambian (recálculo automático).
  - Rango de 32 días, `hasta < desde`, `desde: '2026-02-30'` → 400 (Review Focus 3).
  - `GET /micro-ventanas/:id` y `DELETE` de otro usuario → 404; `DELETE` propio → 204.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde (incluidos los tests de bloques/perfil existentes) + lint + typecheck.
- [ ] **Step 5: Commit** `feat: micro-ventanas con recálculo automático al cambiar el horario`.

---

### Task 4: Micro-pausas (recomendación, consulta, cumplimiento)

**Files:**
- Create: `src/modules/micro-pausas/micro-pausas.{schemas,repository,service,controller,routes}.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/micro-pausas.test.ts`

**Interfaces:**
- Consumes: `recomendarActividad`, `crearRng` (Task 1); `actividades.service.candidatas/existe` (Task 2); `microVentanas.service.obtener` (Task 3).
- Produces (`micro-pausas.service.ts`): `type MicroPausaDto = { idPausa; estado; fechaRegistro: string | null; ventana: { idVentana; fecha; horaInicio; duracionMin }; actividad: { idActividad; nombre; categoria; duracionMin; instrucciones } }`; `recomendar(idUsuario, idVentana, idActividad?: number, rng = crearRng())` (404 ventana ajena; 409 si ya tiene pausa; 404 actividad inexistente; 422 si no cabe o sin candidatas); `listar(idUsuario, filtros: { estado?; desde?; hasta?; page; pageSize })`; `hoy(idUsuario)` (pausas con `ventana.fecha = hoyEnZona()` ordenadas por `horaInicio`); `obtener`; `cambiarEstado(idUsuario, id, estado)` (U-7: `hecha` con fecha futura → 422; fija `fechaRegistro`); `cambiarActividad(idUsuario, id, idActividad)` (solo `pendiente` y si cabe, si no 422); `eliminar` (no revierte puntos, S-09).
- Rutas (`requireAuth`): `POST /micro-ventanas/:idVentana/micro-pausa` (201 + `Location: /api/v1/micro-pausas/:id`), `GET /micro-pausas`, `GET /micro-pausas/hoy` (antes de `/:id`), `GET /micro-pausas/:id`, `PATCH /micro-pausas/:id` (`{ estado }` estricto), `PUT /micro-pausas/:id` (`{ idActividad }`), `DELETE /micro-pausas/:id`.

- [ ] **Step 1: Tests de integración** (perfil + bloques para que hoy haya una ventana de 15 min y otra de 5 min):
  - Recomendar en la de 15 → 201, actividad con `duracionMin <= 15`; segunda vez → 409.
  - En la de 5: si alguna actividad del catálogo dura ≤ 5 se asigna; forzar `idActividad` de 10 min → 422; `idActividad` 999999 → 404 (Review Focus 4). Para el caso "sin candidatas" usar una ventana de 5 min y un `rng`/catálogo controlado en un test unitario del servicio con mocks (no depender del seed).
  - `GET /micro-pausas/hoy` → las de hoy ordenadas por hora con `ventana` y `actividad`.
  - `PATCH { estado: 'hecha' }` → 200, `fechaRegistro` ISO; pausa en ventana de mañana → `hecha` 422, `omitida` 200.
  - `PUT { idActividad }` sobre pendiente → 200; sobre hecha → 422.
  - Historial (Review Focus 2): pausa `hecha`, luego `POST /bloques` que tapa su hueco → la ventana y la pausa siguen existiendo; una `pendiente` tapada desaparece.
  - `DELETE /actividades/:id` (admin) de una actividad con pausas → 409.
  - Otro usuario: `GET/PATCH/PUT/DELETE /micro-pausas/:id` y `POST /micro-ventanas/:id/micro-pausa` → 404.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: micro-pausas (recomendación, consulta y registro de cumplimiento)`.

---

### Task 5: Idempotencia (`Idempotency-Key`)

**Files:**
- Create: `src/common/middleware/idempotency.ts`, `src/common/idempotency/idempotency.repository.ts`
- Modify: `src/modules/micro-pausas/micro-pausas.routes.ts`
- Test: `tests/integration/idempotencia.test.ts`

**Interfaces:**
- Produces: `idempotencia(): RequestHandler` — usar tras `requireAuth`. Sin header → `next()`. Header inválido → 400. Clave BD `${idUsuario}:${clave}`; `metodoRuta = ${req.method} ${req.originalUrl}` (sin query). Si existe y `creadaEn` < 24 h: misma `metodoRuta` → responde `codigo` + `respuesta` guardados con header `Idempotent-Replayed: true`; distinta → 422 `'Idempotency-Key ya usada en otra petición'`. Si no existe: envuelve `res.json` para **guardar antes de enviar** (Vercel puede congelar la función tras responder) las respuestas con `status < 500`; P2002 al guardar (carrera) se ignora.
- Repository: `buscar(clave)`, `guardar(clave, metodoRuta, codigo, respuesta)`, `borrarAntiguas(antesDe: Date)` (para el job de limpieza de la Fase 5).

- [ ] **Step 1: Tests** — mismo `PATCH { estado: 'hecha' }` dos veces con la misma clave → mismas respuestas, segunda con `idempotent-replayed: true` y **mismo** `fechaRegistro`; misma clave en otra pausa → 422; clave con caracteres inválidos → 400; sin clave → comportamiento normal; la clave de otro usuario no colisiona (mismo valor de header, usuarios distintos → ambos se ejecutan).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: idempotencia de reintentos offline con Idempotency-Key`.

---

### Task 6: Documentación, verificación, PR y revisión

- [ ] **Step 1:** README (endpoints nuevos y `Idempotency-Key`), `docs/DECISIONES.md` (reconciliación; día despierto hasta 24:00; seed en `vercel-build`; repository de micro-ventanas lee perfil/bloques; idempotencia guarda antes de responder; recálculo omitido sin perfil; respuesta de PATCH sin gamificación hasta Fase 6).
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm run test:coverage` → verde.
- [ ] **Step 3:** commit + push + `gh pr create`; `gh pr checks --watch`; Quality Gate.
- [ ] **Step 4:** revisión final (subagente) → fix pass → avisar al usuario. Tras el merge: verificar en producción que `/actividades` devuelve el catálogo sembrado por `vercel-build`.

**Criterio de aceptación (spec §13):** casos obligatorios de §11 en verde; recálculo tras modificar bloques.

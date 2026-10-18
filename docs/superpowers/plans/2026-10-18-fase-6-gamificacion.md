# Fase 6 — Gamificación y progreso · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gamificación tolerante (RF-08, §7.4) con racha por fecha de la ventana (U-7), puntos, insignias (§7.6) y panel de progreso (RF-09, §7.5).

**Architecture:** Funciones puras en `gamificacion.domain.ts` (racha, insignias) y `progreso.domain.ts` (resumen semanal). Un servicio `gamificacion.service` aplica todo en **una transacción con advisory lock por usuario** y es llamado por `micro-pausas` y `registros-sueno`. Los puntos se otorgan con un **libro de puntos** (`puntos_otorgados`, único por `(usuario, concepto, referencia)`): idempotente, sin doble cobro por alternar estados ni por borrar y recrear, y sin revertir al borrar (S-09). `Progreso` actúa como caché del cálculo (U-7).

**Spec:** `.claude/spec.md` §6.6 (respuesta del PATCH), §6.11, §7.4–§7.6, §11 (casos de racha), §14 (S-06, S-08, S-09) · diseño U-7 · `docs/DECISIONES.md`.

## Global Constraints

- `config/gamificacion.ts`: `PUNTOS_PAUSA = 10`, `PUNTOS_SUENO_META = 5`, `COMODINES_SEMANA = 2`.
- **Día activo** = fecha de ventana con ≥ 1 micro-pausa `hecha` (y ≤ hoy, garantizado por la Fase 4).
- **Racha** (recalculada sobre los días activos ordenados, U-7): primer día → 1; por cada día siguiente `d` con anterior `p`: `perdidos = diasEntre(p, d) − 1`; si `semanaIso(d) ≠ semanaComodin` → `comodines = 2`, `semanaComodin = semanaIso(d)`; `perdidos = 0` → +1; `0 < perdidos ≤ comodines` → `comodines −= perdidos`, +1; si no → 1. `rachaMaxima = max`. **Vigencia** al consultar: si desde `ultimaFechaActiva` hasta hoy hay más días perdidos que comodines disponibles hoy (2 si hoy es otra semana ISO), `rachaActual = 0` (sin consumir comodines).
- **Puntos**: +10 la primera vez que una micro-pausa pasa a `hecha` (`concepto 'pausa'`, `referencia idPausa`); +5 la primera vez que una fecha tiene `horasDormidas ≥ metaHorasSueno` (`concepto 'sueno'`, `referencia fecha`). Nunca se revierten (S-09).
- **Insignias** (estrategia por `codigo`, idempotente por PK compuesta): `PRIMERA_SEMANA` ≥ 7 días activos; `DIEZ_PAUSAS` ≥ 10 puntos de pausa en el libro; `SUENO_7H_5N` ≥ 5 noches con ≥ 7 h en una misma semana ISO. Solo se otorgan insignias existentes en el catálogo; las creadas por el admin sin estrategia no se otorgan solas.
- `PATCH /micro-pausas/:id` responde `{ ...microPausa, puntosGanados, rachaActual, insigniasNuevas: [{ codigo, nombre }] }`.
- `Progreso` es de solo lectura para el cliente.

## Review Focus

1. **Alternar `hecha → pendiente → hecha`** o borrar y recrear un registro de sueño → los puntos no se duplican. Test en Task 2.
2. **Dos PATCH `hecha` simultáneos** del mismo usuario (offline sync en paralelo) → racha y puntos coherentes (un solo cobro por pausa). Test en Task 2.
3. **Llegada desordenada** (martes antes que lunes) y **sincronización tardía de 2 días** → la racha final es la misma que en orden. Test en Task 1 (U-7).
4. **Cambio de semana ISO** con días perdidos que cruzan el domingo → comodines restablecidos según la semana del nuevo día activo. Test en Task 1.
5. **Usuario inactivo varios días** → `GET /progreso` no muestra una racha vieja como vigente. Test en Task 1 y Task 3.

---

### Task 1: Dominio puro (racha, insignias, resumen semanal)

**Files:** Create `src/config/gamificacion.ts`, `src/modules/progreso/gamificacion.domain.ts`, `src/modules/progreso/progreso.domain.ts`; tests `tests/unit/modules/progreso/gamificacion.domain.test.ts`, `tests/unit/modules/progreso/progreso.domain.test.ts`.

**Interfaces:**
- `interface EstadoRacha { rachaActual; rachaMaxima; diasComodin; ultimaFechaActiva: string | null; semanaComodin: string | null }`; `calcularRacha(diasActivos: string[]): EstadoRacha` (ordena y deduplica); `rachaVigente(estado: EstadoRacha, hoy: string): { rachaActual: number; comodinesRestantes: number }`.
- `interface ContextoInsignias { diasActivos: number; pausasPuntuadas: number; maxNochesSuenoSemana: number }`; `ESTRATEGIAS: Record<string, (c) => boolean>`; `insigniasMerecidas(ctx, codigosCatalogo: string[], yaObtenidas: string[]): string[]`; `maxNochesPorSemana(registros: { fecha; horas }[], minimoHoras = 7): number`.
- `progreso.domain.ts`: `semanaDe(fecha): { inicio; fin }` (lunes–domingo); `resumenSueno(registros, metaHoras | null)` → `{ promedioHoras: number | null (1 decimal), metaHoras, porDia: [{ fecha, horas }] }`; `resumenActividad(pausas: { estado; duracionMin }[], metaMinutos | null)` → `{ minutosAcumulados, metaMinutos, porcentajeMeta: number | null (redondeado), pausasHechas, pausasOmitidas }`.
- [ ] **Step 1: Tests** (§11 + Review Focus 3–5): primer día → 1; consecutivo → 2; 1 día perdido con comodín → racha +1 y `diasComodin 1`; 3 días perdidos con 2 comodines → reinicia a 1; cambio de semana restablece comodines (perdidos jueves–domingo de W41 y activo el lunes de W42 con 1 comodín restante: `perdidos 3 > 2` → 1; perdido el domingo y activo el lunes → `semana nueva`: comodines 2 → racha +1, quedan 1); día duplicado no cuenta dos veces; orden de entrada distinto → mismo resultado; `rachaVigente` con última actividad hace 4 días en la misma semana y 2 comodines → 0; hace 2 días (1 perdido) → mantiene. Insignias: 7 días activos → `PRIMERA_SEMANA`; ya obtenida → no se repite; código fuera del catálogo → no; `maxNochesPorSemana` con 5 noches ≥ 7 h en W41 y 4 en W42 → 5. Resumen: sin registros → `promedioHoras null`; 3 registros 7, 6.5, 6.9 → 6.8; minutos 96 con meta 150 → 64.
- [ ] **Step 2–5:** FAIL → implementar → verde + lint + typecheck → commit `feat: dominio de gamificación (racha tolerante, insignias y resumen semanal)`.

### Task 2: Libro de puntos y servicio de gamificación (hooks en micro-pausas y sueño)

**Files:** Modify `prisma/schema.prisma` (+ `PuntosOtorgados`), new migration; create `src/modules/progreso/gamificacion.repository.ts`, `gamificacion.service.ts`; modify `src/common/db/bloqueos.ts` (clase `progreso`), `micro-pausas.service.ts` (`cambiarEstado`, `eliminar`), `micro-pausas.schemas.ts` (respuesta extendida), `registros-sueno.service.ts` (`crear`, `reemplazar`). Tests: `tests/integration/gamificacion.test.ts`.

**Interfaces:**
- Prisma `PuntosOtorgados { idPunto, idUsuario (FK cascade), concepto VarChar(20), referencia VarChar(40), puntos SmallInt, creadoEn; @@unique([idUsuario, concepto, referencia]) }` (`// +`).
- `gamificacion.service`: `type ResultadoGamificacion = { puntosGanados: number; rachaActual: number; insigniasNuevas: { codigo; nombre }[] }`; `trasCambioDePausa(idUsuario, idPausa, estado): Promise<ResultadoGamificacion>` (en `conBloqueoProgreso`: si `hecha` inserta en el libro `skipDuplicates` y suma 10 solo si insertó; recalcula racha desde los días activos; actualiza `Progreso`; evalúa insignias); `trasRegistroDeSueno(idUsuario, fecha, horas): Promise<ResultadoGamificacion>`; `recalcular(idUsuario)` (tras borrar una pausa).
- [ ] **Step 1: Tests de integración** — `PATCH hecha` → `puntosGanados 10`, `rachaActual 1`; `pendiente` y otra vez `hecha` → `puntosGanados 0`, `GET /progreso` 10 puntos; dos `PATCH hecha` simultáneos sobre pausas distintas del mismo día → 20 puntos y racha 1; registro de sueño con 8 h (meta 7.5) → +5; borrarlo y recrearlo → sigue en 5; con 6 h → 0; tras 10 pausas hechas (fixture directo por Prisma de ventanas/pausas de días pasados + un PATCH real) → `insigniasNuevas` contiene `DIEZ_PAUSAS` una sola vez; borrar una pausa hecha no resta puntos.
- [ ] **Step 2–5:** FAIL → migración + implementar → `npm test` verde → commit `feat: puntos, racha e insignias al registrar cumplimiento`.

### Task 3: `/progreso` y `/progreso/semanal`

**Files:** Create `src/modules/progreso/progreso.{schemas,repository,service,routes}.ts`; modify `src/app.ts`. Test `tests/integration/progreso.test.ts`.

**Interfaces:** `GET /progreso` → `{ puntosTotales, rachaActual (vigente), rachaMaxima, diasComodin, ultimaFechaActiva }`; `GET /progreso/semanal?semana=YYYY-MM-DD` (default hoy) → estructura de §7.5 (`semana`, `sueno`, `actividad`, `racha { actual, comodinesRestantes }`, `insignias` obtenidas esa semana).
- [ ] **Step 1: Tests** — usuario nuevo → ceros; tras una pausa hecha hoy (10 min) con perfil meta 150 → `actividad.minutosAcumulados 10`, `porcentajeMeta 7`, `pausasHechas 1`; registro de sueño de hoy 7.5 → `sueno.promedioHoras 7.5`; `?semana=2026-02-30` → 400; semana sin datos → `promedioHoras null`.
- [ ] **Step 2–5:** FAIL → implementar → verde → commit `feat: progreso y resumen semanal`.

### Task 4: Insignias (catálogo, propias y CRUD admin)

**Files:** Create `src/modules/insignias/insignias.{schemas,repository,service,controller,routes}.ts`; modify `src/app.ts` (y `GET /usuarios/me/insignias` en el router de insignias). Test `tests/integration/insignias.test.ts`.

**Interfaces:** `GET /insignias` → catálogo con `obtenida` y `fechaObtencion` (o `null`); `GET /usuarios/me/insignias` → solo obtenidas; `POST /insignias` (admin, 409 si `codigo` duplicado), `PUT /insignias/:id`, `DELETE /insignias/:id` (admin).
- [ ] **Step 1: Tests** — catálogo ≥ 3 con `obtenida: false`; usuario 403 en `POST`; admin crea/actualiza/borra; tras otorgar una (fixture) → aparece en `/usuarios/me/insignias` y con `obtenida: true`.
- [ ] **Step 2–5:** FAIL → implementar → verde → commit `feat: insignias (catálogo, propias y administración)`.

### Task 5: Documentación, PR y revisión

- [ ] README, DECISIONES (libro de puntos, vigencia de la racha, insignias por estrategia, respuesta del PATCH), cobertura, commit, push, `gh pr create`, checks + Quality Gate, revisión final, fix pass.

**Criterio de aceptación (spec §13):** tests de racha completos; insignias sin duplicados.

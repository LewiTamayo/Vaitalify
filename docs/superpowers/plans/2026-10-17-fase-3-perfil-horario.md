# Fase 3 — Perfil y horario · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de `/perfil` (1:1) y de `/bloques` (con filtros, paginación e importación por lote atómica), con validaciones de rango y orden de horas y aislamiento estricto por usuario.

**Architecture:** Módulos `perfil/` y `bloques/` en capas. Utilidades comunes nuevas: paginación, parámetro `:id` y mapeo de errores Prisma (se mueven desde `usuarios.service`). Toda consulta filtra por `idUsuario`; un recurso ajeno o inexistente responde 404.

**Spec:** `.claude/spec.md` §5, §6.3, §6.4, §9, §11 · `docs/DECISIONES.md`.

## Global Constraints

- Todo lo de las fases 1–2 sigue vigente.
- Horas `"HH:mm"` (`parseHHmm`/`formatHHmm`), JSON `camelCase`, decimales como `number`.
- Perfil: `metaHorasSueno` ∈ [4, 12] múltiplo de 0.5; `metaMinActividad` entero ∈ [0, 1500]; `horaDormir ≠ horaDespertar`.
- Bloque: `tipo` ∈ {`trabajo`,`estudio`,`viaje`}; `titulo` trim 1–80; `diaSemana` entero 1–7; `horaFin > horaInicio` (sin cruzar medianoche, S-11); los bloques **pueden solaparse**.
- `:id` entero 1…2147483647 (rango de `INT` de PostgreSQL); fuera de rango o no numérico → 400.
- Paginación `?page` (≥1, default 1) `&pageSize` (1–100, default 20) → `{ data, meta: { page, pageSize, total } }`. `pageSize > 100` → 400.
- Importación: 1–200 bloques, todos válidos o ninguno se guarda; `origen = importado`; body hasta 1 MB solo en esa ruta.
- El recálculo de micro-ventanas tras mutar bloques (§6.4) **no** es de esta fase: lo añade la Fase 4.

## Review Focus

1. **PATCH que deja `horaFin <= horaInicio`** enviando solo un campo (p. ej. `{ horaInicio: "10:00" }` sobre un bloque 07:00–09:00) → 400 con `campo: 'horaFin'` (la validación ocurre tras combinar con lo guardado). Test en Task 3.
2. **`:id` no numérico o fuera del rango INT** (`/bloques/abc`, `/bloques/99999999999`) → 400, nunca 500 por desbordamiento en PostgreSQL. Test en Task 1 y Task 3.
3. **Recurso de otro usuario** → 404 en GET/PUT/PATCH/DELETE de `/bloques/:id` (no 403). Test en Task 3.
4. **Importación con un bloque inválido en la posición 150** → 400 indicando `bloques.149.horaFin` y **ningún** bloque guardado. Test en Task 4.
5. **`metaHorasSueno: 7.3` o `7.25`** → 400; `7.5` se devuelve como número `7.5` (no `"7.5"`). Test en Task 2.

---

### Task 1: Utilidades comunes (paginación, `:id`, errores Prisma)

**Files:**
- Create: `src/common/utils/pagination.ts`, `src/common/http/params.ts`, `src/common/db/errores-prisma.ts`
- Modify: `src/modules/usuarios/usuarios.service.ts` (usar `errores-prisma.ts`), `src/common/openapi/registry.ts` (helper `respuestaPaginada`)
- Test: `tests/unit/common/utils/pagination.test.ts`, `tests/unit/common/http/params.test.ts`

**Interfaces:**
- Produces (`pagination.ts`): `PaginacionSchema` (`z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) })`); `type Paginacion`; `aSkipTake(p: Paginacion): { skip: number; take: number }`; `interface Pagina<T> { data: T[]; meta: { page; pageSize; total } }`; `pagina<T>(data: T[], total: number, p: Paginacion): Pagina<T>`.
- Produces (`params.ts`): `IdParamSchema = z.object({ id: z.coerce.number().int().min(1).max(2_147_483_647) })`.
- Produces (`errores-prisma.ts`): `esUnicoViolado(e: unknown): boolean` (P2002), `esNoEncontrado(e: unknown): boolean` (P2025).
- Produces (`registry.ts`): `esquemaPaginado<T extends z.ZodType>(item: T)` → `z.object({ data: z.array(item), meta: z.object({ page, pageSize, total }) })`.

- [ ] **Step 1: Tests** — `PaginacionSchema.parse({})` → `{ page: 1, pageSize: 20 }`; `{ pageSize: '101' }` falla; `{ page: '0' }` falla; `aSkipTake({ page: 3, pageSize: 20 })` → `{ skip: 40, take: 20 }`; `pagina([1,2], 57, { page: 1, pageSize: 2 })` → `{ data: [1,2], meta: { page: 1, pageSize: 2, total: 57 } }`. `IdParamSchema`: `'7'` → 7; `'abc'`, `'0'`, `'99999999999'`, `'1.5'` fallan.
- [ ] **Step 2:** FAIL. **Step 3:** implementar y refactorizar `usuarios.service` para importar `esUnicoViolado`/`esNoEncontrado`. **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: utilidades de paginación, parámetro id y errores de Prisma`.

---

### Task 2: `/perfil` (CRUD 1:1)

**Files:**
- Create: `src/modules/perfil/perfil.schemas.ts`, `perfil.repository.ts`, `perfil.service.ts`, `perfil.controller.ts`, `perfil.routes.ts`
- Modify: `src/app.ts`
- Test: `tests/unit/modules/perfil/perfil.schemas.test.ts`, `tests/integration/perfil.test.ts`

**Interfaces:**
- Produces (`perfil.schemas.ts`): `horaSchema` (string `HH:mm`, reutilizable por bloques — exportarlo desde `src/common/utils/time.ts` como `HoraSchema` si encaja mejor allí); `PerfilBaseSchema` (los 4 campos); `PerfilSchema` (= base `.strict()` + refinamiento `horaDormir ≠ horaDespertar` con `path: ['horaDespertar']`); `PerfilParcialSchema` (= base `.partial().strict()` + al menos un campo); `PerfilRespuestaSchema` (OpenAPI `Perfil`: `idPerfil` + los 4 campos); `validarPerfilCompleto(datos): void` (aplica las reglas cruzadas a un perfil ya combinado; lanza `errores.validacion`).
- Produces (`perfil.service.ts`): `type PerfilDto`; `crear(idUsuario, datos): Promise<PerfilDto>` (P2002 → 409 `'Ya tienes un perfil; usa PUT o PATCH'`); `obtener(idUsuario)` (404 con `detail: 'Aún no has configurado tu perfil'` y `hint: 'Crea tu perfil con POST /perfil. Sugerido (OMS): metaHorasSueno 7.5 y metaMinActividad 150'`); `reemplazar(idUsuario, datos)` (404 si no existe); `actualizar(idUsuario, parcial)` (combina con el actual, `validarPerfilCompleto`, guarda); `eliminar(idUsuario)` (404 si no existe).
- Rutas (`perfilRouter`, `requireAuth`): `POST /perfil` 201 + `Location: /api/v1/perfil`; `GET`; `PUT`; `PATCH`; `DELETE` 204.

- [ ] **Step 1: Tests**
  - Unit schemas: válido `{ horaDormir: '22:45', horaDespertar: '06:15', metaHorasSueno: 7.5, metaMinActividad: 150 }`; fallan `metaHorasSueno` 7.3, 7.25, 3.5, 12.5; `metaMinActividad` 1501, -1, 10.5; `horaDormir: '25:00'`; `horaDormir === horaDespertar`; campo extra.
  - Integración: `GET` sin perfil → 404 con `hint` que menciona `POST /perfil`; `POST` → 201 + `Location`, cuerpo con `metaHorasSueno === 7.5` (`typeof` number) y horas `HH:mm`; segundo `POST` → 409; `PATCH { metaHorasSueno: 8 }` → 200 conserva el resto; `PATCH { horaDespertar: '22:45' }` (igual a dormir) → 400; `PUT` completo → 200; `PUT` sin perfil (otro usuario) → 404; `DELETE` → 204 y luego `GET` → 404; sin token → 401.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (repository con `findUnique/create/update/delete` por `idUsuario`; mapeo Decimal → number y TIME → `HH:mm` en un `aDto`). **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: perfil de hábitos (CRUD 1:1)`.

---

### Task 3: `/bloques` (CRUD con filtros y paginación)

**Files:**
- Create: `src/modules/bloques/bloques.schemas.ts`, `bloques.repository.ts`, `bloques.service.ts`, `bloques.controller.ts`, `bloques.routes.ts`
- Modify: `src/app.ts`
- Test: `tests/unit/modules/bloques/bloques.schemas.test.ts`, `tests/integration/bloques.test.ts`, `tests/integration/helpers.ts` (helper `crearBloque`)

**Interfaces:**
- Consumes: `PaginacionSchema`, `aSkipTake`, `pagina`, `IdParamSchema`, `esquemaPaginado` (Task 1); `HoraSchema` (Task 2).
- Produces (`bloques.schemas.ts`): `BloqueBaseSchema` (`tipo, titulo, diaSemana, horaInicio, horaFin`); `BloqueSchema` (base `.strict()` + `horaFin > horaInicio`, mensaje `'horaFin debe ser posterior a horaInicio (los bloques no cruzan medianoche; usa dos bloques)'`, `path: ['horaFin']`); `BloqueParcialSchema` (partial strict, ≥1 campo); `FiltrosBloquesSchema` (`PaginacionSchema` + `tipo?` + `diaSemana?`); `BloqueRespuestaSchema` (OpenAPI `Bloque`: `idBloque` + base + `origen`); `validarBloque(datos)` (regla de orden sobre un bloque combinado, lanza `errores.validacion([{ campo: 'horaFin', … }])`).
- Produces (`bloques.service.ts`): `type BloqueDto`; `crear(idUsuario, datos)`; `listar(idUsuario, filtros): Promise<Pagina<BloqueDto>>` (orden `diaSemana, horaInicio`); `obtener(idUsuario, idBloque)` (404 si no existe **o** es de otro usuario: consultar con `where: { idBloque, idUsuario }`); `reemplazar`; `actualizar` (combina + `validarBloque`); `eliminar`. `origen` siempre `manual` en estas rutas.
- Rutas (`bloquesRouter`, `requireAuth`): `POST /bloques` 201 + `Location: /api/v1/bloques/:id`; `GET /bloques`; `GET|PUT|PATCH|DELETE /bloques/:id`.

- [ ] **Step 1: Tests**
  - Unit schemas: válido `{ tipo: 'estudio', titulo: 'Clase de Cálculo', diaSemana: 2, horaInicio: '07:00', horaFin: '09:00' }`; fallan `horaFin === horaInicio`, `horaFin < horaInicio`, `diaSemana` 0 y 8, `tipo: 'ocio'`, `titulo` vacío o de 81 caracteres, `horaFin: '24:00'`.
  - Integración (usuario A y B):
    - `POST` → 201 + `Location` + `origen: 'manual'`; dos bloques solapados del mismo día → ambos 201.
    - `GET /bloques?diaSemana=2&tipo=estudio` filtra; `?page=2&pageSize=1` → `meta.total` correcto y 1 elemento; `?pageSize=101` → 400.
    - `GET /bloques/abc` → 400; `GET /bloques/99999999999` → 400 (Review Focus 2).
    - `PATCH { horaInicio: '10:00' }` sobre 07:00–09:00 → 400 con `campo: 'horaFin'` (Review Focus 1); `PATCH { titulo: 'Nuevo' }` → 200.
    - `PUT` completo → 200; `DELETE` → 204 y luego `GET /bloques/:id` → 404.
    - B sobre el bloque de A: `GET`, `PUT`, `PATCH`, `DELETE` → 404, y el bloque de A sigue intacto (Review Focus 3); el listado de B no incluye bloques de A.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (operaciones de escritura con `updateMany/deleteMany where { idBloque, idUsuario }` y `count === 0` → 404, para no consultar dos veces). **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: bloques de horario (CRUD con filtros y paginación)`.

---

### Task 4: `POST /bloques/importar` (lote atómico)

**Files:**
- Modify: `bloques.schemas.ts`, `bloques.service.ts`, `bloques.repository.ts`, `bloques.routes.ts`, `src/app.ts` (parser JSON de 1 MB solo para esta ruta)
- Test: `tests/integration/bloques-importar.test.ts`

**Interfaces:**
- Produces: `ImportarBloquesSchema = z.object({ bloques: z.array(BloqueSchema).min(1).max(200) }).strict()`; `importar(idUsuario, bloques): Promise<{ importados: number; bloques: BloqueDto[] }>` — `prisma.$transaction` con `createManyAndReturn` (`origen: 'importado'`).
- `app.ts`: el `express.json({ limit: '100kb' })` global se salta `POST /api/v1/bloques/importar`; esa ruta usa su propio `express.json({ limit: '1mb' })`.

- [ ] **Step 1: Tests** — 3 bloques válidos → 201 `{ importados: 3 }` y todos con `origen: 'importado'`; 200 bloques → 201; 201 bloques → 400; `bloques: []` → 400; 200 bloques con el de índice 149 inválido (`horaFin < horaInicio`) → 400 con `errors[].campo === 'bloques.149.horaFin'` y `GET /bloques` del usuario con `total` sin cambios (Review Focus 4); cuerpo de ~150 kB válido en esta ruta no da 413 (títulos largos dentro del límite de 80 no llegan; usar 200 bloques con `titulo` de 80 caracteres ≈ 25 kB y comprobar además que `POST /bloques` con un cuerpo de 150 kB sí da 413).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: importación de bloques por lote (atómica, máx. 200)`.

---

### Task 5: Documentación, verificación y PR

- [ ] **Step 1:** `README.md` (endpoints de perfil y bloques) y `docs/DECISIONES.md` (PUT sin perfil → 404 y no upsert; PATCH valida tras combinar; `:id` limitado al rango INT; bloque que termina a medianoche se registra hasta `23:59`; parser de 1 MB solo en importar; paginación con `pageSize > 100` → 400 en vez de recortar).
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm run test:coverage` → verde.
- [ ] **Step 3:** commit + push; `gh pr create --base main --head fase-3-perfil-horario` con resumen y checklist; esperar CI y Quality Gate (`gh pr checks --watch`).
- [ ] **Step 4:** revisión final de la rama (subagente) → fix pass → avisar al usuario para mergear.

**Criterio de aceptación (spec §13):** validaciones de rango y orden de horas; aislamiento por usuario.

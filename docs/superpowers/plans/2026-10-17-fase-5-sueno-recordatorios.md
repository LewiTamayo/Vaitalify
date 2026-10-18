# Fase 5 — Sueño y recordatorios · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registros de sueño (RF-07), hora sugerida para acostarse (RF-06, §7.3), configuración de notificaciones (RF-10), recordatorios generados en servidor y entregados por el cliente (§7.7, S-15) y tareas programadas con Vercel Cron.

**Architecture:** Lógica pura en `sueno.domain.ts` (hora de acostarse, checklist) y `recordatorios.domain.ts` (recordatorios deseados de un día, silencio, sincronización). Módulos nuevos `registros-sueno/`, `sueno/`, `config-notificaciones/`, `recordatorios/`, `jobs/`. Los servicios de bloques, perfil, micro-pausas y config regeneran los recordatorios del día afectado sin fallar la operación. Rama apilada sobre `fase-4-nucleo` (PR #8 aún abierto).

**Spec:** `.claude/spec.md` §5 (idempotencia), §6.8–§6.10, §6.12 (jobs), §7.3, §7.7, §12, §14 (S-10, S-13, S-15) · `docs/DECISIONES.md`.

## Global Constraints

- Todo lo de las fases 1–4 sigue vigente.
- `MARGEN_PREPARACION_MIN` (env, default 45). Instantes (`fechaHoraEnvio`) en ISO-8601 UTC; horas locales en `APP_TZ`.
- Registro de sueño: `horasDormidas` ∈ [0, 16] múltiplo de 0.5; `fecha` (`FechaSchema`) **no futura** respecto a `hoyEnZona()`; una por `(usuario, fecha)` → 409. `POST` y `PUT` aceptan `Idempotency-Key`.
- §7.3: `primeraActividad(D+1)` = bloque de menor `horaInicio` con `diaSemana = isoWeekday(D+1)`; `despertar = inicio − margen`; `acostarse = despertar − metaHorasSueno·60`. Sin bloques en D+1 → `acostarse = perfil.horaDormir` y `despertar = perfil.horaDespertar`. `horasDeSuenoLogradas = (despertar − acostarse) mod 24h` en horas (1 decimal). Sin perfil → 422.
- Checklist (orden fijo): `{ texto: 'Deja las pantallas', hora: acostarse−30 }`, `{ texto: 'Prepara lo de mañana', hora: acostarse−45 }`, `{ texto: 'Última cafeína antes de las 16:00', hora: null }`.
- Recordatorios de un día D: `sueno` a `acostarse−30` ("Deja las pantallas: en 30 minutos es hora de dormir") y a `acostarse` ("Hora de dormir para cumplir tu meta de sueño"); `pausa` 5 min antes de cada micro-pausa `pendiente` de D ("En 5 minutos: <actividad>"). Un instante local de la noche con hora < 12:00 pertenece a D+1.
- Ámbito de un día D para sincronizar: instantes en `[D 04:00, D+1 04:00)` locales. Solo se tocan recordatorios con `enviado = false`.
- Config: tipo inactivo → no se genera. En silencio → se mueve al fin del silencio si sigue antes de su límite (pausa: inicio de su ventana; sueño: hora de despertar); si no, se descarta. Silencio puede cruzar medianoche; `silencioInicio` y `silencioFin` van juntos (ambos o ninguno) y distintos.
- Unicidad natural de recordatorios `(idUsuario, tipo, fechaHoraEnvio)`: nueva migración con índice único.
- `/recordatorios/pendientes?horas=n` (1–72, default 24): no enviados entre ahora y ahora+n h, de tipos activos, ordenados por instante.
- Jobs: `GET /jobs/generar-recordatorios` y `GET /jobs/limpieza` solo con `Authorization: Bearer ${CRON_SECRET}` (comparación en tiempo constante); sin `CRON_SECRET` configurado → 401 siempre. Fuera del rate limit global. `vercel.json` con los dos crons del spec §7.7.
- Generación diaria por lotes de 100 usuarios con perfil; idempotente.

## Review Focus

1. **Acostarse después de medianoche** (meta de 9 h y primera actividad a las 07:00 → 21:15; meta 7 h con primera actividad 06:00 → 22:15; perfil con `horaDormir` 00:30) → los instantes de los recordatorios caen en D+1 y nunca en el pasado del día D. Test en Task 1.
2. **Generar dos veces el mismo día** (cron repetido, cron + cambio de bloque) → sin duplicados; un recordatorio ya `enviado` no se toca. Test en Task 4.
3. **Silencio que cruza medianoche** (22:00→07:00): el "Deja las pantallas" de las 22:15 se movería a las 07:00 del día siguiente, después de su límite (despertar 06:15) → se descarta; una pausa a las 06:55 de una ventana de 07:00 → se descarta. Ninguno se programa dentro del silencio. Test en Task 1.
4. **Cron sin `CRON_SECRET` o con secreto incorrecto o de distinta longitud** → 401, sin lanzar (`timingSafeEqual` exige longitudes iguales). Test en Task 5.
5. **Registro de sueño con fecha futura en Bogotá pero no en UTC** (a las 20:00 de Bogotá, "mañana" en UTC ya es hoy) → 422 usando `hoyEnZona()`. Test en Task 2.

---

### Task 1: Dominio puro (sueño y recordatorios)

**Files:**
- Create: `src/modules/sueno/sueno.domain.ts`, `src/modules/recordatorios/recordatorios.domain.ts`
- Test: `tests/unit/modules/sueno/sueno.domain.test.ts`, `tests/unit/modules/recordatorios/recordatorios.domain.test.ts`

**Interfaces:**
- Produces (`sueno.domain.ts`): `interface PlanSueno { acostarse: string; despertar: string; horasDeSuenoLogradas: number; primeraActividad: { titulo: string; horaInicio: string } | null; checklist: { texto: string; hora: string | null }[] }`; `calcularPlanSueno(perfil: { horaDormir; horaDespertar; metaHorasSueno }, bloquesDiaSiguiente: { titulo; horaInicio }[], margenMin: number): PlanSueno`.
- Produces (`recordatorios.domain.ts`):
  - `instanteNoche(fecha: string, hora: string, zona: string): Date` (hora < 12:00 → D+1); `instanteDia(fecha, hora, zona): Date`.
  - `interface Deseado { tipo: 'sueno' | 'pausa'; mensaje: string; fechaHoraEnvio: Date; limite: Date }`.
  - `recordatoriosDelDia(fecha, plan: PlanSueno | null, pausas: { horaInicio: string; actividad: string }[], zona): Deseado[]`.
  - `interface Config { tipo: 'sueno' | 'pausa' | 'logros'; activa: boolean; silencioInicio: string | null; silencioFin: string | null }`; `aplicarConfig(deseados, configs, zona): Deseado[]` (inactivos fuera; silencio → mover/descartar).
  - `ambitoDia(fecha, zona): { desde: Date; hasta: Date }` (`[D 04:00, D+1 04:00)`).
  - `planSincronizacion(existentes: { idRecordatorio; tipo; fechaHoraEnvio: Date; enviado: boolean }[], deseados: Deseado[]): { crear: Deseado[]; eliminar: number[]; conservados: number }` — clave `tipo|iso`; los `enviado` nunca se eliminan.
- [ ] **Step 1: Tests** — ejemplo del mockup: perfil meta 7.5, bloque D+1 07:00, margen 45 → `acostarse '22:45'`, `despertar '06:15'`, `horasDeSuenoLogradas 7.5`, checklist `['22:15','22:00',null]`; sin bloques → `acostarse = horaDormir`, `despertar = horaDespertar`, `primeraActividad null`, logradas = diferencia (22:45→06:15 = 7.5); dos bloques en D+1 → usa el de menor hora; meta 9 h + 07:00 → `21:15`; `horaDormir '00:30'` sin bloques → logradas `5.75`→ redondeo a 1 decimal (`5.8`). `instanteNoche('2026-10-19','00:30','America/Bogota')` → `2026-10-20T05:30:00.000Z`; `instanteNoche('2026-10-19','22:15', …)` → `2026-10-20T03:15:00.000Z`. `recordatoriosDelDia` con plan del mockup y pausa 10:00 → 3 recordatorios (22:15, 22:45 locales y 09:55). `aplicarConfig`: sueño inactivo → solo pausa; silencio 22:00→07:00 → 22:15/22:45 se mueven a 07:00 del día siguiente y como el límite (despertar 06:15) es anterior se **descartan**; pausa 06:55 con ventana 07:00 en silencio hasta 07:30 → descartada; pausa 09:55 con silencio 09:00→09:58 → se mueve a 09:58 (límite 10:00) y se conserva. `planSincronizacion`: existente igual → conservado; existente no deseado y no enviado → eliminar; enviado no deseado → se conserva; deseado nuevo → crear.
- [ ] **Step 2:** FAIL. **Step 3:** implementar con Luxon (`DateTime.fromISO(\`\${fecha}T\${hora}\`, { zone })`). **Step 4:** verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: dominio de higiene del sueño y recordatorios`.

---

### Task 2: Registros de sueño y recomendación

**Files:**
- Create: `src/modules/registros-sueno/registros-sueno.{schemas,repository,service,controller,routes}.ts`, `src/modules/sueno/sueno.{schemas,repository,service,controller,routes}.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/registros-sueno.test.ts`, `tests/integration/sueno.test.ts`

**Interfaces:**
- Produces (`registros-sueno.service.ts`): `type RegistroSuenoDto = { idRegistro; fecha; horasDormidas }`; `crear(idUsuario, datos)` (fecha futura → 422 `'No puedes registrar el sueño de una fecha futura'`; P2002 → 409); `listar(idUsuario, { desde?, hasta?, page, pageSize })`; `obtener`; `reemplazar` (mismas reglas); `eliminar`.
- Produces (`sueno.service.ts`): `planDelDia(idUsuario, fecha): Promise<PlanSueno>` (422 sin perfil) — reutilizado por recordatorios; `recomendacion(idUsuario, fecha = hoyEnZona())` → `{ fecha, horaSugeridaAcostarse, horaDespertar, primeraActividad, horasDeSuenoLogradas, checklist }`.
- `sueno.repository.ts`: `cargar(idUsuario, diaSemana)` → perfil + bloques de ese día (solo lectura).
- Rutas: `POST/GET /registros-sueno`, `GET/PUT/DELETE /registros-sueno/:id` (`POST` y `PUT` con `idempotencia()`); `GET /sueno/recomendacion?fecha=`.
- [ ] **Step 1: Tests** — `POST` 201 con `horasDormidas: 7.5` numérico; mismo día → 409; `horasDormidas` 7.3 o 17 → 400; fecha `sumarDias(hoyEnZona(), 1)` → 422 (Review Focus 5); `PUT` a una fecha ya registrada → 409; listar con rango; ajeno → 404; `Idempotency-Key` en `POST` repetido → `idempotent-replayed`. Recomendación: sin perfil → 422; perfil 22:45/06:15/7.5 y bloque mañana 07:00 → `horaSugeridaAcostarse '22:45'`, `primeraActividad.horaInicio '07:00'`; sin bloques mañana → `'22:45'` desde el perfil y `primeraActividad: null`; `?fecha=2026-02-30` → 400.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: registros de sueño y hora sugerida para acostarse`.

---

### Task 3: Configuración de notificaciones

**Files:**
- Create: `src/modules/config-notificaciones/config-notificaciones.{schemas,repository,service,controller,routes}.ts`
- Modify: `src/app.ts`
- Test: `tests/integration/config-notificaciones.test.ts`, `tests/unit/modules/config-notificaciones/config-notificaciones.schemas.test.ts`

**Interfaces:**
- Produces: `type ConfigDto = { tipo; activa; silencioInicio: string | null; silencioFin: string | null }`; service `listar(idUsuario)` (los 3, en orden `sueno, pausa, logros`), `crear(idUsuario, tipo, datos)` (409 si existe), `obtener(idUsuario, tipo)` (404), `reemplazar(idUsuario, tipo, datos)` (404 si no existe), `restablecer(idUsuario, tipo)` (upsert a `activa=true`, sin silencio); `configsDe(idUsuario): Promise<Config[]>` para recordatorios.
- Schema `ConfigSchema = { activa: boolean, silencioInicio: Hora | null, silencioFin: Hora | null }` strict; refinamientos: ambos null o ambos con valor; distintos. `TipoParamSchema = { tipo: enum }`. `POST` body: `ConfigSchema.extend({ tipo })`.
- Rutas: `GET/POST /config-notificaciones`, `GET/PUT/DELETE /config-notificaciones/:tipo` (`DELETE` → 204).
- [ ] **Step 1: Tests** — schema: solo `silencioInicio` → falla; iguales → falla; 22:00→07:00 → válido. Integración: tras registrarse `GET` → 3 configs activas sin silencio; `POST` de un tipo existente → 409; `DELETE /sueno` → 204 y luego `POST /sueno` … (409, porque el reset no borra: restablecer = upsert); `PUT /pausa` con silencio 22:00→07:00 → 200; `GET /config-notificaciones/xyz` → 400; `DELETE` y luego `GET /pausa` → `activa: true`, sin silencio.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde.
- [ ] **Step 5: Commit** `feat: configuración de notificaciones`.

---

### Task 4: Recordatorios (generar, consultar, pendientes, editar) y regeneración automática

**Files:**
- Create: `prisma/migrations/<timestamp>_recordatorio_unico/migration.sql`, `src/modules/recordatorios/recordatorios.{schemas,repository,service,controller,routes}.ts`
- Modify: `prisma/schema.prisma` (`@@unique([idUsuario, tipo, fechaHoraEnvio])`), `src/app.ts`, servicios de `bloques`, `perfil`, `micro-pausas`, `config-notificaciones` (llamar `regenerarSinFallar`)
- Test: `tests/integration/recordatorios.test.ts`

**Interfaces:**
- Consumes: Task 1 (dominio), `sueno.service.planDelDia`, `configNotificaciones.service.configsDe`.
- Produces (`recordatorios.service.ts`): `generar(idUsuario, fecha): Promise<{ generados: number; eliminados: number; conservados: number }>` — dentro de un `$transaction`: lee pausas pendientes del día, existentes del ámbito, aplica `planSincronizacion` (`createMany skipDuplicates`). Sin perfil: no genera recordatorios de sueño (sí los de pausa). `regenerarSinFallar(idUsuario, fecha = hoyEnZona())`; `listar`, `obtener`, `pendientes(idUsuario, horas)`, `actualizar(idUsuario, id, cambios)` (editar mensaje/instante solo si `enviado=false` → 422; `{ enviado: true }` como acuse), `eliminar`.
- Rutas: `POST /recordatorios/generar` `{ fecha? }`, `GET /recordatorios`, `GET /recordatorios/pendientes` (antes de `/:id`), `GET/PATCH/DELETE /recordatorios/:id`.
- Hooks: bloques/perfil/config → `regenerarSinFallar(idUsuario)` (hoy); micro-pausas (recomendar, cambiar estado/actividad, eliminar) → `regenerarSinFallar(idUsuario, fechaDeLaVentana)`.
- [ ] **Step 1: Tests** — con perfil 22:45/06:15/7.5 y sin bloques mañana: `POST /generar { fecha: hoy }` → `generados: 2`; otra vez → `{ generados: 0, conservados: 2 }` (Review Focus 2); marcar uno `{ enviado: true }` y regenerar con la config de sueño inactiva → el enviado sigue, el otro se elimina; recomendar una micro-pausa hoy en una ventana futura → aparece un recordatorio `pausa` 5 min antes (regeneración automática); `PATCH` de mensaje en un enviado → 422; `/pendientes?horas=73` → 400; `/pendientes?horas=72` → solo no enviados, ordenados y en el futuro; ajeno → 404.
- [ ] **Step 2:** FAIL. **Step 3:** migración con `prisma migrate diff --from-schema <copia anterior> --to-schema prisma/schema.prisma --script`; implementar. **Step 4:** `npm run db:migrate:test` y `npm test` verde + lint + typecheck.
- [ ] **Step 5: Commit** `feat: recordatorios generados en servidor y regeneración automática`.

---

### Task 5: Jobs de Vercel Cron, NotificationSender y vercel.json

**Files:**
- Create: `src/common/middleware/cron-auth.ts`, `src/modules/jobs/jobs.{service,controller,routes}.ts`, `src/common/notifications/notification-sender.ts`
- Modify: `vercel.json` (crons §7.7), `src/app.ts` (jobs antes del límite global), `src/modules/auth/auth.repository.ts` (`borrarCaducados()`), `tests/setup-env.ts` (`CRON_SECRET` de test)
- Test: `tests/unit/common/middleware/cron-auth.test.ts`, `tests/integration/jobs.test.ts`

**Interfaces:**
- Produces: `cronAuth: RequestHandler` (401 sin header, con otro secreto, de distinta longitud o si `env.CRON_SECRET` no existe); `jobs.service.generarRecordatoriosDeHoy(): Promise<{ usuarios: number; generados: number }>` (por lotes de 100 usuarios con perfil, `regenerar`), `limpiar(): Promise<{ idempotencia: number; refreshTokens: number }>`; `interface NotificationSender { enviar(n: { idUsuario; titulo; cuerpo }): Promise<void> }` + `LogSender` (S-13; no lo usa ningún flujo aún, deja el punto de extensión).
- [ ] **Step 1: Tests** — `cronAuth`: sin header → 401; `Bearer x` → 401; secreto correcto → pasa; sin `CRON_SECRET` en env → 401 (Review Focus 4). Integración: `GET /jobs/limpieza` con el secreto → 200 y borra una `idempotency_key` de hace 25 h y un refresh token vencido creados en el test; `GET /jobs/generar-recordatorios` → 200 con `usuarios ≥ 1` y el usuario de prueba con sus recordatorios de hoy.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** verde.
- [ ] **Step 5: Commit** `feat: jobs de Vercel Cron (recordatorios diarios y limpieza)`.

---

### Task 6: Documentación, PR y revisión

- [ ] README (endpoints, flujo de recordatorios con notificaciones locales), DECISIONES (ámbito 04:00–04:00, regla de silencio con límites, regeneración automática, unicidad natural, `CRON_SECRET` obligatorio solo para los jobs, `LogSender`), `npm run test:coverage`, commit, push, `gh pr create --base fase-4-nucleo` (o `main` si el #8 ya se mergeó), checks + Quality Gate, revisión final y fix pass.

**Criterio de aceptación (spec §13):** ejemplo 07:00 → 22:45 correcto; silencio respetado; job idempotente; 401 sin `CRON_SECRET`.

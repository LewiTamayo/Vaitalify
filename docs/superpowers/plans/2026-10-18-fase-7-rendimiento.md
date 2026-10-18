# Fase 7 — Rendimiento con JMeter: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: superpowers:executing-plans (elegida por el usuario). Pasos con casillas (`- [ ]`).

**Objetivo:** pruebas de rendimiento reales de la API con Apache JMeter: datos de prueba, plan `.jmx`, escenarios, ejecuciones con resultados y `docs/RENDIMIENTO.md` con números medidos.

**Arquitectura:**
- La API corre en local con Node (`APP_ENV=perf`, rate limit apagado) contra la rama `perf` de Neon (U-2). Ahí se ejecutan carga, estrés y pico.
- El *smoke* corre contra el Preview protegido de Vercel con el header de bypass (U-9).
- Dos scripts TypeScript envuelven JMeter:
  - `ejecutar.ts` lanza los escenarios y nunca escribe el token en la consola.
  - `resumen.ts` convierte el `.jtl` en la tabla del informe y evalúa los umbrales de §19.5.

**Stack:** Apache JMeter 5.6.3 (`C:\jmeter\bin\jmeter.bat`), tsx, Vitest y Prisma, con los servicios existentes de la API.

**Spec:** `.claude/spec.md` §19 (y §13, Fase 7) + `docs/superpowers/specs/2026-10-17-vitalify-api-design.md` (U-2, U-9).

## Restricciones globales
- **Dónde corre cada prueba:**
  - Vercel Preview: solo *smoke* (≤ 5 usuarios, ≤ 1 min).
  - Vercel Production: ninguna prueba de JMeter.
  - Carga, estrés y pico: solo en local contra la rama `perf`.
- **Configuración del perf:** `APP_ENV=perf`, `RATE_LIMIT_ENABLED=false` y el **mismo** `BCRYPT_COST` que producción (12).
- **Plan JMeter (§19.4):**
  - Variables `PROTOCOL/HOST/PORT/USERS/RAMP/DURATION` con `__P` y sus defaults (`http`, `localhost`, `3000`, `10`, `30`, `60`).
  - Ruta base `/api/v1`.
  - Headers:
    - `Content-Type: application/json`;
    - `Authorization: Bearer ${accessToken}`;
    - `x-test-run: ${__P(run,local)}`;
    - `x-vercel-protection-bypass: ${__P(bypass,)}` (U-9).
  - CSV `correo,contrasena` con `recycle=false` y `stopThread=true`.
  - Login dentro de un *Once Only Controller*.
  - Mezcla: hoy 30 %, semanal 20 %, PATCH pausa 15 %, recomendación de sueño 10 %, POST registros-sueno 10 % (409 válido), POST+DELETE bloques 15 %.
  - *Uniform Random Timer* de 1 a 3 s, *Duration Assertion* de 2000 ms y ningún listener en el `.jmx`.
- **Escenarios** (`users` / `ramp` / `duration`):

  | Escenario | users | ramp (s) | duration (s) |
  |---|---|---|---|
  | smoke | 5 | 10 | 60 |
  | carga | 100 | 120 | 600 |
  | estres | 400 | 1200 | 1500 |
  | pico | 300 | 5 | 180 |
  | resistencia | 50 | 60 | 3600 |

- **Umbrales de carga:**
  - error < 1 %;
  - p95 de GET ≤ 500 ms;
  - p95 de escrituras ≤ 800 ms;
  - p95 de login ≤ 1500 ms;
  - throughput estable.
- **Punto de quiebre del estrés:** error > 5 % o p95 > 2 s.
- **Datos:** `prisma/seed-perf.ts` crea `PERF_USERS` usuarios `perf_0001@vitalify.test`…, cada uno con perfil, 10 a 15 bloques semanales y ventanas con pausas pendientes para 7 días. Exporta `tests/performance/data/usuarios.csv`, que ya está en `.gitignore`.
- **Secretos:** ninguno en el repo ni en la consola. El bypass sale de `VERCEL_BYPASS_TOKEN` en `.env.perf`. La contraseña de los usuarios perf es `PERF_USER_PASSWORD` o, si falta, una aleatoria de `crypto` que solo queda en el CSV.
- **Código:** ESLint con sonarjs sin errores, sin `console.log` en `src/` y complejidad ≤ 15.

## Review Focus
1. **Volver a correr `seed-perf`** no duplica usuarios ni bloques, y la contraseña del CSV siempre coincide con el hash guardado. *Test:* `contrasenaPerf` y la idempotencia se verifican en la ejecución real (Tarea 1, paso 6).
2. **Un usuario sin pausas hoy no debe hacer fallar el PATCH:** si el extractor no encuentra un id, el PATCH se salta. *Test:* el contrato del `.jmx` exige un *If Controller* alrededor del PATCH (Tarea 2).
3. **Las fechas aleatorias de `POST /registros-sueno` nunca son futuras,** porque la API respondería 422 y contaría como error. *Test:* el contrato exige `__RandomDate` con un fin ≤ hoy, de la forma `${__time(yyyy-MM-dd)}` (Tarea 2).
4. **El `.jtl` contiene filas de controladores y de muestras con éxito y con error;** el resumen agrupa por la etiqueta del sampler y calcula los percentiles por *nearest-rank*. *Test:* en `resumen.test.ts` (Tarea 3).
5. **El token de bypass nunca aparece en la línea de comandos que se imprime.** *Test:* `argumentosJmeter()` lo pasa en un archivo `-q` temporal, no como `-J` (Tarea 3).

---

### Tarea 1: datos de prueba y arranque de la API en modo perf

**Archivos:**
- Crear `prisma/seed-perf.ts`, `scripts/perf-start.ts` y `tests/unit/performance/seed-perf.test.ts`.
- Modificar `package.json` (scripts) y `.gitignore` (`jmeter.log`).

**Interfaces:**
- Produce:
  - `correoPerf(i: number): string`, que da `perf_0001@vitalify.test`;
  - `horarioPerf(i: number): DatosBloque[]`, que da entre 10 y 15 bloques válidos para `BloqueSchema` y es determinista por `i`;
  - `lineasCsv(correos: string[], contrasena: string): string`, con la cabecera `correo,contrasena` y un salto de línea final;
  - `sembrarPerf(cantidad: number, contrasena: string): Promise<void>`.
- Scripts npm:
  - `perf:migrate`: `migrate deploy` con `.env.perf`;
  - `perf:seed`: el catálogo con `.env.perf`;
  - `db:seed:perf`: el seed de perf con `.env.perf`;
  - `perf:start`: `tsx scripts/perf-start.ts`.

- [ ] **Paso 1. Tests:**
  - `correoPerf(1) === 'perf_0001@vitalify.test'` y `correoPerf(123) === 'perf_0123@vitalify.test'`;
  - para `i` de 1 a 50, `horarioPerf(i)` tiene entre 10 y 15 bloques, todos válidos en `BloqueSchema.safeParse`, y `horarioPerf(7)` es igual en dos llamadas;
  - `lineasCsv(['a@x','b@x'],'p')` da `'correo,contrasena\na@x,p\nb@x,p\n'`.
- [ ] **Paso 2.** Correr `npx vitest run tests/unit/performance/seed-perf.test.ts` y confirmar que FALLA (el módulo no existe).
- [ ] **Paso 3. Implementación:**
  - La importación desde `prisma/seed-perf.ts` no debe ejecutar nada; el `main` corre solo como script, con el mismo patrón `pathToFileURL` de `seed.ts`.
  - `sembrarPerf`:
    1. Calcula el hash una sola vez con `hashContrasena` (`BCRYPT_COST` del env).
    2. Hace upsert de cada usuario: si ya existe, actualiza el hash; crea `progreso` y `configs` como en `seed.ts`.
    3. Hace upsert del perfil (06:15 / 22:45 / 7,5 / 150).
    4. Si el usuario no tiene bloques, `createMany` con `horarioPerf(i)`.
    5. Llama a `recalcularSemana` y luego a `recomendar` para cada ventana sin pausa de los próximos 7 días, ignorando 409 y 422.
    6. Todo con una concurrencia de 10 usuarios a la vez.
    7. Escribe el CSV.
  - `scripts/perf-start.ts`:
    - pone `DOTENV_CONFIG_PATH=.env.perf`, `APP_ENV=perf` y `RATE_LIMIT_ENABLED=false`;
    - si faltan, genera `JWT_*` aleatorios de 32 bytes en hex;
    - después importa `../src/local.js`.
- [ ] **Paso 4.** Correr el test del paso 2 y confirmar que PASA.
- [ ] **Paso 5.** Correr `npm run perf:migrate && npm run perf:seed && npm run db:seed:perf`. Esperado: el CSV tiene `PERF_USERS + 1` líneas.
- [ ] **Paso 6. Idempotencia:** repetir `db:seed:perf` y confirmar que el conteo de usuarios y bloques `perf_` no cambia y que un login con la contraseña del CSV responde 200 (con la API levantada con `perf:start`).
- [ ] **Paso 7.** Commit: `feat(perf): datos de prueba y arranque de la API en modo perf`.

### Tarea 2: plan JMeter y escenarios

**Archivos:**
- Crear `tests/performance/vitalify.jmx` y `tests/performance/escenarios/{smoke,carga,estres,pico,resistencia}.properties`.
- Test: `tests/unit/performance/plan-jmeter.test.ts`.

**Interfaces:**
- Produce las propiedades `protocol`, `host`, `port`, `users`, `ramp`, `duration`, `run`, `bypass` y `usuarios` (la ruta del CSV, por defecto `data/usuarios.csv` relativa al `.jmx`).
- Etiquetas de los samplers (las usa `resumen.ts`): `POST /auth/login`, `GET /micro-pausas/hoy`, `GET /progreso/semanal`, `PATCH /micro-pausas/{id}`, `GET /sueno/recomendacion`, `POST /registros-sueno`, `POST /bloques` y `DELETE /bloques/{id}`.

- [ ] **Paso 1. Test de contrato** (lee los archivos como texto):
  - cada `.properties` tiene los valores exactos de la tabla de escenarios;
  - el `.jmx`:
    - contiene las 8 etiquetas;
    - tiene `recycle` en false y `stopThread` en true;
    - tiene el header `x-vercel-protection-bypass` con `${__P(bypass,)}`;
    - tiene la Duration Assertion de `2000`;
    - tiene porcentajes de Throughput Controller iguales a `30`, `20`, `15`, `10`, `10` y `15`;
    - tiene un `IfController` que referencia `idPausa`;
    - usa `__RandomDate` con `${__time(yyyy-MM-dd)}`;
    - no tiene ningún `ResultCollector`.
- [ ] **Paso 2.** Correr el test y confirmar que FALLA.
- [ ] **Paso 3. Escribir el `.jmx` y los escenarios.** El orden de cada hilo:
  1. *Once Only*: login + JSON Extractor de `accessToken`.
  2. GET de hoy + JSON Extractor de `idPausa` (`$[0].idPausa`, default `NONE`) dentro de su controlador.
  3. El PATCH envía `{"estado":"hecha"}` dentro de `If ${idPausa} != NONE`.
  4. El POST de bloques usa `diaSemana` aleatorio y 23:00–23:30, extrae `idBloque` y le sigue su DELETE.
  - Las Response Assertions aceptan 200, 201 y 204, y además 409 en registros-sueno.
- [ ] **Paso 4.** Correr el test y confirmar que PASA.
- [ ] **Paso 5. Validación real:** con `perf:start` levantado, correr el smoke en local con `ejecutar.ts` (Tarea 3) o con `jmeter -n` directo. Esperado: 0 % de error y las 8 etiquetas presentes en el `.jtl`.
- [ ] **Paso 6.** Commit: `feat(perf): plan JMeter y escenarios`.

### Tarea 3: ejecución y resumen de resultados

**Archivos:**
- Crear `tests/performance/ejecutar.ts`, `tests/performance/resumen.ts` y `tests/performance/preparar-preview.ts`.
- Tests: `tests/unit/performance/resumen.test.ts` y `tests/unit/performance/ejecutar.test.ts`.

**Interfaces:**
- `leerJtl(csv: string): Muestra[]`, donde `Muestra = { etiqueta, ms, ok, codigo, inicio }`.
- `resumir(muestras): FilaResumen[]`, con una fila por etiqueta más una fila `TOTAL`: `{ etiqueta, muestras, p50, p90, p95, p99, errorPct, throughput }`.
- `evaluarUmbrales(filas): Array<{ regla, valor, umbral, cumple }>`, que aplica §19.5.
- `tablaMarkdown(filas): string`.
- `argumentosJmeter(op: { escenario, jmx, salida, propsTemporales?, extra? }): string[]`.
- Uso desde la línea de comandos:
  - `tsx tests/performance/ejecutar.ts <escenario> [--preview <url>]`;
  - `tsx tests/performance/resumen.ts <jtl>`.

- [ ] **Paso 1. Tests:**
  - `resumir` sobre 100 muestras de 1..100 ms da `p50 = 50`, `p95 = 95` y `p99 = 99` por *nearest-rank*.
  - El error % cuenta `ok = false`.
  - El throughput es igual a las muestras entre la ventana (`max(inicio + ms) − min(inicio)`), en segundos.
  - `leerJtl` respeta las comas entre comillas del CSV de JMeter.
  - `evaluarUmbrales`: con un GET de p95 = 600, la regla "p95 lecturas" no se cumple; con un login de p95 = 1400 sí se cumple.
  - `argumentosJmeter` con bypass no contiene el token y sí `-q` con el archivo temporal.
- [ ] **Paso 2.** Correr los tests y confirmar que FALLAN.
- [ ] **Paso 3. Implementación:**
  - `ejecutar.ts`:
    - toma el jmeter de `JMETER_HOME` o `C:\jmeter`;
    - escribe en `tests/performance/resultados/<escenario>-<AAAAMMDD-HHmm>/` el `resultados.jtl` y la carpeta `reporte/` (con `-e -o`);
    - para Preview, primero llama a `preparar-preview.ts`, que registra 5 usuarios temporales y les prepara perfil, horario y pausas a través de la API con el header de bypass; luego escribe un CSV temporal y, al terminar, borra esos usuarios con `DELETE /usuarios/me`;
    - imprime la tabla de `resumen`.
  - `resumen.ts`: la parte de línea de comandos imprime la tabla y los umbrales.
- [ ] **Paso 4.** Correr los tests y confirmar que PASAN.
- [ ] **Paso 5.** Commit: `feat(perf): ejecución de escenarios y resumen de resultados`.

### Tarea 4: ejecuciones, mejora y documentación

**Archivos:**
- Crear `docs/RENDIMIENTO.md`.
- Modificar `docs/DECISIONES.md` y `README.md`.
- Posible mejora en `src/` (con su propio test).

- [ ] **Paso 1. Entorno:** registrar CPU, RAM, sistema operativo, versiones de Node, JMeter y Java, la región de Neon y el plan.
- [ ] **Paso 2. Smoke en local** contra la API con `perf:start`. Esperado: 0 % de error.
- [ ] **Paso 3. Carga** (100 usuarios, 10 min): tabla y umbrales.
- [ ] **Paso 4. Cuello de botella:** identificar el endpoint o recurso con peor p95 o más errores y aplicar **una** mejora con TDD; por ejemplo, el tamaño del pool `pg` configurable o un índice. Volver a correr la carga para la comparación antes/después. Si la mejora no cambia nada, se documenta igual (ruling).
- [ ] **Paso 5. Estrés y pico:**
  - Estrés: punto de quiebre, primer recurso en saturarse y si el sistema se recupera.
  - Pico: si aguanta el salto brusco y se recupera.
  - Resistencia: se documenta como opcional y no se ejecuta (60 min); queda como ruling.
- [ ] **Paso 6. Smoke contra Preview** (el del PR de esta rama), con bypass. Esperado: < 1 % de error.
- [ ] **Paso 7. Documentación:**
  - `docs/RENDIMIENTO.md` según §19.8: entorno, salvedades (latencia de red a Neon incluida, sin límite de CPU/RAM, plan gratuito de Neon), tablas reales, punto de quiebre, cuello de botella, mejora y antes/después;
  - filas nuevas en `DECISIONES.md`;
  - comandos en el README.
- [ ] **Paso 8.** Commit: `docs(perf): resultados de rendimiento`.
- [ ] **Paso 9.** Revisión de toda la rama con un subagente opus y un único fix pass. Después, el PR.

# Vitalify Web API — Diseño complementario al spec

## Contexto
`.claude/spec.md` (996 líneas) es la fuente de verdad del proyecto universitario Vitalify (Entregable 2, Politécnico Grancolombiano): Web API REST en Node/TypeScript/Express + Prisma/PostgreSQL desplegada en Vercel, con SonarQube y JMeter. El repo `LewiTamayo/Vaitalify` (público) está vacío salvo `.claude/`. Este documento **no repite el spec**: registra las decisiones tomadas en la conversación de requisitos que ajustan o completan el spec. Lo que no aparezca aquí se hace exactamente como dice el spec.

## Intención y criterio de éxito
- Entrega al docente = **repositorio + informe** (el informe lo redacta el estudiante).
- El repo debe contener las **8 fases completas** del spec (§13) y producir **evidencias reales** que el estudiante usará en el informe: Quality Gate de SonarQube en PRs, reporte HTML de JMeter con números reales, despliegue funcionando en `*.vercel.app`.
- Anti-objetivo: configuraciones que "existen" pero nunca se ejecutaron (CI sin correr, `.jmx` sin resultados, Sonar sin análisis).

## Decisiones del usuario
| # | Decisión | Efecto sobre el spec |
|---|---|---|
| U-1 | **Desviaciones S-01…S-17 aceptadas** (PostgreSQL/Neon, campos añadidos al ER). | Spec §4 y §14 tal cual. |
| U-2 | **Sin Docker: todo en Neon.** Desarrollo local y tests de integración locales contra **ramas de Neon** (`dev`, `test`); pruebas JMeter contra la API corriendo en local con Node (`APP_ENV=perf`) apuntando a una rama `perf` de Neon. | `docker-compose.yml`, `docker-compose.perf.yml` y `Dockerfile` se crean igualmente pero **solo como referencia documentada** (no son el camino principal). Scripts `perf:up/perf:down` se sustituyen por `perf:start` (`APP_ENV=perf RATE_LIMIT_ENABLED=false node` sobre el build). README y `RENDIMIENTO.md` explican la limitación (sin límite de CPU/RAM; latencia de red a Neon incluida en las mediciones). |
| U-3 | Las 8 fases completas. | Spec §13. |
| U-4 | **Avance continuo**, pausar solo en bloqueos (cuentas, secretos, despliegue, instalaciones). | Se ignora la pausa por fase del prompt §20; se siguen ejecutando lint/typecheck/tests al cerrar cada fase. |
| U-5 | **Rama + PR por fase** (`fase-1-base`, `fase-2-identidad`, …), commits pequeños, push a `origin`. El usuario abre/mergea los PR (no hay `gh` instalado). | La fase N+1 se ramifica desde la rama de la fase N si el PR anterior aún no se ha mergeado (stacked). |
| U-6 | **Solo docs técnicos**: README, `docs/DECISIONES.md`, `docs/PRIVACIDAD.md`, `docs/RENDIMIENTO.md` con resultados reales. | Sin borrador de informe. |

| U-7 | **Racha por fecha de la ventana**, no por fecha de sincronización. Una pausa marcada `hecha` cuenta como actividad del día `microVentana.fecha` (si es ≤ hoy en `APP_TZ`; una ventana futura no se puede marcar `hecha` → `422`). | Cambia §7.4: en vez de actualizar la racha de forma incremental con "hoy", se **recalcula** con una función pura `calcularRacha(diasActivos: string[], hoy)` que recorre los días activos en orden y aplica 2 comodines por semana ISO. `Progreso` (`rachaActual`, `rachaMaxima`, `diasComodin`, `ultimaFechaActiva`, `semanaComodin`) pasa a ser una **caché** de ese cálculo, actualizada en la misma transacción. Los puntos siguen siendo incrementales (+10 por pausa). Tests obligatorios extra: llegada desordenada (martes antes que lunes) y sincronización tardía de 2 días. |
| U-8 | **Neon desde el Marketplace de Vercel**, con rama de base de datos automática por cada Preview. | `config/env.ts` acepta los nombres que inyecta la integración (`DATABASE_URL` + `DATABASE_URL_UNPOOLED`) y mapea `DIRECT_URL = DIRECT_URL ?? DATABASE_URL_UNPOOLED`. El comando de build en Vercel ejecuta `prisma migrate deploy` (sobre la URL sin pooling), así cada rama de Preview y Production migra al desplegarse. El job `migrate` de GitHub Actions del spec §18.6 se elimina (lo sustituye el build). Ramas locales `dev`/`test`/`perf` se crean en la consola de Neon. |
| U-9 | **Preview protegido + token de bypass** para la prueba smoke de JMeter. | El `.jmx` añade el header `x-vercel-protection-bypass: ${__P(bypass,)}` (vacío en local). El secreto se pasa con `-Jbypass=…` y nunca se versiona. |

## Decisiones mías (revisables)
- **Commit inicial en `main`** (`.gitignore`, `README` mínimo, `.claude/spec.md`) para que los PR tengan una rama destino; todo lo demás va por ramas de fase.
- Si la hora de dormir del perfil es después de medianoche (p. ej. 00:30), el día despierto se trata como `[horaDespertar, 23:59]` + `[00:00, horaDormir]` del día siguiente se ignora para ventanas en el MVP; se registra en DECISIONES.md.
- Las cifras de JMeter se toman con Neon en plan gratuito (con autosuspensión de cómputo): se hace un calentamiento previo y la salvedad se documenta en RENDIMIENTO.md.
- **Proyecto en la raíz del repo**, no en `vitalify-api/`.
- **SonarQube Cloud** (repo público, sin Docker para Sonar local). Acción oficial `SonarSource/sonarqube-scan-action` + `SONAR_TOKEN`.
- **Node 24.x** en `engines` (es lo instalado localmente, v24.16, y el spec lo permite).
- **CI en GitHub Actions** mantiene el `postgres:16` service container (los runners sí tienen Docker); localmente los tests usan la rama `test` de Neon.
- **Versiones**: últimas estables de cada dependencia al momento de scaffold; si Prisma exige `prisma.config.ts`/driver adapter, seguir su doc manteniendo `DATABASE_URL`/`DIRECT_URL`.
- Tests de integración locales: base `test` se resetea con `prisma migrate reset --force` antes de la suite; los tests limpian por usuario creado (cada test registra usuarios únicos) para tolerar latencia de Neon.
- JMeter se instala localmente (Java ya presente): binario en carpeta fuera del repo; `.jmx` y `escenarios/*.properties` en `tests/performance/`; resultados (`.jtl`, reportes) en `.gitignore` salvo un resumen en `RENDIMIENTO.md`.

## Bloqueos previstos (momentos en que me detendré)
1. **Fase 1**: crear proyecto en Vercel desde el repo + Neon desde Marketplace (con ramas por Preview activadas); crear ramas `dev`/`test` en Neon y poner sus URLs en `.env` / `.env.test` locales (nunca en chat). Crear proyecto en SonarQube Cloud y `SONAR_TOKEN` en GitHub Secrets.
2. **Fase 2**: Upstash Redis (Marketplace) para Preview/Production.
3. **Fase 5**: `CRON_SECRET` en Vercel.
4. **Fase 7**: instalar Apache JMeter 5.6+, crear rama `perf` en Neon y generar el token de bypass de Preview en Vercel.
5. Cada fin de fase: el usuario abre el PR en GitHub.

## Fuera de alcance
Lo mismo que el spec §1 (OAuth calendarios, push real, panel admin, UI) + borrador del informe.

## Verificación
- Por fase: `npm run lint`, `npm run typecheck`, `npm run test:coverage` en verde localmente; CI verde en el PR; Quality Gate aprobado.
- Fase 1: `GET https://<proyecto>.vercel.app/api/v1/health` → `{status:"ok", db:"up"}`.
- Fases 3–6: casos obligatorios de §11 (ventanas, racha, sueño 07:00→22:45, aislamiento 404).
- Fase 7: JMeter `carga` cumple §19.5 (en el entorno local+Neon, con la salvedad documentada); `estres` documenta punto de quiebre; `smoke` contra Vercel Preview.
- Fase 8: checklist §9, cobertura ≥ 80 %, 0 issues bloqueantes/críticos en Sonar.

## Siguiente paso tras aprobación
Guardar este diseño en `docs/superpowers/specs/2026-10-17-vitalify-api-design.md` (commit en `fase-1-base`) e invocar `superpowers:writing-plans` para el plan detallado de implementación.

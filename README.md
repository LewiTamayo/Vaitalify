# Vitalify API

Web API REST de Vitalify (Entregable 2 – Emprendimiento de Base Tecnológica, Politécnico Grancolombiano).
Ayuda a personas que estudian y trabajan a sostener hábitos de sueño y micro-pausas activas.

- Especificación: [.claude/spec.md](.claude/spec.md)
- Decisiones de diseño: [docs/DECISIONES.md](docs/DECISIONES.md)

## Stack

Node 24 · TypeScript · Express 5 · Prisma 7 + PostgreSQL (Neon) · Zod · OpenAPI 3.1 · Vitest · ESLint + SonarQube · Vercel.

## Correr en local (< 5 minutos)

Requisitos: Node 24 y una base de datos PostgreSQL. El flujo recomendado usa una **rama `dev` de Neon**.

```bash
npm install                     # también genera el cliente de Prisma
cp .env.example .env            # pega en DATABASE_URL (pooled) y DIRECT_URL (direct) las URLs de la rama dev
npx prisma migrate deploy       # crea las tablas
npm run dev                     # http://localhost:3000/api/v1/docs
```

Comprobación rápida: `curl http://localhost:3000/api/v1/health` → `{"status":"ok","db":"up"}`.

## Tests

```bash
npm run test:unit               # unitarios (no necesitan BD)
npm test                        # unitarios + integración (usa .env.test → rama test de Neon)
npm run test:coverage           # con cobertura (coverage/lcov.info para SonarQube)
npm run lint && npm run typecheck
```

Para los tests de integración, crea `.env.test` con `DATABASE_URL`/`DIRECT_URL` de una rama `test` de Neon
y ejecuta `npm run db:migrate:test` antes de la primera corrida.

## Despliegue

- **Vercel**: Production desde `main`, Preview por cada PR. El entry es `src/app.ts` (`export default app`).
  `vercel-build` ejecuta `prisma generate && prisma migrate deploy`.
- **SonarQube Cloud**: el job `ci` de GitHub Actions analiza cada PR y espera el Quality Gate (secreto `SONAR_TOKEN`).

## Endpoints disponibles

| Ruta | Descripción |
|---|---|
| `GET /api/v1/health` | Estado de la API y de la base de datos |
| `GET /api/v1/docs` | Swagger UI |
| `GET /api/v1/openapi.json` | Especificación OpenAPI 3.1 |

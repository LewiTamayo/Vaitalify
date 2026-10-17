import { Router } from 'express';
import { buildOpenApiDocument } from './registry.js';

// Swagger UI se carga desde CDN: en serverless no se sirven archivos estáticos.
const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.3';

const CSP_DOCS = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

const HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vitalify API · Documentación</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script src="./docs-init.js"></script>
</body>
</html>`;

// Script de arranque en un archivo propio para no necesitar 'unsafe-inline' en la CSP.
const INIT_JS = `window.ui = SwaggerUIBundle({ url: './openapi.json', dom_id: '#swagger-ui' });`;

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(buildOpenApiDocument());
});

docsRouter.get('/docs', (_req, res) => {
  res.setHeader('Content-Security-Policy', CSP_DOCS);
  res.type('html').send(HTML);
});

docsRouter.get('/docs-init.js', (_req, res) => {
  res.type('application/javascript').send(INIT_JS);
});

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// Cada módulo registra sus rutas aquí desde su *.routes.ts.
export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const ProblemSchema = registry.register(
  'Problem',
  z
    .object({
      type: z.string().openapi({ example: 'https://vitalify.app/errors/validation' }),
      title: z.string().openapi({ example: 'Datos inválidos' }),
      status: z.number().int().openapi({ example: 400 }),
      detail: z.string().optional(),
      errors: z.array(z.object({ campo: z.string(), mensaje: z.string() })).optional(),
      hint: z.string().optional(),
    })
    .openapi({ description: 'Error RFC 7807 (application/problem+json)' }),
);

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Vitalify API',
      version: '1.0.0',
      description: 'Web API de Vitalify: hábitos de sueño y micro-pausas activas.',
    },
    servers: [{ url: '/api/v1' }],
  });
}

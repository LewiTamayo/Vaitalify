import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';

export const SemanaQuerySchema = z.object({
  semana: FechaSchema.optional().openapi({
    description: 'Cualquier fecha de la semana ISO a resumir (por defecto hoy)',
  }),
});

export const ProgresoSchema = registry.register(
  'Progreso',
  z.object({
    puntosTotales: z.number().int(),
    rachaActual: z.number().int().openapi({ description: 'Racha vigente hoy' }),
    rachaMaxima: z.number().int(),
    diasComodin: z.number().int().openapi({ description: 'Comodines disponibles esta semana' }),
    ultimaFechaActiva: z.string().nullable(),
  }),
);

export const ResumenSemanalSchema = registry.register(
  'ResumenSemanal',
  z.object({
    semana: z.object({ inicio: z.string(), fin: z.string() }),
    sueno: z.object({
      promedioHoras: z.number().nullable(),
      metaHoras: z.number().nullable(),
      porDia: z.array(z.object({ fecha: z.string(), horas: z.number() })),
    }),
    actividad: z.object({
      minutosAcumulados: z.number().int(),
      metaMinutos: z.number().int().nullable(),
      porcentajeMeta: z.number().int().nullable(),
      pausasHechas: z.number().int(),
      pausasOmitidas: z.number().int(),
    }),
    racha: z.object({ actual: z.number().int(), comodinesRestantes: z.number().int() }),
    insignias: z.array(z.object({ codigo: z.string(), nombre: z.string() })),
  }),
);

export type ProgresoDto = z.infer<typeof ProgresoSchema>;
export type ResumenSemanal = z.infer<typeof ResumenSemanalSchema>;

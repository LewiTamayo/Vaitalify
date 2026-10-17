import { z } from 'zod';

export const PaginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'pageSize no puede superar 100').default(20),
});

export type Paginacion = z.infer<typeof PaginacionSchema>;

export interface Pagina<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export function aSkipTake({ page, pageSize }: Paginacion): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pagina<T>(data: T[], total: number, { page, pageSize }: Paginacion): Pagina<T> {
  return { data, meta: { page, pageSize, total } };
}

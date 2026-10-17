import type { ZodError } from 'zod';
import type { ErrorCampo } from './app-error.js';

// Convierte los issues de Zod en errores por campo del cuerpo RFC 7807.
export function erroresDeZod(error: ZodError): ErrorCampo[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((clave) => ({ campo: clave, mensaje: 'Campo no permitido' }));
    }
    return [{ campo: issue.path.join('.'), mensaje: issue.message }];
  });
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export interface OpcionesError {
  detail?: string;
  errors?: ErrorCampo[];
  hint?: string;
}

export const TIPO_ERROR_BASE = 'https://vitalify.app/errors/';

export class AppError extends Error {
  readonly detail?: string;
  readonly errors?: ErrorCampo[];
  readonly hint?: string;

  constructor(
    readonly status: number,
    readonly slug: string,
    readonly title: string,
    opciones: OpcionesError = {},
  ) {
    super(opciones.detail ?? title);
    this.name = 'AppError';
    this.detail = opciones.detail;
    this.errors = opciones.errors;
    this.hint = opciones.hint;
  }
}

export const errores = {
  validacion: (errors: ErrorCampo[], detail?: string) =>
    new AppError(400, 'validation', 'Datos inválidos', { errors, detail }),
  noAutenticado: (detail?: string) => new AppError(401, 'no-autenticado', 'No autenticado', { detail }),
  prohibido: () => new AppError(403, 'prohibido', 'Acceso denegado'),
  noEncontrado: (detail?: string, hint?: string) =>
    new AppError(404, 'no-encontrado', 'Recurso no encontrado', { detail, hint }),
  conflicto: (detail: string) => new AppError(409, 'conflicto', 'Conflicto', { detail }),
  reglaNegocio: (detail: string, hint?: string) =>
    new AppError(422, 'regla-negocio', 'Regla de negocio incumplida', { detail, hint }),
};

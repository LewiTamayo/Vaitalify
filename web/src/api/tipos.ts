// Copia a mano de los esquemas de respuesta de la API (src/modules/*/*.schemas.ts).

export interface Usuario {
  idUsuario: number;
  nombre: string;
  correo: string;
  rol: 'user' | 'admin';
}

export interface Sesion {
  usuario: Usuario;
  accessToken: string;
  refreshToken: string;
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export interface Pagina<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export type EstadoPausa = 'pendiente' | 'hecha' | 'omitida';

export interface Actividad {
  idActividad: number;
  nombre: string;
  categoria: 'estiramiento' | 'caminata' | 'bajo_impacto';
  duracionMin: number;
  instrucciones: string;
}

export interface MicroPausa {
  idPausa: number;
  estado: EstadoPausa;
  fechaRegistro: string | null;
  ventana: { idVentana: number; fecha: string; horaInicio: string; duracionMin: number };
  actividad: Actividad;
}

export interface MicroPausaConProgreso extends MicroPausa {
  puntosGanados: number;
  rachaActual: number;
  insigniasNuevas: Array<{ codigo: string; nombre: string }>;
}

export interface MicroVentana {
  idVentana: number;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
  microPausa: { idPausa: number; estado: EstadoPausa } | null;
}

export interface Bloque {
  tipo: 'trabajo' | 'estudio' | 'viaje';
  titulo: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface Progreso {
  puntosTotales: number;
  rachaActual: number;
  rachaMaxima: number;
  diasComodin: number;
  ultimaFechaActiva: string | null;
}

export interface ResumenSemanal {
  semana: { inicio: string; fin: string };
  actividad: {
    minutosAcumulados: number;
    metaMinutos: number | null;
    porcentajeMeta: number | null;
    pausasHechas: number;
    pausasOmitidas: number;
  };
  racha: { actual: number; comodinesRestantes: number };
}

export interface InsigniaUsuario {
  idInsignia: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  criterio: string;
  obtenida: boolean;
  fechaObtencion: string | null;
}

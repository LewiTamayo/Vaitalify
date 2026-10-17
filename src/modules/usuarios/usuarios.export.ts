import { formatFecha } from '../../common/utils/dates.js';
import { formatHHmm } from '../../common/utils/time.js';
import type { UsuarioConRelaciones } from './usuarios.repository.js';
import { aDto } from './usuarios.mapper.js';

// Derecho de acceso (Ley 1581/2012): todos los datos del usuario en el formato de la API.
// Se omiten el hash de la contraseña y los refresh tokens.

const hora = (d: Date | null) => (d ? formatHHmm(d) : null);
const fecha = (d: Date | null) => (d ? formatFecha(d) : null);
const numero = (d: { toNumber(): number }) => d.toNumber();

type Datos = UsuarioConRelaciones;

function perfil(p: Datos['perfil']) {
  return (
    p && {
      horaDormir: hora(p.horaDormir),
      horaDespertar: hora(p.horaDespertar),
      metaHorasSueno: numero(p.metaHorasSueno),
      metaMinActividad: p.metaMinActividad,
    }
  );
}

function progreso(p: Datos['progreso']) {
  return (
    p && {
      puntosTotales: p.puntosTotales,
      rachaActual: p.rachaActual,
      rachaMaxima: p.rachaMaxima,
      diasComodin: p.diasComodin,
      ultimaFechaActiva: fecha(p.ultimaFechaActiva),
    }
  );
}

function microVentanas(ventanas: Datos['microVentanas']) {
  return ventanas.map((v) => ({
    idVentana: v.idVentana,
    fecha: fecha(v.fecha),
    horaInicio: hora(v.horaInicio),
    duracionMin: v.duracionMin,
    microPausa: v.microPausa && {
      idPausa: v.microPausa.idPausa,
      idActividad: v.microPausa.idActividad,
      estado: v.microPausa.estado,
      fechaRegistro: v.microPausa.fechaRegistro?.toISOString() ?? null,
    },
  }));
}

export function construirExportacion(datos: Datos, generadoEn: Date) {
  return {
    generadoEn: generadoEn.toISOString(),
    usuario: aDto(datos),
    perfil: perfil(datos.perfil),
    bloques: datos.bloques.map((b) => ({
      idBloque: b.idBloque,
      tipo: b.tipo,
      titulo: b.titulo,
      diaSemana: b.diaSemana,
      horaInicio: hora(b.horaInicio),
      horaFin: hora(b.horaFin),
      origen: b.origen,
    })),
    microVentanas: microVentanas(datos.microVentanas),
    registrosSueno: datos.registrosSueno.map((r) => ({
      idRegistro: r.idRegistro,
      fecha: fecha(r.fecha),
      horasDormidas: numero(r.horasDormidas),
    })),
    recordatorios: datos.recordatorios.map((r) => ({
      idRecordatorio: r.idRecordatorio,
      tipo: r.tipo,
      mensaje: r.mensaje,
      fechaHoraEnvio: r.fechaHoraEnvio.toISOString(),
      enviado: r.enviado,
    })),
    configNotificaciones: datos.configs.map((c) => ({
      tipo: c.tipo,
      activa: c.activa,
      silencioInicio: hora(c.silencioInicio),
      silencioFin: hora(c.silencioFin),
    })),
    progreso: progreso(datos.progreso),
    insignias: datos.insignias.map((ui) => ({
      codigo: ui.insignia.codigo,
      nombre: ui.insignia.nombre,
      fechaObtencion: fecha(ui.fechaObtencion),
    })),
  };
}

export type ExportacionUsuario = ReturnType<typeof construirExportacion>;

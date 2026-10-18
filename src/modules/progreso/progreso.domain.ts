import { isoWeekday, sumarDias } from '../../common/utils/dates.js';

// Resumen semanal (§7.5). Funciones puras.

export function semanaDe(fecha: string): { inicio: string; fin: string } {
  const inicio = sumarDias(fecha, 1 - isoWeekday(fecha));
  return { inicio, fin: sumarDias(inicio, 6) };
}

const unDecimal = (n: number) => Math.round(n * 10) / 10;

export function resumenSueno(
  registros: { fecha: string; horas: number }[],
  metaHoras: number | null,
) {
  const porDia = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const promedioHoras =
    porDia.length === 0
      ? null
      : unDecimal(porDia.reduce((suma, r) => suma + r.horas, 0) / porDia.length);
  return { promedioHoras, metaHoras, porDia };
}

export function resumenActividad(
  pausas: { estado: 'pendiente' | 'hecha' | 'omitida'; duracionMin: number }[],
  metaMinutos: number | null,
) {
  const hechas = pausas.filter((p) => p.estado === 'hecha');
  const minutosAcumulados = hechas.reduce((suma, p) => suma + p.duracionMin, 0);
  return {
    minutosAcumulados,
    metaMinutos,
    porcentajeMeta: metaMinutos ? Math.round((minutosAcumulados / metaMinutos) * 100) : null,
    pausasHechas: hechas.length,
    pausasOmitidas: pausas.filter((p) => p.estado === 'omitida').length,
  };
}

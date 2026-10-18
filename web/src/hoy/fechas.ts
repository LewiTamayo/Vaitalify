// Igual que diaLogico() de la API: el día cambia a las 04:00 en America/Bogota.
const ZONA = 'America/Bogota';
const HORA_CORTE = 4;

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function hoyLogico(ahora: Date = new Date()): string {
  const partes = Object.fromEntries(formato.formatToParts(ahora).map((p) => [p.type, p.value]));
  const fecha = new Date(
    Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)),
  );
  if (Number(partes.hour) < HORA_CORTE) fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

// Las columnas TIME de PostgreSQL llegan desde Prisma como Date en 1970-01-01 (UTC).
// La API siempre expone las horas como "HH:mm".

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTOS_DIA = 1440;

function partes(hhmm: string): [number, number] {
  const match = HHMM.exec(hhmm);
  if (!match) {
    throw new Error(`Hora inválida: se esperaba HH:mm (${hhmm})`);
  }
  return [Number(match[1]), Number(match[2])];
}

export function aMinutos(hhmm: string): number {
  const [h, m] = partes(hhmm);
  return h * 60 + m;
}

export function deMinutos(min: number): string {
  const normalizado = ((min % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  const h = Math.floor(normalizado / 60);
  const m = normalizado % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseHHmm(hhmm: string): Date {
  const [h, m] = partes(hhmm);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

export function formatHHmm(d: Date): string {
  return deMinutos(d.getUTCHours() * 60 + d.getUTCMinutes());
}

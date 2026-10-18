// Igual que hoyEnZona() de la API: la fecha de calendario en America/Bogota. Es la que usan
// /micro-pausas/hoy, el recálculo de ventanas y la regla de "no marcar hecha una ventana futura".
const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function hoyEnZona(ahora: Date = new Date()): string {
  return formato.format(ahora);
}

export interface OpcionesJmeter {
  jmx: string;
  escenario: string;
  salida: string;
  // Propiedades secretas (token de bypass) en un archivo temporal: así no aparecen en la
  // línea de comandos, que el sistema operativo y los logs pueden mostrar.
  propsSecretas?: string;
  extra?: string[];
}

// Corrida no-GUI (spec §19.6): JTL con -l, log propio con -j y reporte HTML con -e -o.
export function argumentosJmeter(op: OpcionesJmeter): string[] {
  return [
    '-n',
    '-t',
    op.jmx,
    '-q',
    op.escenario,
    ...(op.propsSecretas ? ['-q', op.propsSecretas] : []),
    ...(op.extra ?? []),
    '-l',
    `${op.salida}/resultados.jtl`,
    '-j',
    `${op.salida}/jmeter.log`,
    '-e',
    '-o',
    `${op.salida}/reporte`,
  ];
}

// Dominio de Production de la API: ahí no corre ninguna prueba de JMeter (§19.1).
const PRODUCCION = 'vaitalify-beta.vercel.app';

// §19.1: carga, estrés y pico solo en local; contra Vercel Preview solo el smoke.
export function validarDestino(escenario: string, preview: string | undefined): void {
  if (preview === undefined) return;
  if (new URL(preview).host === PRODUCCION) {
    throw new Error('No se ejecutan pruebas de JMeter contra producción (spec §19.1).');
  }
  if (escenario !== 'smoke') {
    throw new Error('Contra Vercel Preview se permite solo el escenario smoke (spec §19.1).');
  }
}

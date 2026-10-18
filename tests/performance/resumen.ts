// Resumen de un .jtl de JMeter para docs/RENDIMIENTO.md (spec §19.5 y §19.8).
// Uso: npm run perf:resumen -- tests/performance/resultados/<corrida>/resultados.jtl
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface Muestra {
  etiqueta: string;
  ms: number;
  ok: boolean;
  codigo: string;
  inicio: number;
}

export interface FilaResumen {
  etiqueta: string;
  muestras: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  errorPct: number;
  throughput: number;
}

export interface Regla {
  regla: string;
  valor: number;
  umbral: number;
  cumple: boolean;
}

// CSV de JMeter: los campos con comas o saltos de línea (mensajes de error) van entre comillas,
// así que se recorre el texto completo en vez de partirlo por líneas.
function filasCsv(csv: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let actual = '';
  let citado = false;
  const cerrarFila = () => {
    fila.push(actual);
    if (fila.some((campo) => campo.length > 0)) filas.push(fila);
    fila = [];
    actual = '';
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (citado) {
      if (c === '"' && csv[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (c === '"') citado = false;
      else actual += c;
    } else if (c === '"') citado = true;
    else if (c === ',') {
      fila.push(actual);
      actual = '';
    } else if (c === '\n') cerrarFila();
    else if (c !== '\r') actual += c;
  }
  cerrarFila();
  return filas;
}

export function leerJtl(csv: string): Muestra[] {
  const [columnas = [], ...filas] = filasCsv(csv);
  const col = (nombre: string) => columnas.indexOf(nombre);
  const [t, ms, etiqueta, codigo, ok] = [
    col('timeStamp'),
    col('elapsed'),
    col('label'),
    col('responseCode'),
    col('success'),
  ];
  return filas.map((f) => ({
    etiqueta: f[etiqueta] ?? '',
    ms: Number(f[ms]),
    ok: f[ok] === 'true',
    codigo: f[codigo] ?? '',
    inicio: Number(f[t]),
  }));
}

// Percentil por nearest-rank: el valor en la posición ⌈q·n⌉ de la lista ordenada.
const percentil = (ordenados: number[], q: number) =>
  ordenados[Math.max(Math.ceil((q / 100) * ordenados.length) - 1, 0)] ?? 0;

function fila(etiqueta: string, grupo: Muestra[]): FilaResumen {
  const tiempos = grupo.map((m) => m.ms).sort((a, b) => a - b);
  // Con reduce y no con Math.min(...): un JTL de estrés tiene cientos de miles de muestras.
  const desde = grupo.reduce((min, m) => Math.min(min, m.inicio), Infinity);
  const hasta = grupo.reduce((max, m) => Math.max(max, m.inicio + m.ms), -Infinity);
  const segundos = Math.max(hasta - desde, 1) / 1000;
  return {
    etiqueta,
    muestras: grupo.length,
    p50: percentil(tiempos, 50),
    p90: percentil(tiempos, 90),
    p95: percentil(tiempos, 95),
    p99: percentil(tiempos, 99),
    errorPct: (grupo.filter((m) => !m.ok).length / grupo.length) * 100,
    throughput: grupo.length / segundos,
  };
}

export function resumir(muestras: Muestra[]): FilaResumen[] {
  const grupos = new Map<string, Muestra[]>();
  for (const m of muestras) {
    const grupo = grupos.get(m.etiqueta);
    if (grupo) grupo.push(m);
    else grupos.set(m.etiqueta, [m]);
  }
  const filas = [...grupos].map(([etiqueta, grupo]) => fila(etiqueta, grupo));
  return muestras.length > 0 ? [...filas, fila('TOTAL', muestras)] : filas;
}

const LOGIN = 'POST /auth/login';

// Umbrales de aceptación del escenario de carga (§19.5). El de throughput estable se revisa
// en la gráfica "Transactions Per Second" del reporte HTML.
export function evaluarUmbrales(filas: FilaResumen[]): Regla[] {
  const endpoints = filas.filter((f) => f.etiqueta !== 'TOTAL');
  const peorP95 = (filtro: (f: FilaResumen) => boolean) => {
    const grupo = endpoints.filter(filtro);
    return grupo.length > 0 ? Math.max(...grupo.map((f) => f.p95)) : null;
  };
  const candidatas: Array<[string, number | null, number, boolean]> = [
    ['Tasa de error < 1 %', filas.find((f) => f.etiqueta === 'TOTAL')?.errorPct ?? null, 1, true],
    ['p95 lecturas (GET) ≤ 500 ms', peorP95((f) => f.etiqueta.startsWith('GET ')), 500, false],
    [
      'p95 escrituras ≤ 800 ms',
      peorP95((f) => /^(POST|PATCH|DELETE) /.test(f.etiqueta) && f.etiqueta !== LOGIN),
      800,
      false,
    ],
    [`p95 ${LOGIN} ≤ 1500 ms`, peorP95((f) => f.etiqueta === LOGIN), 1500, false],
  ];
  return candidatas.flatMap(([regla, valor, umbral, estricto]) =>
    valor === null
      ? []
      : [{ regla, valor, umbral, cumple: estricto ? valor < umbral : valor <= umbral }],
  );
}

export function tablaMarkdown(filas: FilaResumen[]): string {
  const cabecera =
    '| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |';
  const lineas = filas.map(
    (f) =>
      `| ${f.etiqueta} | ${f.muestras} | ${f.p50} | ${f.p90} | ${f.p95} | ${f.p99} | ${f.errorPct.toFixed(2)} | ${f.throughput.toFixed(2)} |`,
  );
  return [cabecera, '|---|---|---|---|---|---|---|---|', ...lineas].join('\n');
}

export function informe(jtl: string): string {
  const filas = resumir(leerJtl(readFileSync(jtl, 'utf8')));
  const reglas = evaluarUmbrales(filas)
    .map((r) => `- ${r.cumple ? '✅' : '❌'} ${r.regla}: ${r.valor.toFixed(2)}`)
    .join('\n');
  return `${tablaMarkdown(filas)}\n\nUmbrales (§19.5):\n${reglas}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const jtl = process.argv[2];
  if (!jtl) throw new Error('Uso: npm run perf:resumen -- <ruta al .jtl>');
  process.stdout.write(informe(jtl));
}

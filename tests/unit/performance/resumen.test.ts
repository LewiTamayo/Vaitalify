import { describe, expect, it } from 'vitest';
import { argumentosJmeter, validarDestino } from '../../performance/argumentos.js';
import {
  evaluarUmbrales,
  leerJtl,
  resumir,
  tablaMarkdown,
  type FilaResumen,
  type Muestra,
} from '../../performance/resumen.js';

const CABECERA =
  'timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect';

const muestras = (etiqueta: string, tiempos: number[], fallidas = 0): Muestra[] =>
  tiempos.map((ms, i) => ({ etiqueta, ms, ok: i >= fallidas, codigo: '200', inicio: i * 1000 }));

describe('leerJtl', () => {
  it('lee las columnas por nombre y respeta comas entre comillas', () => {
    const csv = [
      CABECERA,
      '1000,120,GET /progreso/semanal,200,OK,Usuarios 1-1,text,true,,500,200,1,1,http://x,100,0,5',
      '2000,2500,POST /bloques,201,Created,Usuarios 1-2,text,false,"The operation lasted too long: It took 2,500 milliseconds",10,10,1,1,http://x,90,0,1',
    ].join('\n');
    expect(leerJtl(csv)).toEqual([
      { etiqueta: 'GET /progreso/semanal', ms: 120, ok: true, codigo: '200', inicio: 1000 },
      { etiqueta: 'POST /bloques', ms: 2500, ok: false, codigo: '201', inicio: 2000 },
    ]);
  });
});

describe('leerJtl con saltos de línea', () => {
  it('un mensaje entre comillas con saltos de línea no parte la muestra', () => {
    const csv = [
      CABECERA,
      '1000,2100,PATCH /micro-pausas/{id},200,OK,Usuarios 1-1,text,false,"The operation lasted too long: It took 2,100 milliseconds,',
      ' but should not have lasted longer than 2,000 milliseconds.",10,10,1,1,http://x,90,0,1',
      '2000,50,GET /x,200,OK,Usuarios 1-1,text,true,,10,10,1,1,http://x,40,0,1',
    ].join('\r\n');
    expect(leerJtl(csv).map((m) => m.etiqueta)).toEqual(['PATCH /micro-pausas/{id}', 'GET /x']);
  });
});

describe('resumir', () => {
  it('calcula percentiles por nearest-rank, error y throughput por etiqueta', () => {
    const tiempos = Array.from({ length: 100 }, (_, i) => i + 1);
    const [fila] = resumir(muestras('GET /micro-pausas/hoy', tiempos, 5));
    expect(fila).toMatchObject({
      etiqueta: 'GET /micro-pausas/hoy',
      muestras: 100,
      p50: 50,
      p90: 90,
      p95: 95,
      p99: 99,
      errorPct: 5,
    });
    // 100 muestras entre t=0 y t=99 000 + 100 ms → 100 / 99,1 s
    expect(fila?.throughput).toBeCloseTo(100 / 99.1, 3);
  });

  it('aguanta un JTL de estrés (300 000 muestras) sin desbordar la pila', () => {
    const grandes = muestras(
      'GET /x',
      Array.from({ length: 300_000 }, (_, i) => (i % 1000) + 1),
    );
    expect(resumir(grandes)[0]?.p99).toBe(990);
  });

  it('agrega una fila TOTAL al final con todas las muestras', () => {
    const filas = resumir([...muestras('A', [10, 20]), ...muestras('B', [30], 1)]);
    expect(filas.map((f) => f.etiqueta)).toEqual(['A', 'B', 'TOTAL']);
    expect(filas[2]).toMatchObject({ muestras: 3, p50: 20 });
    expect(filas[2]?.errorPct).toBeCloseTo(33.33, 1);
  });
});

describe('evaluarUmbrales (§19.5)', () => {
  const fila = (etiqueta: string, p95: number, errorPct = 0): FilaResumen => ({
    etiqueta,
    muestras: 10,
    p50: p95,
    p90: p95,
    p95,
    p99: p95,
    errorPct,
    throughput: 1,
  });

  it('separa lecturas, escrituras y login', () => {
    const reglas = evaluarUmbrales([
      fila('GET /progreso/semanal', 600),
      fila('POST /bloques', 700),
      fila('POST /auth/login', 1400),
      fila('TOTAL', 600, 0.5),
    ]);
    const por = (regla: string) => reglas.find((r) => r.regla === regla);
    expect(por('p95 lecturas (GET) ≤ 500 ms')).toMatchObject({ valor: 600, cumple: false });
    expect(por('p95 escrituras ≤ 800 ms')).toMatchObject({ valor: 700, cumple: true });
    expect(por('p95 POST /auth/login ≤ 1500 ms')).toMatchObject({ valor: 1400, cumple: true });
    expect(por('Tasa de error < 1 %')).toMatchObject({ valor: 0.5, cumple: true });
  });

  it('el p95 de un grupo es el peor de sus endpoints', () => {
    const reglas = evaluarUmbrales([fila('GET /a', 100), fila('GET /b', 450), fila('TOTAL', 300)]);
    expect(reglas.find((r) => r.regla.startsWith('p95 lecturas'))?.valor).toBe(450);
  });
});

describe('tablaMarkdown', () => {
  it('genera una fila por endpoint con las columnas del informe', () => {
    const tabla = tablaMarkdown(resumir(muestras('GET /x', [10, 20, 30])));
    expect(tabla.split('\n')[0]).toBe(
      '| Endpoint | Muestras | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput (req/s) |',
    );
    expect(tabla).toContain('| GET /x | 3 | 20 | 30 | 30 | 30 | 0.00 |');
  });
});

describe('argumentosJmeter', () => {
  it('arma la corrida no-GUI con escenario, JTL y reporte', () => {
    const args = argumentosJmeter({
      jmx: 'plan.jmx',
      escenario: 'esc/carga.properties',
      salida: 'res/carga',
    });
    expect(args).toEqual([
      '-n',
      '-t',
      'plan.jmx',
      '-q',
      'esc/carga.properties',
      '-l',
      'res/carga/resultados.jtl',
      '-j',
      'res/carga/jmeter.log',
      '-e',
      '-o',
      'res/carga/reporte',
    ]);
  });

  it('el token de bypass va en un archivo de propiedades, nunca en los argumentos', () => {
    const args = argumentosJmeter({
      jmx: 'plan.jmx',
      escenario: 'esc/smoke.properties',
      salida: 'res/smoke',
      propsSecretas: 'tmp/secretas.properties',
      extra: ['-Jhost=x.vercel.app'],
    });
    expect(args).toContain('tmp/secretas.properties');
    expect(args).toContain('-Jhost=x.vercel.app');
    expect(args.join(' ')).not.toMatch(/bypass/i);
  });
});

describe('validarDestino (§19.1)', () => {
  it('en local se permite cualquier escenario', () => {
    expect(() => validarDestino('estres', undefined)).not.toThrow();
  });

  it('contra Vercel solo se permite el smoke', () => {
    expect(() => validarDestino('smoke', 'https://x.vercel.app')).not.toThrow();
    expect(() => validarDestino('carga', 'https://x.vercel.app')).toThrow(
      /solo el escenario smoke/,
    );
  });

  it('nunca contra el dominio de producción', () => {
    expect(() => validarDestino('smoke', 'https://vaitalify-beta.vercel.app')).toThrow(
      /producción/,
    );
  });
});

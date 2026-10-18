import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Contrato del plan de JMeter con la spec (§19.4): no ejecuta JMeter, revisa lo que el plan
// declara para que un cambio en el .jmx no rompa en silencio lo que exige el informe.
const DIR = 'tests/performance';
const jmx = readFileSync(`${DIR}/vitalify.jmx`, 'utf8');

function propiedades(escenario: string): Record<string, string> {
  const texto = readFileSync(`${DIR}/escenarios/${escenario}.properties`, 'utf8');
  return Object.fromEntries(
    texto
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.split('=').map((s) => s.trim()) as [string, string]),
  );
}

describe('escenarios de JMeter (§19.4)', () => {
  it.each([
    ['smoke', '5', '10', '60'],
    ['carga', '100', '120', '600'],
    ['estres', '400', '1200', '1500'],
    ['pico', '300', '5', '180'],
    ['resistencia', '50', '60', '3600'],
  ])('%s: users=%s ramp=%s duration=%s', (escenario, users, ramp, duration) => {
    expect(propiedades(escenario)).toMatchObject({ users, ramp, duration });
  });
});

describe('plan vitalify.jmx (§19.4)', () => {
  it.each([
    'POST /auth/login',
    'GET /micro-pausas/hoy',
    'GET /progreso/semanal',
    'PATCH /micro-pausas/{id}',
    'GET /sueno/recomendacion',
    'POST /registros-sueno',
    'POST /bloques',
    'DELETE /bloques/{id}',
  ])('tiene el sampler "%s"', (etiqueta) => {
    expect(jmx).toContain(`testname="${etiqueta}"`);
  });

  it('parametriza destino y carga con __P', () => {
    for (const p of [
      '${__P(protocol,http)}',
      '${__P(host,localhost)}',
      '${__P(port,3000)}',
      '${__P(users,10)}',
      '${__P(ramp,30)}',
      '${__P(duration,60)}',
    ]) {
      expect(jmx).toContain(p);
    }
  });

  it('cada hilo usa un usuario distinto del CSV', () => {
    expect(jmx).toMatch(/<boolProp name="recycle">false<\/boolProp>/);
    expect(jmx).toMatch(/<boolProp name="stopThread">true<\/boolProp>/);
    expect(jmx).toContain('correo,contrasena');
  });

  it('envía los headers de la spec y el de bypass de Vercel (U-9)', () => {
    expect(jmx).toContain('Bearer ${accessToken}');
    expect(jmx).toContain('${__P(run,local)}');
    expect(jmx).toContain('x-vercel-protection-bypass');
    expect(jmx).toContain('${__P(bypass,)}');
  });

  it('el login va en un Once Only Controller', () => {
    expect(jmx).toContain('OnceOnlyController');
  });

  it('mezcla con Throughput Controllers 30/20/15/10/10/15', () => {
    const porcentajes = [
      ...jmx.matchAll(
        /<FloatProperty>\s*<name>ThroughputController\.percentThroughput<\/name>\s*<value>([\d.]+)<\/value>/g,
      ),
    ].map((m) => Number(m[1]));
    expect(porcentajes).toEqual([30, 20, 15, 10, 10, 15]);
  });

  it('el PATCH solo se envía si hay una pausa de hoy', () => {
    expect(jmx).toMatch(/IfController[\s\S]*idPausa[\s\S]*PATCH \/micro-pausas\/\{id\}/);
  });

  it('las fechas de sueño son del último año y nunca futuras', () => {
    expect(jmx).toContain('__RandomDate');
    expect(jmx).toContain('${__time(yyyy-MM-dd)}');
  });

  it('acepta 409 en registros de sueño y marca como error lo que tarde más de 2 s', () => {
    expect(jmx).toMatch(/201\|409/);
    expect(jmx).toMatch(/DurationAssertion\.duration">2000</);
  });

  it('tiene el temporizador de 1 a 3 s y ningún listener', () => {
    expect(jmx).toContain('UniformRandomTimer');
    expect(jmx).not.toContain('ResultCollector');
  });
});

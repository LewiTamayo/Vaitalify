// Ejecuta un escenario de JMeter en modo no-GUI (spec §19.6) y resume el resultado.
//
//   npm run perf:run -- carga                      # contra la API local (npm run perf:start)
//   npm run perf:run -- smoke --preview <url>      # contra Vercel Preview, con bypass (U-9)
//
// JMeter se busca en JMETER_HOME (por defecto C:\jmeter). El token de bypass sale de
// VERCEL_BYPASS_TOKEN en .env.perf y viaja en un archivo temporal, no en la línea de comandos.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'dotenv';
import { DateTime } from 'luxon';
import { argumentosJmeter, validarDestino } from './argumentos.js';
import { prepararUsuarios, type UsuariosPreview } from './preparar-preview.js';
import { informe } from './resumen.js';

const DIR = 'tests/performance';
const USUARIOS_PREVIEW = 5;

function jmeter(): string {
  const home = process.env.JMETER_HOME ?? 'C:\\jmeter';
  return join(home, 'bin', process.platform === 'win32' ? 'jmeter.bat' : 'jmeter');
}

function tokenBypass(): string {
  const token = parse(readFileSync('.env.perf')).VERCEL_BYPASS_TOKEN;
  if (!token) throw new Error('Falta VERCEL_BYPASS_TOKEN en .env.perf');
  return token;
}

async function main(): Promise<void> {
  const [escenario = '', bandera, preview] = process.argv.slice(2);
  if (!escenario) throw new Error('Uso: npm run perf:run -- <escenario> [--preview <url>]');
  const destino = bandera === '--preview' ? preview : undefined;
  validarDestino(escenario, destino);

  const ahora = DateTime.now().setZone('America/Bogota');
  const salida = `${DIR}/resultados/${escenario}${destino ? '-preview' : ''}-${ahora.toFormat('yyyyMMdd-HHmm')}`;
  mkdirSync(salida, { recursive: true });

  let temporal: string | undefined;
  let usuarios: UsuariosPreview | undefined;
  const extra: string[] = [];
  try {
    if (destino) {
      const bypass = tokenBypass();
      const url = new URL(destino);
      temporal = mkdtempSync(join(tmpdir(), 'vitalify-perf-'));
      writeFileSync(join(temporal, 'secretas.properties'), `bypass=${bypass}\n`);
      usuarios = await prepararUsuarios(
        url.origin,
        bypass,
        USUARIOS_PREVIEW,
        ahora.toISODate() ?? '',
      );
      writeFileSync(join(temporal, 'usuarios.csv'), usuarios.csv);
      extra.push(
        '-Jprotocol=https',
        `-Jhost=${url.host}`,
        '-Jport=443',
        '-Jrun=smoke-preview',
        `-Jusuarios=${join(temporal, 'usuarios.csv')}`,
      );
    }
    const args = argumentosJmeter({
      jmx: resolve(DIR, 'vitalify.jmx'),
      escenario: resolve(DIR, 'escenarios', `${escenario}.properties`),
      salida: resolve(salida),
      propsSecretas: temporal ? join(temporal, 'secretas.properties') : undefined,
      extra,
    });
    // jmeter.bat se ejecuta a través de cmd en Windows; ningún argumento lleva secretos.
    const [comando, previos] =
      process.platform === 'win32'
        ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', jmeter()]]
        : [jmeter(), []];
    const r = spawnSync(comando, [...previos, ...args], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`JMeter terminó con código ${r.status}`);
  } finally {
    await usuarios?.borrar();
    if (temporal) rmSync(temporal, { recursive: true, force: true });
  }
  const resumen = informe(`${salida}/resultados.jtl`);
  writeFileSync(`${salida}/resumen.md`, resumen);
  process.stdout.write(`\n${resumen}\nResultados: ${salida}\n`);
}

await main();

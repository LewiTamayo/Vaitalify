import { esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { formatFecha, hoyEnZona } from '../../common/utils/dates.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import { trasRegistroDeSuenoSinFallar } from '../progreso/gamificacion.service.js';
import * as repo from './registros-sueno.repository.js';
import type {
  DatosRegistro,
  FiltrosRegistros,
  RegistroSuenoDto,
} from './registros-sueno.schemas.js';

const noEncontrado = () => errores.noEncontrado('El registro de sueño no existe');
const duplicado = () => errores.conflicto('Ya registraste el sueño de esa fecha');

function aDto(r: repo.FilaRegistro): RegistroSuenoDto {
  return {
    idRegistro: r.idRegistro,
    fecha: formatFecha(r.fecha),
    horasDormidas: r.horasDormidas.toNumber(),
  };
}

// "Hoy" en APP_TZ: a las 20:00 de Bogotá, en UTC ya es el día siguiente.
function validarFecha({ fecha }: DatosRegistro): void {
  if (fecha > hoyEnZona()) {
    throw errores.reglaNegocio('No puedes registrar el sueño de una fecha futura');
  }
}

async function conDuplicado<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esUnicoViolado(error)) throw duplicado();
    throw error;
  }
}

export async function crear(idUsuario: number, datos: DatosRegistro): Promise<RegistroSuenoDto> {
  validarFecha(datos);
  const registro = aDto(await conDuplicado(() => repo.crear(idUsuario, datos)));
  await trasRegistroDeSuenoSinFallar(idUsuario, registro.fecha, registro.horasDormidas);
  return registro;
}

export async function listar(
  idUsuario: number,
  filtros: FiltrosRegistros,
): Promise<Pagina<RegistroSuenoDto>> {
  const { filas, total } = await repo.listar(idUsuario, filtros);
  return pagina(filas.map(aDto), total, filtros);
}

export async function obtener(idUsuario: number, idRegistro: number): Promise<RegistroSuenoDto> {
  const registro = await repo.buscar(idUsuario, idRegistro);
  if (!registro) throw noEncontrado();
  return aDto(registro);
}

export async function reemplazar(
  idUsuario: number,
  idRegistro: number,
  datos: DatosRegistro,
): Promise<RegistroSuenoDto> {
  validarFecha(datos);
  const registro = await conDuplicado(() => repo.reemplazar(idUsuario, idRegistro, datos));
  if (!registro) throw noEncontrado();
  const dto = aDto(registro);
  await trasRegistroDeSuenoSinFallar(idUsuario, dto.fecha, dto.horasDormidas);
  return dto;
}

export async function eliminar(idUsuario: number, idRegistro: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario, idRegistro))) throw noEncontrado();
}

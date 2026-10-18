// Datos base del catálogo (spec §10 y §7.6). Las instrucciones van en pasos numerados,
// como en la pantalla "Cómo hacerlo" del mockup.

export const ACTIVIDADES = [
  {
    nombre: 'Estiramiento de cuello y hombros',
    categoria: 'estiramiento',
    duracionMin: 6,
    instrucciones:
      '1. Siéntate con la espalda recta.\n2. Inclina la cabeza hacia un hombro y sostén 15 segundos.\n3. Repite hacia el otro lado.\n4. Gira los hombros hacia atrás 10 veces.',
  },
  {
    nombre: 'Estiramiento de espalda baja',
    categoria: 'estiramiento',
    duracionMin: 5,
    instrucciones:
      '1. Ponte de pie con los pies a la anchura de la cadera.\n2. Lleva las manos a la cintura.\n3. Inclínate suavemente hacia atrás y sostén 10 segundos.\n4. Flexiona el tronco hacia delante sin forzar y vuelve despacio.',
  },
  {
    nombre: 'Rotación de muñecas y tobillos',
    categoria: 'estiramiento',
    duracionMin: 5,
    instrucciones:
      '1. Extiende los brazos al frente.\n2. Gira las muñecas 10 veces en cada sentido.\n3. Levanta un pie y gira el tobillo 10 veces en cada sentido.\n4. Repite con el otro pie.',
  },
  {
    nombre: 'Caminata corta',
    categoria: 'caminata',
    duracionMin: 10,
    instrucciones:
      '1. Levántate y sal de tu puesto.\n2. Camina a paso cómodo durante 8 minutos.\n3. Respira profundo los últimos 2 minutos.\n4. Vuelve e hidrátate.',
  },
  {
    nombre: 'Subir y bajar escaleras',
    categoria: 'bajo_impacto',
    duracionMin: 8,
    instrucciones:
      '1. Busca una escalera cercana.\n2. Sube y baja a ritmo constante durante 6 minutos, usando el pasamanos.\n3. Termina caminando 2 minutos en plano.',
  },
  {
    nombre: 'Sentadillas suaves',
    categoria: 'bajo_impacto',
    duracionMin: 7,
    instrucciones:
      '1. Ponte de pie frente a una silla.\n2. Baja como si fueras a sentarte, sin llegar a apoyarte.\n3. Sube despacio.\n4. Haz 3 series de 10 repeticiones con descanso de 1 minuto.',
  },
  {
    nombre: 'Respiración y movilidad torácica',
    categoria: 'estiramiento',
    duracionMin: 5,
    instrucciones:
      '1. Siéntate o ponte de pie con la espalda recta.\n2. Inhala 4 segundos abriendo los brazos.\n3. Exhala 6 segundos girando el tronco hacia un lado.\n4. Alterna lados durante 5 minutos.',
  },
  {
    nombre: 'Caminata activa',
    categoria: 'caminata',
    duracionMin: 15,
    instrucciones:
      '1. Sal a un espacio abierto o a un pasillo largo.\n2. Camina 2 minutos a paso suave.\n3. Acelera el paso durante 10 minutos.\n4. Baja el ritmo los últimos 3 minutos.',
  },
] as const;

export const INSIGNIAS = [
  {
    codigo: 'PRIMERA_SEMANA',
    nombre: 'Primera semana',
    descripcion: 'Completaste 7 días activos.',
    criterio: '≥ 7 días activos acumulados',
  },
  {
    codigo: 'DIEZ_PAUSAS',
    nombre: '10 pausas',
    descripcion: 'Completaste 10 micro-pausas activas.',
    criterio: '≥ 10 micro-pausas hechas en total',
  },
  {
    codigo: 'SUENO_7H_5N',
    nombre: '7 h por 5 noches',
    descripcion: 'Dormiste al menos 7 horas durante 5 noches de una misma semana.',
    criterio: '≥ 5 noches con ≥ 7 h en una misma semana ISO',
  },
] as const;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "TipoBloque" AS ENUM ('trabajo', 'estudio', 'viaje');

-- CreateEnum
CREATE TYPE "OrigenBloque" AS ENUM ('manual', 'importado');

-- CreateEnum
CREATE TYPE "EstadoMicroPausa" AS ENUM ('pendiente', 'hecha', 'omitida');

-- CreateEnum
CREATE TYPE "TipoRecordatorio" AS ENUM ('sueno', 'pausa');

-- CreateEnum
CREATE TYPE "TipoConfigNotificacion" AS ENUM ('sueno', 'pausa', 'logros');

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acepta_datos" BOOLEAN NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'user',

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id_token" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id_token")
);

-- CreateTable
CREATE TABLE "perfil_habitos" (
    "id_perfil" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "hora_dormir" TIME(0) NOT NULL,
    "hora_despertar" TIME(0) NOT NULL,
    "meta_horas_sueno" DECIMAL(3,1) NOT NULL,
    "meta_min_actividad" INTEGER NOT NULL,

    CONSTRAINT "perfil_habitos_pkey" PRIMARY KEY ("id_perfil")
);

-- CreateTable
CREATE TABLE "bloque_horario" (
    "id_bloque" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoBloque" NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "hora_fin" TIME(0) NOT NULL,
    "origen" "OrigenBloque" NOT NULL DEFAULT 'manual',

    CONSTRAINT "bloque_horario_pkey" PRIMARY KEY ("id_bloque")
);

-- CreateTable
CREATE TABLE "micro_ventana" (
    "id_ventana" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TIME(0) NOT NULL,
    "duracion_min" SMALLINT NOT NULL,

    CONSTRAINT "micro_ventana_pkey" PRIMARY KEY ("id_ventana")
);

-- CreateTable
CREATE TABLE "actividad" (
    "id_actividad" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "categoria" VARCHAR(40) NOT NULL,
    "duracion_min" SMALLINT NOT NULL,
    "instrucciones" TEXT NOT NULL,

    CONSTRAINT "actividad_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateTable
CREATE TABLE "micro_pausa" (
    "id_pausa" SERIAL NOT NULL,
    "id_ventana" INTEGER NOT NULL,
    "id_actividad" INTEGER NOT NULL,
    "estado" "EstadoMicroPausa" NOT NULL DEFAULT 'pendiente',
    "fecha_registro" TIMESTAMP(3),

    CONSTRAINT "micro_pausa_pkey" PRIMARY KEY ("id_pausa")
);

-- CreateTable
CREATE TABLE "registro_sueno" (
    "id_registro" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "horas_dormidas" DECIMAL(3,1) NOT NULL,

    CONSTRAINT "registro_sueno_pkey" PRIMARY KEY ("id_registro")
);

-- CreateTable
CREATE TABLE "recordatorio" (
    "id_recordatorio" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoRecordatorio" NOT NULL,
    "mensaje" VARCHAR(160) NOT NULL,
    "fecha_hora_envio" TIMESTAMP(3) NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "recordatorio_pkey" PRIMARY KEY ("id_recordatorio")
);

-- CreateTable
CREATE TABLE "config_notificacion" (
    "id_config" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoConfigNotificacion" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "silencio_inicio" TIME(0),
    "silencio_fin" TIME(0),

    CONSTRAINT "config_notificacion_pkey" PRIMARY KEY ("id_config")
);

-- CreateTable
CREATE TABLE "progreso" (
    "id_progreso" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "puntos_totales" INTEGER NOT NULL DEFAULT 0,
    "racha_actual" SMALLINT NOT NULL DEFAULT 0,
    "racha_maxima" SMALLINT NOT NULL DEFAULT 0,
    "dias_comodin" SMALLINT NOT NULL DEFAULT 2,
    "ultima_fecha_activa" DATE,
    "semana_comodin" VARCHAR(8),

    CONSTRAINT "progreso_pkey" PRIMARY KEY ("id_progreso")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "clave" VARCHAR(100) NOT NULL,
    "metodo_ruta" VARCHAR(120) NOT NULL,
    "codigo" INTEGER NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "insignia" (
    "id_insignia" SERIAL NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(160) NOT NULL,
    "criterio" VARCHAR(120) NOT NULL,

    CONSTRAINT "insignia_pkey" PRIMARY KEY ("id_insignia")
);

-- CreateTable
CREATE TABLE "usuario_insignia" (
    "id_usuario" INTEGER NOT NULL,
    "id_insignia" INTEGER NOT NULL,
    "fecha_obtencion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_insignia_pkey" PRIMARY KEY ("id_usuario","id_insignia")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_habitos_id_usuario_key" ON "perfil_habitos"("id_usuario");

-- CreateIndex
CREATE INDEX "bloque_horario_id_usuario_dia_semana_idx" ON "bloque_horario"("id_usuario", "dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX "micro_ventana_id_usuario_fecha_hora_inicio_key" ON "micro_ventana"("id_usuario", "fecha", "hora_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "micro_pausa_id_ventana_key" ON "micro_pausa"("id_ventana");

-- CreateIndex
CREATE UNIQUE INDEX "registro_sueno_id_usuario_fecha_key" ON "registro_sueno"("id_usuario", "fecha");

-- CreateIndex
CREATE INDEX "recordatorio_enviado_fecha_hora_envio_idx" ON "recordatorio"("enviado", "fecha_hora_envio");

-- CreateIndex
CREATE UNIQUE INDEX "config_notificacion_id_usuario_tipo_key" ON "config_notificacion"("id_usuario", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_id_usuario_key" ON "progreso"("id_usuario");

-- CreateIndex
CREATE INDEX "idempotency_key_creada_en_idx" ON "idempotency_key"("creada_en");

-- CreateIndex
CREATE UNIQUE INDEX "insignia_codigo_key" ON "insignia"("codigo");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_habitos" ADD CONSTRAINT "perfil_habitos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloque_horario" ADD CONSTRAINT "bloque_horario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_ventana" ADD CONSTRAINT "micro_ventana_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_pausa" ADD CONSTRAINT "micro_pausa_id_ventana_fkey" FOREIGN KEY ("id_ventana") REFERENCES "micro_ventana"("id_ventana") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_pausa" ADD CONSTRAINT "micro_pausa_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "actividad"("id_actividad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_sueno" ADD CONSTRAINT "registro_sueno_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorio" ADD CONSTRAINT "recordatorio_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_notificacion" ADD CONSTRAINT "config_notificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso" ADD CONSTRAINT "progreso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_insignia" ADD CONSTRAINT "usuario_insignia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_insignia" ADD CONSTRAINT "usuario_insignia_id_insignia_fkey" FOREIGN KEY ("id_insignia") REFERENCES "insignia"("id_insignia") ON DELETE CASCADE ON UPDATE CASCADE;

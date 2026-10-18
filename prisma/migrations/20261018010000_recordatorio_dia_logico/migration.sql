-- Recordatorios: día lógico ("fecha") y clave de origen ("clave_origen").
-- La sincronización deja de depender del instante de envío, que el usuario puede editar.

-- 1. Columnas nuevas, primero nulas para rellenar las filas existentes.
ALTER TABLE "recordatorio" ADD COLUMN "clave_origen" VARCHAR(60),
ADD COLUMN "fecha" DATE;

-- 2. Relleno: el día lógico corta a las 04:00 de Bogotá; la clave usa el instante actual en UTC.
UPDATE "recordatorio"
SET "fecha" = ((("fecha_hora_envio" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota') - INTERVAL '4 hours')::date,
    "clave_origen" = "tipo"::text || '|' || to_char("fecha_hora_envio", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

ALTER TABLE "recordatorio" ALTER COLUMN "clave_origen" SET NOT NULL,
ALTER COLUMN "fecha" SET NOT NULL;

-- 3. La unicidad pasa del instante a la clave de origen.
DROP INDEX "recordatorio_id_usuario_tipo_fecha_hora_envio_key";

CREATE UNIQUE INDEX "recordatorio_id_usuario_clave_origen_key" ON "recordatorio"("id_usuario", "clave_origen");

CREATE INDEX "recordatorio_id_usuario_fecha_idx" ON "recordatorio"("id_usuario", "fecha");

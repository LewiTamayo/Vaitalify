-- CreateTable
CREATE TABLE "puntos_otorgados" (
    "id_punto" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "concepto" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(40) NOT NULL,
    "puntos" SMALLINT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puntos_otorgados_pkey" PRIMARY KEY ("id_punto")
);

-- CreateIndex
CREATE UNIQUE INDEX "puntos_otorgados_id_usuario_concepto_referencia_key" ON "puntos_otorgados"("id_usuario", "concepto", "referencia");

-- AddForeignKey
ALTER TABLE "puntos_otorgados" ADD CONSTRAINT "puntos_otorgados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

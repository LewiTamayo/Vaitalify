-- CreateIndex
CREATE UNIQUE INDEX "recordatorio_id_usuario_tipo_fecha_hora_envio_key" ON "recordatorio"("id_usuario", "tipo", "fecha_hora_envio");

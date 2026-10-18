import { logger } from '../logger.js';

// Punto de extensión para push del servidor (S-13). En el MVP la entrega la hace la app con
// notificaciones locales (GET /recordatorios/pendientes, S-15); un envío push real (FCM/APNs)
// implementaría esta interfaz y requeriría un programador con precisión de minutos (§7.7.5).
export interface Notificacion {
  idUsuario: number;
  titulo: string;
  cuerpo: string;
}

export interface NotificationSender {
  enviar(notificacion: Notificacion): Promise<void>;
}

export class LogSender implements NotificationSender {
  enviar({ idUsuario, titulo }: Notificacion): Promise<void> {
    // Sin el cuerpo: los logs no llevan contenido personal (RNF-07).
    logger.info({ idUsuario, titulo }, 'Notificación (stub)');
    return Promise.resolve();
  }
}

import { pino } from 'pino';

// JSON a stdout (Vercel lo recoge en Logs). Nunca registrar contraseñas ni tokens.
export const logger = pino({
  level: process.env.APP_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.contrasena',
      '*.contrasenaActual',
      '*.contrasenaHash',
      '*.refreshToken',
      '*.accessToken',
      '*.token',
    ],
    censor: '[oculto]',
  },
});

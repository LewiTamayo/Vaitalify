# Tratamiento de datos personales — Vitalify API

> Borrador técnico (Fase 2). Se completa en la Fase 8 con el resto de módulos.
> Marco: Ley Estatutaria 1581 de 2012 (Colombia) y RNF-07 del Entregable 2.

## Finalidad

Vitalify trata los datos del usuario **solo** para:

1. Autenticarlo y mantener su sesión.
2. Detectar micro-ventanas libres en su horario y recomendarle micro-pausas activas.
3. Calcular recordatorios de higiene del sueño.
4. Mostrar su progreso (puntos, racha, insignias).

No se venden, ceden ni comparten datos con terceros. No se usan para publicidad.

## Autorización

El registro exige `aceptaDatos: true` (autorización previa, expresa e informada). Sin ella la cuenta no se crea (`422`).

## Datos tratados

| Dato | Para qué | Dónde |
|---|---|---|
| Nombre y correo | Identificar la cuenta e iniciar sesión | `usuario` |
| Contraseña | Autenticación. Se guarda **solo** su hash bcrypt (coste 12), nunca en claro | `usuario.contrasena_hash` |
| Sesiones | Mantener la sesión. Se guarda solo el hash SHA-256 del refresh token | `refresh_token` |
| Horario semanal, hábitos de sueño, registros de cumplimiento | Funcionalidad principal (RF-02 a RF-09) | tablas del modelo ER |

Minimización: no se piden fecha de nacimiento, teléfono, ubicación ni datos de salud más allá de las horas de sueño declaradas.

## Derechos del titular

| Derecho | Cómo se ejerce |
|---|---|
| Acceso / consulta | `GET /api/v1/usuarios/me/exportar` descarga **todos** sus datos en JSON |
| Actualización / rectificación | `PATCH /api/v1/usuarios/me` y los endpoints de cada recurso |
| Supresión | `DELETE /api/v1/usuarios/me` borra la cuenta y **todos** sus datos (borrado en cascada en la BD) |
| Revocar la autorización | Equivale a la supresión de la cuenta |

## Seguridad

- HTTPS en todos los entornos (`*.vercel.app`, HSTS con `helmet`).
- Conexión a la BD (Neon) con TLS (`sslmode=require`) y cifrado en reposo del proveedor.
- Secretos solo en las variables de entorno de Vercel, nunca en el repositorio.
- Los logs no incluyen contraseñas, tokens ni la cabecera `Authorization` (`pino` con `redact`).
- Rate limiting en autenticación para mitigar ataques de fuerza bruta.
- Cada usuario solo accede a sus propios recursos (los ajenos responden `404`).

# Vitalify Web (demostración)

Front mínimo para **mostrar la API funcionando**: entrar o crear cuenta, pantalla **Hoy**
(micro-pausas con _Hecha_ / _Omitir_) y **Progreso** (puntos, racha, actividad semanal e insignias).
No reemplaza a la app móvil ni cubre todas las funciones de la API (para eso está `/api/v1/docs`).

React 19 · Vite · TypeScript · React Router · Vitest + Testing Library.

## Correr en local

Con la API corriendo en la raíz del repo (`npm run dev`, puerto 3000; su `CORS_ORIGINS` debe incluir
`http://localhost:5173`, que es el valor de `.env.example`):

```bash
cd web
npm install
cp .env.example .env.local   # opcional: VITE_API_URL por defecto es http://localhost:3000/api/v1
npm run dev                  # http://localhost:5173
```

Flujo de la demo: **Crear cuenta** → **Preparar mi día de ejemplo** (crea el perfil, un horario de
estudio y trabajo para los 7 días y las micro-pausas de hoy) → marcar una pausa como **Hecha**
(aviso con +10 puntos y la racha) → **Progreso**.

## Calidad

```bash
npm run lint && npm run typecheck
npm run test:coverage        # coverage/lcov.info (lo lee SonarQube junto con el de la API)
npm run build                # dist/
```

El job `ci` de GitHub Actions corre estos mismos pasos antes del análisis de SonarQube.

## Despliegue (Vercel)

Segundo proyecto de Vercel sobre el mismo repositorio, con **Root Directory = `web`** (Vite se
detecta solo). Variable `VITE_API_URL` en Production, por ejemplo
`https://vaitalify-beta.vercel.app/api/v1`; se fija al compilar, así que cambiarla exige redesplegar.
El dominio del front debe estar en `CORS_ORIGINS` del proyecto de la API.

Los Preview del front no están en `CORS_ORIGINS`, así que no pueden llamar a la API; la demo se hace
en Production o en local.

## Sesión

El token de acceso vive solo en memoria y el refresh token en `sessionStorage` (se borra al cerrar la
pestaña). Ante un `401` el cliente renueva la sesión una sola vez, compartida entre las peticiones
simultáneas, y reintenta. Es una concesión de demo: un XSS podría leer el refresh token; una
versión productiva usaría una cookie `httpOnly`.

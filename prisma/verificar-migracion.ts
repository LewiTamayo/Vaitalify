import { exigirUrlMigraciones } from '../prisma.config.js';

// Paso de vercel-build: falla con un mensaje claro si el entorno no tiene URL directa de Neon.
exigirUrlMigraciones(process.env);

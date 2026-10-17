# Referencia: el flujo principal usa Neon (ver docs/DECISIONES.md, U-2).
# Solo para el entorno de rendimiento local; Vercel no usa este archivo.
FROM node:24-alpine
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npx", "tsx", "src/local.ts"]

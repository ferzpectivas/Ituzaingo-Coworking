# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa de compilación: instala dependencias y compila API y web.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY . .

# URL que el navegador usa para hablar con la API. Por defecto es relativa
# (/api/v1) porque Caddy publica la API y la web bajo el mismo origen.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN node tools/floorplan/build-floorplan.mjs \
  && npm run build -w @ituzaingo/api \
  && npm run build -w @ituzaingo/web \
  && npm prune --omit=dev

# ---------------------------------------------------------------------------
# API NestJS + Fastify
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production \
    API_PORT=4000 \
    DATA_DIR=/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]

# ---------------------------------------------------------------------------
# Web Next.js
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts
COPY --from=build /app/apps/web/.next ./apps/web/.next
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start", "-w", "@ituzaingo/web"]

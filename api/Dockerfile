FROM node:20-alpine AS deps
WORKDIR /app
COPY api/package.json api/pnpm-lock.yaml* /app/
WORKDIR /app/api
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/api/node_modules
COPY api/. /app/api/
COPY db /app/db
WORKDIR /app/api
RUN pnpm build || true

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=development
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules /app/api/node_modules
COPY api/. /app/api/
COPY db /app/db
WORKDIR /app/api
EXPOSE 3001
CMD ["pnpm","dev"]

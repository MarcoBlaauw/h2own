FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm","dev","--","--host"]

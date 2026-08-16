FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

FROM base AS development

RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "run", "start:dev"]

FROM base AS builder

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build
RUN mkdir -p src/_db/drizzle/migrations

FROM base AS production

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/_db/drizzle/migrations ./src/_db/drizzle/migrations
COPY --from=builder /app/src/_db/drizzle/schema ./src/_db/drizzle/schema

CMD ["pnpm", "run", "start:prod"]

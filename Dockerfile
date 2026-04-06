# Optional: Railway → Settings → Builder → Dockerfile
FROM node:22-bookworm-slim AS deps
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
# Avoid postinstall `prisma generate` before prisma/ exists (would embed wrong or default client).
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS build
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG DIRECT_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]

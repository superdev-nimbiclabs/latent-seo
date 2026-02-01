FROM node:20-alpine AS base
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Build the app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production
EXPOSE 3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app/workers ./app/workers
COPY --from=builder /app/app/services ./app/services
COPY --from=builder /app/app/lib ./app/lib
COPY --from=builder /app/app/config ./app/config
COPY --from=builder /app/app/db.server.ts ./app/db.server.ts

# Generate Prisma client
RUN npx prisma generate

CMD ["npm", "run", "docker-start"]

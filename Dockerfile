FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
RUN npx prisma generate

COPY src ./src

EXPOSE 3001

# Migrations are idempotent: only migrations that have not run yet are applied.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/app.ts"]

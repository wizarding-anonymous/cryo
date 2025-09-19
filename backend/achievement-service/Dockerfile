# Multi-stage build для оптимизации размера образа
FROM node:18-alpine AS base

# Установка зависимостей для сборки
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Stage 1: Установка зависимостей
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Сборка приложения
FROM base AS builder
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 3: Production образ
FROM node:18-alpine AS runner
WORKDIR /app

# Создание пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Копирование только необходимых файлов
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Установка владельца файлов
RUN chown -R nestjs:nodejs /app
USER nestjs

# Настройка переменных окружения
ENV NODE_ENV=production
ENV PORT=3003

# Открытие порта
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Запуск приложения
CMD ["node", "dist/main.js"]
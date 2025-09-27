# Multi-stage build для минимизации размера образа
FROM node:20-alpine AS base

# Установка зависимостей для сборки и безопасности
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Копирование файлов конфигурации
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Stage 1: Установка production зависимостей
FROM base AS deps
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Stage 2: Сборка приложения
FROM base AS builder
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npm run build

# Stage 3: Production образ
FROM node:20-alpine AS runner
WORKDIR /app

# Установка dumb-init для правильной обработки сигналов
RUN apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Создание пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Копирование только необходимых файлов
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Создание необходимых директорий с правильными правами
RUN mkdir -p logs tmp && \
    chown -R nestjs:nodejs logs tmp

# Переключение на непривилегированного пользователя
USER nestjs

# Настройка переменных окружения
ENV NODE_ENV=production \
    PORT=3003 \
    NODE_OPTIONS="--max-old-space-size=512" \
    NPM_CONFIG_CACHE=/tmp/.npm

# Открытие порта
EXPOSE 3003

# Health check для Kubernetes
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Запуск приложения с dumb-init для правильной обработки сигналов
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
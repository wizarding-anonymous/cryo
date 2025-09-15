# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /usr/src/app

# Install only production deps
COPY --from=builder /usr/src/app/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built files
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3008

EXPOSE 3008

CMD ["node", "dist/main.js"]


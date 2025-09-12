# ---- Base Stage ----
FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install -g @nestjs/cli

# ---- Dependencies Stage ----
FROM base AS dependencies
RUN npm install --only=production
COPY . .
RUN npm run build

# ---- Release Stage ----
FROM node:18-alpine AS release
WORKDIR /usr/src/app
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=dependencies /usr/src/app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]

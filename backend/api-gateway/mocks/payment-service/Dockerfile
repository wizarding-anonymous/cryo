FROM node:20-alpine
WORKDIR /srv/mock
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY index.js ./
ENV PORT=3003
EXPOSE 3003
CMD ["node", "index.js"]
FROM node:20-alpine
WORKDIR /srv/mock
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY index.js ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "index.js"]


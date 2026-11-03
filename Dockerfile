# CRM do dono — imagem de demo / desenvolvimento.
# Uso: docker compose up --build
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Modo demo: sem .env. Dados de exemplo ficam no navegador.
EXPOSE 3000
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]

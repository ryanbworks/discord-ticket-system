FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Dependências primeiro, para aproveitar o cache de camadas do Docker.
# Nenhuma dependência precisa de compilação nativa.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]

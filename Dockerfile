# Imagem base Node.js
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Variáveis de ambiente padrão
ENV NODE_ENV=production

# Copiar e dar permissão ao script de inicialização
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Comando de inicialização - apenas o bot
CMD ["/app/start.sh"]

# Usar uma imagem base do Node.js com suporte a Alpine (leve e compatível com Chromium)
FROM node:16-alpine

# Instalar dependências do sistema para o Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Definir variáveis de ambiente para o Chromium rodar em modo headless
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm install

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta que o servidor vai rodar
EXPOSE ${PORT}

# Comando para rodar a aplicação
CMD ["node", "index.js"]
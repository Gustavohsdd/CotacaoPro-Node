# Usa uma imagem oficial leve do Node.js
FROM node:18-slim

# Instala dependências do sistema necessárias para bibliotecas gráficas (se o pdfmake precisar)
# E fontes caso necessário (opcional, mas recomendado para PDF)
RUN apt-get update && apt-get install -y \
    fontconfig \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (para aproveitar cache do Docker)
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código do projeto
COPY . .

# Expõe a porta que o Cloud Run espera (padrão 8080, mas seu app lê process.env.PORT)
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["npm", "start"]
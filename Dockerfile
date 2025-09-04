FROM node:20-alpine
WORKDIR /app

# copia dipendenze già installate e dist buildata in locale
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist

EXPOSE 8080
CMD ["node", "dist/server.js"]

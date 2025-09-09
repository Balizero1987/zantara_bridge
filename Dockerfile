# ---------- Builder ----------
FROM node:20-slim AS builder
WORKDIR /app

# Dipendenze
COPY package*.json ./
# usa ci se possibile, fallback a install
RUN npm ci || npm install

# Config TS + sorgenti
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript → dist/
RUN npm run build

# ---------- Runtime ----------
FROM node:20-slim
WORKDIR /app

# Dipendenze runtime sole
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copia il build
COPY --from=builder /app/dist ./dist

# Env standard
ENV NODE_ENV=production

# Entry-point: deve esistere dist/src/index.js
CMD ["node","dist/index.js"]

# ---------- Builder ----------
FROM node:20-slim AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci || npm install

# Copy sources
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript → dist/
RUN npm run build

# ---------- Runtime ----------
FROM node:20-slim
WORKDIR /app

# Runtime-only deps
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Entry
CMD ["node","dist/index.js"]

        hotfix/fix-node-modules
FROM node:20-bullseye AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bullseye

FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
FROM node:20-slim
        main
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node","dist/src/index.js"]

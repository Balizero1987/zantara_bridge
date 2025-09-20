# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source and dist (pre-built)
COPY . .
# Skip TypeScript compilation - using pre-built dist/
# RUN npx tsc -p tsconfig.json

# Production stage (optimized for zero-cost operation)
FROM node:20-alpine AS production
WORKDIR /app

# Security: create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zantara -u 1001

# Copy entire application (including pre-built dist) and dependencies
COPY --from=builder --chown=zantara:nodejs /app ./
RUN npm ci --omit=dev

# Switch to non-root user
USER zantara

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Expose port
EXPOSE 8080

# Start main server with Redis integration
CMD ["node", "dist/index.js"]

# Note: Removed legacy runner stage - using production stage as default

# Multi-stage build for Notification Service

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (prefer lockfile, fallback without it)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Stage 2: Production
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

# Copy application files first
COPY --chown=nodejs:nodejs . .

# Ensure no stale node_modules from context
RUN rm -rf node_modules

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create directories
RUN mkdir -p logs templates && \
    chown -R nodejs:nodejs logs templates

# Switch to non-root user
USER nodejs

# Expose port (Railway injects PORT env var)
EXPOSE 8085

# Start with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

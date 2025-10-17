FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
RUN mkdir -p uploads logs && chown -R nodejs:nodejs uploads logs
USER nodejs
EXPOSE 8084
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8084/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

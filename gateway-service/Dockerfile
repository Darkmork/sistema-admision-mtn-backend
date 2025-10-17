# NGINX API Gateway Docker Image
FROM nginx:1.25-alpine

# Install necessary tools
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm /etc/nginx/nginx.conf
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx configuration
COPY config/nginx-docker.conf /etc/nginx/nginx.conf

# Create log directory
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/gateway/status || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

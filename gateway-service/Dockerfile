# NGINX API Gateway Docker Image
FROM nginx:1.25-alpine

# Install necessary tools
RUN apk add --no-cache curl

# Expose port
EXPOSE 8080

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

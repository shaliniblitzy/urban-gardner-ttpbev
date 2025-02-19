# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Add build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY src/web/package*.json ./

# Install dependencies with exact versions
RUN npm ci --only=production

# Copy source code and config files
COPY src/web/tsconfig.json ./
COPY src/web/src ./src
COPY src/web/public ./public

# Set build-time variables
ARG NODE_ENV=production
ARG API_URL
ARG BUILD_VERSION

ENV NODE_ENV=${NODE_ENV}
ENV REACT_APP_API_URL=${API_URL}
ENV REACT_APP_VERSION=${BUILD_VERSION}
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Generate production build
RUN npm run build

# Remove dev dependencies and clear npm cache
RUN npm prune --production && \
    npm cache clean --force

# Stage 2: Production stage
FROM nginx:alpine

# Install required packages
RUN apk add --no-cache curl

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx configuration
RUN mkdir -p /etc/nginx/templates
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Security headers configuration
RUN echo 'add_header X-Frame-Options "DENY";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-Content-Type-Options "nosniff";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/security-headers.conf && \
    echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";' >> /etc/nginx/conf.d/security-headers.conf

# Configure gzip compression
RUN echo 'gzip on;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_comp_level 6;' >> /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_types text/plain text/css application/javascript application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/conf.d/gzip.conf

# Create nginx user and set permissions
RUN adduser -D -H -u 101 -s /sbin/nologin nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 500 /usr/share/nginx/html

# Configure worker processes and connections
RUN echo 'worker_processes auto;' > /etc/nginx/nginx.conf && \
    echo 'events { worker_connections 1024; }' >> /etc/nginx/nginx.conf

# Create health check endpoint
RUN mkdir -p /usr/share/nginx/html/health && \
    echo "OK" > /usr/share/nginx/html/health/index.html

# Set read-only filesystem
RUN chmod 555 /usr/share/nginx/html/health/index.html

# Expose ports
EXPOSE 80 443

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost/health || exit 1

# Set user
USER nginx

# Set read-only root filesystem
RUN chmod -R 555 /usr/share/nginx/html

# Drop all capabilities and set no new privileges
RUN echo 'no-new-privileges=true' >> /etc/nginx/nginx.conf

# Set cache control headers
RUN echo 'location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {' >> /etc/nginx/conf.d/cache-control.conf && \
    echo '    expires 1y;' >> /etc/nginx/conf.d/cache-control.conf && \
    echo '    add_header Cache-Control "public, max-age=31536000";' >> /etc/nginx/conf.d/cache-control.conf && \
    echo '}' >> /etc/nginx/conf.d/cache-control.conf

# Configure graceful shutdown
STOPSIGNAL SIGQUIT

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
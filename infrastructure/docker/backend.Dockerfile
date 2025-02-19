# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY src/backend/package*.json ./
COPY src/backend/tsconfig.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY src/backend/src ./src

# Build TypeScript code
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

# Create non-root user/group
RUN addgroup -S nodeapp && \
    adduser -S -G nodeapp nodeapp

# Set working directory
WORKDIR /app

# Install production dependencies
COPY src/backend/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Set secure file permissions
RUN chown -R nodeapp:nodeapp /app && \
    chmod -R 550 /app && \
    chmod -R 550 /app/dist

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose service port
EXPOSE 3000

# Switch to non-root user
USER nodeapp

# Set read-only filesystem
RUN chmod a-w /app

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set entry point
CMD ["node", "dist/index.js"]
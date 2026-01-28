# ============================================
# Multi-Stage Dockerfile for React Frontend
# LMSetjen DPD RI - Learning Management System
# ============================================

# Stage 1: Build Stage
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci && \
    npm cache clean --force

# Copy application source
COPY . .

# Build argument for API URL
# Default to using the same origin (production) or localhost for development
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Debug: Show environment variable
RUN echo "========================================" && \
    echo "Building with VITE_API_BASE_URL: $VITE_API_BASE_URL" && \
    echo "========================================" && \
    env | grep VITE

# Build application - only if dist doesn't exist
COPY . .
RUN if [ ! -d "dist" ]; then npm run build; fi

# ============================================
# Stage 2: Production Stage with Nginx
FROM nginx:1.25-alpine as production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

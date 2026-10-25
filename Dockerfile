# Multi-stage Dockerfile for Torn Scouter

# Stage 1: Build static frontend assets and prepare application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for Vite & TypeScript build)
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend assets into /app/dist
RUN npm run build

# Stage 2: Production runner environment
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

# Expose default application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start server using tsx
CMD ["npm", "start"]

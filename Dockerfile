# Multi-stage Dockerfile for Sargus

# Stage 1: Build static frontend assets and prepare application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifest
COPY package.json ./

# Install dependencies using --legacy-peer-deps to prevent edgesOut npm resolver bug
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build Vite frontend assets into /app/dist
RUN npm run build

# Stage 2: Production runner environment
FROM node:20-alpine AS runner

LABEL org.opencontainers.image.title="Sargus"
LABEL org.opencontainers.image.description="Inactive Target & Battle Stat Finder for Torn City MMORPG"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifest and install runtime dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps

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

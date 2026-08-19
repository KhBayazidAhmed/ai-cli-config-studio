# Use official lightweight Bun image
FROM oven/bun:1.3.12-alpine AS runner

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy application files
COPY --chown=bun:bun package.json server.ts ./
COPY --chown=bun:bun public ./public

# Use non-root bun user
USER bun

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["bun", "run", "start"]

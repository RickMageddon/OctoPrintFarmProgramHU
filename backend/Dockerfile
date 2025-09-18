FROM node:18-alpine

WORKDIR /app



# Install dependencies and sqlite3 CLI as root
COPY package*.json ./
RUN apk add --no-cache sqlite sqlite-libs && npm install --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/database /app/uploads

# Set permissions
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]

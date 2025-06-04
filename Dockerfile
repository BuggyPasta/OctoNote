FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create data directory and set permissions
RUN mkdir -p /data/octonote/notes /data/octonote/logs && \
    touch /data/octonote/users.txt && \
    chown -R node:node /data/octonote

# Switch to non-root user
USER node

# Expose port
EXPOSE 51828

# Start the application
CMD ["npm", "start"] 
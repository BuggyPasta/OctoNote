FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create startup script
RUN echo '#!/bin/sh\n\
mkdir -p /data/octonote/notes /data/octonote/logs\n\
touch /data/octonote/users.txt\n\
chown -R node:node /data/octonote\n\
exec su-exec node node src/server.js' > /app/start.sh && \
chmod +x /app/start.sh

# Expose port
EXPOSE 51828

# Start the application
CMD ["/app/start.sh"] 
FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Install gosu
RUN apt-get update && \
    apt-get install -y gosu && \
    rm -rf /var/lib/apt/lists/*

# Create startup script
RUN echo '#!/bin/sh\n\
# Create directories if they don'\''t exist\n\
mkdir -p /data/octonote/notes /data/octonote/logs\n\
\n\
# Create users.txt if it doesn'\''t exist\n\
touch /data/octonote/users.txt\n\
\n\
# Set permissions\n\
chown -R node:node /data/octonote\n\
chmod -R 755 /data/octonote\n\
\n\
# Start the application\n\
exec gosu node node src/server.js' > /app/start.sh && \
chmod +x /app/start.sh

# Expose port
EXPOSE 51828

# Start the application
CMD ["/app/start.sh"] 
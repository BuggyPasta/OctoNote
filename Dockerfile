FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Install gosu and wget (for healthcheck)
RUN apt-get update && \
    apt-get install -y gosu wget && \
    rm -rf /var/lib/apt/lists/*

# Create startup script
RUN echo '#!/bin/sh\n\
set -e\n\
echo "Starting OctoNote container..."\n\
\n\
# Create data directory structure\n\
echo "Creating data directories..."\n\
mkdir -p /data/octonote/notes /data/octonote/logs\n\
\n\
# Create users.txt if it doesn'\''t exist\n\
echo "Checking users.txt..."\n\
touch /data/octonote/users.txt\n\
\n\
# Set permissions - use node user (1000) to match host user\n\
echo "Setting permissions..."\n\
chown -R 1000:1000 /data/octonote\n\
chmod -R 755 /data/octonote\n\
\n\
# Verify public directory contents\n\
echo "Public directory contents:"\n\
ls -la /app/public\n\
echo "CSS directory contents:"\n\
ls -la /app/public/css\n\
\n\
# List directory contents and permissions\n\
echo "Directory contents:"\n\
ls -la /data/octonote\n\
\n\
# Start the application as node user\n\
echo "Starting application..."\n\
exec gosu 1000:1000 node src/server.js' > /app/start.sh && \
chmod +x /app/start.sh

# Set permissions for public directory
RUN chown -R 1000:1000 /app/public && \
    chmod -R 755 /app/public

# Expose port
EXPOSE 51828

# Start the application
CMD ["/app/start.sh"] 
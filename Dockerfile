FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create startup script
RUN echo '#!/bin/sh\n\
mkdir -p /data/octonote/notes /data/octonote/logs\n\
touch /data/octonote/users.txt\n\
chown -R node:node /data/octonote\n\
exec node src/server.js' > /app/start.sh && \
chmod +x /app/start.sh

# Switch to non-root user
USER node

# Expose port
EXPOSE 51828

# Start the app
CMD ["/app/start.sh"] 
FROM node:18-bookworm

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create data directory
RUN mkdir -p /data/octonote/notes /data/octonote/logs && \
    touch /data/octonote/users.txt && \
    chown -R node:node /data/octonote

# Switch to non-root user
USER node

# Expose port
EXPOSE 51828

# Start the app
CMD ["npm", "start"] 
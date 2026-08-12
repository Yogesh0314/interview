FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Use non-root node user
USER node

CMD ["npm", "start"]


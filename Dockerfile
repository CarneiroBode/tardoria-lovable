FROM node:20-alpine

WORKDIR /app

# Install all deps (including devDependencies for vite build)
COPY package*.json ./
RUN npm ci

# Copy source and build React frontend
COPY . .
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

EXPOSE 4000

CMD ["node", "server.js"]

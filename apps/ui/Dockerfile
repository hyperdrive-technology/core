FROM node:23.6-alpine

# Install pnpm using npm
RUN npm install -g pnpm

WORKDIR /app

# We'll mount the source code and install dependencies through compose
# Just set up the initial workspace
COPY package.json ./

# Expose Vite's dev server port
EXPOSE 5173

# Use development mode with hot reloading
CMD ["pnpm", "dev", "--host"]

# Development stage
FROM node:23.6-alpine

WORKDIR /apps/ui

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    gcc \
    git \
    linux-headers


# Install pnpm using npm
RUN npm install -g pnpm@10.4.1

# Copy package files for initial install
COPY apps/ui/package.json apps/ui/pnpm-lock.yaml ./

RUN pnpm install lightningcss-linux-arm64-musl @tailwindcss/oxide-linux-arm64-musl sass-embedded-linux-arm64

# Install dependencies
RUN pnpm install

EXPOSE 8080

# At runtime, the volume will mount over these files, but node_modules will be preserved
CMD ["pnpm", "dev"]

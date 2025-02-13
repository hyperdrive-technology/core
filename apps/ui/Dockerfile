# Development stage
FROM node:23-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/ui/package.json ./apps/ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Start development server
CMD ["pnpm", "run", "dev", "--filter", "@inrush/ui"]

# Production build would be:
# FROM node:18-alpine AS builder
# WORKDIR /app
# RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
# COPY . .
# RUN pnpm install --frozen-lockfile
# RUN pnpm run build --filter=@inrush/ui
#
# FROM nginx:alpine
# COPY --from=builder /app/apps/ui/dist /usr/share/nginx/html

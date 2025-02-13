FROM node:23-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY docs/package.json ./docs/
COPY packages/protocol/package.json ./packages/protocol/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Start development server
CMD ["pnpm", "run", "dev", "--filter", "@inrush/docs"]

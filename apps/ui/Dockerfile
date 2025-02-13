# Development stage
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/ui/package.json ./apps/ui/
COPY packages/protocol/package.json ./packages/protocol/

RUN npm install

# Copy source code
COPY . .

# Start development server
CMD ["npm", "run", "dev", "--workspace=@inrush/ui"]

# Production build would be:
# FROM node:18-alpine AS builder
# WORKDIR /app
# COPY . .
# RUN npm ci
# RUN npm run build --workspace=@inrush/ui
#
# FROM nginx:alpine
# COPY --from=builder /app/apps/ui/dist /usr/share/nginx/html

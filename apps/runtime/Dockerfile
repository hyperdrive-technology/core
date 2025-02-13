# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go.mod and go.sum
COPY apps/runtime/go.mod apps/runtime/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY apps/runtime/cmd ./cmd
COPY apps/runtime/internal ./internal

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o inrush ./cmd/inrush

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /app/inrush .

# Create data directory
RUN mkdir -p /data

# Set environment variables
ENV GO_ENV=production \
    INRUSH_DATA_DIR=/data

EXPOSE 3000 2222

CMD ["./inrush"]

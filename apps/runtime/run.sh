#!/bin/bash

# Ensure we're in the runtime directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing Go dependencies..."
go mod tidy

# Build the runtime
echo "Building Inrush runtime..."
go build -o ./bin/inrush ./cmd/inrush

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

# Run the runtime
echo "Starting Inrush runtime on http://localhost:3000"
./bin/inrush

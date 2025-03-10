#!/bin/bash

# Run UI and runtime in parallel

# Function to clean up child processes when script exits
cleanup() {
  echo "Cleaning up..."
  kill $UI_PID $RUNTIME_PID 2>/dev/null
  exit 0
}

# Set up trap to catch SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start the UI in the background
echo "Starting UI..."
cd apps/ui && npm run dev &
UI_PID=$!

# Start the runtime in the background
echo "Starting runtime..."
cd apps/runtime && ./run.sh &
RUNTIME_PID=$!

echo "Development environment started! Press Ctrl+C to stop."
echo "UI running at http://localhost:5173"
echo "Runtime API running at http://localhost:3000"

# Wait for both processes to finish
wait $UI_PID $RUNTIME_PID

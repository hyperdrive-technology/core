package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/inrush-io/inrush/apps/runtime/internal/runtime"
	"github.com/inrush-io/inrush/apps/runtime/internal/websocket"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Set up logging
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting Inrush runtime...")

	// Initialize runtime with configuration
	rt, err := runtime.New(runtime.Config{
		ScanTime: 100 * time.Millisecond,
		DataDir:  getEnvOrDefault("INRUSH_DATA_DIR", "./data"),
	})
	if err != nil {
		log.Fatalf("Failed to initialize runtime: %v", err)
	}

	// Initialize WebSocket server
	ws := websocket.NewServer(rt)
	go func() {
		log.Println("Starting WebSocket and HTTP server on :3000")
		if err := ws.Start(":3000"); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Setup signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start runtime
	if err := rt.Start(ctx); err != nil {
		log.Fatalf("Failed to start runtime: %v", err)
	}
	log.Println("Runtime started successfully")

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Received signal %v, shutting down...", sig)

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := rt.Stop(shutdownCtx); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}

	log.Println("Shutdown complete")
}

// Helper function to get environment variable with default value
func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

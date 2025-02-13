package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/inrush/inrush/runtime/internal/runtime"
	"github.com/inrush/inrush/runtime/internal/websocket"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize runtime
	rt, err := runtime.New(runtime.Config{
		ScanTime: 100 * time.Millisecond,
		DataDir:  os.Getenv("INRUSH_DATA_DIR"),
	})
	if err != nil {
		log.Fatalf("Failed to initialize runtime: %v", err)
	}

	// Initialize WebSocket server
	ws := websocket.NewServer(rt)
	go ws.Start(":3000")

	// Setup signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start runtime
	if err := rt.Start(ctx); err != nil {
		log.Fatalf("Failed to start runtime: %v", err)
	}

	// Wait for shutdown signal
	<-sigChan
	log.Println("Shutting down...")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := rt.Stop(shutdownCtx); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

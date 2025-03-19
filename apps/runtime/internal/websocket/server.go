package websocket

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/hyperdrive/core/apps/runtime/internal/runtime"
)

// Server handles WebSocket connections and HTTP API
type Server struct {
	router   *gin.Engine
	runtime  *runtime.Runtime
	upgrader websocket.Upgrader
	clients  map[*websocket.Conn]bool
	mutex    sync.Mutex
}

// NewServer creates a new WebSocket server
func NewServer(rt *runtime.Runtime) *Server {
	server := &Server{
		router:  gin.Default(),
		runtime: rt,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
		clients: make(map[*websocket.Conn]bool),
	}

	// Set up routes
	server.setupRoutes()

	return server
}

// Start starts the HTTP server
func (s *Server) Start(addr string) error {
	return s.router.Run(addr)
}

// setupRoutes initializes the API routes
func (s *Server) setupRoutes() {
	// CORS middleware
	s.router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// WebSocket endpoint
	s.router.GET("/ws", s.handleWebSocket)

	// API endpoints
	api := s.router.Group("/api")
	{
		// Get count of ST files
		api.GET("/st-files-count", s.handleSTFilesCount)

		// Compile code (validate without deploying)
		api.POST("/compile", s.handleCompile)

		// Deploy code
		api.POST("/deploy", s.handleDeploy)

		// Get runtime status
		api.GET("/status", s.handleStatus)

		// Get variables
		api.GET("/variables", s.handleGetAllVariables)

		// Get specific variable
		api.GET("/variables/:name", s.handleGetVariable)
	}
}

// handleWebSocket handles WebSocket connections
func (s *Server) handleWebSocket(c *gin.Context) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Register client
	s.mutex.Lock()
	s.clients[conn] = true
	s.mutex.Unlock()

	// Remove client when function returns
	defer func() {
		s.mutex.Lock()
		delete(s.clients, conn)
		s.mutex.Unlock()
	}()

	// Start sending periodic updates
	go s.sendPeriodicUpdates(conn)

	// Handle incoming messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		// Process message
		log.Printf("Received message: %s", message)
	}
}

// sendPeriodicUpdates sends runtime status updates to the client
func (s *Server) sendPeriodicUpdates(conn *websocket.Conn) {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			status := s.runtime.GetStatus()
			variables := s.runtime.GetAllVariables()

			update := map[string]interface{}{
				"type":      "update",
				"status":    status,
				"variables": variables,
			}

			if err := conn.WriteJSON(update); err != nil {
				log.Printf("Error sending update: %v", err)
				return
			}
		}
	}
}

// handleSTFilesCount returns the count of ST files under the Control section
func (s *Server) handleSTFilesCount(c *gin.Context) {
	// In a real implementation, this would scan the project directory
	// Here we return a placeholder count
	c.JSON(http.StatusOK, gin.H{"count": 3}) // Placeholder count
}

// handleCompile validates the code without deploying it
func (s *Server) handleCompile(c *gin.Context) {
	var req struct {
		Files       []runtime.DeployRequest `json:"files"`
		ProjectPath string                  `json:"projectPath,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Files) == 0 {
		// If no files were provided but a project path was, we can assume this is a project-wide compile
		if req.ProjectPath != "" {
			// In a real implementation, we would find all ST files in the project and compile them
			// For now, just return a success with a placeholder count
			c.JSON(http.StatusOK, gin.H{
				"status":    "compiled",
				"fileCount": 3, // Placeholder count
				"success":   true,
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided for compilation", "success": false})
		return
	}

	// Validate all ASTs without deploying
	var errors []string
	for _, file := range req.Files {
		_, err := runtime.ParseAST(file.AST)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Error in file %s: %s", file.FilePath, err.Error()))
		}
	}

	if len(errors) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   strings.Join(errors, "; "),
			"success": false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "compiled",
		"fileCount": len(req.Files),
		"success":   true,
	})
}

// handleDeploy handles code deployment requests
func (s *Server) handleDeploy(c *gin.Context) {
	var req runtime.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Deploy the code to the runtime
	if err := s.runtime.DeployCode(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deployed", "path": req.FilePath})

	// Notify all clients that code has been deployed
	s.notifyClients(map[string]interface{}{
		"type":    "deployment",
		"path":    req.FilePath,
		"success": true,
	})
}

// handleStatus returns the current runtime status
func (s *Server) handleStatus(c *gin.Context) {
	status := s.runtime.GetStatus()
	c.JSON(http.StatusOK, status)
}

// handleGetAllVariables returns all variables
func (s *Server) handleGetAllVariables(c *gin.Context) {
	variables := s.runtime.GetAllVariables()
	c.JSON(http.StatusOK, variables)
}

// handleGetVariable returns a specific variable
func (s *Server) handleGetVariable(c *gin.Context) {
	name := c.Param("name")
	variable, exists := s.runtime.GetVariable(name)

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Variable not found"})
		return
	}

	c.JSON(http.StatusOK, variable)
}

// notifyClients sends a message to all connected WebSocket clients
func (s *Server) notifyClients(message interface{}) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for client := range s.clients {
		if err := client.WriteJSON(message); err != nil {
			log.Printf("Error sending message to client: %v", err)
			client.Close()
			delete(s.clients, client)
		}
	}
}

package websocket

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/hyperdrive/core/apps/runtime/internal/runtime"
)

// Server handles WebSocket connections and HTTP API
type Server struct {
	router                *gin.Engine
	runtime               *runtime.Runtime
	upgrader              websocket.Upgrader
	clients               map[*websocket.Conn]bool
	mutex                 sync.Mutex
	subscriptions         map[*websocket.Conn]map[string]bool // Track subscribed variables per client
	subscriptionPath      map[*websocket.Conn]string          // Track path filter for each client
	lastFilterWarningTime map[*websocket.Conn]time.Time
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
		clients:               make(map[*websocket.Conn]bool),
		subscriptions:         make(map[*websocket.Conn]map[string]bool),
		subscriptionPath:      make(map[*websocket.Conn]string),
		lastFilterWarningTime: make(map[*websocket.Conn]time.Time),
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

		// Download AST
		api.GET("/download-ast/:path", s.handleDownloadAST)

		// List all available ASTs
		api.GET("/download-ast", s.handleListASTs)
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
	// Initialize subscription map for this client
	s.subscriptions[conn] = make(map[string]bool)

	// Get all variables and automatically subscribe to them
	allVars := s.runtime.GetAllVariables()
	var autoSubscribeVars []string

	// Extract all variable names
	for _, varList := range allVars {
		for _, v := range varList {
			s.subscriptions[conn][v.Name] = true
			autoSubscribeVars = append(autoSubscribeVars, v.Name)
		}
	}

	// Log auto-subscription
	if len(autoSubscribeVars) > 0 {
		log.Printf("Auto-subscribed client to %d variables", len(autoSubscribeVars))
	}

	s.mutex.Unlock()

	// Remove client when function returns
	defer func() {
		s.mutex.Lock()
		delete(s.clients, conn)
		delete(s.subscriptions, conn)
		delete(s.subscriptionPath, conn)
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

		// Parse as JSON
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		// Handle message based on type
		if msgType, ok := msg["type"].(string); ok {
			switch msgType {
			case "subscribe":
				s.handleSubscribe(conn, msg)
			}
		}
	}
}

// handleSubscribe subscribes to variable updates
func (s *Server) handleSubscribe(conn *websocket.Conn, msg map[string]interface{}) {
	// Extract variables to subscribe to
	varsData, ok := msg["variables"]
	if !ok {
		log.Printf("No variables in subscription message")
		return
	}

	varsToSubscribe, ok := varsData.([]interface{})
	if !ok {
		log.Printf("Variables not in expected format")
		return
	}

	// Extract path filter if provided
	pathFilter := ""
	if path, ok := msg["path"].(string); ok && path != "" {
		// Normalize path for better matching
		pathFilter = path

		// Remove any numeric suffix that might be added by the IDE (e.g., -0, -1)
		pathFilter = regexp.MustCompile(`-\d+$`).ReplaceAllString(pathFilter, "")

		// Extract just the filename if it's a full path
		pathFilter = filepath.Base(pathFilter)

		log.Printf("Client subscribed with path filter: %s (normalized from %s)",
			pathFilter, path)
	}

	// Initialize subscriptions map if needed
	s.mutex.Lock()
	if s.subscriptions[conn] == nil {
		s.subscriptions[conn] = make(map[string]bool)
	}

	// Store the path filter
	s.subscriptionPath[conn] = pathFilter

	// Add each variable to the subscription list
	for _, v := range varsToSubscribe {
		if varName, ok := v.(string); ok {
			s.subscriptions[conn][varName] = true
		}
	}
	s.mutex.Unlock()

	// Confirm subscription
	conn.WriteJSON(map[string]interface{}{
		"type":      "subscribed",
		"variables": varsToSubscribe,
		"path":      pathFilter,
	})
}

// sendPeriodicUpdates sends runtime status updates to the client
func (s *Server) sendPeriodicUpdates(conn *websocket.Conn) {
	ticker := time.NewTicker(1000 * time.Millisecond) // Reduce from 200ms to 1000ms
	defer ticker.Stop()

	var lastVarHash string
	var lastStatusHash string
	var lastLogTime time.Time
	var updateCounter int

	for {
		select {
		case <-ticker.C:
			updateCounter++
			status := s.runtime.GetStatus()

			// Create a hash of status to detect changes
			statusJSON, _ := json.Marshal(status)
			statusHash := fmt.Sprintf("%x", md5.Sum(statusJSON))

			// Get variables based on subscriptions
			s.mutex.Lock()
			subscriptions := s.subscriptions[conn]
			pathFilter := s.subscriptionPath[conn]
			s.mutex.Unlock()

			// Get variables from runtime
			allVariables := s.runtime.GetAllVariables()

			// Calculate total variables available before filtering
			totalVars := countVariables(allVariables)

			// Add throttling for filter warnings
			const warningThrottleInterval = 5 * time.Minute

			// Filter variables if needed
			filteredVariables := make(map[string][]*runtime.Variable)
			if len(subscriptions) > 0 {
				// Filter by subscription
				for path, vars := range allVariables {
					// Check path filter with better logic
					if pathFilter != "" {
						// Try different variations to match paths more flexibly
						var matches bool

						// 1. Direct contains check
						if strings.Contains(path, pathFilter) {
							matches = true
						}

						// 2. Check basename (filename without path)
						pathFilterBase := filepath.Base(pathFilter)
						if pathFilterBase != pathFilter && strings.Contains(path, pathFilterBase) {
							matches = true
						}

						// 3. Check with extensions stripped
						pathNoExt := strings.TrimSuffix(path, filepath.Ext(path))
						filterNoExt := strings.TrimSuffix(pathFilter, filepath.Ext(pathFilter))
						if strings.Contains(pathNoExt, filterNoExt) {
							matches = true
						}

						// Skip if no match found with any method
						if !matches {
							continue
						}
					}

					var filteredVars []*runtime.Variable
					for _, v := range vars {
						if subscriptions[v.Name] {
							filteredVars = append(filteredVars, v)
						}
					}

					if len(filteredVars) > 0 {
						filteredVariables[path] = filteredVars
					}
				}

				// If no variables passed the filter but we have subscriptions,
				// log this issue to help with debugging (but throttle to avoid spam)
				if len(filteredVariables) == 0 && totalVars > 0 {
					lastWarning, exists := s.lastFilterWarningTime[conn]
					if !exists || time.Since(lastWarning) > warningThrottleInterval {
						// Get remote address for better logging
						remoteAddr := "unknown"
						if conn.RemoteAddr() != nil {
							remoteAddr = conn.RemoteAddr().String()
						}

						log.Printf("Warning: Client %s - No variables matched filter. Path filter: %s, Subscriptions: %v",
							remoteAddr, pathFilter, getSubscriptionKeys(subscriptions))

						// Remove any subscriptions that don't match any registered variables
					}
				}
			} else {
				// No subscriptions, use all variables
				filteredVariables = allVariables
			}

			// Create a hash of variables to detect changes
			varJSON, _ := json.Marshal(filteredVariables)
			varHash := fmt.Sprintf("%x", md5.Sum(varJSON))

			// Only send update if something changed
			if varHash != lastVarHash || statusHash != lastStatusHash {
				lastVarHash = varHash
				lastStatusHash = statusHash

				// Only log if:
				// 1. We have variables AND it's been at least 60 seconds since the last log, OR
				// 2. It's been at least 5 minutes since the last log, OR
				// 3. It's the first message (updateCounter == 1)
				// 4. Only log every 30th update when conditions are met
				// Calculate filtered variables count for logging purposes
				filteredVarsCount := countVariables(filteredVariables)
				shouldLog := (filteredVarsCount > 0 && time.Since(lastLogTime) > 60*time.Second) ||
					time.Since(lastLogTime) > 300*time.Second ||
					updateCounter == 1

				// Further reduce by only logging on certain update counts
				shouldLog = shouldLog && (updateCounter%30 == 0)

				if shouldLog {
					log.Printf("Sending update to client: %d paths, %d total variables (of %d available)",
						len(filteredVariables), filteredVarsCount, totalVars)
					lastLogTime = time.Now()
				}

				update := map[string]interface{}{
					"type":      "update",
					"status":    status,
					"variables": filteredVariables,
				}

				if err := conn.WriteJSON(update); err != nil {
					log.Printf("Error sending update: %v", err)
					return
				}
			}
		}
	}
}

// countVariables counts the total number of variables in a map of variable arrays
func countVariables(variables map[string][]*runtime.Variable) int {
	count := 0
	for _, vars := range variables {
		count += len(vars)
	}
	return count
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

// handleDownloadAST returns the AST for a given file path
func (s *Server) handleDownloadAST(c *gin.Context) {
	// Extract the file path from the URL parameter
	path := c.Param("path")
	log.Printf("Attempting to download AST for %s", path)

	// Try to get the AST for the specified path
	ast, err := s.runtime.GetAST(path)

	if err != nil {
		// Log all possible paths to help with debugging
		log.Printf("All AST paths in runtime store:")
		s.runtime.LogAllASTKeys()

		// Try a series of path variations
		variations := []string{path}

		// Try without numeric suffix (e.g., -0)
		if strings.HasSuffix(path, "-0") {
			variations = append(variations, strings.TrimSuffix(path, "-0"))
		}

		// Try without the file extension
		if dot := strings.LastIndex(path, "."); dot >= 0 {
			variations = append(variations, path[:dot])
		}

		// Try with .st extension if it doesn't already have one
		if !strings.HasSuffix(path, ".st") {
			variations = append(variations, path+".st")
		}

		// Try just the filename without path/prefixes
		if lastSlash := strings.LastIndex(path, "/"); lastSlash >= 0 {
			variations = append(variations, path[lastSlash+1:])
		}

		// If there are dashes, try extracting just the filename part
		if strings.Contains(path, "-") {
			parts := strings.Split(path, "-")
			for _, part := range parts {
				if strings.HasSuffix(part, ".st") {
					variations = append(variations, part)
					break
				}
			}
		}

		// Try each variation
		for _, variant := range variations {
			if variant == path {
				continue // Skip the original path as we already tried it
			}

			log.Printf("Trying path variation: %s", variant)
			ast, err = s.runtime.GetAST(variant)
			if err == nil {
				log.Printf("Found AST using path variation: %s", variant)
				break
			}
		}

		// If still not found, return a 404 error
		if err != nil {
			log.Printf("Could not find AST for %s or any variations", path)
			c.JSON(http.StatusNotFound, gin.H{
				"error": fmt.Sprintf("AST not found for %s", path),
				"path":  path,
			})
			return
		}
	}

	// Get the source code from the runtime
	sourceCode := s.runtime.GetSourceCode(path)

	log.Printf("Successfully found AST for %s, returning with source code", path)

	c.JSON(http.StatusOK, gin.H{
		"ast":        ast,
		"sourceCode": sourceCode,
		"path":       path,
	})
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

// Helper function to get subscription keys for logging
func getSubscriptionKeys(subscriptions map[string]bool) []string {
	keys := make([]string, 0, len(subscriptions))
	for k := range subscriptions {
		keys = append(keys, k)
	}
	return keys
}

// handleListASTs returns all available AST keys
func (s *Server) handleListASTs(c *gin.Context) {
	// Get all AST keys
	keys := s.runtime.GetAllASTKeys()

	// Log the available ASTs
	log.Printf("Available ASTs: %v", keys)

	// Even if no ASTs are found, return an empty array with 200 status
	c.JSON(http.StatusOK, gin.H{
		"keys": keys,
	})
}

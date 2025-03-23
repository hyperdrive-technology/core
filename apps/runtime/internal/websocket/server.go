package websocket

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
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

		// Read specific variables (supports namespaced names)
		api.POST("/read-variables", s.handleReadVariables)

		// Download AST
		api.GET("/download-ast/:path", s.handleDownloadAST)

		// List all available ASTs
		api.GET("/download-ast", s.handleListASTs)

		// Debugging endpoint - detailed variable info
		api.GET("/debug/variables", s.handleDebugVariables)

		// Debugging endpoint - create test variables
		api.POST("/debug/create-test-variables", s.handleCreateTestVariables)
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

	// Log client connection with remote address for easier debugging
	remoteAddr := c.Request.RemoteAddr
	log.Printf("WebSocket client connected from %s. Waiting for explicit subscriptions.", remoteAddr)

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
			case "read-variables":
				s.handleReadVariablesWS(conn, msg)
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
		// Store the original path for logging
		originalPath := path

		// Normalize path for better matching
		pathFilter = path

		// Remove any numeric suffix that might be added by the IDE (e.g., -0, -1)
		pathFilter = regexp.MustCompile(`-\d+$`).ReplaceAllString(pathFilter, "")

		// Extract just the filename if it's a full path
		pathFilter = filepath.Base(pathFilter)

		// If the path includes a complex project structure with multiple segments
		// like "examples-example-1-0-devices-1-controller1.json-0:missing"
		// extract just the controller name part
		if strings.Contains(pathFilter, "controller") || strings.Contains(pathFilter, "devices") {
			// Try to extract controller name
			controllerRegex := regexp.MustCompile(`(controller[^-:\s.]*)`)
			if matches := controllerRegex.FindStringSubmatch(pathFilter); len(matches) > 1 {
				pathFilter = matches[1]
				log.Printf("Extracted controller name '%s' from path", pathFilter)
			}
		}

		// If there's a colon, take the part before it (removing :missing suffix)
		if colonIndex := strings.Index(pathFilter, ":"); colonIndex > 0 {
			pathFilter = pathFilter[:colonIndex]
		}

		// Remove file extension if present
		pathFilter = strings.TrimSuffix(pathFilter, filepath.Ext(pathFilter))

		log.Printf("Client subscribed with path filter: %s (normalized from %s)",
			pathFilter, originalPath)
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
			// Store the full namespaced name for exact matching
			s.subscriptions[conn][varName] = true

			// Don't auto-subscribe to the simple name anymore, as this causes duplicate variables
			// Just log the full variable name being subscribed to
			log.Printf("Subscribing to variable: '%s'", varName)
		}
	}
	s.mutex.Unlock()

	// Get all available variables to help with debugging
	allVariables := s.runtime.GetAllVariables()
	var availableVarNames []string

	// Extract variable names into a flat list for easier debugging
	for path, vars := range allVariables {
		for _, v := range vars {
			// Include both the simple name and fully qualified path.name
			availableVarNames = append(availableVarNames, v.Name)
			if path != "missing" && path != "" {
				availableVarNames = append(availableVarNames, path+"."+v.Name)
			}
		}
	}

	// Sort the list for easier reading
	if len(availableVarNames) > 0 {
		sort.Strings(availableVarNames)
		log.Printf("Available variables for debugging: %v", availableVarNames)
	}

	// Confirm subscription
	response := map[string]interface{}{
		"type":      "subscribed",
		"variables": varsToSubscribe,
		"path":      pathFilter,
	}

	// Add available variables to the response for debugging
	if len(availableVarNames) > 0 {
		response["availableVariables"] = availableVarNames
	}

	// Log a summary of the subscription at the end
	if len(varsToSubscribe) > 0 {
		if len(varsToSubscribe) <= 5 {
			log.Printf("Client subscribed to %d variables: %v with path filter: %s",
				len(varsToSubscribe), varsToSubscribe, pathFilter)
		} else {
			// Just log the count and first few variables for larger subscriptions
			var firstFew []interface{}
			if len(varsToSubscribe) >= 5 {
				firstFew = varsToSubscribe[:5]
			} else {
				firstFew = varsToSubscribe
			}
			log.Printf("Client subscribed to %d variables (first few: %v...) with path filter: %s",
				len(varsToSubscribe), firstFew, pathFilter)
		}
	}

	conn.WriteJSON(response)
}

// sendPeriodicUpdates sends runtime status updates to the client
func (s *Server) sendPeriodicUpdates(conn *websocket.Conn) {
	ticker := time.NewTicker(1000 * time.Millisecond) // Set to exactly 1 second
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

			// Skip sending variables if there are no subscriptions
			if len(subscriptions) == 0 {
				// Only send status updates less frequently when no subscriptions
				if updateCounter%10 == 0 || statusHash != lastStatusHash {
					conn.WriteJSON(map[string]interface{}{
						"type":   "update",
						"status": status,
					})
					lastStatusHash = statusHash
				}
				continue
			}

			// Get variables from runtime
			allVariables := s.runtime.GetAllVariables()

			// Calculate total variables available before filtering
			totalVars := countVariables(allVariables)

			// Filter variables if needed
			filteredVariables := make(map[string][]*runtime.Variable)
			if len(subscriptions) > 0 {
				// Keep track of which variables we've found
				foundVariables := make(map[string]bool)

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

						// 4. Special handling for controller names - more relaxed matching
						if strings.Contains(pathFilter, "controller") {
							// Extract just the controller part for matching
							controllerRegex := regexp.MustCompile(`(controller\w*)`)
							pathMatches := controllerRegex.FindStringSubmatch(path)
							if len(pathMatches) > 0 {
								// We found a controller pattern in the path - good enough for matching
								matches = true
							}
						}

						// 5. If path is short like "st" or "main", be more lenient
						if len(pathFilter) <= 4 {
							// For short filters, just check if it appears anywhere
							if strings.Contains(path, pathFilter) {
								matches = true
							}

							// Also check for variations like "main-st" for "main.st"
							if strings.Contains(pathFilter, ".") {
								dashVersion := strings.ReplaceAll(pathFilter, ".", "-")
								if strings.Contains(path, dashVersion) {
									matches = true
								}
							} else if strings.Contains(pathFilter, "-") {
								dotVersion := strings.ReplaceAll(pathFilter, "-", ".")
								if strings.Contains(path, dotVersion) {
									matches = true
								}
							}
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
							foundVariables[v.Name] = true
						}
					}

					if len(filteredVars) > 0 {
						filteredVariables[path] = filteredVars
					}
				}

				// Create a special "missing" path for variables that were subscribed to but not found
				var missingVars []*runtime.Variable

				// Use the client's requested path filter as the base for the missing variables path
				// This preserves the original path sent by the client
				requestedPath := pathFilter
				if requestedPath == "" {
					requestedPath = "missing"
				}

				for varName := range subscriptions {
					if !foundVariables[varName] {
						// Check if this is a namespaced variable (contains a dot)
						var displayName = varName
						var varPath = requestedPath

						// If it's a namespaced variable, extract the namespace to use as path
						if strings.Contains(varName, ".") {
							parts := strings.Split(varName, ".")
							if len(parts) > 1 {
								namespace := parts[0]

								// Use the client's requested path by default, but fall back to
								// the variable's namespace if no specific path was requested
								if requestedPath == "missing" {
									// Convert main-st to main.st for better matching if needed
									if strings.Contains(namespace, "-") {
										cleanNamespace := strings.ReplaceAll(namespace, "-", ".")
										varPath = cleanNamespace
									} else {
										varPath = namespace
									}
								}

								// Use the original varName as the display name
								displayName = varName
							}
						}

						// Create a placeholder variable with "???" value
						missingVar := &runtime.Variable{
							Name:      displayName,
							DataType:  runtime.TypeString,
							Value:     "???",
							Quality:   runtime.QualityUncertain,
							Timestamp: time.Now(),
							Path:      varPath, // Use the path based on client's request
						}
						missingVars = append(missingVars, missingVar)
					}
				}

				// Add missing variables to the filtered list if any were found
				if len(missingVars) > 0 {
					// Use the original requested path or "missing" if not specified
					missingVarPath := requestedPath
					if missingVarPath == "" {
						missingVarPath = "missing"
					}

					filteredVariables[missingVarPath] = missingVars

					// Only log messages about missing variables occasionally to reduce spam
					shouldLogMissing := (updateCounter == 1) || // First update always logs
						(updateCounter%60 == 0) || // Log once per minute
						(time.Since(lastLogTime) > 300*time.Second) // Or if we haven't logged in 5 minutes

					if shouldLogMissing {
						log.Printf("Added %d missing variables with placeholder values under path '%s'",
							len(missingVars), missingVarPath)
					}

					// For debugging: collect available variable names when missing vars are detected
					var availableVarNames []string

					// Extract variable names from all variables for debugging purposes
					for path, vars := range allVariables {
						for _, v := range vars {
							// Include both the simple name and fully qualified path.name
							availableVarNames = append(availableVarNames, v.Name)

							// Add path.Name format for easier discovery
							if path != "" && path != "missing" {
								availableVarNames = append(availableVarNames, path+"."+v.Name)
							}
						}
					}

					// Sort and log the available variables
					if len(availableVarNames) > 0 {
						sort.Strings(availableVarNames)

						// Only log available variables when we're also logging about missing variables
						if shouldLogMissing {
							log.Printf("Available variables that could be subscribed to: %v", availableVarNames)
						}

						// Store in filteredVariables for client-side debugging
						filteredVariables["_availableVariables"] = []*runtime.Variable{
							{
								Name:      "_debug",
								DataType:  runtime.TypeString,
								Value:     strings.Join(availableVarNames, ", "),
								Quality:   runtime.QualityGood,
								Timestamp: time.Now(),
								Path:      "debug",
							},
						}
					}
				}
			} else {
				// No subscriptions, use all variables
				filteredVariables = allVariables
			}

			// Create a hash of variables to detect changes
			varJSON, _ := json.Marshal(filteredVariables)
			varHash := fmt.Sprintf("%x", md5.Sum(varJSON))

			// Include debugging info if we have missing variables
			var missingCount = 0
			// Check all paths that might contain missing variables
			for _, vars := range filteredVariables {
				// Count variables with "???" placeholder value in any path
				for _, v := range vars {
					if v.Value == "???" {
						missingCount++
					}
				}
			}

			// Only send update if something changed
			if varHash != lastVarHash || statusHash != lastStatusHash {
				lastVarHash = varHash
				lastStatusHash = statusHash

				// Only log if:
				// 1. We have variables AND it's been at least 60 seconds since the last log, OR
				// 2. It's been at least 5 minutes since the last log, OR
				// 3. It's the first message (updateCounter == 1)
				// Calculate filtered variables count for logging purposes
				filteredVarsCount := countVariables(filteredVariables)
				shouldLog := (updateCounter == 1) || // First update always logs
					(filteredVarsCount > 0 && time.Since(lastLogTime) > 60*time.Second) || // Log once per minute if we have variables
					(time.Since(lastLogTime) > 300*time.Second) // Or log every 5 minutes regardless

				// Include debugging info if we have missing variables
				if missingCount > 0 && shouldLog {
					log.Printf("Sending update to client: %d paths, %d total variables (of %d available), %d missing variables",
						len(filteredVariables), filteredVarsCount, totalVars, missingCount)
					lastLogTime = time.Now()
				} else if shouldLog {
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

	log.Printf("=== DEPLOYMENT STARTED ===")
	log.Printf("Deploying code to %s", req.FilePath)

	// Print first 100 chars of source code for debugging
	if req.SourceCode != "" {
		sourcePreview := req.SourceCode
		if len(sourcePreview) > 100 {
			sourcePreview = sourcePreview[:100] + "..."
		}
		log.Printf("Source code preview: %s", sourcePreview)
	}

	// Validate and parse the AST - do this before deployment so we can examine variables
	ast, err := runtime.ParseAST(req.AST)
	if err != nil {
		log.Printf("ERROR: AST parsing failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Log AST information
	if ast != nil {
		log.Printf("AST parsed successfully: Name=%s", ast.Name)

		// Print AST keys for debugging
		astBytes, _ := json.Marshal(req.AST)
		var astMap map[string]interface{}
		if err := json.Unmarshal(astBytes, &astMap); err == nil {
			keys := make([]string, 0, len(astMap))
			for k := range astMap {
				keys = append(keys, k)
			}
			log.Printf("AST root keys: %v", keys)
		}

		// Log variables found in the AST
		log.Printf("=== VARIABLES FOUND IN AST ===")
		if len(ast.Vars) > 0 {
			// Format for variable list display
			tableFormat := "%-30s | %-10s | %-15s\n"
			log.Printf(tableFormat, "VARIABLE NAME", "TYPE", "INITIAL VALUE")
			log.Printf("%s", strings.Repeat("-", 60))

			for name, v := range ast.Vars {
				// Format the variable type
				typeName := "UNKNOWN"
				switch v.DataType {
				case runtime.TypeBool:
					typeName = "BOOL"
				case runtime.TypeInt:
					typeName = "INT"
				case runtime.TypeFloat:
					typeName = "FLOAT"
				case runtime.TypeString:
					typeName = "STRING"
				}

				// Format the variable value
				valueStr := fmt.Sprintf("%v", v.Value)
				if len(valueStr) > 15 {
					valueStr = valueStr[:12] + "..."
				}

				// Log in table format
				log.Printf(tableFormat, name, typeName, valueStr)
			}
		} else {
			log.Printf("No variables found in AST!")
			log.Printf("Check your ST code for proper variable declarations in VAR_INPUT, VAR_OUTPUT, or VAR sections.")
		}
	} else {
		log.Printf("WARNING: AST parsing returned nil result!")
	}

	// Deploy the code to the runtime
	err = s.runtime.DeployCode(req)
	if err != nil {
		log.Printf("ERROR: Failed to deploy code: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log all runtime variables after deployment
	log.Printf("=== DEPLOYMENT SUCCESSFUL ===")
	log.Printf("Listing all variables registered in runtime:")

	allVariables := s.runtime.GetAllVariables()
	var availableVarNames []string
	runtimeVarCount := 0

	// Format for variable list display
	tableFormat := "%-30s | %-10s | %-15s | %-10s\n"
	log.Printf(tableFormat, "VARIABLE NAME", "TYPE", "VALUE", "PATH")
	log.Printf("%s", strings.Repeat("-", 70))

	// Create a flattened list of all variables
	for path, vars := range allVariables {
		for _, v := range vars {
			runtimeVarCount++

			// Format the variable type
			typeName := "UNKNOWN"
			switch v.DataType {
			case runtime.TypeBool:
				typeName = "BOOL"
			case runtime.TypeInt:
				typeName = "INT"
			case runtime.TypeFloat:
				typeName = "FLOAT"
			case runtime.TypeString:
				typeName = "STRING"
			}

			// Format the variable value
			valueStr := fmt.Sprintf("%v", v.Value)
			if len(valueStr) > 15 {
				valueStr = valueStr[:12] + "..."
			}

			// Log in table format
			log.Printf(tableFormat, v.Name, typeName, valueStr, v.Path)

			// Include both the simple name and fully qualified path.name
			availableVarNames = append(availableVarNames, v.Name)

			// Also add path.Name format if not already the full name
			if !strings.Contains(v.Name, ".") && path != "" && path != "missing" {
				fullName := path + "." + v.Name
				availableVarNames = append(availableVarNames, fullName)
			}
		}
	}

	// Sort and log all variables
	if len(availableVarNames) > 0 {
		sort.Strings(availableVarNames)
		log.Printf("\nSummary: Runtime now has %d total variables after deployment", runtimeVarCount)
		log.Printf("Available variable names for subscription: %v", availableVarNames)
	} else {
		log.Printf("\nWARNING: No variables found in runtime after deployment!")
		log.Printf("Make sure your ST code defines variables properly under VAR_INPUT, VAR_OUTPUT, or VAR sections")
		log.Printf("Example: \nVAR_INPUT\n  Mode: STRING;\n  Sensor1: INT;\nEND_VAR")
	}

	log.Printf("=== DEPLOYMENT COMPLETE ===")

	// Notify clients that new code has been deployed
	s.notifyClients(map[string]interface{}{
		"type":    "deployment",
		"path":    req.FilePath,
		"success": true,
	})

	c.JSON(http.StatusOK, gin.H{
		"status":  "deployed",
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

// handleReadVariables handles requests to read specific variables
func (s *Server) handleReadVariables(c *gin.Context) {
	var req struct {
		Names []string `json:"names"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rt := s.runtime
	if rt == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Runtime not available"})
		return
	}

	variables := []*runtime.Variable{}
	for _, name := range req.Names {
		// First, try direct lookup by the exact variable name
		variable, exists := rt.GetVariable(name)

		// If not found and the name includes a namespace (contains a dot)
		if !exists && (strings.Contains(name, ".") || strings.Contains(name, "-")) {
			// Extract the part after the dot or dash
			var nameParts []string
			var simpleName string

			if strings.Contains(name, ".") {
				nameParts = strings.Split(name, ".")
				if len(nameParts) > 1 {
					simpleName = nameParts[1]
				}
			} else if strings.Contains(name, "-") {
				nameParts = strings.Split(name, "-")
				if len(nameParts) > 1 {
					simpleName = nameParts[1]
				}
			}

			if simpleName != "" {
				// Try to find by simple name among all variables
				allVars := rt.GetAllVariables()
				for path, vars := range allVars {
					for _, v := range vars {
						// Check for direct name match
						if v.Name == simpleName ||
							// Also check if the variable's full path matches our search pattern
							strings.HasSuffix(path+"."+v.Name, "."+simpleName) {
							// Found a match - create a copy with the requested name format
							variableCopy := *v       // Make a copy
							variableCopy.Name = name // Use the requested name format
							variable = &variableCopy
							exists = true
							break
						}

						// Also try dot-to-dash conversions for the path and vice versa
						if strings.Contains(path, ".") {
							// Convert dots to dashes and check again
							dashPath := strings.ReplaceAll(path, ".", "-")
							if strings.HasSuffix(dashPath+"-"+v.Name, "-"+simpleName) {
								// Found a match with converted path
								variableCopy := *v
								variableCopy.Name = name
								variable = &variableCopy
								exists = true
								break
							}
						} else if strings.Contains(path, "-") {
							// Convert dashes to dots and check again
							dotPath := strings.ReplaceAll(path, "-", ".")
							if strings.HasSuffix(dotPath+"."+v.Name, "."+simpleName) {
								// Found a match with converted path
								variableCopy := *v
								variableCopy.Name = name
								variable = &variableCopy
								exists = true
								break
							}
						}
					}
					if exists {
						break
					}
				}
			}
		}

		if exists && variable != nil {
			variables = append(variables, variable)
		} else {
			// Add a placeholder for variables that weren't found
			variables = append(variables, &runtime.Variable{
				Name:      name,
				DataType:  runtime.TypeString,
				Value:     "???",
				Quality:   runtime.QualityUncertain,
				Timestamp: time.Now(),
				Path:      "missing",
			})
		}
	}

	// Create response with variables
	response := gin.H{
		"variables": variables,
	}

	// Check if we need to include debugging information
	var missingCount = 0
	for _, v := range variables {
		if v.Value == "???" {
			missingCount++
		}
	}

	// If all or most variables were not found, include available variables for debugging
	if missingCount >= len(variables)/2 {
		// Get all available variables for debugging
		allVars := rt.GetAllVariables()
		var availableVarNames []string

		// Create a flattened list of variable names
		for path, vars := range allVars {
			for _, v := range vars {
				// Simple name
				availableVarNames = append(availableVarNames, v.Name)

				// Path-qualified name
				if path != "" && path != "missing" {
					availableVarNames = append(availableVarNames, path+"."+v.Name)
				}
			}
		}

		// Sort for easier reading
		if len(availableVarNames) > 0 {
			sort.Strings(availableVarNames)
			log.Printf("Including %d available variable names in API response for debugging", len(availableVarNames))
			response["availableVariables"] = availableVarNames
		}
	}

	c.JSON(http.StatusOK, response)
}

// handleReadVariablesWS handles WebSocket requests to read variables
func (s *Server) handleReadVariablesWS(conn *websocket.Conn, msg map[string]interface{}) {
	// Extract variables to read
	varsData, ok := msg["variables"]
	if !ok {
		log.Printf("No variables in read-variables message")
		return
	}

	varsToRead, ok := varsData.([]interface{})
	if !ok {
		log.Printf("Variables not in expected format")
		return
	}

	variables := []*runtime.Variable{}
	variableNames := []string{}

	// Convert to string array
	for _, v := range varsToRead {
		if varName, ok := v.(string); ok {
			variableNames = append(variableNames, varName)
		}
	}

	// Get runtime
	rt := s.runtime
	if rt == nil {
		log.Printf("Runtime not available for read-variables request")

		// Return error response
		conn.WriteJSON(map[string]interface{}{
			"type":  "read-variables-response",
			"id":    msg["id"],
			"error": "Runtime not available",
		})
		return
	}

	// Read each variable
	for _, name := range variableNames {
		// First, try direct lookup by the exact variable name
		variable, exists := rt.GetVariable(name)

		// If not found and the name includes a namespace (contains a dot)
		if !exists && (strings.Contains(name, ".") || strings.Contains(name, "-")) {
			// Extract the part after the dot or dash
			var nameParts []string
			var simpleName string

			if strings.Contains(name, ".") {
				nameParts = strings.Split(name, ".")
				if len(nameParts) > 1 {
					simpleName = nameParts[1]
				}
			} else if strings.Contains(name, "-") {
				nameParts = strings.Split(name, "-")
				if len(nameParts) > 1 {
					simpleName = nameParts[1]
				}
			}

			if simpleName != "" {
				// Try to find by simple name among all variables
				allVars := rt.GetAllVariables()
				for path, vars := range allVars {
					for _, v := range vars {
						// Check for direct name match
						if v.Name == simpleName ||
							// Also check if the variable's full path matches our search pattern
							strings.HasSuffix(path+"."+v.Name, "."+simpleName) {
							// Found a match - create a copy with the requested name format
							variableCopy := *v       // Make a copy
							variableCopy.Name = name // Use the requested name format
							variable = &variableCopy
							exists = true
							break
						}

						// Also try dot-to-dash conversions for the path and vice versa
						if strings.Contains(path, ".") {
							// Convert dots to dashes and check again
							dashPath := strings.ReplaceAll(path, ".", "-")
							if strings.HasSuffix(dashPath+"-"+v.Name, "-"+simpleName) {
								// Found a match with converted path
								variableCopy := *v
								variableCopy.Name = name
								variable = &variableCopy
								exists = true
								break
							}
						} else if strings.Contains(path, "-") {
							// Convert dashes to dots and check again
							dotPath := strings.ReplaceAll(path, "-", ".")
							if strings.HasSuffix(dotPath+"."+v.Name, "."+simpleName) {
								// Found a match with converted path
								variableCopy := *v
								variableCopy.Name = name
								variable = &variableCopy
								exists = true
								break
							}
						}
					}
					if exists {
						break
					}
				}
			}
		}

		if exists && variable != nil {
			variables = append(variables, variable)
		} else {
			// Add a placeholder for variables that weren't found
			variables = append(variables, &runtime.Variable{
				Name:      name,
				DataType:  runtime.TypeString,
				Value:     "???",
				Quality:   runtime.QualityUncertain,
				Timestamp: time.Now(),
				Path:      "missing",
			})
		}
	}

	// Send response
	var response = map[string]interface{}{
		"type":      "read-variables-response",
		"id":        msg["id"],
		"variables": variables,
	}

	// Add debugging information if any variables were not found
	// Check if all of the requested variables were placeholders with "???" value
	var missingCount = 0
	for _, v := range variables {
		if v.Value == "???" {
			missingCount++
		}
	}

	// If all or most variables were not found, include available variables for debugging
	if missingCount >= len(variables)/2 {
		// Extract all available variables from the runtime for debugging
		allVars := rt.GetAllVariables()
		var availableVarNames []string

		// Create a flattened list of available variable names
		for path, vars := range allVars {
			for _, v := range vars {
				// Simple name
				availableVarNames = append(availableVarNames, v.Name)

				// Path-qualified name
				if path != "" && path != "missing" {
					availableVarNames = append(availableVarNames, path+"."+v.Name)
				}
			}
		}

		// Sort for easier reading
		if len(availableVarNames) > 0 {
			sort.Strings(availableVarNames)
			log.Printf("Sending %d available variable names for debugging", len(availableVarNames))
			response["availableVariables"] = availableVarNames
		}
	}

	conn.WriteJSON(response)
}

// handleDebugVariables returns detailed information about all variables in the runtime
func (s *Server) handleDebugVariables(c *gin.Context) {
	rt := s.runtime
	if rt == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Runtime not available"})
		return
	}

	// Get all variables
	allVariables := rt.GetAllVariables()
	varCount := 0

	// Create response structure with detailed info
	type VariableInfo struct {
		Name      string      `json:"name"`
		DataType  string      `json:"dataType"`
		Value     interface{} `json:"value"`
		Quality   string      `json:"quality"`
		Timestamp time.Time   `json:"timestamp"`
		Path      string      `json:"path"`
		FullName  string      `json:"fullName,omitempty"`
	}

	response := make(map[string][]VariableInfo)

	// Convert DataType enum to string
	dataTypeToString := func(dt runtime.DataType) string {
		switch dt {
		case runtime.TypeBool:
			return "BOOL"
		case runtime.TypeInt:
			return "INT"
		case runtime.TypeFloat:
			return "FLOAT"
		case runtime.TypeString:
			return "STRING"
		default:
			return fmt.Sprintf("UNKNOWN(%d)", dt)
		}
	}

	// Convert Quality enum to string
	qualityToString := func(q runtime.Quality) string {
		switch q {
		case runtime.QualityGood:
			return "GOOD"
		case runtime.QualityBad:
			return "BAD"
		case runtime.QualityUncertain:
			return "UNCERTAIN"
		default:
			return fmt.Sprintf("UNKNOWN(%d)", q)
		}
	}

	// Process all variables
	for path, vars := range allVariables {
		pathInfo := []VariableInfo{}

		for _, v := range vars {
			varCount++

			// Create full name with path if appropriate
			fullName := v.Name
			if path != "" && path != "missing" {
				fullName = path + "." + v.Name
			}

			// Add to response
			pathInfo = append(pathInfo, VariableInfo{
				Name:      v.Name,
				DataType:  dataTypeToString(v.DataType),
				Value:     v.Value,
				Quality:   qualityToString(v.Quality),
				Timestamp: v.Timestamp,
				Path:      v.Path,
				FullName:  fullName,
			})
		}

		if len(pathInfo) > 0 {
			response[path] = pathInfo
		}
	}

	// Additional debug info
	debugInfo := map[string]interface{}{
		"totalVariables": varCount,
		"paths":          len(allVariables),
		"timestamp":      time.Now(),
	}

	c.JSON(http.StatusOK, gin.H{
		"variables": response,
		"debug":     debugInfo,
	})
}

// handleCreateTestVariables creates test variables for debugging
func (s *Server) handleCreateTestVariables(c *gin.Context) {
	var req struct {
		Namespace string `json:"namespace" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Namespace parameter required",
			"example": gin.H{
				"namespace": "main-st",
			},
		})
		return
	}

	rt := s.runtime
	if rt == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Runtime not available"})
		return
	}

	// Register test variables using the specified namespace
	rt.RegisterTestVariables(req.Namespace)

	// Get the variables after registration
	allVariables := rt.GetAllVariables()
	varCount := countVariables(allVariables)

	c.JSON(http.StatusOK, gin.H{
		"message":   fmt.Sprintf("Created test variables with namespace %s", req.Namespace),
		"count":     varCount,
		"variables": allVariables,
	})
}

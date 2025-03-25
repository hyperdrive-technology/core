package server

import (
	"fmt"
	"log"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/hyperdrive/core/apps/runtime/internal/runtime"
)

// Server handles HTTP API for the runtime
type Server struct {
	router  *gin.Engine
	runtime *runtime.Runtime
}

// NewServer creates a new HTTP server
func NewServer(rt *runtime.Runtime) *Server {
	server := &Server{
		router:  gin.Default(),
		runtime: rt,
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

	// API endpoints
	api := s.router.Group("/api")
	{
		// Deploy code
		api.POST("/deploy", s.handleDeploy)
	}
}

// DeployHandler handles code deployment to the runtime
func (s *Server) handleDeploy(c *gin.Context) {
	var req runtime.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Clear all existing variables to start fresh
	s.runtime.ClearAllVariables()

	if err := s.runtime.DeployCode(req); err != nil {
		log.Printf("Failed to deploy code: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to deploy code: %v", err)})
		return
	}

	// Log all variables for debugging
	s.logAllVariables()

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Code deployed successfully",
	})
}

// logAllVariables logs all variables in the runtime for debugging
func (s *Server) logAllVariables() {
	// Get all variables
	variables := []string{}

	// Get variables from the runtime and add them to the list
	for _, vars := range s.runtime.GetAllVariables() {
		for _, v := range vars {
			variables = append(variables, v.Name)
		}
	}

	// Sort variables for consistent output
	sort.Strings(variables)

	// Log the list of variables
	log.Printf("Available variables for debugging: %v", variables)
}

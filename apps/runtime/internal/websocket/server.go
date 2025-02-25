package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/inrush-io/inrush/apps/runtime/internal/runtime"
)

type Server struct {
	runtime  *runtime.Runtime
	upgrader websocket.Upgrader
	clients  map[*Client]bool
	mu       sync.RWMutex
}

type Client struct {
	conn          *websocket.Conn
	server        *Server
	send          chan []byte
	subscriptions map[string]bool
}

type Message struct {
	Type    string          `json:"type"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

func NewServer(rt *runtime.Runtime) *Server {
	return &Server{
		runtime: rt,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Configure as needed
			},
		},
		clients: make(map[*Client]bool),
	}
}

func (s *Server) Start(addr string) error {
	http.HandleFunc("/ws", s.handleConnection)
	return http.ListenAndServe(addr, nil)
}

func (s *Server) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	client := &Client{
		conn:          conn,
		server:        s,
		send:          make(chan []byte, 256),
		subscriptions: make(map[string]bool),
	}

	s.mu.Lock()
	s.clients[client] = true
	s.mu.Unlock()

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.server.mu.Lock()
		delete(c.server.clients, c)
		c.server.mu.Unlock()
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message: %v", err)
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case "subscribe":
		var payload struct {
			Tags []string `json:"tags"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("Error unmarshaling subscribe payload: %v", err)
			return
		}

		for _, tag := range payload.Tags {
			c.subscriptions[tag] = true
		}

	case "write":
		var payload struct {
			Tag   string      `json:"tag"`
			Value interface{} `json:"value"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("Error unmarshaling write payload: %v", err)
			return
		}

		// Handle write operation

	case "project":
		switch msg.Action {
		case "list":
			c.handleListProjects(msg)
		case "create":
			c.handleCreateProject(msg)
		case "load":
			c.handleLoadProject(msg)
		case "save":
			c.handleSaveProject(msg)
		}
	}
}

func (c *Client) handleListProjects(msg Message) {
	// Get storage manager from server
	sm := c.server.storageManager

	// List projects
	projects, err := sm.ListProjects(context.Background())
	if err != nil {
		c.sendError("Failed to list projects", err)
		return
	}

	// Send response
	response := struct {
		Type    string          `json:"type"`
		Action  string          `json:"action"`
		Success bool            `json:"success"`
		Data    json.RawMessage `json:"data"`
	}{
		Type:    "project",
		Action:  "list",
		Success: true,
		Data:    projects,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		c.sendError("Failed to marshal response", err)
		return
	}

	c.send <- responseBytes
}

func (c *Client) handleCreateProject(msg Message) {
	var payload struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Tags        []string `json:"tags,omitempty"`
	}

	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		c.sendError("Failed to parse create project payload", err)
		return
	}

	// Get storage manager from server
	sm := c.server.storageManager

	// Create project
	projectID, err := sm.CreateProject(context.Background(),
		payload.Name, payload.Description, "user", payload.Tags)
	if err != nil {
		c.sendError("Failed to create project", err)
		return
	}

	// Send response
	response := struct {
		Type    string `json:"type"`
		Action  string `json:"action"`
		Success bool   `json:"success"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}{
		Type:    "project",
		Action:  "create",
		Success: true,
		Data: struct {
			ID string `json:"id"`
		}{
			ID: projectID,
		},
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		c.sendError("Failed to marshal response", err)
		return
	}

	c.send <- responseBytes
}

func (c *Client) handleLoadProject(msg Message) {
	var payload struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		c.sendError("Failed to parse load project payload", err)
		return
	}

	// Get storage manager from server
	sm := c.server.storageManager

	// Load project
	projectDir, err := sm.LoadProject(context.Background(), payload.ID)
	if err != nil {
		c.sendError("Failed to load project", err)
		return
	}

	// Read project metadata
	metadataPath := filepath.Join(projectDir, "metadata.json")
	metadataBytes, err := os.ReadFile(metadataPath)
	if err != nil {
		c.sendError("Failed to read project metadata", err)
		return
	}

	// Send response
	response := struct {
		Type    string          `json:"type"`
		Action  string          `json:"action"`
		Success bool            `json:"success"`
		Data    json.RawMessage `json:"data"`
	}{
		Type:    "project",
		Action:  "load",
		Success: true,
		Data:    metadataBytes,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		c.sendError("Failed to marshal response", err)
		return
	}

	c.send <- responseBytes
}

func (c *Client) handleSaveProject(msg Message) {
	var payload struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		c.sendError("Failed to parse save project payload", err)
		return
	}

	// Get storage manager from server
	sm := c.server.storageManager

	// Get project directory
	projectDir := filepath.Join(sm.tempDir, payload.ID)

	// Save project
	if err := sm.SaveProject(context.Background(), payload.ID, projectDir); err != nil {
		c.sendError("Failed to save project", err)
		return
	}

	// Send response
	response := struct {
		Type    string `json:"type"`
		Action  string `json:"action"`
		Success bool   `json:"success"`
	}{
		Type:    "project",
		Action:  "save",
		Success: true,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		c.sendError("Failed to marshal response", err)
		return
	}

	c.send <- responseBytes
}

// Helper method to send error response
func (c *Client) sendError(message string, err error) {
	log.Printf("%s: %v", message, err)

	response := struct {
		Type    string `json:"type"`
		Action  string `json:"action"`
		Success bool   `json:"success"`
		Error   string `json:"error"`
	}{
		Type:    "error",
		Action:  "project",
		Success: false,
		Error:   fmt.Sprintf("%s: %v", message, err),
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		log.Printf("Failed to marshal error response: %v", err)
		return
	}

	c.send <- responseBytes
}

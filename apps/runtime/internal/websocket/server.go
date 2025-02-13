package websocket

import (
	"encoding/json"
	"log"
	"net/http"
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
	}
}

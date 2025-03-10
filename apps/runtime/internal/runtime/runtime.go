package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type Config struct {
	ScanTime time.Duration
	DataDir  string
}

type Runtime struct {
	mu        sync.RWMutex
	config    Config
	variables map[string]*Variable
	tasks     []*Task
	version   *Version
	done      chan struct{}
	scanTime  time.Duration
	lastScan  time.Time
}

type Variable struct {
	Name      string
	DataType  DataType
	Value     interface{}
	Quality   Quality
	Timestamp time.Time
	Path      string // Add path to track file/folder structure
}

type DataType int

const (
	TypeBool DataType = iota
	TypeInt
	TypeFloat
	TypeString
)

type Quality int

const (
	QualityGood Quality = iota
	QualityBad
	QualityUncertain
)

type Task struct {
	Name     string
	Program  *Program
	Interval time.Duration
	Priority int
}

type Version struct {
	ID        string
	Timestamp time.Time
	State     VersionState
	Program   *Program
	Parent    *Version
}

type VersionState int

const (
	VersionActive VersionState = iota
	VersionTesting
	VersionPending
	VersionArchived
)

// DeployRequest represents the data needed to deploy code to the runtime
type DeployRequest struct {
	AST        json.RawMessage `json:"ast"`        // AST in JSON format from Langium
	SourceCode string          `json:"sourceCode"` // Original source code
	FilePath   string          `json:"filePath"`   // Path of the file
}

// RuntimeStatus represents the current status of the runtime
type RuntimeStatus struct {
	ScanTime      time.Duration `json:"scanTime"`
	LastScan      time.Time     `json:"lastScan"`
	VariableCount int           `json:"variableCount"`
	TaskCount     int           `json:"taskCount"`
	Status        string        `json:"status"`
}

func New(config Config) (*Runtime, error) {
	return &Runtime{
		config:    config,
		variables: make(map[string]*Variable),
		tasks:     make([]*Task, 0),
		done:      make(chan struct{}),
		scanTime:  config.ScanTime,
	}, nil
}

func (r *Runtime) Start(ctx context.Context) error {
	go r.scanCycle(ctx)
	return nil
}

func (r *Runtime) Stop(ctx context.Context) error {
	close(r.done)
	return nil
}

func (r *Runtime) scanCycle(ctx context.Context) {
	ticker := time.NewTicker(r.config.ScanTime)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.done:
			return
		case <-ticker.C:
			r.executeCycle()
		}
	}
}

func (r *Runtime) executeCycle() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.lastScan = time.Now()

	// Execute all tasks in priority order
	for _, task := range r.tasks {
		if err := task.Program.Execute(); err != nil {
			// Handle error, update quality
			continue
		}
	}
}

// DeployCode deploys the code to the runtime
func (r *Runtime) DeployCode(req DeployRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Parse the AST and create a Program
	prog, err := ParseAST(req.AST)
	if err != nil {
		return fmt.Errorf("failed to parse AST: %w", err)
	}

	// Create a new task for the program
	task := &Task{
		Name:     req.FilePath,
		Program:  prog,
		Interval: r.config.ScanTime,
		Priority: 0, // Default priority
	}

	// Add the task to the runtime
	r.tasks = append(r.tasks, task)

	// Extract variables from the program and register them
	for name, v := range prog.vars {
		r.variables[name] = &Variable{
			Name:      name,
			DataType:  v.DataType,
			Value:     v.Value,
			Quality:   QualityGood,
			Timestamp: time.Now(),
			Path:      req.FilePath, // Store the file path for organization
		}
	}

	return nil
}

// GetVariable returns a variable by name
func (r *Runtime) GetVariable(name string) (*Variable, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	v, ok := r.variables[name]
	return v, ok
}

// GetAllVariables returns all variables organized by path
func (r *Runtime) GetAllVariables() map[string][]*Variable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string][]*Variable)

	for _, v := range r.variables {
		result[v.Path] = append(result[v.Path], v)
	}

	return result
}

// GetStatus returns the current runtime status
func (r *Runtime) GetStatus() RuntimeStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()

	status := "running"
	if r.done == nil {
		status = "stopped"
	}

	return RuntimeStatus{
		ScanTime:      r.scanTime,
		LastScan:      r.lastScan,
		VariableCount: len(r.variables),
		TaskCount:     len(r.tasks),
		Status:        status,
	}
}

// ParseAST parses the JSON AST from Langium and converts it to a runtime Program
func ParseAST(astJSON json.RawMessage) (*Program, error) {
	// Create a placeholder program
	prog := &Program{
		Name:     "ASTProgram",
		Version:  "1.0",
		Modified: time.Now(),
		vars:     make(map[string]*Variable),
	}

	// Parse the AST JSON - this is a simplified version
	var astData map[string]interface{}
	if err := json.Unmarshal(astJSON, &astData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal AST: %w", err)
	}

	// Extract variables from the AST
	// This is a simplified implementation - you'll need to adapt to your actual AST structure
	if declarations, ok := astData["declarations"]; ok {
		if declArray, ok := declarations.([]interface{}); ok {
			for _, decl := range declArray {
				declMap, ok := decl.(map[string]interface{})
				if !ok {
					continue
				}

				if varName, ok := declMap["name"]; ok {
					// Add the variable to the program
					prog.vars[varName.(string)] = &Variable{
						Name:      varName.(string),
						DataType:  TypeInt, // Default to int for simplicity
						Value:     0,       // Default value
						Quality:   QualityGood,
						Timestamp: time.Now(),
					}
				}
			}
		}
	}

	return prog, nil
}

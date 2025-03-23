package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Config struct {
	ScanTime time.Duration
	DataDir  string
}

type Runtime struct {
	mu            sync.RWMutex
	config        Config
	variables     map[string]*Variable
	tasks         []*Task
	version       *Version
	done          chan struct{}
	scanTime      time.Duration
	lastScan      time.Time
	astStore      map[string]json.RawMessage // Store for ASTs by file path
	codeStore     map[string]string          // Store for source code by file path
	lastNoVarsLog time.Time
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
	// Initialize random seed for variable simulation
	rand.Seed(time.Now().UnixNano())

	runtime := &Runtime{
		config:    config,
		variables: make(map[string]*Variable),
		tasks:     make([]*Task, 0),
		done:      make(chan struct{}),
		scanTime:  config.ScanTime,
		astStore:  make(map[string]json.RawMessage),
		codeStore: make(map[string]string),
	}

	return runtime, nil
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

	// Store the AST for future reference
	r.astStore[req.FilePath] = req.AST

	// Store the source code as well
	if req.SourceCode != "" {
		r.codeStore[req.FilePath] = req.SourceCode
	}

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

	// Make sure path is properly formatted for variables
	filePath := req.FilePath
	// Strip any leading paths to get just the filename if it's a full path
	if lastSlash := strings.LastIndex(filePath, "/"); lastSlash >= 0 {
		filePath = filePath[lastSlash+1:]
	}

	log.Printf("Deploying code to %s with %d variables", filePath, len(prog.vars))

	// Extract variables from the program and register them
	for name, v := range prog.vars {
		r.variables[name] = &Variable{
			Name:      name,
			DataType:  v.DataType,
			Value:     v.Value,
			Quality:   QualityGood,
			Timestamp: time.Now(),
			Path:      filePath, // Store just the filename for easier matching in UI
		}
		log.Printf("Registered variable %s from %s", name, filePath)
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

// RegisterVariable registers a variable with the runtime
func (r *Runtime) RegisterVariable(v *Variable) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Add debug logging
	log.Printf("Registering variable: %s, Type: %d, Path: %s", v.Name, v.DataType, v.Path)

	if r.variables == nil {
		r.variables = make(map[string]*Variable)
	}

	r.variables[v.Name] = v
}

// GetAllVariables returns all variables
func (r *Runtime) GetAllVariables() map[string][]*Variable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string][]*Variable)

	// If we have no variables, log and return empty result
	if len(r.variables) == 0 {
		// Only log this once every 30 seconds to avoid log spam
		now := time.Now()
		if r.lastNoVarsLog.IsZero() || now.Sub(r.lastNoVarsLog) > 30*time.Second {
			log.Printf("No variables registered in runtime")
			r.lastNoVarsLog = now
		}
		return result
	}

	// Reset the last log time when we do have variables
	r.lastNoVarsLog = time.Time{}

	// Group variables by path
	for _, v := range r.variables {
		path := v.Path
		if path == "" {
			path = "default"
		}

		if result[path] == nil {
			result[path] = make([]*Variable, 0)
		}

		result[path] = append(result[path], v)
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

// GetAST returns the stored AST for a given file path
func (r *Runtime) GetAST(path string) (json.RawMessage, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ast, ok := r.astStore[path]
	if !ok {
		return nil, fmt.Errorf("no AST found for path: %s", path)
	}

	return ast, nil
}

// GetSourceCode returns the source code for a given file path
func (r *Runtime) GetSourceCode(path string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	sourceCode, exists := r.codeStore[path]
	if !exists {
		return "" // Return empty string if no source code found
	}

	return sourceCode
}

// LogAllASTKeys logs all AST keys stored in the runtime for debugging
func (r *Runtime) LogAllASTKeys() {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if len(r.astStore) == 0 {
		log.Printf("  No ASTs stored in runtime")
		return
	}

	for key := range r.astStore {
		log.Printf("  - %s", key)
	}
}

// GetAllASTKeys returns all AST keys stored in the runtime
func (r *Runtime) GetAllASTKeys() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	keys := make([]string, 0, len(r.astStore))
	for key := range r.astStore {
		keys = append(keys, key)
	}

	return keys
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

	// Parse the AST JSON
	var astData map[string]interface{}
	if err := json.Unmarshal(astJSON, &astData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal AST: %w", err)
	}

	log.Printf("Parsing AST: %+v", astData)

	// Extract program name if available
	if programName, ok := astData["name"].(string); ok {
		prog.Name = programName
		log.Printf("Found program name: %s", programName)
	}

	// Process the AST based on the format coming from Langium
	if declarations, ok := astData["declarations"]; ok {
		log.Printf("Processing declarations")
		extractVariablesFromDeclarations(declarations, prog)
	}

	// Also check for VAR sections at the root level
	for key, value := range astData {
		if strings.HasPrefix(key, "VAR") || strings.HasPrefix(key, "var") {
			log.Printf("Processing VAR section: %s", key)
			extractVariablesFromVarSection(value, prog)
		}
	}

	// Check for variables inside program blocks if present
	if programs, ok := astData["programs"].([]interface{}); ok {
		log.Printf("Processing programs array")
		for _, program := range programs {
			if programMap, ok := program.(map[string]interface{}); ok {
				// Extract program name
				if programName, ok := programMap["name"].(string); ok {
					prog.Name = programName
				}

				// Process local variables
				if localVars, ok := programMap["localVariables"].([]interface{}); ok {
					log.Printf("Processing program local variables")
					extractVariablesFromArray(localVars, prog)
				}

				// Process variable sections
				for key, value := range programMap {
					if strings.HasPrefix(key, "VAR") || strings.HasPrefix(key, "var") {
						log.Printf("Processing program VAR section: %s", key)
						extractVariablesFromVarSection(value, prog)
					}
				}
			}
		}
	}

	// Log the variables extracted
	log.Printf("Extracted %d variables from AST", len(prog.vars))
	for varName := range prog.vars {
		log.Printf("  - %s", varName)
	}

	return prog, nil
}

// Helper function to extract variables from declarations array
func extractVariablesFromDeclarations(declarations interface{}, prog *Program) {
	if declArray, ok := declarations.([]interface{}); ok {
		extractVariablesFromArray(declArray, prog)
	}
}

// Helper function to extract variables from array of objects
func extractVariablesFromArray(items []interface{}, prog *Program) {
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		// Process variable declarations
		if declType, ok := itemMap["$type"].(string); ok {
			if declType == "VariableDeclaration" || strings.Contains(declType, "Variable") {
				addVariableToProg(itemMap, prog)
			}
		} else if name, ok := itemMap["name"].(string); ok {
			// If it has a name, it might be a variable even without $type
			addVariableToProg(itemMap, prog)
			log.Printf("Added variable by name: %s", name)
		}
	}
}

// Helper function to extract variables from VAR sections
func extractVariablesFromVarSection(varSection interface{}, prog *Program) {
	if varItems, ok := varSection.([]interface{}); ok {
		extractVariablesFromArray(varItems, prog)
	} else if varMap, ok := varSection.(map[string]interface{}); ok {
		// Some ASTs might have variables as direct map entries
		for name, declaration := range varMap {
			if declMap, ok := declaration.(map[string]interface{}); ok {
				declMap["name"] = name
				addVariableToProg(declMap, prog)
				log.Printf("Added variable from VAR map: %s", name)
			}
		}
	}
}

// Helper function to add a variable to the program
func addVariableToProg(variableMap map[string]interface{}, prog *Program) {
	if varName, ok := variableMap["name"].(string); ok {
		// Determine data type
		dataType := TypeString // Default
		if typeInfo, ok := variableMap["type"].(map[string]interface{}); ok {
			if typeName, ok := typeInfo["name"].(string); ok {
				switch strings.ToUpper(typeName) {
				case "BOOL":
					dataType = TypeBool
				case "INT":
					dataType = TypeInt
				case "REAL", "FLOAT":
					dataType = TypeFloat
				case "STRING":
					dataType = TypeString
				}
			}
		}

		// Initialize with default value
		var value interface{}
		switch dataType {
		case TypeBool:
			value = false
		case TypeInt:
			value = 0
		case TypeFloat:
			value = 0.0
		case TypeString:
			value = ""
		}

		// Check for initial value
		if initialValue, ok := variableMap["initialValue"]; ok {
			if initialValueMap, ok := initialValue.(map[string]interface{}); ok {
				if litValue, ok := initialValueMap["value"]; ok {
					value = convertLiteralValue(litValue, dataType)
				}
			}
		}

		// Add variable to program
		prog.vars[varName] = &Variable{
			Name:      varName,
			DataType:  dataType,
			Value:     value,
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}

		log.Printf("Added variable: %s (type: %v)", varName, dataType)
	}
}

// Helper function to convert literal values from AST to appropriate Go types
func convertLiteralValue(value interface{}, dataType DataType) interface{} {
	switch dataType {
	case TypeBool:
		if strValue, ok := value.(string); ok {
			return strings.ToLower(strValue) == "true"
		}
		return value == true
	case TypeInt:
		if floatValue, ok := value.(float64); ok {
			return int(floatValue)
		}
		if strValue, ok := value.(string); ok {
			if intValue, err := strconv.Atoi(strValue); err == nil {
				return intValue
			}
		}
		return 0
	case TypeFloat:
		if floatValue, ok := value.(float64); ok {
			return floatValue
		}
		if strValue, ok := value.(string); ok {
			if floatValue, err := strconv.ParseFloat(strValue, 64); err == nil {
				return floatValue
			}
		}
		return 0.0
	case TypeString:
		if strValue, ok := value.(string); ok {
			return strValue
		}
		return fmt.Sprintf("%v", value)
	default:
		return value
	}
}

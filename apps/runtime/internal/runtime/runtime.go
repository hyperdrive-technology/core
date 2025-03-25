package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"path/filepath"
	"regexp"
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

	// Start a timer if none are running
	r.ensureTimerRunning()

	// Create a list of all timer bases to update
	timerBases := make(map[string]bool)

	// Find all timer variables to update
	for name := range r.variables {
		if strings.HasSuffix(name, ".ET") || strings.HasSuffix(name, ".Q") {
			// Extract the timer base name
			timerBase := strings.TrimSuffix(name, ".ET")
			if strings.HasSuffix(timerBase, ".Q") {
				timerBase = strings.TrimSuffix(name, ".Q")
			}
			timerBases[timerBase] = true
		}
	}

	// Process each timer we found
	for timerBase := range timerBases {
		// Try to find the timer variables
		runningVarName := timerBase + ".Running"
		startTimeVarName := timerBase + ".StartTime"
		etVarName := timerBase + ".ET"
		qVarName := timerBase + ".Q"

		runningVar, hasRunning := r.variables[runningVarName]
		startTimeVar, hasStartTime := r.variables[startTimeVarName]
		etVar, hasET := r.variables[etVarName]
		qVar, hasQ := r.variables[qVarName]

		// If any variables are missing, skip this timer
		if !hasRunning || !hasStartTime || !hasET || !hasQ {
			continue
		}

		// Check if timer is running
		isRunning, ok := runningVar.Value.(bool)
		if !ok || !isRunning {
			continue
		}

		// Parse the start time
		startTimeStr, ok := startTimeVar.Value.(string)
		if !ok {
			continue
		}

		startTime, err := time.Parse(time.RFC3339Nano, startTimeStr)
		if err != nil {
			continue
		}

		// Update elapsed time
		elapsed := time.Since(startTime)
		etVar.Value = elapsed.String()
		etVar.Timestamp = time.Now()

		// Check if timer has expired (standard timeout of 5 seconds)
		expiredDuration := 5 * time.Second

		// Different timeouts depending on state
		stateValue := 0
		for name, v := range r.variables {
			if strings.HasSuffix(name, ".CurrentState") {
				if state, ok := v.Value.(int); ok {
					stateValue = state
					break
				}
			}
		}

		// Use different timeouts based on state
		switch stateValue {
		case 0, 3: // Main road green, side road green
			expiredDuration = 10 * time.Second
		case 1, 4: // Main road yellow, side road yellow
			expiredDuration = 3 * time.Second
		default:
			expiredDuration = 5 * time.Second
		}

		if elapsed >= expiredDuration {
			// Timer expired
			if isRunningBool, _ := qVar.Value.(bool); !isRunningBool {
				qVar.Value = true
				qVar.Timestamp = time.Now()

				// Advance state if this timer completed
				for name, v := range r.variables {
					if strings.HasSuffix(name, ".CurrentState") {
						if state, ok := v.Value.(int); ok {
							newState := (state + 1) % 7 // 0-6 states
							v.Value = newState
							v.Timestamp = time.Now()

							// Reset timer for next state
							runningVar.Value = true
							startTimeVar.Value = time.Now().Format(time.RFC3339Nano)
							qVar.Value = false
							break
						}
					}
				}
			}
		}
	}

	// Execute all tasks in priority order
	for _, task := range r.tasks {
		// fmt.Printf("Executing task: %s\n", task.Name)
		if err := task.Program.Execute(); err != nil {
			// Handle error, update quality
			log.Printf("Error executing task: %v", err)
			continue
		}
	}
}

// ensureTimerRunning checks if any timer is running and starts one if needed
func (r *Runtime) ensureTimerRunning() {
	// Look for any timer variables
	var anyTimerRunning bool
	var foundTimer bool
	var firstTimerBase string

	for name, v := range r.variables {
		if strings.HasSuffix(name, ".Running") {
			foundTimer = true
			timerBase := strings.TrimSuffix(name, ".Running")
			if firstTimerBase == "" {
				firstTimerBase = timerBase
			}

			running, ok := v.Value.(bool)
			if ok && running {
				anyTimerRunning = true
				break
			}
		}
	}

	// If we found timers but none are running, start the first one
	if foundTimer && !anyTimerRunning && firstTimerBase != "" {
		runningVar, hasRunning := r.variables[firstTimerBase+".Running"]
		startTimeVar, hasStartTime := r.variables[firstTimerBase+".StartTime"]
		qVar, hasQ := r.variables[firstTimerBase+".Q"]
		etVar, hasET := r.variables[firstTimerBase+".ET"]

		if hasRunning && hasStartTime && hasQ && hasET {
			runningVar.Value = true
			startTimeVar.Value = time.Now().Format(time.RFC3339Nano)
			qVar.Value = false
			etVar.Value = "0s"

			// Try to find a CurrentState variable to reset
			for name, v := range r.variables {
				if strings.HasSuffix(name, ".CurrentState") {
					v.Value = 0
					break
				}
			}
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

	// Strip the extension to get a clean namespace
	namespace := strings.TrimSuffix(filePath, filepath.Ext(filePath))

	// Prevent cases where namespace would be empty
	if namespace == "" {
		namespace = "main"
	}

	log.Printf("Using namespace '%s' for variables from file '%s'", namespace, filePath)

	varCount := len(prog.Vars)
	if varCount == 0 {
		log.Printf("WARNING: No variables found in the program for %s. Check your ST code for proper variable declarations.", filePath)
		log.Printf("Variables should be defined in sections like VAR_INPUT, VAR_OUTPUT, or VAR.")
		// Check if source code is available for additional logging
		if req.SourceCode != "" {
			log.Printf("Source code sample (first 100 chars): %s", truncateString(req.SourceCode, 100))
		}
	} else {
		log.Printf("Deploying code to %s with %d variables:", filePath, varCount)
		// Log all variables we're about to register
		for name, v := range prog.Vars {
			log.Printf("  - %s (type: %v)", name, v.DataType)
		}
	}

	// Clean up any existing variables from this path before adding new ones
	// to prevent duplicates
	r.removeVariablesByPath(namespace)

	// Make sure we have a CurrentState variable in this namespace
	namespacedStateName := namespace + ".CurrentState"
	r.variables[namespacedStateName] = &Variable{
		Name:      namespacedStateName,
		DataType:  TypeInt,
		Value:     0,
		Quality:   QualityGood,
		Timestamp: time.Now(),
		Path:      namespace,
	}
	log.Printf("Created CurrentState variable for namespace %s", namespace)

	// Extract variables from the program and register them
	for name, v := range prog.Vars {
		// Skip if we just created this variable (CurrentState)
		if name == "CurrentState" {
			continue
		}

		// Register with namespaced name for direct access
		namespacedName := namespace + "." + name
		namespacedVariable := &Variable{
			Name:      namespacedName,
			DataType:  v.DataType,
			Value:     v.Value,
			Quality:   QualityGood,
			Timestamp: time.Now(),
			Path:      namespace,
		}
		r.variables[namespacedName] = namespacedVariable
		log.Printf("Registered namespaced variable %s", namespacedName)
	}

	// Register TON timer instances found in source code
	if req.SourceCode != "" {
		// Look for timer declarations in the source code
		timerInstances := findTimersInSourceCode(req.SourceCode)
		for _, timerName := range timerInstances {
			// Register timer's Q output for monitoring in namespaced form only
			namespacedName := namespace + "." + timerName

			// Register timer base
			r.variables[namespacedName] = &Variable{
				Name:      namespacedName,
				DataType:  TypeString,
				Value:     "", // Timer type
				Quality:   QualityGood,
				Timestamp: time.Now(),
				Path:      namespace,
			}

			// Register Q output
			r.variables[namespacedName+".Q"] = &Variable{
				Name:      namespacedName + ".Q",
				DataType:  TypeBool,
				Value:     false,
				Quality:   QualityGood,
				Timestamp: time.Now(),
				Path:      namespace,
			}

			// Register ET output
			r.variables[namespacedName+".ET"] = &Variable{
				Name:      namespacedName + ".ET",
				DataType:  TypeString,
				Value:     "0s",
				Quality:   QualityGood,
				Timestamp: time.Now(),
				Path:      namespace,
			}

			// Register internal variables
			r.variables[namespacedName+".Running"] = &Variable{
				Name:      namespacedName + ".Running",
				DataType:  TypeBool,
				Value:     false,
				Quality:   QualityGood,
				Timestamp: time.Now(),
				Path:      namespace,
			}

			r.variables[namespacedName+".StartTime"] = &Variable{
				Name:      namespacedName + ".StartTime",
				DataType:  TypeString,
				Value:     time.Now().Format(time.RFC3339Nano),
				Quality:   QualityGood,
				Timestamp: time.Now(),
				Path:      namespace,
			}

			log.Printf("Registered timer variables for %s with namespace %s", timerName, namespacedName)
		}
	}

	// Log the total variables in the runtime after deployment
	log.Printf("Runtime now has %d total variables", len(r.variables))

	// If we still have no variables, create some test variables for debugging
	if len(r.variables) == 0 {
		log.Printf("No variables found in program. Creating test variables for debugging.")
		r.RegisterTestVariables(namespace)
	}

	return nil
}

// findTimersInSourceCode scans source code for timer declarations
func findTimersInSourceCode(sourceCode string) []string {
	timerNames := []string{}

	// Pattern to match variable declarations of type TON
	// Example: "MyTimer : TON;" or "Timer1: TON ;"
	timerMatches := regexp.MustCompile(`\b(\w+)\s*:\s*TON\b`).FindAllStringSubmatch(sourceCode, -1)

	for _, match := range timerMatches {
		if len(match) > 1 {
			timerNames = append(timerNames, match[1])
		}
	}

	return timerNames
}

// removeVariablesByPath removes all variables with a given path, including nested paths
func (r *Runtime) removeVariablesByPath(path string) {
	// First, identify all variables with this path or that contain this path
	var toRemove []string
	for name, v := range r.variables {
		// Remove direct path matches
		if v.Path == path {
			toRemove = append(toRemove, name)
			continue
		}

		// Also remove any variables whose names contain the namespace
		// This catches nested variables like "main-st.main-st.Timer"
		if strings.Contains(name, path+".") {
			toRemove = append(toRemove, name)
			continue
		}
	}

	// Then remove them
	if len(toRemove) > 0 {
		log.Printf("Removing %d existing variables with path '%s'", len(toRemove), path)
		for _, name := range toRemove {
			delete(r.variables, name)
		}
	}
}

// RegisterTestVariables registers test variables for debugging purposes
func (r *Runtime) RegisterTestVariables(namespace string) {
	// Create test variables with the requested namespace
	testVars := []struct {
		name  string
		dtype DataType
		value interface{}
	}{
		{"Mode", TypeString, "AUTO"},
		{"Sensor1", TypeInt, 42},
		{"Sensor2", TypeInt, 75},
		{"EmergencyVehicle", TypeBool, true},
		{"ManualOverride", TypeBool, false},
		{"TimeOfDay", TypeString, "DAY"},
	}

	// Register variables with namespace only
	for _, v := range testVars {
		// Register namespaced name only
		namespacedName := namespace + "." + v.name
		r.variables[namespacedName] = &Variable{
			Name:      namespacedName,
			DataType:  v.dtype,
			Value:     v.value,
			Quality:   QualityGood,
			Timestamp: time.Now(),
			Path:      namespace,
		}

		log.Printf("Registered test variable: %s", namespacedName)
	}

	log.Printf("Added %d test variables with namespace %s", len(testVars), namespace)
}

// Helper function to truncate long strings
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
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
		Vars:     make(map[string]*Variable),
		code:     make([]interface{}, 0), // Initialize code slice
	}

	// Parse the AST JSON
	var astData map[string]interface{}
	if err := json.Unmarshal(astJSON, &astData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal AST: %w", err)
	}

	log.Printf("Parsing AST with keys: %v", getMapKeys(astData))

	// Extract program name if available
	if programName, ok := astData["name"].(string); ok {
		prog.Name = programName
		log.Printf("Found program name: %s", programName)
	}

	// Extract statements if available (common AST format)
	if statements, ok := astData["statements"].([]interface{}); ok && len(statements) > 0 {
		log.Printf("Found %d statements in the AST", len(statements))
		prog.code = statements
	} else if body, ok := astData["body"].([]interface{}); ok && len(body) > 0 {
		// Alternative AST format
		log.Printf("Found %d statements in the body", len(body))
		prog.code = body
	}

	// Look deeper for statements if not found at top level
	if len(prog.code) == 0 {
		extractStatementsFromAST(astData, prog)
	}

	// Process the AST starting from the root to extract variables
	processASTNode(astData, prog, 0)

	// Log the variables extracted
	log.Printf("Extracted %d variables and %d statements from AST",
		len(prog.Vars), len(prog.code))
	for varName, v := range prog.Vars {
		log.Printf("  - %s (type: %v)", varName, v.DataType)
	}

	return prog, nil
}

// extractStatementsFromAST recursively searches for statement arrays in the AST
func extractStatementsFromAST(node interface{}, prog *Program) {
	switch n := node.(type) {
	case map[string]interface{}:
		// Look for statement arrays in this node
		for key, value := range n {
			if key == "statements" || key == "body" {
				if stmts, ok := value.([]interface{}); ok && len(stmts) > 0 {
					log.Printf("Found %d statements in %s", len(stmts), key)
					prog.code = stmts
					return
				}
			}

			// Also check for common POU/program structures
			if key == "programs" || key == "functions" || key == "functionBlocks" {
				extractStatementsFromAST(value, prog)
			}
		}

		// Recurse into all other fields
		for _, value := range n {
			extractStatementsFromAST(value, prog)
		}

	case []interface{}:
		// Check each item in the array
		for _, item := range n {
			extractStatementsFromAST(item, prog)
			// If we found statements, stop recursing
			if len(prog.code) > 0 {
				return
			}
		}
	}
}

// getMapKeys returns a string with all keys in a map for debugging
func getMapKeys(m map[string]interface{}) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return strings.Join(keys, ", ")
}

// processASTNode recursively processes AST nodes looking for variable declarations
func processASTNode(node interface{}, prog *Program, depth int) {
	// Guard against too deep recursion
	if depth > 10 {
		return
	}

	// Process different node types
	switch n := node.(type) {
	case map[string]interface{}:
		// Check if this node is a variable declaration
		if isVariableDeclaration(n) {
			addVariableToProg(n, prog)
			return
		}

		// Process all fields of the node
		for key, value := range n {
			// Special handling for variable sections
			if strings.HasPrefix(strings.ToLower(key), "var") {
				log.Printf("Found VAR section: %s", key)
				processASTNode(value, prog, depth+1)
				continue
			}

			// Special handling for declarations array
			if key == "declarations" || key == "variables" || key == "varDeclarations" {
				log.Printf("Processing %s array", key)
				processASTNode(value, prog, depth+1)
				continue
			}

			// Special handling for programs array
			if key == "programs" {
				log.Printf("Processing programs array")
				processASTNode(value, prog, depth+1)
				continue
			}

			// Recursively process all other objects
			processASTNode(value, prog, depth+1)
		}

	case []interface{}:
		// Process all elements in the array
		for _, item := range n {
			processASTNode(item, prog, depth+1)
		}
	}
}

// isVariableDeclaration checks if a node is a variable declaration
func isVariableDeclaration(node map[string]interface{}) bool {
	// Check for name as a basic requirement
	if _, hasName := node["name"].(string); !hasName {
		return false
	}

	// Check for type hints
	if declType, ok := node["$type"].(string); ok {
		if strings.Contains(strings.ToLower(declType), "variable") {
			return true
		}
	}

	// Check for type definition
	if _, hasType := node["type"].(map[string]interface{}); hasType {
		return true
	}

	return false
}

// addVariableToProg adds a variable declaration to the program
func addVariableToProg(variableMap map[string]interface{}, prog *Program) {
	if varName, ok := variableMap["name"].(string); ok {
		// Skip empty names or reserved words
		if varName == "" || strings.ToLower(varName) == "type" {
			return
		}

		log.Printf("Processing variable: %s", varName)

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
				log.Printf("  Data type: %s", typeName)
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
					log.Printf("  Initial value: %v", value)
				}
			}
		}

		// Add variable to program
		prog.Vars[varName] = &Variable{
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

// ClearAllVariables removes all variables from the runtime
func (r *Runtime) ClearAllVariables() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Create a new empty map to replace the existing one
	r.variables = make(map[string]*Variable)
	log.Printf("Cleared all variables from runtime")
}

package runtime

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/hyperdrive/core/apps/runtime/internal/parser"
	"github.com/hyperdrive/core/apps/runtime/internal/parser/ast"
)

// Program represents an executable IEC 61131-3 program
type Program struct {
	Name     string
	Code     string
	Version  string
	Modified time.Time
	ast      *ast.Program
	Vars     map[string]*Variable // Public field for easier debugging
	code     []interface{}        // Raw statements from AST JSON
}

// NewProgram creates a new program from source code
func NewProgram(name, code string) (*Program, error) {
	astProg, err := parser.Parse(code)
	if err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	prog := &Program{
		Name:     name,
		Code:     code,
		Version:  "1.0",
		Modified: time.Now(),
		ast:      astProg,
		Vars:     make(map[string]*Variable),
	}

	// Initialize variables
	for _, v := range astProg.Vars {
		variable := &Variable{
			Name:      v.Name,
			DataType:  convertDataType(v.Type),
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}

		// Set initial value if provided
		if v.InitExpr != nil {
			val, err := prog.evaluateExpression(v.InitExpr)
			if err != nil {
				return nil, fmt.Errorf("initialization error: %w", err)
			}
			variable.Value = val
		} else {
			variable.Value = defaultValue(variable.DataType)
		}

		prog.Vars[v.Name] = variable
	}

	return prog, nil
}

// Execute runs one cycle of the program
func (p *Program) Execute() error {
	if p.ast == nil {
		// fmt.Printf("Warning: Program %s has nil AST\n", p.Name)
	} else {
		// fmt.Printf("Executing program: %s with %d statements\n", p.Name, len(p.ast.Body))
	}

	// If we have a traditional AST, execute it
	if p.ast != nil && len(p.ast.Body) > 0 {
		for _, stmt := range p.ast.Body {
			// fmt.Printf("Statement %d: %T\n", i, stmt)
			if err := p.executeStatement(stmt); err != nil {
				return err
			}
		}
		return nil
	}

	// Otherwise, if we have raw statements from JSON, execute those
	if len(p.code) > 0 {
		// fmt.Printf("Executing from raw JSON with %d statements\n", len(p.code))
		for _, stmt := range p.code {
			// fmt.Printf("Raw statement %d: %T\n", i, stmt)
			if err := p.executeRawStatement(stmt); err != nil {
				return err
			}
		}
		return nil
	}

	// If we reach here, there was nothing to execute
	// fmt.Printf("Program %s has no statements to execute\n", p.Name)
	return nil
}

// executeStatement executes a single statement
func (p *Program) executeStatement(stmt ast.Statement) error {
	// fmt.Printf("Executing statement: %T\n", stmt)

	switch s := stmt.(type) {
	case *ast.Assignment:
		// Check if the assignment's value is a function call (common for FB invocations)
		if callExpr, ok := s.Value.(*ast.CallExpr); ok {
			// Check if this is a TON timer call
			if instance, ok := isTimerExpression(callExpr.Function); ok {
				// fmt.Printf("Detected timer call: %s with %d args\n", instance, len(callExpr.Args))
				return p.executeTONTimer(instance, callExpr.Args)
			}
		}

		// Normal assignment processing
		val, err := p.evaluateExpression(s.Value)
		if err != nil {
			return err
		}
		v, ok := p.Vars[s.Variable.String()]
		if !ok {
			return fmt.Errorf("undefined variable: %s", s.Variable.String())
		}
		v.Value = val
		v.Timestamp = time.Now()
		return nil
	default:
		return fmt.Errorf("unsupported statement type: %T", stmt)
	}
}

// executeRawStatement executes a statement from raw JSON AST
func (p *Program) executeRawStatement(stmt interface{}) error {
	stmtMap, ok := stmt.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid statement format: not a map")
	}

	stmtType, ok := stmtMap["$type"].(string)
	if !ok {
		return fmt.Errorf("invalid statement format: missing $type")
	}

	switch stmtType {
	case "AssignmentStatement":
		// Check if this is a function call assignment
		expr, hasExpr := stmtMap["expression"].(map[string]interface{})
		if hasExpr && expr["$type"] == "FunctionCallExpression" {
			// It's a function call, check if it's a timer
			callObj, hasCall := expr["call"].(map[string]interface{})
			if hasCall && callObj["$type"] == "MemberAccess" {
				// Get the instance name
				instance, hasInstance := callObj["object"].(map[string]interface{})
				if hasInstance && instance["$type"] == "VariableReference" {
					instanceName, hasName := instance["name"].(string)
					if hasName && isTimerInstance(instanceName) {
						// Handle timer call
						return p.executeRawTONTimer(instanceName, expr["arguments"])
					}
				}
			} else if hasCall && callObj["$type"] == "VariableReference" {
				// Direct function call like Timer(...)
				instanceName, hasName := callObj["name"].(string)
				if hasName && isTimerInstance(instanceName) {
					// Handle timer call
					return p.executeRawTONTimer(instanceName, expr["arguments"])
				}
			}
		}
		return p.executeRawAssignment(stmtMap)
	case "IfStatement":
		return p.executeRawIfStatement(stmtMap)
	case "FunctionCall":
		// Direct function call statement
		callObj, hasCall := stmtMap["call"].(map[string]interface{})
		if hasCall {
			if callObj["$type"] == "VariableReference" {
				instanceName, hasName := callObj["name"].(string)
				if hasName && isTimerInstance(instanceName) {
					// Handle timer call
					return p.executeRawTONTimer(instanceName, stmtMap["arguments"])
				}
			}
		}
		// Fall through to default for unsupported function calls
		fallthrough
	default:
		// Log unsupported statement type but don't fail
		// fmt.Printf("Unsupported statement type: %s\n", stmtType)
		return nil
	}
}

// executeRawAssignment executes an assignment statement from raw JSON AST
func (p *Program) executeRawAssignment(stmt map[string]interface{}) error {
	// Get variable name
	varRef, ok := stmt["variable"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid assignment: missing variable reference")
	}

	varName, ok := varRef["name"].(string)
	if !ok {
		return fmt.Errorf("invalid assignment: missing variable name")
	}

	// Find the variable in our program
	variable, ok := p.Vars[varName]
	if !ok {
		return fmt.Errorf("undefined variable: %s", varName)
	}

	// Get the expression to evaluate
	expr, ok := stmt["expression"]
	if !ok {
		return fmt.Errorf("invalid assignment: missing expression")
	}

	// Evaluate the expression
	value, err := p.evaluateRawExpression(expr)
	if err != nil {
		return err
	}

	// Assign the value to the variable
	variable.Value = value
	variable.Timestamp = time.Now()

	return nil
}

// executeRawIfStatement executes an if statement from raw JSON AST
func (p *Program) executeRawIfStatement(stmt map[string]interface{}) error {
	// Get condition
	condition, ok := stmt["condition"]
	if !ok {
		return fmt.Errorf("invalid if statement: missing condition")
	}

	// Evaluate condition
	condValue, err := p.evaluateRawExpression(condition)
	if err != nil {
		return err
	}

	// Check if condition is true
	condBool, ok := condValue.(bool)
	if !ok {
		return fmt.Errorf("invalid condition result: not a boolean")
	}

	// Execute then or else branch
	if condBool {
		// Execute then branch
		thenBlock, ok := stmt["then"].([]interface{})
		if !ok {
			// It might be a single statement
			if thenStmt, ok := stmt["then"].(map[string]interface{}); ok {
				return p.executeRawStatement(thenStmt)
			}
			return fmt.Errorf("invalid then branch")
		}

		for _, thenStmt := range thenBlock {
			if err := p.executeRawStatement(thenStmt); err != nil {
				return err
			}
		}
	} else if elseExpr, hasElse := stmt["else"]; hasElse {
		// Execute else branch if exists
		elseBlock, ok := elseExpr.([]interface{})
		if !ok {
			// It might be a single statement
			if elseStmt, ok := elseExpr.(map[string]interface{}); ok {
				return p.executeRawStatement(elseStmt)
			}
			return fmt.Errorf("invalid else branch")
		}

		for _, elseStmt := range elseBlock {
			if err := p.executeRawStatement(elseStmt); err != nil {
				return err
			}
		}
	}

	return nil
}

// executeTONTimer executes a TON timer function block
func (p *Program) executeTONTimer(instance string, inputs []ast.Expression) error {
	// TON timer has inputs: IN (BOOL), PT (TIME)
	// and outputs: Q (BOOL), ET (TIME)
	var inValue bool
	var ptValue time.Duration

	// If inputs are provided, evaluate them
	if len(inputs) >= 1 {
		in, err := p.evaluateExpression(inputs[0])
		if err != nil {
			return err
		}
		inBool, ok := in.(bool)
		if !ok {
			return fmt.Errorf("IN parameter must be boolean")
		}
		inValue = inBool
	}

	if len(inputs) >= 2 {
		pt, err := p.evaluateExpression(inputs[1])
		if err != nil {
			return err
		}

		// Convert to time.Duration
		switch v := pt.(type) {
		case time.Duration:
			ptValue = v
		case string:
			// Parse IEC time format (e.g. T#2s)
			ptValue = parseIECTime(v)
		default:
			return fmt.Errorf("PT parameter must be TIME")
		}
	}

	// Debug info
	// fmt.Printf("TON Timer: %s, IN=%v, PT=%v\n", instance, inValue, ptValue)

	// Timer state variables (standard TON interface)
	timerQ := instance + ".Q"   // Output: timer expired flag
	timerET := instance + ".ET" // Output: elapsed time

	// Internal state variables
	timerRunning := instance + ".Running"     // Internal: is timer running
	timerStartTime := instance + ".StartTime" // Internal: when timer started

	// Ensure all timer variables exist
	if _, ok := p.Vars[timerQ]; !ok {
		p.Vars[timerQ] = &Variable{
			Name:      timerQ,
			DataType:  TypeBool,
			Value:     false,
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerET]; !ok {
		p.Vars[timerET] = &Variable{
			Name:      timerET,
			DataType:  TypeString,
			Value:     "0s",
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerRunning]; !ok {
		p.Vars[timerRunning] = &Variable{
			Name:      timerRunning,
			DataType:  TypeBool,
			Value:     false,
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerStartTime]; !ok {
		p.Vars[timerStartTime] = &Variable{
			Name:      timerStartTime,
			DataType:  TypeString,
			Value:     time.Now().Format(time.RFC3339Nano),
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	// Get variable references
	qVar := p.Vars[timerQ]
	etVar := p.Vars[timerET]
	runningVar := p.Vars[timerRunning]
	startTimeVar := p.Vars[timerStartTime]

	// Debug current state
	// fmt.Printf("  Before - Q=%v, ET=%v, Running=%v\n",
	// 	qVar.Value, etVar.Value, runningVar.Value)

	// TON behavior implementation
	if inValue {
		// Timer input is TRUE
		running, _ := runningVar.Value.(bool)

		if !running {
			// Timer just started
			runningVar.Value = true
			startTimeVar.Value = time.Now().Format(time.RFC3339Nano)
			qVar.Value = false
			// fmt.Printf("  Timer starting now\n")
		}

		// Calculate elapsed time
		startTime, _ := time.Parse(time.RFC3339Nano, startTimeVar.Value.(string))
		elapsed := time.Since(startTime)
		etVar.Value = elapsed.String()

		// Check if timer has expired
		if elapsed >= ptValue {
			if qVar.Value != true {
				// fmt.Printf("  Timer expired after %v (preset: %v)\n", elapsed, ptValue)
			}
			qVar.Value = true
		}
	} else {
		// Timer input is FALSE, reset timer
		if runningVar.Value.(bool) {
			// fmt.Printf("  Timer being reset\n")
		}
		runningVar.Value = false
		etVar.Value = "0s"
		qVar.Value = false
	}

	// Debug final state
	// fmt.Printf("  After - Q=%v, ET=%v, Running=%v\n",
	// 	qVar.Value, etVar.Value, runningVar.Value)

	return nil
}

// parseIECTime parses an IEC 61131-3 time literal
func parseIECTime(iecTime string) time.Duration {
	// Strip the T# prefix if present
	s := iecTime
	if strings.HasPrefix(strings.ToUpper(s), "T#") {
		s = s[2:]
	}

	var duration time.Duration

	// Parse days
	if idx := strings.Index(s, "d"); idx >= 0 {
		days, _ := strconv.Atoi(s[:idx])
		duration += time.Duration(days) * 24 * time.Hour
		s = s[idx+1:]
	}

	// Parse hours
	if idx := strings.Index(s, "h"); idx >= 0 {
		hours, _ := strconv.Atoi(s[:idx])
		duration += time.Duration(hours) * time.Hour
		s = s[idx+1:]
	}

	// Parse minutes
	if idx := strings.Index(s, "m"); idx >= 0 && !strings.Contains(s[:idx], "s") {
		mins, _ := strconv.Atoi(s[:idx])
		duration += time.Duration(mins) * time.Minute
		s = s[idx+1:]
	}

	// Parse seconds
	if idx := strings.Index(s, "s"); idx >= 0 && !strings.Contains(s[:idx], "m") {
		secs, _ := strconv.Atoi(s[:idx])
		duration += time.Duration(secs) * time.Second
		s = s[idx+1:]
	}

	// Parse milliseconds
	if idx := strings.Index(s, "ms"); idx >= 0 {
		ms, _ := strconv.Atoi(s[:idx])
		duration += time.Duration(ms) * time.Millisecond
	}

	return duration
}

// evaluateExpression evaluates an expression
func (p *Program) evaluateExpression(expr ast.Expression) (interface{}, error) {
	switch e := expr.(type) {
	case *ast.Variable:
		v, ok := p.Vars[e.Name]
		if !ok {
			return nil, fmt.Errorf("undefined variable: %s", e.Name)
		}
		return v.Value, nil
	case *ast.Literal:
		return e.Value, nil
	case *ast.BinaryExpr:
		left, err := p.evaluateExpression(e.Left)
		if err != nil {
			return nil, err
		}
		right, err := p.evaluateExpression(e.Right)
		if err != nil {
			return nil, err
		}
		return evaluateBinaryOp(left, e.Operator, right)
	case *ast.CallExpr:
		// Handle function calls
		if instance, ok := isTimerExpression(e.Function); ok {
			// For timer calls, we handle these separately in executeTONTimer
			// Just return a placeholder value
			log.Printf("Function call to timer instance: %s", instance)
			return true, nil
		}

		// For other function calls, log and return a default
		log.Printf("Unhandled function call: %s", e.Function)
		return false, nil
	case *ast.MemberAccess:
		// Handle member access (e.g., Timer.Q)
		if obj, ok := e.Object.(*ast.Variable); ok {
			if isTimerInstance(obj.Name) {
				// Look for Timer.Q, Timer.ET properties
				propertyName := obj.Name + "." + e.Member
				if property, ok := p.Vars[propertyName]; ok {
					return property.Value, nil
				}
			}
		}
		return nil, fmt.Errorf("unhandled member access: %s", e)
	default:
		return nil, fmt.Errorf("unsupported expression type: %T", expr)
	}
}

// evaluateRawExpression evaluates an expression from raw JSON AST
func (p *Program) evaluateRawExpression(expr interface{}) (interface{}, error) {
	exprMap, ok := expr.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid expression format: not a map")
	}

	exprType, ok := exprMap["$type"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid expression format: missing $type")
	}

	switch exprType {
	case "IntLiteral", "BooleanLiteral", "RealLiteral", "StringLiteral":
		// Return the value of the literal
		return exprMap["value"], nil

	case "VariableReference":
		// Get variable value
		varName, ok := exprMap["name"].(string)
		if !ok {
			return nil, fmt.Errorf("invalid variable reference: missing name")
		}

		variable, ok := p.Vars[varName]
		if !ok {
			return nil, fmt.Errorf("undefined variable: %s", varName)
		}

		return variable.Value, nil

	case "MemberAccess":
		// Handle member access (e.g., Timer.Q, Timer.ET)
		object, hasObj := exprMap["object"].(map[string]interface{})
		if !hasObj {
			return nil, fmt.Errorf("invalid member access: missing object")
		}

		member, hasMember := exprMap["member"].(string)
		if !hasMember {
			return nil, fmt.Errorf("invalid member access: missing member name")
		}

		// Handle object.member syntax (especially for timers)
		if object["$type"] == "VariableReference" {
			objName, hasName := object["name"].(string)
			if hasName {
				// Check if this is a timer property access
				if isTimerInstance(objName) {
					// Look for Timer.Q, Timer.ET properties
					propertyName := objName + "." + member
					if property, ok := p.Vars[propertyName]; ok {
						return property.Value, nil
					}
				}
			}
		}

		return nil, fmt.Errorf("unhandled member access: %s.%s",
			object["name"], member)

	case "BinaryExpression":
		// Evaluate binary expression
		left, err := p.evaluateRawExpression(exprMap["left"])
		if err != nil {
			return nil, err
		}

		right, err := p.evaluateRawExpression(exprMap["right"])
		if err != nil {
			return nil, err
		}

		operator, ok := exprMap["operator"].(string)
		if !ok {
			return nil, fmt.Errorf("invalid binary expression: missing operator")
		}

		return evaluateBinaryOp(left, operator, right)

	case "FunctionCallExpression":
		// Handle function calls
		call, hasCall := exprMap["call"].(map[string]interface{})
		if !hasCall {
			return nil, fmt.Errorf("invalid function call: missing call object")
		}

		// Check if it's a timer function call
		if call["$type"] == "VariableReference" {
			instanceName, hasName := call["name"].(string)
			if hasName && isTimerInstance(instanceName) {
				// This is a timer call, for now just return true since we handle timers separately
				return true, nil
			}
		} else if call["$type"] == "MemberAccess" {
			// Handle member access function calls (obj.method())
			obj, hasObj := call["object"].(map[string]interface{})
			member, hasMember := call["member"].(string)

			if hasObj && hasMember && obj["$type"] == "VariableReference" {
				instanceName, hasName := obj["name"].(string)
				if hasName && isTimerInstance(instanceName) {
					// This is a timer property access (like Timer.Q)
					propertyName := instanceName + "." + member
					if property, ok := p.Vars[propertyName]; ok {
						return property.Value, nil
					}
				}
			}
		}

		// For other function calls, just return a default value for now
		return false, nil

	default:
		return nil, fmt.Errorf("unsupported expression type: %s", exprType)
	}
}

// Helper functions
func convertDataType(t ast.DataType) DataType {
	switch t.TypeName() {
	case "BOOL":
		return TypeBool
	case "INT":
		return TypeInt
	case "REAL":
		return TypeFloat
	case "STRING":
		return TypeString
	default:
		return TypeString
	}
}

func defaultValue(t DataType) interface{} {
	switch t {
	case TypeBool:
		return false
	case TypeInt:
		return 0
	case TypeFloat:
		return 0.0
	case TypeString:
		return ""
	default:
		return nil
	}
}

func evaluateBinaryOp(left interface{}, op string, right interface{}) (interface{}, error) {
	switch op {
	case "+":
		return evaluateAdd(left, right)
	case "-":
		return evaluateSubtract(left, right)
	case "*":
		return evaluateMultiply(left, right)
	case "/":
		return evaluateDivide(left, right)
	case "<":
		return evaluateLessThan(left, right)
	case ">":
		return evaluateGreaterThan(left, right)
	case "<=":
		return evaluateLessEqual(left, right)
	case ">=":
		return evaluateGreaterEqual(left, right)
	case "=":
		return evaluateEqual(left, right)
	case "<>":
		return evaluateNotEqual(left, right)
	default:
		return nil, fmt.Errorf("unsupported operator: %s", op)
	}
}

// Arithmetic operations
func evaluateAdd(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l + r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l + r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for +: %T and %T", left, right)
}

func evaluateSubtract(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l - r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l - r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for -: %T and %T", left, right)
}

func evaluateMultiply(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l * r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l * r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for *: %T and %T", left, right)
}

func evaluateDivide(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			if r == 0 {
				return nil, fmt.Errorf("division by zero")
			}
			return l / r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			if r == 0 {
				return nil, fmt.Errorf("division by zero")
			}
			return l / r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for /: %T and %T", left, right)
}

// Comparison operations
func evaluateLessThan(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l < r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l < r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for <: %T and %T", left, right)
}

func evaluateGreaterThan(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l > r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l > r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for >: %T and %T", left, right)
}

func evaluateLessEqual(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l <= r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l <= r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for <=: %T and %T", left, right)
}

func evaluateGreaterEqual(left, right interface{}) (interface{}, error) {
	switch l := left.(type) {
	case int:
		if r, ok := right.(int); ok {
			return l >= r, nil
		}
	case float64:
		if r, ok := right.(float64); ok {
			return l >= r, nil
		}
	}
	return nil, fmt.Errorf("invalid operands for >=: %T and %T", left, right)
}

func evaluateEqual(left, right interface{}) (interface{}, error) {
	return left == right, nil
}

func evaluateNotEqual(left, right interface{}) (interface{}, error) {
	return left != right, nil
}

// isTimerExpression checks if the expression refers to a timer and returns the instance name
func isTimerExpression(expr interface{}) (string, bool) {
	// For string inputs (from old code)
	if name, ok := expr.(string); ok {
		if name == "Timer" || strings.HasSuffix(name, "Timer") {
			return name, true
		}
		return "", false
	}

	// For AST expression types
	switch e := expr.(type) {
	case *ast.Variable:
		if e.Name == "Timer" || strings.HasSuffix(e.Name, "Timer") {
			return e.Name, true
		}
	case *ast.MemberAccess:
		// Check for timer member access like Timer.Q
		if obj, ok := e.Object.(*ast.Variable); ok {
			if obj.Name == "Timer" || strings.HasSuffix(obj.Name, "Timer") {
				return obj.Name, true
			}
		}
	}
	return "", false
}

// isTimerInstance checks if a variable name is a timer instance
func isTimerInstance(name string) bool {
	return name == "Timer" || strings.HasSuffix(name, "Timer")
}

// executeRawTONTimer executes a TON timer function block from raw AST
func (p *Program) executeRawTONTimer(instance string, argsObj interface{}) error {
	args, ok := argsObj.([]interface{})
	if !ok {
		// No arguments or invalid format
		return nil
	}

	var inValue bool
	var ptValue time.Duration

	// Process arguments (IN, PT)
	for _, arg := range args {
		argMap, ok := arg.(map[string]interface{})
		if !ok {
			continue
		}

		// Get parameter name and value
		paramName, hasName := argMap["name"].(string)
		if !hasName {
			continue
		}

		value, hasValue := argMap["value"].(map[string]interface{})
		if !hasValue {
			continue
		}

		switch paramName {
		case "IN":
			// Parse boolean value
			if value["$type"] == "BooleanLiteral" {
				inValue, _ = value["value"].(bool)
			} else if value["$type"] == "VariableReference" {
				varName, ok := value["name"].(string)
				if ok {
					if v, exists := p.Vars[varName]; exists {
						if boolVal, ok := v.Value.(bool); ok {
							inValue = boolVal
						}
					}
				}
			}
		case "PT":
			// Parse time value
			if value["$type"] == "TimeLiteral" {
				if timeStr, ok := value["value"].(string); ok {
					ptValue = parseIECTime(timeStr)
				}
			} else if value["$type"] == "VariableReference" {
				varName, ok := value["name"].(string)
				if ok {
					if v, exists := p.Vars[varName]; exists {
						if timeStr, ok := v.Value.(string); ok {
							ptValue = parseIECTime(timeStr)
						}
					}
				}
			}
		}
	}

	// Timer state variables (standard TON interface)
	timerQ := instance + ".Q"   // Output: timer expired flag
	timerET := instance + ".ET" // Output: elapsed time

	// Internal state variables
	timerRunning := instance + ".Running"     // Internal: is timer running
	timerStartTime := instance + ".StartTime" // Internal: when timer started

	// Ensure all timer variables exist
	if _, ok := p.Vars[timerQ]; !ok {
		p.Vars[timerQ] = &Variable{
			Name:      timerQ,
			DataType:  TypeBool,
			Value:     false,
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerET]; !ok {
		p.Vars[timerET] = &Variable{
			Name:      timerET,
			DataType:  TypeString,
			Value:     "0s",
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerRunning]; !ok {
		p.Vars[timerRunning] = &Variable{
			Name:      timerRunning,
			DataType:  TypeBool,
			Value:     false,
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	if _, ok := p.Vars[timerStartTime]; !ok {
		p.Vars[timerStartTime] = &Variable{
			Name:      timerStartTime,
			DataType:  TypeString,
			Value:     time.Now().Format(time.RFC3339Nano),
			Quality:   QualityGood,
			Timestamp: time.Now(),
		}
	}

	// Get variable references
	qVar := p.Vars[timerQ]
	etVar := p.Vars[timerET]
	runningVar := p.Vars[timerRunning]
	startTimeVar := p.Vars[timerStartTime]

	// TON behavior implementation
	if inValue {
		// Timer input is TRUE
		running, _ := runningVar.Value.(bool)

		if !running {
			// Timer just started
			runningVar.Value = true
			startTimeVar.Value = time.Now().Format(time.RFC3339Nano)
			qVar.Value = false
		}

		// Calculate elapsed time
		startTime, _ := time.Parse(time.RFC3339Nano, startTimeVar.Value.(string))
		elapsed := time.Since(startTime)
		etVar.Value = elapsed.String()

		// Check if timer has expired
		if elapsed >= ptValue {
			qVar.Value = true
		}
	} else {
		// Timer input is FALSE, reset timer
		runningVar.Value = false
		etVar.Value = "0s"
		qVar.Value = false
	}

	return nil
}

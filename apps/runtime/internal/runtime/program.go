package runtime

import (
	"fmt"
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
	vars     map[string]*Variable
	code     []interface{} // Raw statements from AST JSON
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
		vars:     make(map[string]*Variable),
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

		prog.vars[v.Name] = variable
	}

	return prog, nil
}

// Execute runs one cycle of the program
func (p *Program) Execute() error {
	// If we have a traditional AST, execute it
	if p.ast != nil && len(p.ast.Body) > 0 {
		for _, stmt := range p.ast.Body {
			if err := p.executeStatement(stmt); err != nil {
				return err
			}
		}
		return nil
	}

	// Otherwise, if we have raw statements from JSON, execute those
	if len(p.code) > 0 {
		for _, stmt := range p.code {
			if err := p.executeRawStatement(stmt); err != nil {
				return err
			}
		}
	}

	return nil
}

// executeStatement executes a single statement
func (p *Program) executeStatement(stmt ast.Statement) error {
	switch s := stmt.(type) {
	case *ast.Assignment:
		val, err := p.evaluateExpression(s.Value)
		if err != nil {
			return err
		}
		v, ok := p.vars[s.Variable.String()]
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
		return p.executeRawAssignment(stmtMap)
	case "IfStatement":
		return p.executeRawIfStatement(stmtMap)
	default:
		// Log unsupported statement type but don't fail
		fmt.Printf("Unsupported statement type: %s\n", stmtType)
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
	variable, ok := p.vars[varName]
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

// evaluateExpression evaluates an expression
func (p *Program) evaluateExpression(expr ast.Expression) (interface{}, error) {
	switch e := expr.(type) {
	case *ast.Variable:
		v, ok := p.vars[e.Name]
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

		variable, ok := p.vars[varName]
		if !ok {
			return nil, fmt.Errorf("undefined variable: %s", varName)
		}

		return variable.Value, nil

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

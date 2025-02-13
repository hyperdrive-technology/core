package runtime

import (
	"fmt"
	"time"

	"github.com/inrush-io/inrush/apps/runtime/internal/parser"
	"github.com/inrush-io/inrush/apps/runtime/internal/parser/ast"
)

// Program represents an executable IEC 61131-3 program
type Program struct {
	Name     string
	Code     string
	Version  string
	Modified time.Time
	ast      *ast.Program
	vars     map[string]*Variable
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
	for _, stmt := range p.ast.Body {
		if err := p.executeStatement(stmt); err != nil {
			return err
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
		v, ok := p.vars[s.Variable.Name]
		if !ok {
			return fmt.Errorf("undefined variable: %s", s.Variable.Name)
		}
		v.Value = val
		v.Timestamp = time.Now()
		return nil
	default:
		return fmt.Errorf("unsupported statement type: %T", stmt)
	}
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

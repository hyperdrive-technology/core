package ast

import (
	"fmt"
	"strings"
)

// Node represents a node in the AST
type Node interface {
	String() string
	Position() Position
}

// Position represents a position in the source code
type Position struct {
	Line   int
	Column int
}

// Program represents a complete IEC 61131-3 program
type Program struct {
	position Position
	Name     string
	Type     ProgramType
	Vars     []*VarDecl
	Body     []Statement
	Comments []string
}

func (p *Program) String() string     { return p.Name }
func (p *Program) Position() Position { return p.position }

type ProgramType string

const (
	ProgramFC  ProgramType = "FUNCTION"
	ProgramFB  ProgramType = "FUNCTION_BLOCK"
	ProgramPRG ProgramType = "PROGRAM"
)

// VarDecl represents a variable declaration
type VarDecl struct {
	position Position
	Name     string
	Type     DataType
	InitExpr Expression
	Comment  string
}

func (v *VarDecl) String() string     { return v.Name }
func (v *VarDecl) Position() Position { return v.position }

// DataType represents an IEC 61131-3 data type
type DataType interface {
	Node
	TypeName() string
}

// BasicType represents primitive data types
type BasicType struct {
	position Position
	TypeName string
}

func (t *BasicType) String() string     { return t.TypeName }
func (t *BasicType) Position() Position { return t.position }

// Statement represents a program statement
type Statement interface {
	Node
	statementNode()
}

// Expression represents a program expression
type Expression interface {
	Node
	expressionNode()
}

// Assignment represents an assignment statement
type Assignment struct {
	position Position
	Variable *Variable
	Value    Expression
}

func (a *Assignment) String() string {
	return fmt.Sprintf("%s := %s", a.Variable, a.Value)
}
func (a *Assignment) Position() Position { return a.position }
func (a *Assignment) statementNode()     {}

// Variable represents a variable reference
type Variable struct {
	position Position
	Name     string
}

func (v *Variable) String() string     { return v.Name }
func (v *Variable) Position() Position { return v.position }
func (v *Variable) expressionNode()    {}

// BinaryExpr represents a binary expression
type BinaryExpr struct {
	position Position
	Left     Expression
	Operator string
	Right    Expression
}

func (b *BinaryExpr) String() string {
	return fmt.Sprintf("(%s %s %s)", b.Left, b.Operator, b.Right)
}
func (b *BinaryExpr) Position() Position { return b.position }
func (b *BinaryExpr) expressionNode()    {}

// CallExpr represents a function/FB call
type CallExpr struct {
	position Position
	Function string
	Args     []Expression
}

func (c *CallExpr) String() string {
	args := make([]string, len(c.Args))
	for i, arg := range c.Args {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", c.Function, strings.Join(args, ", "))
}
func (c *CallExpr) Position() Position { return c.position }
func (c *CallExpr) expressionNode()    {}

// Literal represents a literal value
type Literal struct {
	position Position
	Type     DataType
	Value    interface{}
}

func (l *Literal) String() string     { return fmt.Sprintf("%v", l.Value) }
func (l *Literal) Position() Position { return l.position }
func (l *Literal) expressionNode()    {}

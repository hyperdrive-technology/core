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
	Variable Expression
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

// FunctionBlockType represents a function block type
type FunctionBlockType struct {
	position Position
	Name     string
}

func (t *FunctionBlockType) String() string     { return t.Name }
func (t *FunctionBlockType) Position() Position { return t.position }
func (t *FunctionBlockType) TypeName() string   { return t.Name }

// ArrayType represents an array type
type ArrayType struct {
	position Position
	Start    int
	End      int
	BaseType DataType
}

func (t *ArrayType) String() string {
	return fmt.Sprintf("ARRAY[%d..%d] OF %s", t.Start, t.End, t.BaseType)
}
func (t *ArrayType) Position() Position { return t.position }
func (t *ArrayType) TypeName() string   { return t.String() }

// FBCall represents a function block call with named arguments
type FBCall struct {
	position Position
	Instance string
	Inputs   []Expression
}

func (c *FBCall) String() string     { return fmt.Sprintf("%s(...)", c.Instance) }
func (c *FBCall) Position() Position { return c.position }
func (c *FBCall) expressionNode()    {}

// IfStatement represents an IF control structure
type IfStatement struct {
	position  Position
	Condition Expression
	Then      []Statement
	ElseIf    []*ElseIfClause
	Else      []Statement
}

func (s *IfStatement) String() string     { return "IF" }
func (s *IfStatement) Position() Position { return s.position }
func (s *IfStatement) statementNode()     {}

// ElseIfClause represents an ELSIF clause
type ElseIfClause struct {
	position  Position
	Condition Expression
	Then      []Statement
}

// WhileStatement represents a WHILE loop
type WhileStatement struct {
	position  Position
	Condition Expression
	Body      []Statement
}

func (s *WhileStatement) String() string     { return "WHILE" }
func (s *WhileStatement) Position() Position { return s.position }
func (s *WhileStatement) statementNode()     {}

// RepeatStatement represents a REPEAT loop
type RepeatStatement struct {
	position  Position
	Body      []Statement
	Condition Expression
}

func (s *RepeatStatement) String() string     { return "REPEAT" }
func (s *RepeatStatement) Position() Position { return s.position }
func (s *RepeatStatement) statementNode()     {}

// ForStatement represents a FOR loop
type ForStatement struct {
	position Position
	Variable string
	From     Expression
	To       Expression
	By       Expression
	Body     []Statement
}

func (s *ForStatement) String() string     { return "FOR" }
func (s *ForStatement) Position() Position { return s.position }
func (s *ForStatement) statementNode()     {}

// MemberAccess represents a struct member access
type MemberAccess struct {
	position Position
	Object   Expression
	Member   string
}

func (m *MemberAccess) String() string     { return fmt.Sprintf("%s.%s", m.Object, m.Member) }
func (m *MemberAccess) Position() Position { return m.position }
func (m *MemberAccess) expressionNode()    {}

// ArrayAccess represents an array element access
type ArrayAccess struct {
	position Position
	Array    Expression
	Index    Expression
}

func (a *ArrayAccess) String() string     { return fmt.Sprintf("%s[%s]", a.Array, a.Index) }
func (a *ArrayAccess) Position() Position { return a.position }
func (a *ArrayAccess) expressionNode()    {}

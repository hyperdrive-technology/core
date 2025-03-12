package parser

import (
	"fmt"
	"strconv"

	"github.com/alecthomas/participle/v2"
	"github.com/alecthomas/participle/v2/lexer"
	"github.com/hyperdrive/core/apps/runtime/internal/parser/ast"
)

// IEC61131Grammar defines the grammar for IEC 61131-3 programs
type IEC61131Grammar struct {
	Programs []*ProgramNode `parser:"@@*"`
}

type ProgramNode struct {
	Type     string         `parser:"@('PROGRAM'|'FUNCTION'|'FUNCTION_BLOCK')"`
	Name     string         `parser:"@Ident"`
	RetType  *TypeNode      `parser:"(':' @@)?"`
	VarDecls []*VarDeclNode `parser:"@@*"`
	Body     *ProgramBody   `parser:"@@"`
}

type ProgramBody struct {
	Statements []*StatementNode `parser:"@@*"`
	EndType    string           `parser:"@('END_PROGRAM'|'END_FUNCTION'|'END_FUNCTION_BLOCK')"`
}

type VarDeclNode struct {
	VarType string     `parser:"@('VAR'|'VAR_INPUT'|'VAR_OUTPUT')"`
	Vars    []*VarNode `parser:"@@*"`
	EndVar  string     `parser:"@'END_VAR'"`
}

type VarNode struct {
	Name string          `parser:"@Ident"`
	Type *TypeNode       `parser:"':' @@"`
	Init *ExpressionNode `parser:"(':=' @@)?"`
	Semi string          `parser:"@';'"`
}

type TypeNode struct {
	Array  *ArrayTypeNode  `parser:"  @@"`
	Struct *StructTypeNode `parser:"| @@"`
	Basic  string          `parser:"| @Ident"`
}

type ArrayTypeNode struct {
	Start string    `parser:"'ARRAY' '[' @Number"`
	End   string    `parser:"'..' @Number"`
	Of    *TypeNode `parser:"']' 'OF' @@"`
}

type StructTypeNode struct {
	Fields []*VarNode `parser:"'STRUCT' @@* 'END_STRUCT'"`
}

type StatementNode struct {
	Assignment *AssignmentNode `parser:"  @@ ';'"`
	CallStmt   *CallNode       `parser:"| @@ ';'"`
	IfStmt     *IfNode         `parser:"| @@ ';'"`
	WhileStmt  *WhileNode      `parser:"| @@ ';'"`
	RepeatStmt *RepeatNode     `parser:"| @@ ';'"`
	ForStmt    *ForNode        `parser:"| @@ ';'"`
}

type CallNode struct {
	Name string          `parser:"@FuncIdent"`
	Args []*ArgumentNode `parser:"(@@ (',' @@)*)? ')'"`
}

type AssignmentNode struct {
	Left  *TermNode       `parser:"@@"`
	Right *ExpressionNode `parser:"':=' @@"`
}

type NamedArgNode struct {
	Name  string          `parser:"@Ident ':='"`
	Value *ExpressionNode `parser:"@@"`
}

type ArgumentNode struct {
	Named *NamedArgNode   `parser:"  @@"`
	Posit *ExpressionNode `parser:"| @@"`
}

type ExpressionNode struct {
	Left  *TermNode     `parser:"@@"`
	Right []*OpTermNode `parser:"@@*"`
}

type OpTermNode struct {
	Op    string    `parser:"@('+' | '-' | '*' | '/' | 'AND' | 'OR' | '=' | '<>' | '<' | '<=' | '>' | '>=')"`
	Right *TermNode `parser:"@@"`
}

type TermNode struct {
	Primary *PrimaryNode  `parser:"@@"`
	Access  []*AccessNode `parser:"@@*"`
}

type AccessNode struct {
	Dot    string          `parser:"  @'.'"`
	Member *VariableNode   `parser:"  @@"`
	Array  bool            `parser:"| @'['"`
	Index  *ExpressionNode `parser:"  @@ ']'"`
}

type PrimaryNode struct {
	Variable *VariableNode   `parser:"  @@"`
	Call     *ExprCallNode   `parser:"| @@"`
	Number   string          `parser:"| @Number"`
	String   string          `parser:"| @String"`
	Bool     string          `parser:"| @('TRUE' | 'FALSE')"`
	SubExpr  *ExpressionNode `parser:"| '(' @@ ')'"`
}

type ExprCallNode struct {
	Name string          `parser:"@FuncIdent"`
	Args []*ArgumentNode `parser:"(@@ (',' @@)*)? ')'"`
}

type VariableNode struct {
	Name string `parser:"@Ident"`
}

type IfNode struct {
	Condition *ExpressionNode  `parser:"'IF' @@"`
	Then      []*StatementNode `parser:"'THEN' @@*"`
	ElseIf    []*ElseIfNode    `parser:"@@*"`
	Else      []*StatementNode `parser:"('ELSE' @@*)?"`
	EndIf     string           `parser:"'END_IF'"`
}

type ElseIfNode struct {
	Condition *ExpressionNode  `parser:"'ELSIF' @@"`
	Then      []*StatementNode `parser:"'THEN' @@*"`
}

type WhileNode struct {
	Condition *ExpressionNode  `parser:"'WHILE' @@"`
	Do        []*StatementNode `parser:"'DO' @@*"`
	EndWhile  string           `parser:"'END_WHILE'"`
}

type RepeatNode struct {
	Body      []*StatementNode `parser:"'REPEAT' @@*"`
	Condition *ExpressionNode  `parser:"'UNTIL' @@"`
	EndRepeat string           `parser:"'END_REPEAT'"`
}

type ForNode struct {
	Variable string           `parser:"'FOR' @Ident"`
	From     *ExpressionNode  `parser:"':=' @@"`
	To       *ExpressionNode  `parser:"'TO' @@"`
	By       *ExpressionNode  `parser:"('BY' @@)?"`
	Do       []*StatementNode `parser:"'DO' @@*"`
	EndFor   string           `parser:"'END_FOR'"`
}

var iec61131Lexer = lexer.MustStateful(lexer.Rules{
	"Root": {
		{"comment", `//[^\n]*\n?`, nil},
		{"whitespace", `[\s\t\n\r]+`, nil},
		{"Dots", `\.\.`, nil},
		{"Number", `[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?`, nil},
		{"String", `'[^']*'|"[^"]*"`, nil},
		{"FuncIdent", `[a-zA-Z_][a-zA-Z0-9_]*\(`, nil},
		{"Ident", `[a-zA-Z_][a-zA-Z0-9_]*`, nil},
		{"Semicolon", `;`, nil},
		{"Operator", `(:=|<=|>=|<>|\+|-|\*|/|AND|OR|=|<|>|>=|<=|<>|\.)`, nil},
		{"Punct", `[,()[\]:]`, nil},
	},
})

var Parser = participle.MustBuild[IEC61131Grammar](
	participle.Lexer(iec61131Lexer),
	participle.Unquote("String"),
	participle.UseLookahead(3),
	participle.Elide("comment", "whitespace"),
)

// BasicType implements ast.DataType
type BasicType struct {
	typeName string
	pos      ast.Position
}

func (t *BasicType) String() string         { return t.typeName }
func (t *BasicType) Position() ast.Position { return t.pos }
func (t *BasicType) TypeName() string       { return t.typeName }

// Parse parses the input code and returns the main program
func Parse(code string) (*ast.Program, error) {
	parsed, err := Parser.ParseString("", code)
	if err != nil {
		return nil, err
	}

	// Find the main program
	var mainProgram *ProgramNode
	for _, p := range parsed.Programs {
		if p.Type == "PROGRAM" && p.Name == "Main" {
			mainProgram = p
			break
		}
	}

	if mainProgram == nil {
		return nil, fmt.Errorf("main program not found")
	}

	// Convert to AST
	program := &ast.Program{
		Type: ast.ProgramPRG,
		Name: mainProgram.Name,
	}

	// Convert variables
	for _, varDecl := range mainProgram.VarDecls {
		for _, v := range varDecl.Vars {
			program.Vars = append(program.Vars, &ast.VarDecl{
				Name: v.Name,
				Type: convertType(v.Type),
			})
		}
	}

	// Convert statements
	for _, stmt := range mainProgram.Body.Statements {
		if converted := convertStatement(stmt); converted != nil {
			program.Body = append(program.Body, converted)
		}
	}

	return program, nil
}

func convertNamedArgs(args []*NamedArgNode) []ast.Expression {
	var result []ast.Expression
	for _, arg := range args {
		result = append(result, convertExpression(arg.Value))
	}
	return result
}

func convertAssignment(assign *AssignmentNode) *ast.Assignment {
	return &ast.Assignment{
		Variable: convertAccess(assign.Left.Primary.Variable, assign.Left.Access),
		Value:    convertExpression(assign.Right),
	}
}

func convertAccess(base *VariableNode, accesses []*AccessNode) ast.Expression {
	var expr ast.Expression = convertVariable(base)
	for _, access := range accesses {
		if access.Array {
			expr = &ast.ArrayAccess{
				Array: expr,
				Index: convertExpression(access.Index),
			}
		} else if access.Member != nil {
			expr = &ast.MemberAccess{
				Object: expr,
				Member: access.Member.Name,
			}
		}
	}
	return expr
}

func convertVariable(v *VariableNode) *ast.Variable {
	if v == nil {
		return nil
	}
	return &ast.Variable{
		Name: v.Name,
	}
}

func convertExpression(expr *ExpressionNode) ast.Expression {
	if expr == nil || expr.Left == nil {
		return nil
	}

	result := convertTerm(expr.Left)
	for _, opTerm := range expr.Right {
		result = &ast.BinaryExpr{
			Left:     result,
			Operator: opTerm.Op,
			Right:    convertTerm(opTerm.Right),
		}
	}
	return result
}

func convertTerm(term *TermNode) ast.Expression {
	if term.Primary != nil {
		var result ast.Expression = nil

		if term.Primary.Variable != nil {
			result = convertVariable(term.Primary.Variable)
		} else if term.Primary.Call != nil {
			funcName := term.Primary.Call.Name
			if len(funcName) > 0 && funcName[len(funcName)-1] == '(' {
				funcName = funcName[:len(funcName)-1]
			}
			result = &ast.CallExpr{
				Function: funcName,
				Args:     convertCallArgs(term.Primary.Call.Args),
			}
		} else if term.Primary.Number != "" {
			result = &ast.Literal{
				Type:  &BasicType{typeName: "REAL"},
				Value: term.Primary.Number,
			}
		} else if term.Primary.Bool != "" {
			result = &ast.Literal{
				Type:  &BasicType{typeName: "BOOL"},
				Value: term.Primary.Bool == "TRUE",
			}
		} else if term.Primary.String != "" {
			result = &ast.Literal{
				Type:  &BasicType{typeName: "STRING"},
				Value: term.Primary.String,
			}
		} else if term.Primary.SubExpr != nil {
			result = convertExpression(term.Primary.SubExpr)
		}

		// Handle member access and array indexing
		for _, access := range term.Access {
			if access.Dot != "" && access.Member != nil {
				result = &ast.MemberAccess{
					Object: result,
					Member: access.Member.Name,
				}
			} else if access.Array && access.Index != nil {
				result = &ast.ArrayAccess{
					Array: result,
					Index: convertExpression(access.Index),
				}
			}
		}

		return result
	}

	return nil
}

func convertCallArgs(args []*ArgumentNode) []ast.Expression {
	var result []ast.Expression
	for _, arg := range args {
		if arg.Named != nil {
			result = append(result, convertExpression(arg.Named.Value))
		} else {
			result = append(result, convertExpression(arg.Posit))
		}
	}
	return result
}

func convertType(t *TypeNode) ast.DataType {
	if t.Basic != "" {
		return &BasicType{typeName: t.Basic}
	}
	if t.Array != nil {
		start, _ := strconv.Atoi(t.Array.Start)
		end, _ := strconv.Atoi(t.Array.End)
		return &ast.ArrayType{
			Start:    start,
			End:      end,
			BaseType: convertType(t.Array.Of),
		}
	}
	if t.Struct != nil {
		// TODO: Implement struct type conversion
		return &BasicType{typeName: "STRUCT"}
	}
	return &BasicType{typeName: "UNKNOWN"}
}

func convertStatement(stmt *StatementNode) ast.Statement {
	if stmt.Assignment != nil {
		return convertAssignment(stmt.Assignment)
	}
	if stmt.CallStmt != nil {
		// Remove the trailing ( from the function name
		funcName := stmt.CallStmt.Name
		if len(funcName) > 0 && funcName[len(funcName)-1] == '(' {
			funcName = funcName[:len(funcName)-1]
		}
		return &ast.Assignment{
			Value: &ast.CallExpr{
				Function: funcName,
				Args:     convertCallArgs(stmt.CallStmt.Args),
			},
		}
	}
	if stmt.IfStmt != nil {
		return convertIfStatement(stmt.IfStmt)
	}
	if stmt.WhileStmt != nil {
		return convertWhileStatement(stmt.WhileStmt)
	}
	if stmt.RepeatStmt != nil {
		return convertRepeatStatement(stmt.RepeatStmt)
	}
	if stmt.ForStmt != nil {
		return convertForStatement(stmt.ForStmt)
	}
	return nil
}

func convertIfStatement(ifStmt *IfNode) ast.Statement {
	result := &ast.IfStatement{
		Condition: convertExpression(ifStmt.Condition),
		Then:      convertStatements(ifStmt.Then),
		Else:      convertStatements(ifStmt.Else),
	}

	for _, elseif := range ifStmt.ElseIf {
		result.ElseIf = append(result.ElseIf, &ast.ElseIfClause{
			Condition: convertExpression(elseif.Condition),
			Then:      convertStatements(elseif.Then),
		})
	}

	return result
}

func convertWhileStatement(whileStmt *WhileNode) ast.Statement {
	return &ast.WhileStatement{
		Condition: convertExpression(whileStmt.Condition),
		Body:      convertStatements(whileStmt.Do),
	}
}

func convertRepeatStatement(repeatStmt *RepeatNode) ast.Statement {
	return &ast.RepeatStatement{
		Body:      convertStatements(repeatStmt.Body),
		Condition: convertExpression(repeatStmt.Condition),
	}
}

func convertForStatement(forStmt *ForNode) ast.Statement {
	return &ast.ForStatement{
		Variable: forStmt.Variable,
		From:     convertExpression(forStmt.From),
		To:       convertExpression(forStmt.To),
		By:       convertExpression(forStmt.By),
		Body:     convertStatements(forStmt.Do),
	}
}

func convertStatements(stmts []*StatementNode) []ast.Statement {
	var result []ast.Statement
	for _, stmt := range stmts {
		if converted := convertStatement(stmt); converted != nil {
			result = append(result, converted)
		}
	}
	return result
}

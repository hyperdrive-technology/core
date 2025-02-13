package parser

import (
	"strings"

	"github.com/inrush-io/dsl"
	"github.com/inrush-io/inrush/apps/runtime/internal/parser/ast"
)

// Parse parses IEC 61131-3 source code and returns an AST
func Parse(code string) (*ast.Program, error) {
	parser := dsl.New(strings.NewReader(code))
	if err := parser.Parse(); err != nil {
		return nil, err
	}

	// Convert DSL AST to our AST
	program := &ast.Program{
		Name: "main", // Default name for now
		Type: ast.ProgramPRG,
		Vars: make([]*ast.VarDecl, 0),
		Body: make([]ast.Statement, 0),
	}

	// TODO: Walk the DSL AST and populate our AST
	// This is a placeholder implementation

	return program, nil
}

func parseFunctionBlock(p *dsl.Parser) {
	p.AddNode(NODE_FUNCTION_BLOCK)
	p.SkipToken() // Skip FUNCTION_BLOCK
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_VARIABLE, nil}}})
	p.AddTokens() // Add function block name

	parseVarDeclarations(p)
	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_FUNCTION_BLOCK, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseFunction(p *dsl.Parser) {
	p.AddNode(NODE_FUNCTION)
	p.SkipToken() // Skip FUNCTION
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_VARIABLE, nil}}})
	p.AddTokens() // Add function name
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_COLON, nil}}})
	p.SkipToken() // Skip COLON
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_INT, nil}, {TOKEN_REAL, nil}, {TOKEN_BOOL, nil}, {TOKEN_STRING, nil}}})
	p.AddTokens() // Add return type

	parseVarDeclarations(p)
	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_FUNCTION, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseProgram(p *dsl.Parser) {
	p.AddNode(NODE_PROGRAM)
	p.SkipToken() // Skip PROGRAM
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_VARIABLE, nil}}})
	p.AddTokens() // Add program name

	parseVarDeclarations(p)
	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_PROGRAM, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseVarDeclarations(p *dsl.Parser) {
	// Parse variable declarations
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VAR_INPUT, parseVarBlock},
			{TOKEN_VAR_OUTPUT, parseVarBlock},
			{TOKEN_VAR, parseVarBlock},
			{TOKEN_NL, func(p *dsl.Parser) { p.SkipToken() }},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})
}

func parseVarBlock(p *dsl.Parser) {
	p.AddNode(NODE_VAR_BLOCK)
	p.AddTokens() // This will add the VAR_INPUT, VAR_OUTPUT, or VAR token

	skipNewLines(p)

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseVarDeclaration},
		},
		Options: dsl.ParseOptions{Multiple: true},
	})

	skipNewLines(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_VAR, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseVarDeclaration(p *dsl.Parser) {
	p.AddNode(NODE_VAR)
	p.AddTokens() // Add variable name

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_COLON, nil}}})
	p.SkipToken() // Skip COLON

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_INT, nil},
			{TOKEN_REAL, nil},
			{TOKEN_BOOL, nil},
			{TOKEN_STRING, nil},
			{TOKEN_ARRAY, parseArrayType},
			{TOKEN_STRUCT, parseStructType},
		},
	})
	p.AddTokens() // Add type token

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_SEMICOLON, nil}}})
	p.SkipToken()

	skipNewLines(p)

	p.WalkUp()
}

func parseArrayType(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
		{TOKEN_LBRACKET, nil},
	}, Options: dsl.ParseOptions{Skip: true}})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
		{TOKEN_LITERAL, nil},
	}})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
		{TOKEN_DOTDOT, func(p *dsl.Parser) {
			p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
				{TOKEN_LITERAL, nil},
			}})
		}},
	}, Options: dsl.ParseOptions{Optional: true, Skip: true}})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
		{TOKEN_OF, nil},
	}, Options: dsl.ParseOptions{Skip: true}})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{
		{TOKEN_INT, nil},
		{TOKEN_REAL, nil},
		{TOKEN_BOOL, nil},
		{TOKEN_STRING, nil},
	}})
	p.AddTokens() // Add all array type tokens
}

func parseStructType(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseVarDeclaration},
		},
		Options: dsl.ParseOptions{Multiple: true},
	})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_STRUCT, nil}}})
	p.SkipToken()
}

func parseStatements(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseAssignmentOrFBInvocation},
			{TOKEN_IF, parseIfStatement},
			{TOKEN_FOR, parseForLoop},
			{TOKEN_WHILE, parseWhileLoop},
			{TOKEN_REPEAT, parseRepeatLoop},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})
}

func parseAssignmentOrFBInvocation(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseAssignment},
			{TOKEN_ASSIGN, parseAssignment},
			{TOKEN_VARIABLE, parseFBInvocation},
			{TOKEN_OPEN_PAREN, parseFBInvocation},
		},
		Options: dsl.ParseOptions{Peek: true, Multiple: true, Optional: true},
	})
}

func parseAssignment(p *dsl.Parser) {
	p.AddNode(NODE_ASSIGNMENT)
	parseVariable(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_ASSIGN, nil}}})
	p.SkipToken() // Skip ASSIGN
	parseExpression(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_SEMICOLON, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseFBInvocation(p *dsl.Parser) {
	p.AddNode(NODE_FB_INVOCATION)
	parseVariable(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_OPEN_PAREN, nil}}})
	p.SkipToken() // Skip OPEN_PAREN

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseParameter},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_CLOSE_PAREN, nil}}})
	p.SkipToken()

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_SEMICOLON, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseParameter(p *dsl.Parser) {
	p.AddNode(NODE_PARAMETER)
	p.AddTokens() // Add parameter name
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_ASSIGN, nil}}})
	p.SkipToken() // Skip ASSIGN
	parseExpression(p)
	p.WalkUp()
}

func parseExpression(p *dsl.Parser) {
	p.AddNode(NODE_EXPRESSION)
	parseTerm(p)

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_PLUS, parseOperator},
			{TOKEN_MINUS, parseOperator},
			{TOKEN_MULTIPLY, parseOperator},
			{TOKEN_DIVIDE, parseOperator},
			{TOKEN_AND, parseOperator},
			{TOKEN_OR, parseOperator},
			{TOKEN_NOT, parseOperator},
			{TOKEN_GT, parseOperator},
			{TOKEN_LT, parseOperator},
			{TOKEN_GE, parseOperator},
			{TOKEN_LE, parseOperator},
			{TOKEN_EQ, parseOperator},
			{TOKEN_NE, parseOperator},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})

	p.WalkUp()
}

func parseOperator(p *dsl.Parser) {
	p.AddNode(NODE_OPERATOR)
	p.AddTokens()
	p.WalkUp()
	parseTerm(p)
}

func parseTerm(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseVariable},
			{TOKEN_LITERAL, parseLiteral},
			{TOKEN_FUNCTION, parseFunctionCall},
			{TOKEN_OPEN_PAREN, parseParenExpression},
		},
	})
}

func parseVariable(p *dsl.Parser) {
	p.AddNode(NODE_VALUE)
	p.AddTokens()

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_DOT, parseStructMember},
			{TOKEN_LBRACKET, parseArrayAccess},
		},
	})

	p.WalkUp()
}

func parseStructMember(p *dsl.Parser) {
	p.AddNode(NODE_STRUCT_MEMBER)
	p.AddTokens() // Add the original variable
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_DOT, nil}}})
	p.SkipToken() // Skip DOT
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_VARIABLE, nil}}})
	p.AddTokens() // Add the member variable
	p.WalkUp()
}

func parseArrayAccess(p *dsl.Parser) {
	p.AddNode(NODE_ARRAY_ACCESS)
	p.AddTokens() // Add the original variable
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_LBRACKET, nil}}})
	p.SkipToken() // Skip LBRACKET
	parseExpression(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_RBRACKET, nil}}})
	p.SkipToken()
	p.WalkUp()
}

func parseLiteral(p *dsl.Parser) {
	p.AddNode(NODE_VALUE)
	p.AddTokens()
	p.WalkUp()
}

func parseFunctionCall(p *dsl.Parser) {
	p.AddNode(NODE_FUNCTION_CALL)
	p.SkipToken() // Skip FUNCTION
	p.AddTokens() // Add function name
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_OPEN_PAREN, nil}}})
	p.SkipToken()

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_VARIABLE, parseExpression},
			{TOKEN_LITERAL, parseExpression},
			{TOKEN_FUNCTION, parseExpression},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_CLOSE_PAREN, nil}}})
	p.SkipToken()

	p.WalkUp()
}

func parseParenExpression(p *dsl.Parser) {
	p.SkipToken() // Skip OPEN_PAREN
	parseExpression(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_CLOSE_PAREN, nil}}})
	p.SkipToken()
}

func parseIfStatement(p *dsl.Parser) {
	p.AddNode(NODE_IF_STATEMENT)
	p.SkipToken() // Skip IF

	p.AddNode(NODE_CONDITION)
	parseExpression(p)
	p.WalkUp()

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_THEN, nil}}})
	p.SkipToken()

	parseStatements(p)

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_ELSIF, parseElsifStatement},
			{TOKEN_ELSE, parseElseStatement},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_IF, nil}}})
	p.SkipToken()

	p.WalkUp()
}

func parseElsifStatement(p *dsl.Parser) {
	p.AddNode(NODE_ELSIF_STATEMENT)
	p.SkipToken() // Skip ELSIF

	p.AddNode(NODE_CONDITION)
	parseExpression(p)
	p.WalkUp()

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_THEN, nil}}})
	p.SkipToken()

	parseStatements(p)
	p.WalkUp()
}

func parseElseStatement(p *dsl.Parser) {
	p.AddNode(NODE_ELSE_STATEMENT)
	p.SkipToken() // Skip ELSE
	parseStatements(p)
	p.WalkUp()
}

func parseForLoop(p *dsl.Parser) {
	p.AddNode(NODE_FOR_LOOP)
	p.SkipToken() // Skip FOR

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_VARIABLE, nil}}})
	p.AddTokens() // Add loop variable
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_ASSIGN, nil}}})
	p.SkipToken()
	parseExpression(p)
	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_TO, nil}}})
	p.SkipToken()
	parseExpression(p)

	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{{TOKEN_BY, parseByExpression}},
		Options:  dsl.ParseOptions{Optional: true},
	})

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_DO, nil}}})
	p.SkipToken()

	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_FOR, nil}}})
	p.SkipToken()

	p.WalkUp()
}

func parseByExpression(p *dsl.Parser) {
	p.SkipToken() // Skip BY
	parseExpression(p)
}

func parseWhileLoop(p *dsl.Parser) {
	p.AddNode(NODE_WHILE_LOOP)
	p.SkipToken() // Skip WHILE

	p.AddNode(NODE_CONDITION)
	parseExpression(p)
	p.WalkUp()

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_DO, nil}}})
	p.SkipToken()

	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_WHILE, nil}}})
	p.SkipToken()

	p.WalkUp()
}

func parseRepeatLoop(p *dsl.Parser) {
	p.AddNode(NODE_REPEAT_LOOP)
	p.SkipToken() // Skip REPEAT

	parseStatements(p)

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_UNTIL, nil}}})
	p.SkipToken()

	p.AddNode(NODE_CONDITION)
	parseExpression(p)
	p.WalkUp()

	p.Expect(dsl.ExpectToken{Branches: []dsl.BranchToken{{TOKEN_END_REPEAT, nil}}})
	p.SkipToken()

	p.WalkUp()
}

func skipNewLines(p *dsl.Parser) {
	p.Expect(dsl.ExpectToken{
		Branches: []dsl.BranchToken{
			{TOKEN_NL, func(p *dsl.Parser) { p.SkipToken() }},
		},
		Options: dsl.ParseOptions{Multiple: true, Optional: true},
	})
}

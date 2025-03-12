package parser_test

import (
	"testing"

	"github.com/hyperdrive/core/apps/runtime/internal/parser"
	"github.com/hyperdrive/core/apps/runtime/internal/parser/ast"
)

type basicType struct {
	typeName string
	pos      ast.Position
}

func (t *basicType) String() string         { return t.typeName }
func (t *basicType) Position() ast.Position { return t.pos }
func (t *basicType) TypeName() string       { return t.typeName }

func TestParser(t *testing.T) {
	code := `
FUNCTION_BLOCK FB_Test
    VAR_INPUT
        in1 : INT;
        in2 : REAL;
    END_VAR
    VAR_OUTPUT
        out1 : BOOL;
    END_VAR
    VAR
        local1 : ARRAY[1..5] OF INT;
        local2 : STRUCT
            x : INT;
            y : REAL;
        END_STRUCT;
    END_VAR

    local1[1] := in1;
    local2.x := REAL_TO_INT(in2);

    IF in1 > 10 AND in2 < 20.5 THEN
        out1 := TRUE;
    ELSIF in1 = 5 THEN
        out1 := FALSE;
    ELSE
        out1 := in1 <> 0;
    END_IF;

    FOR i := 1 TO 5 BY 1 DO
        local1[i] := local1[i] * 2;
    END_FOR;

    WHILE local2.x > 0 DO
        local2.x := local2.x - 1;
    END_WHILE;

    REPEAT
        local2.y := local2.y + 0.1;
    UNTIL local2.y >= 1.0
    END_REPEAT;
END_FUNCTION_BLOCK

FUNCTION Func_Test : INT
    VAR_INPUT
        param1 : INT;
        param2 : REAL;
    END_VAR
    VAR
        result : INT;
    END_VAR

    result := REAL_TO_INT(param2) + param1;
    Func_Test := result * 2;
END_FUNCTION

PROGRAM Main
    VAR
        fb_instance : FB_Test;
        x : INT;
        y : REAL;
    END_VAR

    fb_instance(in1 := 15, in2 := 10.5);
    x := Func_Test(param1 := 5, param2 := 3.14);
    y := SQRT(x) + LN(fb_instance.out1);
END_PROGRAM
`

	program, err := parser.Parse(code)
	if err != nil {
		t.Fatalf("Failed to parse program: %v", err)
	}

	// Verify program structure
	if program.Name != "Main" {
		t.Errorf("Expected program name to be 'Main', got %q", program.Name)
	}

	if program.Type != ast.ProgramPRG {
		t.Errorf("Expected program type to be ProgramPRG, got %v", program.Type)
	}

	// Verify variables
	expectedVars := []*ast.VarDecl{
		{Name: "fb_instance", Type: &basicType{typeName: "FB_Test"}},
		{Name: "x", Type: &basicType{typeName: "INT"}},
		{Name: "y", Type: &basicType{typeName: "REAL"}},
	}

	if len(program.Vars) != len(expectedVars) {
		t.Errorf("Expected %d variables, got %d", len(expectedVars), len(program.Vars))
	}

	for i, v := range expectedVars {
		if i >= len(program.Vars) {
			break
		}
		if program.Vars[i].Name != v.Name {
			t.Errorf("Expected variable %d name to be %q, got %q", i, v.Name, program.Vars[i].Name)
		}
		if program.Vars[i].Type.TypeName() != v.Type.TypeName() {
			t.Errorf("Expected variable %d type to be %q, got %q", i, v.Type.TypeName(), program.Vars[i].Type.TypeName())
		}
	}

	// Verify statements
	if len(program.Body) != 3 {
		t.Errorf("Expected 3 statements in program body, got %d", len(program.Body))
	}

	// Verify first statement (FB invocation)
	if stmt, ok := program.Body[0].(*ast.Assignment); ok {
		if call, ok := stmt.Value.(*ast.CallExpr); ok {
			if call.Function != "fb_instance" {
				t.Errorf("Expected first statement to be fb_instance call, got %q", call.Function)
			}
			if len(call.Args) != 2 {
				t.Errorf("Expected fb_instance call to have 2 arguments, got %d", len(call.Args))
			}
		} else {
			t.Errorf("Expected CallExpr in assignment, got %T", stmt.Value)
		}
	} else {
		t.Errorf("Expected first statement to be Assignment, got %T", program.Body[0])
	}

	// Verify second statement (function call assignment)
	if assign, ok := program.Body[1].(*ast.Assignment); ok {
		if variable, ok := assign.Variable.(*ast.Variable); ok {
			if variable.Name != "x" {
				t.Errorf("Expected second statement to assign to x, got %q", variable.Name)
			}
		} else {
			t.Errorf("Expected variable in assignment, got %T", assign.Variable)
		}
		if call, ok := assign.Value.(*ast.CallExpr); ok {
			if call.Function != "Func_Test" {
				t.Errorf("Expected function call to Func_Test, got %q", call.Function)
			}
		} else {
			t.Errorf("Expected function call in assignment, got %T", assign.Value)
		}
	} else {
		t.Errorf("Expected second statement to be Assignment, got %T", program.Body[1])
	}
}

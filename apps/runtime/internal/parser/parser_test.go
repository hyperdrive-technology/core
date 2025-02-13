package parser_test

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/inrush-io/dsl"
	. "github.com/inrush-io/inrush/apps/runtime/internal/parser"
)

func TestDSL(t *testing.T) {
	reader := bytes.NewBufferString(`
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
`)

	bufreader := bufio.NewReader(reader)
	logfilename := "TestDSL.log"
	logfile, fileErr := os.Create(logfilename)
	if fileErr != nil {
		t.Fatal("Error: Could not create log file " + logfilename + ": " + fileErr.Error())
	}
	ast, errs := dsl.Parse(Parse, Scan, bufreader, dsl.WithLogger(logfile))
	logfile.Close()
	if len(errs) != 0 {
		t.Fail()
		t.Error("Should report exactly 0 errors")
	}

	astJSON, _ := json.Marshal(ast)
	expectedNodes := []byte(`{
  "root": {
    "type": "ROOT",
    "tokens": null,
    "children": [
      {
        "type": "FUNCTION_BLOCK",
        "tokens": [
          {
            "ID": "VARIABLE",
            "Literal": "FB_Test"
          }
        ],
        "children": [
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR_INPUT",
                "Literal": "VAR_INPUT"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "in1"
                  },
                  {
                    "ID": "INT",
                    "Literal": "INT"
                  }
                ],
                "children": null
              },
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "in2"
                  },
                  {
                    "ID": "REAL",
                    "Literal": "REAL"
                  }
                ],
                "children": null
              }
            ]
          },
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR_OUTPUT",
                "Literal": "VAR_OUTPUT"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "out1"
                  },
                  {
                    "ID": "BOOL",
                    "Literal": "BOOL"
                  }
                ],
                "children": null
              }
            ]
          },
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR",
                "Literal": "VAR"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "local1"
                  }
                ],
                "children": [
                  {
                    "type": "VAR_TYPE",
                    "tokens": [
                      {
                        "ID": "ARRAY",
                        "Literal": "ARRAY"
                      },
                      {
                        "ID": "LITERAL",
                        "Literal": "1"
                      },
                      {
                        "ID": "LITERAL",
                        "Literal": "5"
                      },
                      {
                        "ID": "OF",
                        "Literal": "OF"
                      },
                      {
                        "ID": "INT",
                        "Literal": "INT"
                      }
                    ],
                    "children": null
                  }
                ]
              },
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "local2"
                  }
                ],
                "children": [
                  {
                    "type": "VAR_TYPE",
                    "tokens": [
                      {
                        "ID": "STRUCT",
                        "Literal": "STRUCT"
                      }
                    ],
                    "children": [
                      {
                        "type": "VAR",
                        "tokens": [
                          {
                            "ID": "VARIABLE",
                            "Literal": "x"
                          },
                          {
                            "ID": "INT",
                            "Literal": "INT"
                          }
                        ],
                        "children": null
                      },
                      {
                        "type": "VAR",
                        "tokens": [
                          {
                            "ID": "VARIABLE",
                            "Literal": "y"
                          },
                          {
                            "ID": "REAL",
                            "Literal": "REAL"
                          }
                        ],
                        "children": null
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "type": "FUNCTION",
        "tokens": [
          {
            "ID": "VARIABLE",
            "Literal": "Func_Test"
          },
          {
            "ID": "INT",
            "Literal": "INT"
          }
        ],
        "children": [
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR_INPUT",
                "Literal": "VAR_INPUT"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "param1"
                  },
                  {
                    "ID": "INT",
                    "Literal": "INT"
                  }
                ],
                "children": null
              },
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "param2"
                  },
                  {
                    "ID": "REAL",
                    "Literal": "REAL"
                  }
                ],
                "children": null
              }
            ]
          },
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR",
                "Literal": "VAR"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "result"
                  },
                  {
                    "ID": "INT",
                    "Literal": "INT"
                  }
                ],
                "children": null
              }
            ]
          }
        ]
      },
      {
        "type": "PROGRAM",
        "tokens": [
          {
            "ID": "VARIABLE",
            "Literal": "Main"
          }
        ],
        "children": [
          {
            "type": "VAR_BLOCK",
            "tokens": [
              {
                "ID": "VAR",
                "Literal": "VAR"
              }
            ],
            "children": [
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "fb_instance"
                  },
                  {
                    "ID": "VARIABLE",
                    "Literal": "FB_Test"
                  }
                ],
                "children": null
              },
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "x"
                  },
                  {
                    "ID": "INT",
                    "Literal": "INT"
                  }
                ],
                "children": null
              },
              {
                "type": "VAR",
                "tokens": [
                  {
                    "ID": "VARIABLE",
                    "Literal": "y"
                  },
                  {
                    "ID": "REAL",
                    "Literal": "REAL"
                  }
                ],
                "children": null
              }
            ]
          },
          {
            "type": "STATEMENT",
            "tokens": [
              {
                "ID": "VARIABLE",
                "Literal": "fb_instance"
              },
              {
                "ID": "LPAREN",
                "Literal": "("
              },
              {
                "ID": "VARIABLE",
                "Literal": "in1"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "LITERAL",
                "Literal": "15"
              },
              {
                "ID": "COMMA",
                "Literal": ","
              },
              {
                "ID": "VARIABLE",
                "Literal": "in2"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "LITERAL",
                "Literal": "10.5"
              },
              {
                "ID": "RPAREN",
                "Literal": ")"
              }
            ],
            "children": null
          },
          {
            "type": "STATEMENT",
            "tokens": [
              {
                "ID": "VARIABLE",
                "Literal": "x"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "VARIABLE",
                "Literal": "Func_Test"
              },
              {
                "ID": "LPAREN",
                "Literal": "("
              },
              {
                "ID": "VARIABLE",
                "Literal": "param1"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "LITERAL",
                "Literal": "5"
              },
              {
                "ID": "COMMA",
                "Literal": ","
              },
              {
                "ID": "VARIABLE",
                "Literal": "param2"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "LITERAL",
                "Literal": "3.14"
              },
              {
                "ID": "RPAREN",
                "Literal": ")"
              }
            ],
            "children": null
          },
          {
            "type": "STATEMENT",
            "tokens": [
              {
                "ID": "VARIABLE",
                "Literal": "y"
              },
              {
                "ID": "ASSIGN",
                "Literal": ":="
              },
              {
                "ID": "FUNCTION",
                "Literal": "SQRT"
              },
              {
                "ID": "LPAREN",
                "Literal": "("
              },
              {
                "ID": "VARIABLE",
                "Literal": "x"
              },
              {
                "ID": "RPAREN",
                "Literal": ")"
              },
              {
                "ID": "PLUS",
                "Literal": "+"
              },
              {
                "ID": "FUNCTION",
                "Literal": "LN"
              },
              {
                "ID": "LPAREN",
                "Literal": "("
              },
              {
                "ID": "VARIABLE",
                "Literal": "fb_instance"
              },
              {
                "ID": "DOT",
                "Literal": "."
              },
              {
                "ID": "VARIABLE",
                "Literal": "out1"
              },
              {
                "ID": "RPAREN",
                "Literal": ")"
              }
            ],
            "children": null
          }
        ]
      }
    ]
  }
}`)

	expectJSON(t, expectedNodes, astJSON)
}

// expectJSON returns an assertion function that compares the expected and
// actual JSON payloads.
func expectJSON(t *testing.T, expected []byte, actual []byte) {

	t.Helper()

	var a, e map[string]any
	if err := json.Unmarshal(expected, &e); err != nil {
		t.Fatalf("error unmarshaling expected json payload: %v", err)
	}

	if err := json.Unmarshal(actual, &a); err != nil {
		t.Fatalf("error unmarshaling actual json payload: %v", err)
	}

	if diff := cmp.Diff(e, a); diff != "" {
		t.Errorf(diff)
	}

}

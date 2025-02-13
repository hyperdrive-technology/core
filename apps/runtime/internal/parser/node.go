package parser

import (
	"github.com/inrush-io/dsl"
)

const (
	NODE_FUNCTION_BLOCK  dsl.NodeType = "FUNCTION_BLOCK"
	NODE_FUNCTION        dsl.NodeType = "FUNCTION"
	NODE_PROGRAM         dsl.NodeType = "PROGRAM"
	NODE_VAR_BLOCK       dsl.NodeType = "VAR_BLOCK"
	NODE_VAR             dsl.NodeType = "VAR"
	NODE_VAR_TYPE        dsl.NodeType = "VAR_TYPE"
	NODE_ASSIGNMENT      dsl.NodeType = "ASSIGNMENT"
	NODE_FB_INVOCATION   dsl.NodeType = "FB_INVOCATION"
	NODE_PARAMETER       dsl.NodeType = "PARAMETER"
	NODE_EXPRESSION      dsl.NodeType = "EXPRESSION"
	NODE_OPERATOR        dsl.NodeType = "OPERATOR"
	NODE_VALUE           dsl.NodeType = "VALUE"
	NODE_STRUCT_MEMBER   dsl.NodeType = "STRUCT_MEMBER"
	NODE_ARRAY_ACCESS    dsl.NodeType = "ARRAY_ACCESS"
	NODE_FUNCTION_CALL   dsl.NodeType = "FUNCTION_CALL"
	NODE_IF_STATEMENT    dsl.NodeType = "IF_STATEMENT"
	NODE_CONDITION       dsl.NodeType = "CONDITION"
	NODE_ELSIF_STATEMENT dsl.NodeType = "ELSIF_STATEMENT"
	NODE_ELSE_STATEMENT  dsl.NodeType = "ELSE_STATEMENT"
	NODE_FOR_LOOP        dsl.NodeType = "FOR_LOOP"
	NODE_WHILE_LOOP      dsl.NodeType = "WHILE_LOOP"
	NODE_REPEAT_LOOP     dsl.NodeType = "REPEAT_LOOP"
	NODE_UNTIL_CONDITION dsl.NodeType = "UNTIL_CONDITION"
)

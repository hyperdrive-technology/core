package parser

import (
	"github.com/inrush-io/inrush/apps/runtime/internal/parser/dsl"
)

var recovering bool

func Scan(s *dsl.Scanner) dsl.Token {
	if recovering {
		s.ExpectNot(dsl.ExpectNotRune{
			Runes: []rune{
				rune(0),
				'\n',
			},
			Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})
		s.Match([]dsl.Match{{"", "UNKNOWN"}})
		return s.Exit()
	}

	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{' ', whitespace},
			{'\t', whitespace}},
		Options: dsl.ExpectRuneOptions{Optional: true}})
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'-', nil},
			{'+', nil},
			{'*', nil},
			{'/', nil},
			{'(', nil},
			{')', nil},
			{'\n', nil},
			{':', assign},
			{';', nil},
			{'\'', comment},
			{'"', stringliteral},
			{'[', nil},
			{']', nil},
			{'.', dotOrDotDot},
			{',', nil},
			{'<', lessThan},
			{'>', greaterThan},
			{'=', equals},
			{rune(0), eof}},
		BranchRanges: []dsl.BranchRange{
			{'0', '9', literal},
			{'A', 'Z', keywordOrVariable},
			{'a', 'z', keywordOrVariable}}})
	s.Match([]dsl.Match{
		{"-", TOKEN_MINUS},
		{"+", TOKEN_PLUS},
		{"*", TOKEN_MULTIPLY},
		{"/", TOKEN_DIVIDE},
		{"(", TOKEN_OPEN_PAREN},
		{")", TOKEN_CLOSE_PAREN},
		{":", TOKEN_COLON},
		{";", TOKEN_SEMICOLON},
		{"\n", TOKEN_NL},
		{"[", TOKEN_LBRACKET},
		{"]", TOKEN_RBRACKET},
		{".", TOKEN_DOT},
		{",", TOKEN_COMMA},
	})
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{' ', nil},
			{'\t', nil}},
		Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})
	return s.Exit()
}

func eof(s *dsl.Scanner) {
	s.Match([]dsl.Match{{"", "EOF"}})
}

func whitespace(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{' ', nil},
			{'\t', nil}},
		Options: dsl.ExpectRuneOptions{Optional: true, Multiple: true}})
}

func keywordOrVariable(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'_', nil}},
		BranchRanges: []dsl.BranchRange{
			{'A', 'Z', nil},
			{'a', 'z', nil},
			{'0', '9', nil}},
		Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})
	s.Match([]dsl.Match{
		{"FUNCTION_BLOCK", TOKEN_FUNCTION_BLOCK},
		{"END_FUNCTION_BLOCK", TOKEN_END_FUNCTION_BLOCK},
		{"FUNCTION", TOKEN_FUNCTION},
		{"END_FUNCTION", TOKEN_END_FUNCTION},
		{"PROGRAM", TOKEN_PROGRAM},
		{"END_PROGRAM", TOKEN_END_PROGRAM},
		{"VAR_INPUT", TOKEN_VAR_INPUT},
		{"VAR_OUTPUT", TOKEN_VAR_OUTPUT},
		{"VAR", TOKEN_VAR},
		{"END_VAR", TOKEN_END_VAR},
		{"BOOL", TOKEN_BOOL},
		{"INT", TOKEN_INT},
		{"REAL", TOKEN_REAL},
		{"STRING", TOKEN_STRING},
		{"ARRAY", TOKEN_ARRAY},
		{"OF", TOKEN_OF},
		{"STRUCT", TOKEN_STRUCT},
		{"END_STRUCT", TOKEN_END_STRUCT},
		{"IF", TOKEN_IF},
		{"THEN", TOKEN_THEN},
		{"ELSIF", TOKEN_ELSIF},
		{"ELSE", TOKEN_ELSE},
		{"END_IF", TOKEN_END_IF},
		{"FOR", TOKEN_FOR},
		{"TO", TOKEN_TO},
		{"BY", TOKEN_BY},
		{"DO", TOKEN_DO},
		{"END_FOR", TOKEN_END_FOR},
		{"WHILE", TOKEN_WHILE},
		{"END_WHILE", TOKEN_END_WHILE},
		{"REPEAT", TOKEN_REPEAT},
		{"UNTIL", TOKEN_UNTIL},
		{"END_REPEAT", TOKEN_END_REPEAT},
		{"AND", TOKEN_AND},
		{"OR", TOKEN_OR},
		{"NOT", TOKEN_NOT},
		{"TRUE", TOKEN_LITERAL},
		{"FALSE", TOKEN_LITERAL},
		{"", TOKEN_VARIABLE},
	})
}

func literal(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		BranchRanges: []dsl.BranchRange{
			{'0', '9', nil}},
		Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})

	s.Peek([]dsl.BranchString{{
		String: "..",
		Fn: func(s *dsl.Scanner) {
			s.Match([]dsl.Match{{"", TOKEN_LITERAL}})
		},
	}})

	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'.', fraction}},
		Options: dsl.ExpectRuneOptions{Optional: true}})

	s.Match([]dsl.Match{{"", TOKEN_LITERAL}})
}

func stringliteral(s *dsl.Scanner) {
	s.SkipRune()
	s.ExpectNot(dsl.ExpectNotRune{
		Runes: []rune{
			'"',
		},
		Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})
	s.Match([]dsl.Match{{"", "UNKNOWN"}})
	s.SkipRune()
	s.Match([]dsl.Match{{"", TOKEN_LITERAL}})
}

func dotOrDotDot(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{{
			Rn: '.',
			Fn: func(s *dsl.Scanner) {
				s.Match([]dsl.Match{{".", TOKEN_DOTDOT}})
			},
		}},
		Options: dsl.ExpectRuneOptions{Optional: true},
	})
	s.Match([]dsl.Match{{".", TOKEN_DOT}})
}

func fraction(s *dsl.Scanner) {

	s.Expect(dsl.ExpectRune{
		BranchRanges: []dsl.BranchRange{
			{'0', '9', nil}},
		Options: dsl.ExpectRuneOptions{Multiple: true}})
	s.Match([]dsl.Match{{"", TOKEN_LITERAL}})
}

func assign(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'=', (func(s *dsl.Scanner) { s.Match([]dsl.Match{{":=", TOKEN_ASSIGN}}) })},
		},
		Options: dsl.ExpectRuneOptions{Optional: true},
	})
	s.Match([]dsl.Match{{":", TOKEN_COLON}})
}

func comment(s *dsl.Scanner) {
	s.SkipRune()
	s.ExpectNot(dsl.ExpectNotRune{
		Runes: []rune{
			rune(0),
			'\n',
		},
		Options: dsl.ExpectRuneOptions{Multiple: true, Optional: true}})
	s.Match([]dsl.Match{{"", TOKEN_COMMENT}})
}

func lessThan(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'=', (func(s *dsl.Scanner) { s.Match([]dsl.Match{{"<=", TOKEN_LE}}) })},
			{'>', (func(s *dsl.Scanner) { s.Match([]dsl.Match{{"<>", TOKEN_NE}}) })},
		},
		Options: dsl.ExpectRuneOptions{Optional: true},
	})
	s.Match([]dsl.Match{{"<", TOKEN_LT}})
}

func greaterThan(s *dsl.Scanner) {
	s.Expect(dsl.ExpectRune{
		Branches: []dsl.Branch{
			{'=', (func(s *dsl.Scanner) { s.Match([]dsl.Match{{">=", TOKEN_GE}}) })},
		},
		Options: dsl.ExpectRuneOptions{Optional: true},
	})
	s.Match([]dsl.Match{{">", TOKEN_GT}})
}

func equals(s *dsl.Scanner) {
	s.Match([]dsl.Match{{"=", TOKEN_EQ}})
}

import { CstNode, IToken } from 'chevrotain';
import type {
  Argument,
  Assignment,
  BinaryExpression,
  BinaryOperator,
  CaseStatement,
  ElementAccess,
  EnumType,
  EnumValue,
  Expression,
  ForStatement,
  FunctionBlock,
  FunctionCallExpression,
  FunctionDef,
  IfStatement,
  LeftExpression,
  ParenExpression,
  PrimaryExpression,
  Program,
  ProgramBody,
  ProgramDecl,
  RepeatStatement,
  ReturnStatement,
  Statement,
  TypeDecl,
  UnaryExpression,
  UnaryOperator,
  VarDeclaration,
  VariableDecl,
  VariableReference,
  WhileStatement,
} from './ast';

interface IEC61131CstNode extends CstNode {
  name: string;
  children: {
    [key: string]: (CstNode | IToken)[];
  };
}

export class IEC61131Visitor {
  visit(cst: IEC61131CstNode): Program {
    return {
      $type: 'Program',
      enumTypes: this.visitEnumTypes(cst),
      functionBlocks: this.visitFunctionBlocks(cst),
      functions: this.visitFunctions(cst),
      programs: this.visitPrograms(cst),
    };
  }

  private visitEnumTypes(cst: IEC61131CstNode): EnumType[] {
    const enumTypes: EnumType[] = [];
    if (cst.children?.enumType) {
      for (const enumType of cst.children.enumType) {
        enumTypes.push(this.visitEnumType(enumType as IEC61131CstNode));
      }
    }
    return enumTypes;
  }

  private visitEnumType(cst: IEC61131CstNode): EnumType {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const enumValues: EnumValue[] = [];

    if (cst.children?.IDENTIFIER.length > 1) {
      for (let i = 1; i < cst.children.IDENTIFIER.length; i++) {
        enumValues.push({
          $type: 'EnumValue',
          name: (cst.children.IDENTIFIER[i] as IToken).image,
        });
      }
    }

    return {
      $type: 'EnumType',
      name,
      enumValues,
    };
  }

  private visitFunctionBlocks(cst: IEC61131CstNode): FunctionBlock[] {
    const functionBlocks: FunctionBlock[] = [];
    if (cst.children?.functionBlock) {
      for (const fb of cst.children.functionBlock) {
        functionBlocks.push(this.visitFunctionBlock(fb as IEC61131CstNode));
      }
    }
    return functionBlocks;
  }

  private visitFunctionBlock(cst: IEC61131CstNode): FunctionBlock {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const varDeclarations = this.visitVarDeclarations(cst);
    const body = this.visitProgramBody(cst);

    return {
      $type: 'FunctionBlock',
      name,
      varDeclarations,
      body,
    };
  }

  private visitFunctions(cst: IEC61131CstNode): FunctionDef[] {
    const functions: FunctionDef[] = [];
    if (cst.children?.functionDef) {
      for (const func of cst.children.functionDef) {
        functions.push(this.visitFunctionDef(func as IEC61131CstNode));
      }
    }
    return functions;
  }

  private visitFunctionDef(cst: IEC61131CstNode): FunctionDef {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const returnType = this.visitDataType(
      cst.children?.dataType?.[0] as IEC61131CstNode
    );
    const varDeclarations = this.visitVarDeclarations(cst);
    const body = this.visitProgramBody(cst);

    return {
      $type: 'FunctionDef',
      name,
      returnType,
      varDeclarations,
      body,
    };
  }

  private visitPrograms(cst: IEC61131CstNode): ProgramDecl[] {
    const programs: ProgramDecl[] = [];
    if (cst.children?.programDecl) {
      for (const prog of cst.children.programDecl) {
        programs.push(this.visitProgramDecl(prog as IEC61131CstNode));
      }
    }
    return programs;
  }

  private visitProgramDecl(cst: IEC61131CstNode): ProgramDecl {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const varDeclarations = this.visitVarDeclarations(cst);
    const body = this.visitProgramBody(cst);

    return {
      $type: 'ProgramDecl',
      name,
      varDeclarations,
      body,
    };
  }

  private visitVarDeclarations(cst: IEC61131CstNode): VarDeclaration[] {
    const varDeclarations: VarDeclaration[] = [];
    if (cst.children?.varDeclaration) {
      for (const varDecl of cst.children.varDeclaration) {
        varDeclarations.push(
          this.visitVarDeclaration(varDecl as IEC61131CstNode)
        );
      }
    }
    return varDeclarations;
  }

  private visitVarDeclaration(cst: IEC61131CstNode): VarDeclaration {
    const variables: VariableDecl[] = [];
    if (cst.children?.varDeclLine) {
      for (const line of cst.children.varDeclLine) {
        variables.push(this.visitVarDeclLine(line as IEC61131CstNode));
      }
    }
    return {
      $type: 'VarDeclaration',
      variables,
    };
  }

  private visitVarDeclLine(cst: IEC61131CstNode): VariableDecl {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const type = this.visitDataType(
      cst.children?.dataType?.[0] as IEC61131CstNode
    );
    const initialValue = cst.children?.expression?.[0]
      ? this.visitExpression(cst.children.expression[0] as IEC61131CstNode)
      : undefined;

    return {
      $type: 'VariableDecl',
      name,
      type,
      initialValue,
    };
  }

  private visitDataType(cst: IEC61131CstNode | undefined): TypeDecl {
    if (!cst) {
      return { $type: 'SimpleType', name: 'VOID' };
    }

    if (cst.children?.IDENTIFIER) {
      return {
        $type: 'SimpleType',
        name: (cst.children.IDENTIFIER[0] as IToken).image,
      };
    }

    if (cst.children?.arrayType) {
      return this.visitArrayType(cst.children.arrayType[0] as IEC61131CstNode);
    }

    throw new Error('Unknown data type');
  }

  private visitArrayType(cst: IEC61131CstNode): TypeDecl {
    // Implementation depends on your array type syntax
    throw new Error('Array type not implemented yet');
  }

  private visitProgramBody(cst: IEC61131CstNode): ProgramBody {
    const statements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        statements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }
    return {
      $type: 'ProgramBody',
      statements,
    };
  }

  private visitStatement(cst: IEC61131CstNode): Statement {
    if (cst.children?.assignmentStmt) {
      return this.visitAssignmentStmt(
        cst.children.assignmentStmt[0] as IEC61131CstNode
      );
    }
    if (cst.children?.ifStmt) {
      return this.visitIfStmt(cst.children.ifStmt[0] as IEC61131CstNode);
    }
    if (cst.children?.whileStmt) {
      return this.visitWhileStmt(cst.children.whileStmt[0] as IEC61131CstNode);
    }
    if (cst.children?.repeatStmt) {
      return this.visitRepeatStmt(
        cst.children.repeatStmt[0] as IEC61131CstNode
      );
    }
    if (cst.children?.forStmt) {
      return this.visitForStmt(cst.children.forStmt[0] as IEC61131CstNode);
    }
    if (cst.children?.caseStmt) {
      return this.visitCaseStmt(cst.children.caseStmt[0] as IEC61131CstNode);
    }
    if (cst.children?.returnStmt) {
      return this.visitReturnStmt(
        cst.children.returnStmt[0] as IEC61131CstNode
      );
    }
    throw new Error('Unknown statement type');
  }

  private visitAssignmentStmt(cst: IEC61131CstNode): Assignment {
    const target = this.visitLeftExpression(
      cst.children.leftExpression[0] as IEC61131CstNode
    );
    const value = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );
    return {
      $type: 'Assignment',
      target,
      value,
    };
  }

  private visitLeftExpression(cst: IEC61131CstNode): LeftExpression {
    const elements = (cst.children.elementAccess || []).map((access) =>
      this.visitElementAccess(access as IEC61131CstNode)
    );

    return {
      $type: 'LeftExpression',
      elements,
    };
  }

  private visitElementAccess(cst: IEC61131CstNode): ElementAccess {
    const member = (cst.children.IDENTIFIER[0] as IToken).image;
    const index = cst.children.expression?.[0]
      ? this.visitExpression(cst.children.expression[0] as IEC61131CstNode)
      : undefined;

    return {
      $type: 'ElementAccess',
      member,
      index,
    };
  }

  private visitIfStmt(cst: IEC61131CstNode): IfStatement {
    const condition = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );

    // Get then statements
    const thenStatements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        thenStatements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }

    // ELSIF branches are handled differently in CST, adjust as needed
    const elseIfConditions: Expression[] = [];
    const elseIfStatements: Statement[] = []; // Change to flat array

    // ELSE branch
    const elseStatements: Statement[] = [];
    // Process ELSE statements if they exist
    if (cst.children?.ELSE) {
      // Find statements after ELSE token
      // Implementation depends on CST structure
    }

    return {
      $type: 'IfStatement',
      condition,
      thenStatements,
      elseIfConditions,
      elseIfStatements,
      elseStatements,
    };
  }

  private visitWhileStmt(cst: IEC61131CstNode): WhileStatement {
    const condition = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );

    // Get statements directly from the statement children
    const statements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        statements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }

    return {
      $type: 'WhileStatement',
      condition,
      statements,
    };
  }

  private visitRepeatStmt(cst: IEC61131CstNode): RepeatStatement {
    const condition = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );

    // Get statements directly
    const statements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        statements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }

    return {
      $type: 'RepeatStatement',
      condition,
      statements,
    };
  }

  private visitForStmt(cst: IEC61131CstNode): ForStatement {
    const variable = (cst.children?.IDENTIFIER[0] as IToken).image;
    const start = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );
    const end = this.visitExpression(
      cst.children.expression[1] as IEC61131CstNode
    );
    const step = cst.children.expression[2]
      ? this.visitExpression(cst.children.expression[2] as IEC61131CstNode)
      : undefined;

    // Get statements directly
    const statements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        statements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }

    return {
      $type: 'ForStatement',
      variable,
      start,
      end,
      step,
      statements,
    };
  }

  private visitCaseStmt(cst: IEC61131CstNode): CaseStatement {
    const expression = this.visitExpression(
      cst.children?.expression[0] as IEC61131CstNode
    );

    const caseLabels: Expression[] = [];
    const caseStatements: Statement[] = [];

    const defaultStatements: Statement[] = [];
    if (cst.children?.ELSE && cst.children?.statement) {
      const elseIndex = cst.children.ELSE.indexOf(cst.children.ELSE[0]);
      if (elseIndex !== -1 && cst.children.statement.length > elseIndex) {
        for (let i = elseIndex; i < cst.children.statement.length; i++) {
          defaultStatements.push(
            this.visitStatement(cst.children.statement[i] as IEC61131CstNode)
          );
        }
      }
    }

    if (cst.children?.expression && cst.children.expression.length > 1) {
      for (let i = 1; i < cst.children.expression.length; i++) {
        caseLabels.push(
          this.visitExpression(cst.children.expression[i] as IEC61131CstNode)
        );

        if (cst.children?.statement && i < cst.children.statement.length) {
          caseStatements.push(
            this.visitStatement(
              cst.children.statement[i - 1] as IEC61131CstNode
            )
          );
        }
      }
    }

    return {
      $type: 'CaseStatement',
      expression,
      caseLabels,
      caseStatements,
      defaultStatements,
    };
  }

  private visitReturnStmt(cst: IEC61131CstNode): ReturnStatement {
    const value = cst.children.expression?.[0]
      ? this.visitExpression(cst.children.expression[0] as IEC61131CstNode)
      : undefined;

    return {
      $type: 'ReturnStatement',
      value,
    };
  }

  private visitExpression(cst: IEC61131CstNode): Expression {
    if (cst.children?.binaryExpr) {
      return this.visitBinaryExpr(
        cst.children.binaryExpr[0] as IEC61131CstNode
      );
    }
    if (cst.children?.unaryExpr) {
      return this.visitUnaryExpr(cst.children.unaryExpr[0] as IEC61131CstNode);
    }
    if (cst.children?.functionCall) {
      return this.visitFunctionCall(
        cst.children.functionCall[0] as IEC61131CstNode
      );
    }
    if (cst.children?.parenExpr) {
      return this.visitParenExpr(cst.children.parenExpr[0] as IEC61131CstNode);
    }
    if (cst.children?.IDENTIFIER) {
      return this.visitVariableRef(cst);
    }
    return this.visitPrimaryExpression(cst);
  }

  private visitBinaryExpr(cst: IEC61131CstNode): BinaryExpression {
    const left = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    ) as PrimaryExpression;
    const right = this.visitExpression(
      cst.children.expression[1] as IEC61131CstNode
    );
    const operator = (cst.children.operator[0] as IToken)
      .image as BinaryOperator;

    return {
      $type: 'BinaryExpression',
      left,
      operator,
      right,
    };
  }

  private visitUnaryExpr(cst: IEC61131CstNode): UnaryExpression {
    const operand = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    ) as PrimaryExpression;
    const operator = (cst.children.operator[0] as IToken)
      .image as UnaryOperator;

    return {
      $type: 'UnaryExpression',
      operator,
      operand,
    };
  }

  private visitFunctionCall(cst: IEC61131CstNode): FunctionCallExpression {
    const functionName = (cst.children?.IDENTIFIER[0] as IToken).image;

    // Process arguments
    const args: Argument[] = [];
    if (cst.children?.argumentList) {
      const argListNode = cst.children.argumentList[0] as IEC61131CstNode;
      if (argListNode.children?.argument) {
        for (const arg of argListNode.children.argument) {
          args.push(this.visitArgument(arg as IEC61131CstNode));
        }
      }
    }

    return {
      $type: 'FunctionCallExpression',
      call: {
        $type: 'Call',
        func: undefined, // Will be resolved during semantic analysis
        args,
      },
    };
  }

  private visitParenExpr(cst: IEC61131CstNode): ParenExpression {
    return {
      $type: 'ParenExpression',
      expr: this.visitExpression(cst.children.expression[0] as IEC61131CstNode),
    };
  }

  private visitVariableRef(cst: IEC61131CstNode): VariableReference {
    const elements = (cst.children.elementAccess || []).map((access) =>
      this.visitElementAccess(access as IEC61131CstNode)
    );

    return {
      $type: 'VariableReference',
      elements,
    };
  }

  private visitPrimaryExpression(cst: IEC61131CstNode): PrimaryExpression {
    if (cst.children?.NUMBER) {
      return {
        $type: 'Literal',
        value: Number((cst.children.NUMBER[0] as IToken).image),
      };
    }
    if (cst.children?.STRING) {
      return {
        $type: 'Literal',
        value: (cst.children.STRING[0] as IToken).image,
      };
    }
    if (cst.children?.DIRECT_ADDRESS) {
      return {
        $type: 'Literal',
        value: (cst.children.DIRECT_ADDRESS[0] as IToken).image,
      };
    }
    if (cst.children?.TRUE) {
      return {
        $type: 'Literal',
        value: true,
      };
    }
    if (cst.children?.FALSE) {
      return {
        $type: 'Literal',
        value: false,
      };
    }
    if (cst.children?.functionCall) {
      const functionCall = cst.children.functionCall[0] as IEC61131CstNode;
      const name = (functionCall.children.IDENTIFIER[0] as IToken).image;
      const args: Argument[] = [];

      // Process arguments
      if (functionCall.children?.argumentList) {
        const argListNode = functionCall.children
          .argumentList[0] as IEC61131CstNode;
        if (argListNode.children?.argument) {
          for (const argNode of argListNode.children.argument) {
            const arg = argNode as IEC61131CstNode;
            let value: Expression;
            let name: string | undefined;

            // Check for named argument
            if (arg.children?.IDENTIFIER && arg.children?.ASSIGN) {
              name = (arg.children.IDENTIFIER[0] as IToken).image;

              // Handle direct address
              if (arg.children.DIRECT_ADDRESS) {
                value = {
                  $type: 'Literal',
                  value: (arg.children.DIRECT_ADDRESS[0] as IToken).image,
                };
              }
              // Handle expression
              else if (arg.children.expression) {
                value = this.visitExpression(
                  arg.children.expression[0] as IEC61131CstNode
                );
              } else {
                throw new Error('Missing value for named argument');
              }
            }
            // Handle positional argument
            else {
              // Direct address
              if (arg.children?.DIRECT_ADDRESS) {
                value = {
                  $type: 'Literal',
                  value: (arg.children.DIRECT_ADDRESS[0] as IToken).image,
                };
              }
              // Expression
              else if (arg.children?.expression) {
                value = this.visitExpression(
                  arg.children.expression[0] as IEC61131CstNode
                );
              } else {
                throw new Error('Missing value for positional argument');
              }
            }

            args.push({
              $type: 'Argument',
              name,
              value,
            });
          }
        }
      }

      return {
        $type: 'FunctionCallExpression',
        call: {
          $type: 'Call',
          args,
        },
      };
    }

    // Handle variable access
    if (cst.children?.variableAccess) {
      return this.visitVariableRef(
        cst.children.variableAccess[0] as IEC61131CstNode
      );
    }

    // Handle parenthesized expression
    if (
      cst.children?.LPAREN &&
      cst.children?.expression &&
      cst.children?.RPAREN
    ) {
      return {
        $type: 'ParenExpression',
        expr: this.visitExpression(
          cst.children.expression[0] as IEC61131CstNode
        ),
      };
    }

    throw new Error('Unknown primary expression type');
  }

  private visitArgument(cst: IEC61131CstNode): Argument {
    // Check if we have a named parameter (paramName label)
    const paramName = cst.children?.paramName?.[0] as IToken;
    const name = paramName ? paramName.image : undefined;

    // Get the argument value - either direct address or expression
    let value: Expression;

    if (cst.children?.DIRECT_ADDRESS) {
      // Direct address as value
      value = {
        $type: 'Literal',
        value: (cst.children.DIRECT_ADDRESS[0] as IToken).image,
      };
    } else if (cst.children?.expression) {
      // Expression as value
      value = this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    } else {
      throw new Error('Missing value for argument');
    }

    return {
      $type: 'Argument',
      name,
      value,
    };
  }
}

export const visitor = new IEC61131Visitor();

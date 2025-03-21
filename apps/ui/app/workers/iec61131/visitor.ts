import { CstNode, IToken } from 'chevrotain';
import type {
  Argument,
  ArrayDimension,
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
  SimpleType,
  Statement,
  TypeDecl,
  TypeDeclaration,
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
    console.log('Starting CST to AST conversion with visitor');

    try {
      // Create the Program node
      const program: Program = {
        $type: 'Program',
        enumTypes: this.visitEnumTypes(cst),
        structTypes: this.visitStructTypes(cst),
        functionBlocks: this.visitFunctionBlocks(cst),
        functions: this.visitFunctions(cst),
        programs: this.visitPrograms(cst),
      };

      console.log('AST conversion completed successfully');
      return program;
    } catch (error) {
      console.error('Error in visitor:', error);
      // Add more context to the error if possible
      if (error instanceof Error) {
        console.error(
          'CST node structure at error location:',
          JSON.stringify(cst.children, null, 2).substring(0, 500) + '...'
        );
      }
      throw error;
    }
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

  private visitStructTypes(cst: IEC61131CstNode): any[] {
    const structTypes: any[] = [];
    if (cst.children?.structType) {
      for (const structType of cst.children.structType) {
        structTypes.push(this.visitStructType(structType as IEC61131CstNode));
      }
    }
    return structTypes;
  }

  private visitStructType(cst: IEC61131CstNode): any {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    const members: any[] = [];

    // Process struct members
    if (cst.children?.IDENTIFIER && cst.children.IDENTIFIER.length > 1) {
      const dataTypes = cst.children?.dataType || [];
      const expressions = cst.children?.expression || [];

      for (let i = 1; i < cst.children.IDENTIFIER.length; i++) {
        const memberName = (cst.children.IDENTIFIER[i] as IToken).image;
        const memberType = dataTypes[i - 1]
          ? this.visitDataType(dataTypes[i - 1] as IEC61131CstNode)
          : { $type: 'SimpleType', name: 'UNKNOWN' };
        const initialValue = expressions[i - 1]
          ? this.visitExpression(expressions[i - 1] as IEC61131CstNode)
          : undefined;

        members.push({
          $type: 'StructMember',
          name: memberName,
          type: memberType,
          initialValue,
        });
      }
    }

    return {
      $type: 'StructType',
      name,
      members,
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

    // Default void return type
    let returnType: TypeDecl = {
      $type: 'SimpleType',
      name: 'VOID',
    };

    if (cst.children?.dataType && cst.children.dataType.length > 0) {
      returnType = this.visitDataType(
        cst.children.dataType[0] as IEC61131CstNode
      );
    }

    const varDeclarations = this.visitVarDeclarations(cst);

    // Process inner type declarations
    const innerTypes: TypeDeclaration[] = [];
    if (cst.children?.innerTypeDeclaration) {
      for (const innerType of cst.children.innerTypeDeclaration) {
        innerTypes.push(
          this.visitInnerTypeDeclaration(innerType as IEC61131CstNode)
        );
      }
    }

    const statements: Statement[] = [];
    if (cst.children?.statement) {
      for (const stmt of cst.children.statement) {
        statements.push(this.visitStatement(stmt as IEC61131CstNode));
      }
    }

    return {
      $type: 'FunctionDef',
      name,
      returnType,
      varDeclarations,
      innerTypes, // Add inner types to function definition
      body: {
        $type: 'ProgramBody',
        statements,
      },
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

    let initialValue: Expression | undefined;

    // Check for range constraints
    let rangeStart: Expression | undefined;
    let rangeEnd: Expression | undefined;

    if (cst.children?.rangeStart?.[0]) {
      rangeStart = this.visitExpression(
        cst.children.rangeStart[0] as IEC61131CstNode
      );
    }

    if (cst.children?.rangeEnd?.[0]) {
      rangeEnd = this.visitExpression(
        cst.children.rangeEnd[0] as IEC61131CstNode
      );
    }

    // Add range constraints to the type if present
    if (rangeStart && rangeEnd && type.$type === 'SimpleType') {
      type.rangeConstraint = {
        start: rangeStart,
        end: rangeEnd,
      };
    }

    // Check for arrayInitializer
    if (cst.children?.arrayInitializer) {
      initialValue = this.visitArrayInitializer(
        cst.children.arrayInitializer[0] as IEC61131CstNode
      );
    } else if (cst.children?.expression?.[0]) {
      initialValue = this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    }

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

    // Handle direct type keywords (like TON, TOF, TP)
    // Check for timer types directly in the CST node
    if (cst.children?.TON || cst.children?.TOF || cst.children?.TP) {
      const timerType = cst.children?.TON
        ? 'TON'
        : cst.children?.TOF
        ? 'TOF'
        : 'TP';

      return {
        $type: 'SimpleType',
        name: timerType,
      };
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
    // Get array dimensions (start and end ranges)
    const startExpr = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );
    const endExpr = this.visitExpression(
      cst.children.expression[1] as IEC61131CstNode
    );

    // Get element type
    const elementType = this.visitDataType(
      cst.children.dataType[0] as IEC61131CstNode
    );

    // Extract dimension values, ensuring they are of the correct type
    let startValue: number | string = 0;
    let endValue: number | string = 0;

    if (startExpr.$type === 'Literal') {
      const val = startExpr.value;
      startValue =
        typeof val === 'number' ? val : typeof val === 'string' ? val : 0;
    }

    if (endExpr.$type === 'Literal') {
      const val = endExpr.value;
      endValue =
        typeof val === 'number' ? val : typeof val === 'string' ? val : 0;
    }

    // Create an array dimension
    const dimension: ArrayDimension = {
      $type: 'ArrayDimension',
      start: startValue,
      end: endValue,
    };

    return {
      $type: 'ArrayType',
      dimensions: [dimension],
      type: elementType,
    };
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
    if (cst.children?.functionCall) {
      const functionCallExpr = this.visitFunctionCall(
        cst.children.functionCall[0] as IEC61131CstNode
      );
      // Convert FunctionCallExpression to FunctionCall statement
      return {
        $type: 'FunctionCall',
        call: functionCallExpr.call,
      };
    }
    if (cst.children?.returnStmt) {
      return this.visitReturnStmt(
        cst.children.returnStmt[0] as IEC61131CstNode
      );
    }
    if (cst.children?.typeDeclaration) {
      return this.visitTypeDeclaration(
        cst.children.typeDeclaration[0] as IEC61131CstNode
      );
    }
    throw new Error('Unknown statement type');
  }

  private visitAssignmentStmt(cst: IEC61131CstNode): Assignment {
    console.log('Visiting assignment statement:', JSON.stringify(cst.children));

    let target: LeftExpression;

    // Handle direct identifiers
    if (cst.children?.IDENTIFIER) {
      const varName = (cst.children.IDENTIFIER[0] as IToken).image;
      target = {
        $type: 'LeftExpression',
        elements: [
          {
            $type: 'ElementAccess',
            member: varName,
          },
        ],
      };

      // Handle dot access if present (for member access)
      if (cst.children.DOT && cst.children.IDENTIFIER.length > 1) {
        for (let i = 1; i < cst.children.IDENTIFIER.length; i++) {
          target.elements.push({
            $type: 'ElementAccess',
            member: (cst.children.IDENTIFIER[i] as IToken).image,
          });
        }
      }
    }
    // Handle direct addresses
    else if (cst.children?.DIRECT_ADDRESS) {
      const address = (cst.children.DIRECT_ADDRESS[0] as IToken).image;
      target = {
        $type: 'LeftExpression',
        elements: [
          {
            $type: 'ElementAccess',
            member: address,
          },
        ],
      };
    }
    // Use the regular left expression if available
    else if (cst.children?.leftExpression) {
      target = this.visitLeftExpression(
        cst.children.leftExpression[0] as IEC61131CstNode
      );
    } else {
      console.error('Invalid assignment target:', JSON.stringify(cst.children));
      throw new Error('Invalid assignment target');
    }

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

    // Handle numeric case labels
    if (cst.children?.NUMBER) {
      for (const numToken of cst.children.NUMBER) {
        caseLabels.push({
          $type: 'Literal',
          value: Number((numToken as IToken).image),
        });
      }
    }

    // Handle expression case labels
    if (cst.children?.expression && cst.children.expression.length > 1) {
      for (let i = 1; i < cst.children.expression.length; i++) {
        caseLabels.push(
          this.visitExpression(cst.children.expression[i] as IEC61131CstNode)
        );
      }
    }

    // Process all statements for each case branch
    // This is a simplification as we're not tracking which statements belong to which label
    const defaultStatements: Statement[] = [];

    if (cst.children?.statement) {
      // If ELSE is present, put statements after ELSE into defaultStatements
      if (cst.children?.ELSE) {
        const elseIndex = cst.children.statement.findIndex((_, index) => {
          return (
            index > 0 &&
            cst.children?.ELSE &&
            cst.children.ELSE.some(
              (elseToken) =>
                (elseToken as IToken).startOffset <
                (cst.children?.statement[index] as any).location?.startOffset
            )
          );
        });

        if (elseIndex !== -1) {
          // Statements before ELSE go into case statements
          for (let i = 0; i < elseIndex; i++) {
            caseStatements.push(
              this.visitStatement(cst.children.statement[i] as IEC61131CstNode)
            );
          }

          // Statements after ELSE go into default statements
          for (let i = elseIndex; i < cst.children.statement.length; i++) {
            defaultStatements.push(
              this.visitStatement(cst.children.statement[i] as IEC61131CstNode)
            );
          }
        } else {
          // If we can't determine the ELSE position, put all statements in case statements
          for (const stmt of cst.children.statement) {
            caseStatements.push(this.visitStatement(stmt as IEC61131CstNode));
          }
        }
      } else {
        // If there's no ELSE, all statements are case statements
        for (const stmt of cst.children.statement) {
          caseStatements.push(this.visitStatement(stmt as IEC61131CstNode));
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

  private visitTypeDeclaration(cst: IEC61131CstNode): Statement {
    const identifier = (cst.children?.IDENTIFIER[0] as IToken).image;
    let dataType: SimpleType | undefined;
    let initialValue: Expression | undefined;

    // Check if we have a data type defined
    if (cst.children?.dataType?.[0]) {
      dataType = this.visitDataType(
        cst.children.dataType[0] as IEC61131CstNode
      ) as SimpleType;
    }

    // Check if we have an initial value
    if (cst.children?.expression?.[0]) {
      initialValue = this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    }

    return {
      $type: 'TypeDeclaration',
      name: identifier,
      dataType,
      initialValue,
    };
  }

  private visitExpression(cst: IEC61131CstNode): Expression {
    // Handle expression hierarchical structure
    if (cst.children?.orExpression) {
      return this.visitOrExpression(
        cst.children.orExpression[0] as IEC61131CstNode
      );
    }

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

  private visitOrExpression(cst: IEC61131CstNode): Expression {
    // Handle AND expressions first
    if (cst.children?.andExpression) {
      return this.visitAndExpression(
        cst.children.andExpression[0] as IEC61131CstNode
      );
    }

    // If we have multiple OR expressions, they should be structured as binary expressions
    if (cst.children?.orExpression && cst.children?.OR) {
      const left = this.visitOrExpression(
        cst.children.orExpression[0] as IEC61131CstNode
      );
      const right = this.visitAndExpression(
        cst.children.andExpression[0] as IEC61131CstNode
      );

      return {
        $type: 'BinaryExpression',
        left: left as PrimaryExpression,
        operator: 'OR',
        right,
      };
    }

    // Default case - just return the AND expression
    return this.visitAndExpression(
      cst.children?.andExpression[0] as IEC61131CstNode
    );
  }

  private visitAndExpression(cst: IEC61131CstNode): Expression {
    // Check if we have relational expressions
    if (cst.children?.relationalExpression) {
      return this.visitRelationalExpression(
        cst.children.relationalExpression[0] as IEC61131CstNode
      );
    }

    // If we have multiple AND expressions, they should be structured as binary expressions
    if (cst.children?.andExpression && cst.children?.AND) {
      const left = this.visitAndExpression(
        cst.children.andExpression[0] as IEC61131CstNode
      );
      const right = this.visitRelationalExpression(
        cst.children.relationalExpression[0] as IEC61131CstNode
      );

      return {
        $type: 'BinaryExpression',
        left: left as PrimaryExpression,
        operator: 'AND',
        right,
      };
    }

    // Default case - just return the relational expression
    return this.visitRelationalExpression(
      cst.children?.relationalExpression[0] as IEC61131CstNode
    );
  }

  private visitRelationalExpression(cst: IEC61131CstNode): Expression {
    // Handle additive expressions first
    if (cst.children?.additiveExpression) {
      const additiveExprs = cst.children.additiveExpression;

      // If we have a single additive expression, just visit it
      if (additiveExprs.length === 1) {
        return this.visitAdditiveExpression(
          additiveExprs[0] as IEC61131CstNode
        );
      }

      // If we have a relational operator (=, <>, <, >, etc.) and two additive expressions
      if (additiveExprs.length === 2 && cst.children?.relationalOp) {
        const left = this.visitAdditiveExpression(
          additiveExprs[0] as IEC61131CstNode
        );
        const right = this.visitAdditiveExpression(
          additiveExprs[1] as IEC61131CstNode
        );
        const operator = (cst.children.relationalOp[0] as IToken)
          .image as BinaryOperator;

        return {
          $type: 'BinaryExpression',
          left: left as PrimaryExpression,
          operator,
          right,
        };
      }
    }

    // If we didn't match a specific pattern, try to visit the additive expression
    if (cst.children?.additiveExpression) {
      return this.visitAdditiveExpression(
        cst.children.additiveExpression[0] as IEC61131CstNode
      );
    }

    // If we don't have any additive expressions, this is probably an error
    console.error(
      'Unable to process relational expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error('Invalid relational expression structure');
  }

  private visitAdditiveExpression(cst: IEC61131CstNode): Expression {
    // Check if we have multiplicative expressions
    if (cst.children?.multiplicativeExpression) {
      const multExprs = cst.children.multiplicativeExpression;

      // If we have a single multiplicative expression, just visit it
      if (multExprs.length === 1) {
        return this.visitMultiplicativeExpression(
          multExprs[0] as IEC61131CstNode
        );
      }

      // If we have an additive operator (+, -) and two multiplicative expressions
      if (multExprs.length === 2 && cst.children?.additiveOp) {
        const left = this.visitMultiplicativeExpression(
          multExprs[0] as IEC61131CstNode
        );
        const right = this.visitMultiplicativeExpression(
          multExprs[1] as IEC61131CstNode
        );
        const operator = (cst.children.additiveOp[0] as IToken)
          .image as BinaryOperator;

        return {
          $type: 'BinaryExpression',
          left: left as PrimaryExpression,
          operator,
          right,
        };
      }
    }

    // If we didn't match a specific pattern, try to visit the multiplicative expression
    if (cst.children?.multiplicativeExpression) {
      return this.visitMultiplicativeExpression(
        cst.children.multiplicativeExpression[0] as IEC61131CstNode
      );
    }

    // If we don't have any multiplicative expressions, this is probably an error
    console.error(
      'Unable to process additive expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error('Invalid additive expression structure');
  }

  private visitMultiplicativeExpression(cst: IEC61131CstNode): Expression {
    // Check if we have unary expressions
    if (cst.children?.unaryExpression) {
      const unaryExprs = cst.children.unaryExpression;

      // If we have a single unary expression, just visit it
      if (unaryExprs.length === 1) {
        return this.visitNestedUnaryExpr(unaryExprs[0] as IEC61131CstNode);
      }

      // If we have a multiplicative operator (*, /, MOD) and two unary expressions
      if (unaryExprs.length === 2 && cst.children?.multiplicativeOp) {
        const left = this.visitNestedUnaryExpr(
          unaryExprs[0] as IEC61131CstNode
        );
        const right = this.visitNestedUnaryExpr(
          unaryExprs[1] as IEC61131CstNode
        );
        const operator = (cst.children.multiplicativeOp[0] as IToken)
          .image as BinaryOperator;

        return {
          $type: 'BinaryExpression',
          left: left as PrimaryExpression,
          operator,
          right,
        };
      }
    }

    // If we didn't match a specific pattern, try to visit the unary expression
    if (cst.children?.unaryExpression) {
      return this.visitNestedUnaryExpr(
        cst.children.unaryExpression[0] as IEC61131CstNode
      );
    }

    // If we don't have any unary expressions, this is probably an error
    console.error(
      'Unable to process multiplicative expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error('Invalid multiplicative expression structure');
  }

  private visitNestedUnaryExpr(cst: IEC61131CstNode): Expression {
    // Check if we have a unary operator (NOT, -)
    if (cst.children?.unaryOp) {
      const operator = (cst.children.unaryOp[0] as IToken)
        .image as UnaryOperator;
      const operand = this.visitNestedPrimaryExpr(
        cst.children.primaryExpression[0] as IEC61131CstNode
      );

      return {
        $type: 'UnaryExpression',
        operator,
        operand: operand as PrimaryExpression,
      };
    }

    // If we don't have a unary operator, just visit the primary expression
    if (cst.children?.primaryExpression) {
      return this.visitNestedPrimaryExpr(
        cst.children.primaryExpression[0] as IEC61131CstNode
      );
    }

    // If we don't have a primary expression, this is probably an error
    console.error(
      'Unable to process unary expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error('Invalid unary expression structure');
  }

  private visitNestedPrimaryExpr(cst: IEC61131CstNode): Expression {
    // Handle number literals
    if (cst.children?.NUMBER) {
      const numberToken = cst.children.NUMBER[0] as IToken;
      return {
        $type: 'Literal',
        value: Number(numberToken.image),
      };
    }

    // Handle string literals
    if (cst.children?.STRING) {
      const stringToken = cst.children.STRING[0] as IToken;
      return {
        $type: 'Literal',
        value: stringToken.image,
      };
    }

    // Handle time literals
    if (cst.children?.TIME_LITERAL) {
      const timeToken = cst.children.TIME_LITERAL[0] as IToken;
      return {
        $type: 'Literal',
        value: timeToken.image,
      };
    }

    // Handle array access
    if (cst.children?.arrayAccess) {
      return this.visitArrayAccess(
        cst.children.arrayAccess[0] as IEC61131CstNode
      );
    }

    // Handle enum references
    if (cst.children?.ENUM_REFERENCE) {
      const enumRef = (cst.children.ENUM_REFERENCE[0] as IToken).image;
      return {
        $type: 'EnumReference',
        value: enumRef,
      };
    }

    // Handle variable references
    if (cst.children?.IDENTIFIER) {
      return {
        $type: 'VariableReference',
        elements: [
          {
            $type: 'ElementAccess',
            member: (cst.children.IDENTIFIER[0] as IToken).image,
          },
        ],
      };
    }

    // Handle boolean literals
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

    // Handle parenthesized expressions (LPAREN, expression, RPAREN)
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

    // Handle parenthesized expressions via parenExpr rule
    if (cst.children?.parenExpr) {
      return this.visitParenExpr(cst.children.parenExpr[0] as IEC61131CstNode);
    }

    // Handle function calls
    if (cst.children?.functionCall) {
      return this.visitFunctionCall(
        cst.children.functionCall[0] as IEC61131CstNode
      );
    }

    // Handle direct addresses as literals
    if (cst.children?.DIRECT_ADDRESS) {
      const addressToken = cst.children.DIRECT_ADDRESS[0] as IToken;
      return {
        $type: 'Literal',
        value: addressToken.image,
      };
    }

    // Handle variableAccess
    if (cst.children?.variableAccess) {
      return this.visitVariableAccess(
        cst.children.variableAccess[0] as IEC61131CstNode
      );
    }

    // If we get here, we have an expression type we can't handle
    console.error(
      'Unknown nested primary expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error(
      `Unknown nested primary expression type: ${Object.keys(
        cst.children || {}
      ).join(', ')}`
    );
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
    let functionName: string;
    let objectName: string | undefined;
    let memberName: string | undefined;

    // Check if we have a direct function call or an object method call
    if (cst.children?.objectName && cst.children?.memberName) {
      // This is an object method call with dot notation (e.g., timer.Q)
      objectName = (cst.children.objectName[0] as IToken).image;
      memberName = (cst.children.memberName[0] as IToken).image;
      functionName = `${objectName}.${memberName}`;

      // For timers, we might not have a function call with parentheses
      // Example: InletDelay.Q doesn't require arguments
      if (!cst.children?.functionArgument) {
        return {
          $type: 'FunctionCallExpression',
          call: {
            $type: 'Call',
            func: undefined,
            args: [],
            object: objectName,
            member: memberName,
          },
        };
      }
    } else if (cst.children?.functionName) {
      // This is a direct function call
      functionName = (cst.children.functionName[0] as IToken).image;
    } else {
      console.error(
        'Function call missing identifier:',
        JSON.stringify(cst.children, null, 2)
      );

      // Use a default name for logging/debugging purposes
      functionName = 'unknown';

      // If we have a name property and it's an IToken with an image property
      if (
        cst.children?.name &&
        cst.children.name[0] &&
        'image' in cst.children.name[0]
      ) {
        functionName = (cst.children.name[0] as IToken).image;
      }
    }

    // Process arguments
    const args: Argument[] = [];
    if (cst.children?.functionArgument) {
      for (const argNode of cst.children.functionArgument) {
        args.push(this.visitFunctionArgument(argNode as IEC61131CstNode));
      }
    }

    return {
      $type: 'FunctionCallExpression',
      call: {
        $type: 'Call',
        func: undefined, // Will be resolved during semantic analysis, keep as undefined
        args,
        object: objectName,
        member: memberName,
      },
    };
  }

  private visitFunctionArgument(cst: IEC61131CstNode): Argument {
    // Check if we have a named or positional argument
    if (cst.children?.namedArgument) {
      return this.visitNamedArgument(
        cst.children.namedArgument[0] as IEC61131CstNode
      );
    } else if (cst.children?.positionalArgument) {
      return this.visitPositionalArgument(
        cst.children.positionalArgument[0] as IEC61131CstNode
      );
    } else {
      throw new Error('Invalid function argument structure');
    }
  }

  private visitNamedArgument(cst: IEC61131CstNode): Argument {
    const name = (cst.children?.paramName[0] as IToken).image;
    const value = this.visitArgumentValue(
      cst.children?.value[0] as IEC61131CstNode
    );

    return {
      $type: 'Argument',
      name,
      value,
    };
  }

  private visitPositionalArgument(cst: IEC61131CstNode): Argument {
    const value = this.visitArgumentValue(
      cst.children?.value[0] as IEC61131CstNode
    );

    return {
      $type: 'Argument',
      name: undefined,
      value,
    };
  }

  private visitArgumentValue(cst: IEC61131CstNode): Expression {
    if (cst.children?.timeLiteral) {
      return {
        $type: 'Literal',
        value: (cst.children.timeLiteral[0] as IToken).image,
      };
    } else if (cst.children?.directAddress) {
      return {
        $type: 'Literal',
        value: (cst.children.directAddress[0] as IToken).image,
      };
    } else if (cst.children?.expression) {
      return this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    } else {
      throw new Error('Invalid argument value');
    }
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

  private visitPrimaryExpression(cst: IEC61131CstNode): Expression {
    // Handle number literals
    if (cst.children?.NUMBER) {
      const numberToken = cst.children.NUMBER[0] as IToken;
      return {
        $type: 'Literal',
        value: Number(numberToken.image),
      };
    }

    // Handle string literals
    if (cst.children?.STRING) {
      const stringToken = cst.children.STRING[0] as IToken;
      return {
        $type: 'Literal',
        value: stringToken.image,
      };
    }

    // Handle time literals
    if (cst.children?.TIME_LITERAL) {
      const timeToken = cst.children.TIME_LITERAL[0] as IToken;
      return {
        $type: 'Literal',
        value: timeToken.image,
      };
    }

    // Handle variable references
    if (cst.children?.IDENTIFIER) {
      return {
        $type: 'VariableReference',
        elements: [
          {
            $type: 'ElementAccess',
            member: (cst.children.IDENTIFIER[0] as IToken).image,
          },
        ],
      };
    }

    // Handle boolean literals
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

    // Handle parenthesized expressions (LPAREN, expression, RPAREN)
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

    // Handle parenthesized expressions via parenExpr rule
    if (cst.children?.parenExpr) {
      return this.visitParenExpr(cst.children.parenExpr[0] as IEC61131CstNode);
    }

    // Handle function calls
    if (cst.children?.functionCall) {
      return this.visitFunctionCall(
        cst.children.functionCall[0] as IEC61131CstNode
      );
    }

    // Handle direct addresses as literals
    if (cst.children?.DIRECT_ADDRESS) {
      const addressToken = cst.children.DIRECT_ADDRESS[0] as IToken;
      return {
        $type: 'Literal',
        value: addressToken.image,
      };
    }

    // Handle variableAccess
    if (cst.children?.variableAccess) {
      return this.visitVariableAccess(
        cst.children.variableAccess[0] as IEC61131CstNode
      );
    }

    // If we get here, we have an expression type we can't handle
    console.error(
      'Unknown primary expression:',
      JSON.stringify(cst.children, null, 2)
    );
    throw new Error(
      `Unknown primary expression type: ${Object.keys(cst.children || {}).join(
        ', '
      )}`
    );
  }

  private visitVariableAccess(cst: IEC61131CstNode): VariableReference {
    console.log('Visiting variable access:', JSON.stringify(cst.children));

    const elements: ElementAccess[] = [];

    if (cst.children?.IDENTIFIER) {
      // Add the first identifier as the base variable
      elements.push({
        $type: 'ElementAccess',
        member: (cst.children.IDENTIFIER[0] as IToken).image,
      });

      // Process array indices and dot-accessed members
      let identifierIndex = 1;

      // Check if we have expressions (for array indices)
      if (cst.children.expression) {
        for (let i = 0; i < cst.children.expression.length; i++) {
          const indexExpr = this.visitExpression(
            cst.children.expression[i] as IEC61131CstNode
          );

          // Last element is the array being indexed
          const lastElement = elements[elements.length - 1];
          lastElement.index = indexExpr;
        }
      }

      // Add additional identifiers as dot-accessed members
      if (cst.children.IDENTIFIER.length > 1) {
        for (let i = 1; i < cst.children.IDENTIFIER.length; i++) {
          elements.push({
            $type: 'ElementAccess',
            member: (cst.children.IDENTIFIER[i] as IToken).image,
          });
        }
      }
    }

    return {
      $type: 'VariableReference',
      elements: elements,
    };
  }

  private visitArrayAccess(cst: IEC61131CstNode): Expression {
    const arrayName = (cst.children.IDENTIFIER[0] as IToken).image;
    const indexExpr = this.visitExpression(
      cst.children.expression[0] as IEC61131CstNode
    );

    return {
      $type: 'ArrayAccess',
      array: {
        $type: 'VariableReference',
        elements: [
          {
            $type: 'ElementAccess',
            member: arrayName,
          },
        ],
      },
      index: indexExpr,
    };
  }

  private visitArrayInitializer(cst: IEC61131CstNode): Expression {
    // If we have a simple expression, just return that
    if (!cst.children?.LBRACKET) {
      return this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    }

    // Otherwise, handle the array initializer
    const elements: Expression[] = [];

    // Process all expressions as array elements
    if (cst.children?.expression) {
      for (const expr of cst.children.expression) {
        elements.push(this.visitExpression(expr as IEC61131CstNode));
      }
    }

    return {
      $type: 'ArrayInitializer',
      elements,
    };
  }

  // Helper method for inner type declarations inside functions
  private visitInnerTypeDeclaration(cst: IEC61131CstNode): TypeDeclaration {
    const name = (cst.children?.IDENTIFIER[0] as IToken).image;
    let dataType: SimpleType | undefined;
    let initialValue: Expression | undefined;

    if (cst.children?.dataType?.[0]) {
      dataType = this.visitDataType(
        cst.children.dataType[0] as IEC61131CstNode
      ) as SimpleType;
    }

    if (cst.children?.expression?.[0]) {
      initialValue = this.visitExpression(
        cst.children.expression[0] as IEC61131CstNode
      );
    }

    return {
      $type: 'TypeDeclaration',
      name,
      dataType,
      initialValue,
    };
  }
}

export const visitor = new IEC61131Visitor();

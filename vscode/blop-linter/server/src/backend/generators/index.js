import { createLiteralGenerators } from './literals.js';
import { createExpressionGenerators } from './expressions.js';
import { createLoopGenerators } from './loops.js';
import { createConditionalGenerators } from './conditionals.js';
import { createFunctionGenerators } from './functions.js';
import { createImportGenerators } from './imports.js';
import { createVirtualNodeGenerators } from './virtualNode.js';
import { createStatementGenerators } from './statements.js';

function createBackendHandlers(context) {
  return {
    ...createLiteralGenerators(context),
    ...createExpressionGenerators(context),
    ...createLoopGenerators(context),
    ...createConditionalGenerators(context),
    ...createFunctionGenerators(context),
    ...createImportGenerators(context),
    ...createVirtualNodeGenerators(context),
    ...createStatementGenerators(context),
  };
}

export {
  createBackendHandlers,
};

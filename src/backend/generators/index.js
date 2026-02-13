const { createLiteralGenerators } = require('./literals');
const { createExpressionGenerators } = require('./expressions');
const { createLoopGenerators } = require('./loops');
const { createConditionalGenerators } = require('./conditionals');
const { createFunctionGenerators } = require('./functions');
const { createImportGenerators } = require('./imports');
const { createVirtualNodeGenerators } = require('./virtualNode');
const { createStatementGenerators } = require('./statements');

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

module.exports = {
  createBackendHandlers,
};

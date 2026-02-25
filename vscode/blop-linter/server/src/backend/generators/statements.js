import { SCOPE_TYPES, SCOPE_DEPTH, ERROR_MESSAGES, BUILTIN_TYPES } from '../../constants.js';

function createStatementGenerators(context) {
  const { generateCode, validators, scopes, typeAliases, hasBlopImports, genericTypeParams, checkFilename } = context;
  const { checkRedefinition, shouldBeDefined, generateError, getExports } = validators;

  const currentScopeVN = () => scopes.type(SCOPE_TYPES.VIRTUAL_NODE);
  
  /**
   * Validate that a type name is defined (built-in, locally defined, or imported)
   * @param {string} typeName - The type name to validate
   * @param {Object} token - The token for error reporting
   */
  function validateTypeName(typeName, token) {
    // Skip validation if no type name
    if (!typeName || typeof typeName !== 'string') {
      return;
    }
    
    // If the file has .blop imports, skip validation for unknown types
    // The inference system will validate imported types properly
    if (hasBlopImports && hasBlopImports.value) {
      return;
    }
    
    // Check if it's a built-in type
    if (BUILTIN_TYPES.has(typeName)) {
      return;
    }
    
    // Check if it's a generic type parameter currently in scope
    if (genericTypeParams) {
      for (let i = genericTypeParams.length - 1; i >= 0; i--) {
        if (genericTypeParams[i].has(typeName)) {
          return;
        }
      }
    }
    
    // Check if it's a locally defined type alias
    if (typeAliases[typeName]) {
      return;
    }
    
    // Check if it starts with { (object type literal)
    if (typeName.startsWith('{')) {
      // It's an inline object type, validate each property type
      // For now, we'll allow any object type literal
      return;
    }
    
    // Check if it's an array type like string[] or Array<string>
    if (typeName.endsWith('[]') || typeName.includes('<')) {
      // Extract the base type and validate it
      const baseType = typeName.replace(/\[\]$/, '').replace(/<.*>/, '');
      if (baseType && !BUILTIN_TYPES.has(baseType) && !typeAliases[baseType]) {
        generateError(token, ERROR_MESSAGES.UNDEFINED_TYPE(baseType));
      }
      return;
    }
    
    // Check if it's a union type (contains |)
    if (typeName.includes('|')) {
      // Validate each type in the union
      const types = typeName.split('|').map(t => t.trim());
      types.forEach(t => validateTypeName(t, token));
      return;
    }
    
    // Type is not recognized
    generateError(token, ERROR_MESSAGES.UNDEFINED_TYPE(typeName));
  }

  return {
    'EOS': () => [],
    'annotation': (node) => {
      // Validate type annotations
      if (node.named && node.named.type) {
        const typeExprNode = node.named.type;
        // Extract type name from the type expression
        // type_expression -> type_primary -> type_name -> name (token)
        if (typeExprNode.children && typeExprNode.children[0]) {
          const typePrimaryNode = typeExprNode.children[0];
          if (typePrimaryNode.type === 'type_primary' && typePrimaryNode.named && typePrimaryNode.named.name) {
            // typePrimaryNode.named.name is the type_name node
            const typeNameNode = typePrimaryNode.named.name;
            // Extract the actual name token
            let typeNameToken = null;
            if (typeNameNode.type === 'name' || typeNameNode.type === 'type_name') {
              // If it's already a name token or a type_name node
              if (typeNameNode.value) {
                // It's a token, use it directly
                typeNameToken = typeNameNode;
              } else if (typeNameNode.children && typeNameNode.children[0]) {
                // It's a type_name node, get its first child (the name token)
                typeNameToken = typeNameNode.children[0];
              }
            }
            
            if (typeNameToken && typeNameToken.value) {
              validateTypeName(typeNameToken.value, typeNameToken);
            }
          }
        }
      }
      return [];
    },
    'type_alias': (node) => {
      // Register the type alias in the context for export/import tracking
      const aliasName = node.named.name.value;
      const aliasTypeNode = node.named.type;
      
      // Store type definition for later use (imports, reflection, etc.)
      typeAliases[aliasName] = {
        node,
        typeNode: aliasTypeNode,
      };
      
      // Register in function scope for export tracking
      const funcScope = scopes.type(SCOPE_TYPES.FUNCTION);
      funcScope.names[aliasName] = { 
        node, 
        token: node.named.name, 
        hoist: false,
        isType: true, // Mark as type for special handling
      };
      
      // TODO: When types become first-class citizens, generate runtime type object
      // For now, no runtime code (types are compile-time only)
      return [];
    },
    'def': () => ['function '],
    'SCOPED_STATEMENT': (node) => {
      const output = [];
      const scope = scopes.currentBlock();
      const alreadyVnode = !!scope.__returnVirtualNode;
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      const parent = currentScopeVN().__currentVNode;
      // small improvement but this doesn't account for normal returns
      // or conditions
      if (!parent && scope.__returnVirtualNode && alreadyVnode) {
        generateError(node, ERROR_MESSAGES.UNREACHABLE_CODE_AFTER_VIRTUAL_NODE(), true);
      }
      return output;
    },
    'assign': (node) => {
      const output = [];
      const scope = scopes.currentBlock();
      
      // Validate type annotation if present
      if (node.named.annotation) {
        generateCode(node.named.annotation);
      }
      
      if (node.named.name) {
        if (!node.named.explicit_assign) {
          checkRedefinition(node.named.name.value, node, node.named.explicit_assign);
          // Register in function scope for hoisting so variable is declared
          const funcScope = scopes.type(SCOPE_TYPES.FUNCTION);
          funcScope.names[node.named.name.value] = { node, token: node.named.name, hoist: true };
        } else {
          // Explicit reassignment (:=) — mark the outer-scope binding as used
          shouldBeDefined(node.named.name.value, node.named.name);
        }
        output.push(...generateCode(node.named.name));
      } else if (node.named.path) {
        // New grammar: exp:path = exp (e.g., this.routes = [], a.b.c = val)
        // Generate the full LHS expression directly
        output.push(...generateCode(node.named.path));
      } else {
        output.push(...generateCode(node.named.destructuring));
      }
      output.push(' = ');
      output.push(...generateCode(node.named.exp));
      output.push(';');
      return output;
    },
    'assign_op': (node) => {
      const output = [];
      shouldBeDefined(node.named.name.value, node.named.name);
      for (let i = 0; i < node.children.length; i++) {
        output.push(...generateCode(node.children[i]));
      }
      return output;
    },
    'break': (node) => {
      if (scopes.filter(SCOPE_TYPES.LOOP).length <= SCOPE_DEPTH.MIN_LOOP_DEPTH) {
        generateError(node, ERROR_MESSAGES.BREAK_OUTSIDE_LOOP());
      }
      return ['break'];
    },
    'continue': (node) => {
      if (scopes.filter(SCOPE_TYPES.LOOP).length <= SCOPE_DEPTH.MIN_LOOP_DEPTH) {
        generateError(node, ERROR_MESSAGES.CONTINUE_OUTSIDE_LOOP());
      }
      return ['continue'];
    },
  };
}

export {
  createStatementGenerators,
};

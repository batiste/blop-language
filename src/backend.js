/**
 * Backend module - code generation for the Blop language
 * 
 * This file now serves as a compatibility layer, re-exporting from the
 * modularized backend structure in src/backend/
 * 
 * The backend has been refactored into:
 * - backend/scopes.js - Scope management
 * - backend/validators.js - Validation and error handling
 * - backend/generators/ - Code generation modules (literals, expressions, loops, etc.)
 * - backend/index.js - Main orchestrator
 */

import { generateCode } from './backend/index.js';

export { generateCode };
export default { generateCode };

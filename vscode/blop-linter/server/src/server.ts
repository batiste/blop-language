/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DiagnosticRelatedInformation,
	Location,
	CodeAction,
	CodeActionKind,
	CodeActionParams,
	Hover,
	MarkupKind
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { tokensDefinition } from './tokensDefinition.js';
import parser from './parser.js';
import { grammar } from './grammar.js';
import { all as builtin } from './builtin.js';
import backend from './backend.js';
import { inference } from './inference/index.js';
import properties from './properties.js';
import { enhanceErrorMessage, formatEnhancedError, displayError, tokenPosition } from './errorMessages.js';
import { selectBestFailure } from './selectBestFailure.js';
import { parseTypeExpression, parseObjectTypeString } from './inference/typeSystem.js';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

// Store diagnostic metadata for code actions
interface DiagnosticMetadata {
	patternName: string;
	tokenStart: number;
	tokenLen: number;
	tokenValue: string;
	quickFix?: any; // Structured edit from errorMessages.js
}
const diagnosticMetadata = new Map<string, DiagnosticMetadata>();

// Cache imported/defined types per document for autocompletion
const documentTypes = new Map<string, string[]>();

// Cache variable types and type definitions per document
interface TypeInfo {
	structure: string; // e.g., "{name: string, id: number}"
}
const documentTypeDefinitions = new Map<string, Map<string, TypeInfo>>(); // uri -> type name -> type info
const documentVariables = new Map<string, Map<string, string>>(); // uri -> variable name -> type name

// Cache AST and token stream per document for hover support
interface DocumentASTInfo {
	tree: any;
	stream: any[];
	typeAliases: Map<string, string>; // type name -> type definition
}
const documentASTs = new Map<string, DocumentASTInfo>(); // uri -> {tree, stream}

/**
 * Extract property names from an object type string
 * e.g., "{name: string, id: number}" -> ["name", "id"]
 */
function extractPropertyNames(objectTypeString: string): string[] {
	if (!objectTypeString || !objectTypeString.startsWith('{') || !objectTypeString.endsWith('}')) {
		return [];
	}
	
	const content = objectTypeString.slice(1, -1).trim();
	if (!content) {
		return [];
	}
	
	const properties: string[] = [];
	const parts = content.split(',');
	
	for (const part of parts) {
		const colonIndex = part.indexOf(':');
		if (colonIndex > 0) {
			let key = part.slice(0, colonIndex).trim();
			// Remove optional marker if present
			if (key.endsWith('?')) {
				key = key.slice(0, -1).trim();
			}
			if (key) {
				properties.push(key);
			}
		}
	}
	
	return properties;
}

/**
 * Extract type aliases from the AST
 */
function extractTypeAliases(node: any, typeAliases: Map<string, string>): void {
	if (!node) return;
	
	// Check if this is a type_alias node
	if (node.type === 'type_alias' && node.named?.name && node.named?.type) {
		const typeName = node.named.name.value;
		const typeExpression = parseTypeExpression(node.named.type);
		if (typeName && typeExpression) {
			typeAliases.set(typeName, typeExpression);
		}
	}
	
	// Recursively walk children
	if (node.children && Array.isArray(node.children)) {
		for (const child of node.children) {
			extractTypeAliases(child, typeAliases);
		}
	}
	
	// Walk named properties
	if (node.named && typeof node.named === 'object') {
		for (const key in node.named) {
			if (node.named[key] && typeof node.named[key] === 'object') {
				extractTypeAliases(node.named[key], typeAliases);
			}
		}
	}
}

/**
 * Walk AST to extract variable declarations with type annotations
 */
function extractVariableTypes(node: any, variableMap: Map<string, string>): void {
	if (!node) return;
	
	// Check if this is an assignment with type annotation
	if (node.type === 'assign' && node.named) {
		if (node.named.name && node.named.annotation) {
			const varName = node.named.name.value;
			const typeAnnotation = parseTypeExpression(node.named.annotation);
			if (varName && typeAnnotation) {
				variableMap.set(varName, typeAnnotation);
			}
		}
	}
	
	// Recursively walk children
	if (node.children && Array.isArray(node.children)) {
		for (const child of node.children) {
			extractVariableTypes(child, variableMap);
		}
	}
	
	// Walk named properties
	if (node.named && typeof node.named === 'object') {
		for (const key in node.named) {
			if (node.named[key] && typeof node.named[key] === 'object') {
				extractVariableTypes(node.named[key], variableMap);
			}
		}
	}
}

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument
		&& capabilities.textDocument.publishDiagnostics
		&& capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true
			},
			// Tell the client that the server supports code actions (quick fixes)
			codeActionProvider: {
				codeActionKinds: [CodeActionKind.QuickFix]
			},
			// Tell the client that the server supports hover
			hoverProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((_event) => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.blopServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'blopServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
	documentSettings.delete(e.document.uri);
	documentTypes.delete(e.document.uri);
	documentTypeDefinitions.delete(e.document.uri);
	documentVariables.delete(e.document.uri);
	documentASTs.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
	validateTextDocument(change.document);
});

interface BlopError extends Error {
	related: {start: number, len: number}
	token: {start: number, len: number}
}

function generateDiagnosis(error: BlopError, textDocument: TextDocument,
	severity: DiagnosticSeverity) {
	const text = textDocument.getText();
	const token = error.token || { start: 0, len: text.length };
	let related: DiagnosticRelatedInformation | null = null;

	if (error.related) {
		const location: Location = {
			uri: textDocument.uri,
			range: {
				start: textDocument.positionAt(error.related.start),
				end: textDocument.positionAt(error.related.start + Math.max(1, error.related.len))
			}
		};
		related = {
			location,
			message: 'This variable is redefined'
		};
	}
	const messageParts = error.message.split('\n');
	const diagnosic: Diagnostic = {
		severity,
		range: {
			start: textDocument.positionAt(token.start),
			end: textDocument.positionAt(token.start + Math.max(1, token.len))
		},
		message: messageParts[0],
		source: 'blop'
	};
	if (related) {
		diagnosic.relatedInformation = [related];
	}

	return diagnosic;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];

	let stream = [];
	try {
		stream = parser.tokenize(tokensDefinition, text);
	} catch (e: any) {
		const token = e.token || { start: 0, end: text.length };
		const diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(token.start + 1),
				end: textDocument.positionAt(text.length),
			},
			message: e.message,
			source: 'blop'
		};
		diagnostics.push(diagnosic);
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		return;
	}

	// @ts-expect-error - parser.parse signature issue
	const tree: any = parser.parse(stream, 0);

	if (!tree.success && settings.maxNumberOfProblems > 0) {
		// Use statistics to select the best failure from the array
		const bestFailure = tree.all_failures 
			? selectBestFailure(tree.all_failures, tree.primary_failure)
			: tree.primary_failure;
		
		if (!bestFailure || !bestFailure.token) {
			// No valid failure info, skip diagnostic
			return;
		}
		
		// Generate enbestFailurced error message for editor (without redundant location/context info)
		const errorParts = enhanceErrorMessage(stream, tokensDefinition, grammar, bestFailure);
		const positions = tokenPosition(bestFailure.token);
		const errorMsg = formatEnhancedError(errorParts, positions, true);

		const token = bestFailure.token;
		const diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(token.start),
				end: textDocument.positionAt(token.start + Math.max(1, token.len))
			},
			message: errorMsg,
			source: 'blop',
			code: errorParts.patternName || 'generic'
		};
		
		// Store metadata for code actions including the quick fix edit instructions
		const metadataKey = `${textDocument.uri}:${token.start}:${token.len}`;
		diagnosticMetadata.set(metadataKey, {
			// @ts-expect-error - patternName can be null
			patternName: errorParts.patternName,
			tokenStart: token.start,
			tokenLen: token.len,
			tokenValue: token.value,
			quickFix: errorParts.quickFix // Store the entire quick fix object with edit instructions
		});
		
		// if (hasDiagnosticRelatedInformationCapability) { }
		diagnostics.push(diagnosic);
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		return;
	}

	if (tree.success && settings.maxNumberOfProblems > 0) {
		// _backend(node, _stream, _input, _filename = false, rootSource, resolve = false)
		// @ts-expect-error - backend types not properly defined
		const result = backend.generateCode(tree, stream, text, textDocument.uri.split(':')[1], undefined, true);

		// Cache type definitions and variable types for autocompletion
		if (result.typeAliases) {
			const typeNames = Object.keys(result.typeAliases);
			documentTypes.set(textDocument.uri, typeNames);
			
			// Store type structures
			const typeDefMap = new Map<string, TypeInfo>();
			for (const [typeName, typeInfo] of Object.entries(result.typeAliases)) {
				if (typeInfo && typeof typeInfo === 'object' && (typeInfo as any).typeNode) {
					const structure = parseTypeExpression((typeInfo as any).typeNode);
					typeDefMap.set(typeName, { structure });
				}
			}
			documentTypeDefinitions.set(textDocument.uri, typeDefMap);
			
			// Extract variable types from AST
			const variableMap = new Map<string, string>();
			extractVariableTypes(tree, variableMap);
			documentVariables.set(textDocument.uri, variableMap);
		}

		if (!result.perfect) {
			result.errors.forEach((error: any) => {
				diagnostics.push(
					generateDiagnosis(error, textDocument, DiagnosticSeverity.Error)
				);
			});
			result.warnings.forEach((error: any) => {
				diagnostics.push(
					generateDiagnosis(error, textDocument, DiagnosticSeverity.Warning)
				);
			});
		}
		
		// Run type inference - this mutates the tree by adding .inference arrays to nodes
		inference(tree, stream, textDocument.uri.split(':')[1]).forEach((warning: any) => {
			diagnostics.push(
				generateDiagnosis(warning, textDocument, DiagnosticSeverity.Warning)
			);
		});
		
		// Extract type aliases from the tree
		const typeAliases = new Map<string, string>();
		extractTypeAliases(tree, typeAliases);
		
		// Store AST and stream for hover support AFTER inference has decorated the tree
		documentASTs.set(textDocument.uri, { tree, stream, typeAliases });
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// Code Actions (Quick Fixes) Handler
connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
	const textDocument = documents.get(params.textDocument.uri);
	if (!textDocument) {
		return [];
	}

	const codeActions: CodeAction[] = [];
	
	// Look at diagnostics in the requested range
	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.source !== 'blop') {
			continue;
		}

		// Look up the stored metadata for this diagnostic
		const text = textDocument.getText();
		const offset = textDocument.offsetAt(diagnostic.range.start);
		const len = textDocument.offsetAt(diagnostic.range.end) - offset;
		const metadataKey = `${params.textDocument.uri}:${offset}:${len}`;
		const metadata = diagnosticMetadata.get(metadataKey);
		
		if (!metadata || !metadata.quickFix || !metadata.quickFix.edit) {
			continue;
		}

		const quickFix = metadata.quickFix;
		const edit = quickFix.edit;
		
		// Apply the structured edit based on its type
		let textEdit;
		
		if (edit.type === 'delete') {
			// Delete the token
			if (edit.range === 'token') {
				textEdit = {
					range: diagnostic.range,
					newText: ''
				};
			}
		} else if (edit.type === 'replace') {
			// Replace the token
			if (edit.range === 'token') {
				textEdit = {
					range: diagnostic.range,
					newText: edit.newText
				};
			}
		} else if (edit.type === 'insert') {
			// Insert text at a specific position
			let insertOffset = offset;
			
			if (edit.position === 'before-token') {
				// Insert before the current token
				insertOffset = offset;
			} else if (edit.position === 'after-previous-token') {
				// Insert after the previous token (find the last non-whitespace character before current position)
				let prevPos = offset - 1;
				while (prevPos >= 0 && /\s/.test(text[prevPos])) {
					prevPos--;
				}
				if (prevPos >= 0) {
					insertOffset = prevPos + 1;
				}
			}
			
			textEdit = {
				range: {
					start: textDocument.positionAt(insertOffset),
					end: textDocument.positionAt(insertOffset)
				},
				newText: edit.text
			};
		}
		
		if (textEdit) {
			const action: CodeAction = {
				title: quickFix.title,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diagnostic],
				edit: {
					changes: {
						[params.textDocument.uri]: [textEdit]
					}
				}
			};
			codeActions.push(action);
		}
	}

	return codeActions;
});

connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		const document = documents.get(_textDocumentPosition.textDocument.uri);
		const line = _textDocumentPosition.position.line;
		if (!document) {
			return [];
		}
		const text = document.getText({
			start: { line, character: 0 },
			end: { line, character: _textDocumentPosition.position.character }
		});
		const kindMap:any = {
			'Function': 3, 'Reference': 18, 'Class': 7, 'Value': 12
		};
		
		// Property completion: after 'varName.'
		const propertyReg = /(\w+)\.(\w*)$/;
		const propertyMatch = propertyReg.exec(text);
		if (propertyMatch) {
			const varName = propertyMatch[1];
			const partial = propertyMatch[2].toLowerCase();
			
			// Look up the variable's type
			const variables = documentVariables.get(_textDocumentPosition.textDocument.uri);
			if (variables && variables.has(varName)) {
				const varType = variables.get(varName);
				
				// Resolve the type to its structure
				const typeDefs = documentTypeDefinitions.get(_textDocumentPosition.textDocument.uri);
				let typeStructure = varType;
				
				// If it's a type alias, resolve it
				if (typeDefs && typeDefs.has(varType!)) {
					const typeInfo = typeDefs.get(varType!);
					if (typeInfo) {
						typeStructure = typeInfo.structure;
					}
				}
				
				// Extract property names from the type structure
				if (typeStructure) {
					const properties = extractPropertyNames(typeStructure);
					return properties
						.filter(prop => prop.toLowerCase().startsWith(partial))
						.map(prop => ({
							label: prop,
							kind: CompletionItemKind.Property,
							detail: `Property of ${varType}`,
							documentation: `${varName}.${prop}`
						}));
				}
			}
		}
		
		// Type annotation completion: after ': '
		const typeAnnotationReg = /:\s*(\w*)$/;
		const typeMatch = typeAnnotationReg.exec(text);
		if (typeMatch) {
			const partial = typeMatch[1].toLowerCase();
			const availableTypes = documentTypes.get(_textDocumentPosition.textDocument.uri) || [];
			const builtinTypes = ['string', 'number', 'boolean', 'any', 'void', 'never', 'object', 'array'];
			const allTypes = [...new Set([...availableTypes, ...builtinTypes])];
			
			return allTypes
				.filter(typeName => typeName.toLowerCase().startsWith(partial))
				.map(typeName => ({
					label: typeName,
					kind: CompletionItemKind.Class,
					detail: builtinTypes.includes(typeName) ? 'Built-in type' : 'Imported/defined type',
					documentation: builtinTypes.includes(typeName) 
						? `Built-in ${typeName} type`
						: `Type defined or imported in this file`
				}));
		}
		
		// Object.<something completion>
		const reg1 = /(\s|^)([\w]+)\./;
		const result = reg1.exec(text);
		if (result) {
			const name = result[2];
			// @ts-expect-error - properties dynamic indexing
			if (properties[name]) {
				const array: any[] = [];
				// @ts-expect-error - properties dynamic indexing
				properties[name].forEach((item: String) => {
					// @ts-expect-error - builtin dynamic indexing
					const builtinForItem = (builtin[item.toString()] || { type: 'Function' });
					const documentation = builtinForItem.documentation;
					const detail = builtinForItem.detail;
					const type = kindMap[builtinForItem.type];
					array.push({
						label: item,
						detail,
						kind: type,
						documentation
					});
				});
				return array;
			}
		}
		// basic builtin 'completion'
		const reg0 = /(\s|^)([\w]{3,})/;
		const result2 = reg0.exec(text);
		if (result2) {
			const name = result2[2];
			// @ts-expect-error - builtin dynamic indexing
			if (builtin[name]) {
				// @ts-expect-error - builtin dynamic indexing
				const builtinForItem = builtin[name];
				const documentation = builtinForItem.documentation;
				const detail = builtinForItem.detail;
				const type = kindMap[builtinForItem.type];
				return [{
					label: name,
					detail,
					kind: type,
					documentation
				}];
			}
		}
		return [];
	}
);

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => item
);

/**
 * Find the AST node at a specific character offset
 * @param node - Current AST node to search
 * @param offset - Character offset in the document
 * @param stream - Token stream
 * @returns The most specific node at that position, or null
 */
function findNodeAtPosition(node: any, offset: number, stream: any[]): any {
	if (!node) return null;
	
	let bestMatch: any = null;
	
	// Recursively search for the most specific node containing this offset
	function search(n: any): void {
		if (!n || n.stream_index === undefined) return;
		
		const token = stream[n.stream_index];
		if (!token) return;
		
		const tokenStart = token.start;
		const tokenEnd = token.start + token.len;
		
		// Check if offset is within this token's range
		if (offset >= tokenStart && offset <= tokenEnd) {
			// This node contains the offset
			// Keep it if we don't have a match or if it's more specific (smaller range)
			if (!bestMatch) {
				bestMatch = n;
			} else {
				const bestToken = stream[bestMatch.stream_index];
				if (token.len < bestToken.len) {
					bestMatch = n;
				}
			}
		}
		
		// Search children regardless of whether parent matches
		// (children might be outside parent's token range)
		if (n.children && Array.isArray(n.children)) {
			for (const child of n.children) {
				search(child);
			}
		}
		
		// Search named properties
		if (n.named && typeof n.named === 'object') {
			for (const key in n.named) {
				const child = n.named[key];
				if (child && typeof child === 'object') {
					search(child);
				}
			}
		}
	}
	
	search(node);
	return bestMatch;
}

/**
 * Try to extract a type name from a type expression node
 */
function extractTypeNameFromExpression(node: any): string | null {
	if (!node) return null;
	
	// If it's a name node, return its value
	if (node.type === 'name') return node.value;
	
	// If it's a type_expression, look for a name child
	if (node.type === 'type_expression' && node.children) {
		for (const child of node.children) {
			if (child.type === 'name') return child.value;
		}
	}
	
	// Try named properties
	if (node.named?.inner && node.named.inner.type === 'name') {
		return node.named.inner.value;
	}
	
	return null;
}

/**
 * Check if a node is an object literal property key and resolve its type
 */
function resolveObjectPropertyKeyType(node: any, tree: any, typeAliases: Map<string, string>): string | null {
	if (!node || (node.type !== 'name' && node.type !== 'str')) return null;
	
	// Get the property name
	let propertyName = node.value;
	if (propertyName && (propertyName.startsWith('"') || propertyName.startsWith("'"))) {
		propertyName = propertyName.slice(1, -1);
	}
	
	if (!propertyName) return null;
	
	// Find the parent assign node
	function findAssignParent(parent: any): any {
		if (!parent) return null;
		if (parent.type === 'assign') {
			// Check if node is a descendant
			if (isDescendantOf(parent, node)) return parent;
		}
		
		// Search from root differently - traverse and check
		if (parent.children) {
			for (const child of parent.children) {
				const result = findAssignParent(child);
				if (result) return result;
			}
		}
		if (parent.named) {
			for (const key in parent.named) {
				const child = parent.named[key];
				if (child && typeof child === 'object') {
					const result = findAssignParent(child);
					if (result) return result;
				}
			}
		}
		return null;
	}
	
	function isDescendantOf(parent: any, target: any): boolean {
		if (!parent) return false;
		if (parent === target) return true;
		
		if (parent.children) {
			for (const child of parent.children) {
				if (isDescendantOf(child, target)) return true;
			}
		}
		
		if (parent.named) {
			for (const key in parent.named) {
				const child = parent.named[key];
				if (child && typeof child === 'object') {
					if (isDescendantOf(child, target)) return true;
				}
			}
		}
		
		return false;
	}
	
	// Start from root
	const assignNode = findAssignParent(tree);
	if (!assignNode || !assignNode.named?.annotation) return null;
	
	// Get the type annotation
	let typeStr = extractTypeNameFromExpression(assignNode.named.annotation);
	if (!typeStr) return null;
	
	// Resolve type alias
	if (typeAliases.has(typeStr)) {
		typeStr = typeAliases.get(typeStr) || '';
	}
	
	// Parse the object type to find this property's type
	if (typeStr && typeStr.startsWith('{') && typeStr.endsWith('}')) {
		const props = parseObjectTypeString(typeStr) as any;
		if (props && props[propertyName]) {
			// Return the property type
			const propType = props[propertyName].type || props[propertyName];
			return typeof propType === 'string' ? propType : null;
		}
	}
	
	return null;
}

/**
/**
 * Find a more specific child node at position when parent is generic (specifically for object literals)
 */
function findMoreSpecificChild(node: any, offset: number, stream: any[]): any {
	if (!node || !node.children) return null;
	
	let bestChild: any = null;
	let bestLen = Infinity;
	
	// For object_literal_body, prioritize name/str nodes that look like property keys
	function search(n: any): void {
		if (!n || n.stream_index === undefined) return;
		
		const token = stream[n.stream_index];
		if (!token) return;
		
		const tokenStart = token.start;
		const tokenEnd = token.start + token.len;
		
		// Check if offset is within this token's range
		if (offset >= tokenStart && offset <= tokenEnd) {
			// Prioritize name and str nodes (likely property keys) over wrapper nodes
			const isKeyNode = n.type === 'name' || n.type === 'str';
			const currentIsKeyNode = bestChild && (bestChild.type === 'name' || bestChild.type === 'str');
			
			if (!bestChild) {
				bestChild = n;
				bestLen = token.len;
			} else if (isKeyNode && !currentIsKeyNode) {
				// Prefer key nodes over non-key nodes
				bestChild = n;
				bestLen = token.len;
			} else if ((isKeyNode && currentIsKeyNode) || (!isKeyNode && !currentIsKeyNode)) {
				// Both are same priority; pick the smaller one
				if (token.len < bestLen) {
					bestChild = n;
					bestLen = token.len;
				}
			}
		}
		
		// Recurse into children
		if (n.children && Array.isArray(n.children)) {
			for (const child of n.children) {
				search(child);
			}
		}
		if (n.named && typeof n.named === 'object') {
			for (const key in n.named) {
				const child = n.named[key];
				if (child && typeof child === 'object') {
					search(child);
				}
			}
		}
	}
	
	search(node);
	return bestChild;
}

/**
 * Widen literal types to their base types for hover display
 * @param type - Type string (might be a literal type)
 * @returns Widened type string
 */
function widenLiteralType(type: string): string {
	// Check if it's a number literal (0, 42, -5, 3.14)
	if (/^-?\d+(\.\d+)?$/.test(type)) {
		return 'number';
	}
	
	// Check if it's a string literal ("hello", 'world')
	if ((type.startsWith('"') && type.endsWith('"')) || 
	    (type.startsWith("'") && type.endsWith("'"))) {
		return 'string';
	}
	
	// Check if it's a boolean literal
	if (type === 'true' || type === 'false') {
		return 'boolean';
	}
	
	return type;
}

/**
 * Find a parent node of a specific type
 * @param node - Starting node
 * @param stream - Token stream
 * @param tree - Root tree to search from
 * @param targetType - Type of parent to find
 * @returns Parent node or null
 */
function findParentNode(node: any, stream: any[], tree: any, targetType: string): any {
	if (!node || !tree) return null;
	
	// Search the entire tree to find which node contains this node as a child
	function searchForParent(currentNode: any): any {
		if (!currentNode) return null;
		
		// Check if this node is the parent we're looking for and contains our target node
		if (currentNode.type === targetType) {
			// Check if node is a descendant of currentNode
			if (isDescendant(currentNode, node)) {
				return currentNode;
			}
		}
		
		// Search children
		if (currentNode.children) {
			for (const child of currentNode.children) {
				const result = searchForParent(child);
				if (result) return result;
			}
		}
		
		// Search named properties
		if (currentNode.named) {
			for (const key in currentNode.named) {
				const child = currentNode.named[key];
				if (child && typeof child === 'object') {
					const result = searchForParent(child);
					if (result) return result;
				}
			}
		}
		
		return null;
	}
	
	function isDescendant(parent: any, target: any): boolean {
		if (!parent) return false;
		if (parent === target) return true;
		
		// Check children
		if (parent.children) {
			for (const child of parent.children) {
				if (isDescendant(child, target)) return true;
			}
		}
		
		// Check named properties
		if (parent.named) {
			for (const key in parent.named) {
				const child = parent.named[key];
				if (child && typeof child === 'object') {
					if (isDescendant(child, target)) return true;
				}
			}
		}
		
		return false;
	}
	
	return searchForParent(tree);
}

/**
 * Check if a node is inside a type annotation and get the type name
 */
function getTypeFromAnnotationContext(node: any, tree: any): string | null {
	if (!node || !tree) return null;
	
	// First, try to extract a simple type name from the node itself
	const extractedName = extractTypeNameFromExpression(node);
	if (extractedName && extractedName !== 'any') {
		return extractedName;
	}
	
	// Search from root to find what assign/func_def this node belongs to
	function searchForAnnotationContext(currentNode: any): string | null {
		if (!currentNode) return null;
		
		// Check if this is an assign and node is inside its annotation
		if (currentNode.type === 'assign' && currentNode.named?.annotation) {
			if (isDescendantOf(currentNode.named.annotation, node)) {
				// Try to extract name from annotation first
				const typeName = extractTypeNameFromExpression(currentNode.named.annotation);
				if (typeName) return typeName;
				// Fallback to parseTypeExpression
				return parseTypeExpression(currentNode.named.annotation);
			}
		}
		
		// Check if this is a func_def and node is inside its annotation
		if (currentNode.type === 'func_def' && currentNode.named?.annotation) {
			if (isDescendantOf(currentNode.named.annotation, node)) {
				const typeName = extractTypeNameFromExpression(currentNode.named.annotation);
				if (typeName) return typeName;
				return parseTypeExpression(currentNode.named.annotation);
			}
		}
		
		// Check params
		if (currentNode.type === 'func_def_param' && currentNode.named?.annotation) {
			if (isDescendantOf(currentNode.named.annotation, node)) {
				const typeName = extractTypeNameFromExpression(currentNode.named.annotation);
				if (typeName) return typeName;
				return parseTypeExpression(currentNode.named.annotation);
			}
		}
		
		// Search children
		if (currentNode.children) {
			for (const child of currentNode.children) {
				const result = searchForAnnotationContext(child);
				if (result) return result;
			}
		}
		
		// Search named properties
		if (currentNode.named) {
			for (const key in currentNode.named) {
				const child = currentNode.named[key];
				if (child && typeof child === 'object') {
					const result = searchForAnnotationContext(child);
					if (result) return result;
				}
			}
		}
		
		return null;
	}
	
	function isDescendantOf(parent: any, target: any): boolean {
		if (!parent) return false;
		if (parent === target) return true;
		
		// Check children
		if (parent.children) {
			for (const child of parent.children) {
				if (isDescendantOf(child, target)) return true;
			}
		}
		
		// Check named properties
		if (parent.named) {
			for (const key in parent.named) {
				const child = parent.named[key];
				if (child && typeof child === 'object') {
					if (isDescendantOf(child, target)) return true;
				}
			}
		}
		
		return false;
	}
	
	return searchForAnnotationContext(tree);
}

/**
 * Get the final inferred type from a node
 * @param node - AST node with potential type inference
 * @param stream - Token stream for context
 * @param tree - Root tree for finding parent nodes
 * @returns The inferred type string, or null
 */
function getInferredType(node: any, stream: any[], tree: any): string | null {
	if (!node) return null;
	
	// Special case: if this is a name node in a function definition, show function signature
	if (node.type === 'name') {
		const funcDefParent = findParentNode(node, stream, tree, 'func_def');
		if (funcDefParent && funcDefParent.named?.name === node) {
			// This is a function name - build signature
			const params = funcDefParent.named.params;
			const annotation = funcDefParent.named.annotation;
			
			// Build parameter list
			let paramStr = '()';
			if (params && params.children) {
				const paramNames: string[] = [];
				function collectParams(n: any): void {
					if (n.type === 'func_def_params' && n.named?.name) {
						const paramName = n.named.name.value;
						const paramType = n.named.annotation ? parseTypeExpression(n.named.annotation) : 'any';
						paramNames.push(`${paramName}: ${paramType}`);
					}
					if (n.children) {
						n.children.forEach(collectParams);
					}
				}
				collectParams(params);
				paramStr = `(${paramNames.join(', ')})`;
			}
			
			// Get return type
			const returnType = annotation ? parseTypeExpression(annotation) : 'void';
			
			return `${paramStr} => ${returnType}`;
		}
	}
	
	// Check if this node has inferred types (annotated by the inference system)
	if (node.inference && Array.isArray(node.inference) && node.inference.length > 0) {
		// Get the last inference (after type resolution)
		const lastInference = node.inference[node.inference.length - 1];
		
		// If it's a string, it's the type
		if (typeof lastInference === 'string') {
			// Widen literal types for better display
			return widenLiteralType(lastInference);
		}
		
		// If it's a node (like math_operator), look for the resolved type
		if (typeof lastInference === 'object' && lastInference.type) {
			// This might be an operator or similar, skip it and look for previous types
			for (let i = node.inference.length - 1; i >= 0; i--) {
				if (typeof node.inference[i] === 'string') {
					return widenLiteralType(node.inference[i]);
				}
			}
		}
	}
	
	// Fallback: provide basic type information based on node type
	if (node.type === 'number') return 'number';
	if (node.type === 'str') return 'string';
	if (node.type === 'true' || node.type === 'false') return 'boolean';
	if (node.type === 'null') return 'null';
	if (node.type === 'undefined') return 'undefined';
	
	return null;
}

// Hover handler - show inferred types
// Hover handler - show inferred types
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		connection.console.log('Hover: No document found');
		return null;
	}
	
	// Get the AST for this document
	const astInfo = documentASTs.get(params.textDocument.uri);
	if (!astInfo) {
		connection.console.log('Hover: No AST info found for document');
		return null;
	}
	
	const { tree, stream, typeAliases } = astInfo;
	
	// Convert position to character offset
	const offset = document.offsetAt(params.position);
	connection.console.log(`Hover: Looking for node at offset ${offset}`);
	
	// Find the node at this position
	let node = findNodeAtPosition(tree, offset, stream);
	if (!node) {
		connection.console.log('Hover: No node found at position');
		return null;
	}
	
	// If we found an object_literal_body (generic parent), search for more specific child
	if (node.type === 'object_literal_body') {
		const moreSpecific = findMoreSpecificChild(node, offset, stream);
		if (moreSpecific && moreSpecific.type !== 'object_literal_body') {
			connection.console.log(`Hover: Found more specific child: ${moreSpecific.type}`);
			node = moreSpecific;
		}
	}
	
	connection.console.log(`Hover: Found node type: ${node.type}, has inference: ${!!node.inference}`);
	if (node.inference) {
		connection.console.log(`Hover: Inference array: ${JSON.stringify(node.inference)}`);
	}
	
	// PRIORITY 1: Check if node has explicit inference from analysis phase
	// This handles property keys, function parameters, etc. that were annotated during inference
	if (node.inference && Array.isArray(node.inference) && node.inference.length > 0) {
		const inferredType = getInferredType(node, stream, tree);
		if (inferredType) {
			connection.console.log(`Hover: Using explicit inference: ${inferredType}`);
			const hoverContent = `**Type**: \`${inferredType}\``;
			const token = stream[node.stream_index];
			if (token) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: hoverContent
					},
					range: {
						start: document.positionAt(token.start),
						end: document.positionAt(token.start + token.len)
					}
				};
			}
		}
	}
	
	// PRIORITY 2: Check if this is a type annotation context (hovering on a type name in annotation)
	const typeAnnotation = getTypeFromAnnotationContext(node, tree);
	if (typeAnnotation) {
		connection.console.log(`Hover: Found type annotation: ${typeAnnotation}`);
		// Check if this type is an alias - if so, resolve it
		if (typeAliases.has(typeAnnotation)) {
			const resolvedType = typeAliases.get(typeAnnotation);
			connection.console.log(`Hover: Resolved type alias ${typeAnnotation} -> ${resolvedType}`);
			
			const hoverContent = `**Type**: \`${typeAnnotation}\`\n\n**Definition**: \`${resolvedType}\``;
			const token = stream[node.stream_index];
			if (token) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: hoverContent
					},
					range: {
						start: document.positionAt(token.start),
						end: document.positionAt(token.start + token.len)
					}
				};
			}
		} else {
			// Just show the annotation
			const hoverContent = `**Type**: \`${typeAnnotation}\``;
			const token = stream[node.stream_index];
			if (token) {
				return {
					contents: {
						kind: MarkupKind.Markdown,
						value: hoverContent
					},
					range: {
						start: document.positionAt(token.start),
						end: document.positionAt(token.start + token.len)
					}
				};
			}
		}
	}
	
	// PRIORITY 3: Get inferred type as fallback for properties and expressions
	const inferredType = getInferredType(node, stream, tree);
	if (!inferredType) {
		connection.console.log('Hover: No inferred type found');
		return null;
	}
	
	connection.console.log(`Hover: Returning inferred type: ${inferredType}`);
	
	// Format the hover content
	const hoverContent = `**Type**: \`${inferredType}\``;
	
	// Get the token range for highlighting
	const token = stream[node.stream_index];
	if (!token) {
		return null;
	}
	
	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: hoverContent
		},
		range: {
			start: document.positionAt(token.start),
			end: document.positionAt(token.start + token.len)
		}
	};
});

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.textDocument.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

console.log('Blop server listening');
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

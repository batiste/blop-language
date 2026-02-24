/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';

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
	DefinitionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DiagnosticRelatedInformation,
	Location,
	CodeAction,
	CodeActionKind,
	CodeActionParams,
	Hover,
	MarkupKind,
	SignatureHelp,
	SignatureInformation,
	ParameterInformation
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { tokensDefinition } from './tokensDefinition.js';
import parser from './parser.js';
import { grammar } from './grammar.js';
import { getGlobalMetadata, getBuiltinObjectType } from './inference/builtinTypes.js';
import backend from './backend.js';
import { inference } from './inference/index.js';
import properties from './properties.js';
import { enhanceErrorMessage, formatEnhancedError, displayError, tokenPosition } from './errorMessages.js';
import { selectBestFailure } from './selectBestFailure.js';
import { parseTypeExpression, parseObjectTypeString, getPropertyType } from './inference/typeSystem.js';

// Load global metadata for autocomplete
const globalMetadata = getGlobalMetadata();

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
			typeAliases.set(typeName, typeExpression.toString());
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
				variableMap.set(varName, typeAnnotation.toString());
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
			hoverProvider: true,
			// Tell the client that the server supports go to definition
			definitionProvider: true,
			// Tell the client that the server supports signature help
			signatureHelpProvider: {
				triggerCharacters: ['(', ',']
			}
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
					typeDefMap.set(typeName, { structure: structure.toString() });
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

// ---------------------------------------------------------------------------
// Inference-based autocomplete helpers
// ---------------------------------------------------------------------------

/**
 * Convert an inferredType (string or Type object) to a display string.
 * Mirrors the same logic used in the hover provider.
 */
function getTypeString(inferredType: any): string {
	if (!inferredType) return '';
	if (typeof inferredType === 'string') return inferredType;
	if (inferredType.kind === 'literal') {
		return inferredType.baseType?.toString() ?? inferredType.toString();
	}
	return inferredType.toString?.() || String(inferredType);
}

/**
 * Walk the AST and collect every `name` node that has an inferredType.
 * Returns a Map of identifier name -> type string.
 * The last occurrence of a name wins (declaration is usually before usages,
 * and later occurrences tend to carry the most specific type).
 */
function collectInferredSymbols(root: any): Map<string, string> {
	const symbols = new Map<string, string>();

	function walk(node: any): void {
		if (!node) return;
		if (node.type === 'name' && node.value && node.inferredType) {
			const typeStr = getTypeString(node.inferredType);
			if (typeStr) symbols.set(node.value, typeStr);
		}
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) walk(child);
		}
		if (node.named && typeof node.named === 'object') {
			for (const key in node.named) {
				const child = node.named[key];
				if (child && typeof child === 'object') walk(child);
			}
		}
	}

	walk(root);
	return symbols;
}

/**
 * For property completions (`foo.`): always re-parse the document with the
 * trailing dot (and anything after it on the cursor line) stripped out.
 * This gives us a syntactically valid AST with fresh, correct stream offsets
 * and full inference results — regardless of whether the stale cache exists.
 * Falls back to the cache only if the re-parse itself fails.
 */
function reparseForPropertyCompletion(
	document: TextDocument,
	cursorLine: number
): DocumentASTInfo | null {
	const fullText = document.getText();
	const lines = fullText.split('\n');
	const lineText = lines[cursorLine] ?? '';
	const dotIdx = lineText.lastIndexOf('.');

	// Build sanitised text: truncate the cursor line at the dot
	if (dotIdx > 0) {
		lines[cursorLine] = lineText.slice(0, dotIdx);
	} else {
		// No dot found — just blank the line so it parses
		lines[cursorLine] = '';
	}
	const sanitized = lines.join('\n');

	try {
		const stream = parser.tokenize(tokensDefinition, sanitized);
		// @ts-expect-error - parser.parse signature issue
		const tree: any = parser.parse(stream, 0);
		if (!tree?.success) {
			// Re-parse failed; fall back to the stale cache
			return documentASTs.get(document.uri) ?? null;
		}
		inference(tree, stream, document.uri.split(':')[1]);
		const typeAliases = new Map<string, string>();
		extractTypeAliases(tree, typeAliases);
		return { tree, stream, typeAliases };
	} catch {
		return documentASTs.get(document.uri) ?? null;
	}
}

/**
 * Resolve an inferred type to a properties map suitable for completion.
 *
 * Returns an iterable of [propName, { type, optional }] entries, or null if
 * the type doesn't describe an object with known properties.
 *
 * Handles:
 *  - ObjectType with a .properties Map  (user-defined object types)
 *  - Named ObjectType / TypeAlias whose name maps to a builtinObjectType
 *    (e.g. Component, VNode, Router) — builtin entries use a plain object
 *    { propName: TypeInstance } without the optional wrapper.
 */
function resolveTypeToPropertiesMap(inferredType: any): { name: string; typeStr: string; optional: boolean }[] | null {
	if (!inferredType) return null;

	// Case 1: ObjectType with a populated .properties Map (user-defined structs)
	if (inferredType.properties instanceof Map && inferredType.properties.size > 0) {
		const results: { name: string; typeStr: string; optional: boolean }[] = [];
		for (const [prop, info] of inferredType.properties as Map<string, { type: any; optional: boolean }>) {
			results.push({
				name: prop,
				typeStr: info.type?.toString?.() ?? '',
				optional: info.optional ?? false
			});
		}
		return results;
	}

	// Case 2: Named type (TypeAlias or named ObjectType) — look up builtins
	const typeName: string | null =
		typeof inferredType === 'string' ? inferredType
		: (inferredType.name ?? null);

	if (typeName) {
		const builtin = getBuiltinObjectType(typeName);
		if (builtin && typeof builtin === 'object') {
			const results: { name: string; typeStr: string; optional: boolean }[] = [];
			for (const [prop, typeVal] of Object.entries(builtin)) {
				results.push({
					name: prop,
					typeStr: (typeVal as any)?.toString?.() ?? '',
					optional: false
				});
			}
			return results;
		}
	}

	return null;
}

/**
 * Like collectInferredSymbols but returns the raw Type objects instead of
 * their string representations. Used for property completion where we need
 * to inspect ObjectType.properties directly.
 */
function collectInferredTypeObjects(root: any): Map<string, any> {
	const symbols = new Map<string, any>();

	function walk(node: any): void {
		if (!node) return;
		if (node.type === 'name' && node.value && node.inferredType) {
			symbols.set(node.value, node.inferredType);
		}
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) walk(child);
		}
		if (node.named && typeof node.named === 'object') {
			for (const key in node.named) {
				const child = node.named[key];
				if (child && typeof child === 'object') walk(child);
			}
		}
	}

	walk(root);
	return symbols;
}

// ---------------------------------------------------------------------------

/**
 * Build a SignatureInformation directly from a FunctionType object.
 * No string parsing — uses .params, .paramNames, .genericParams, .returnType
 * directly from the inference engine's type objects.
 */
function buildSignatureFromFunctionType(funcType: any, methodName: string): SignatureInformation | null {
	if (!funcType || funcType.kind !== 'function') return null;

	const params: any[] = funcType.params ?? [];
	const paramNames: string[] = funcType.paramNames ?? [];
	const genericParams: string[] = funcType.genericParams ?? [];
	const returnType = funcType.returnType;

	const genericPart = genericParams.length ? `<${genericParams.join(', ')}>` : '';
	const paramStrs: string[] = params.map((p: any, i: number) => {
		const name = paramNames[i] ?? `p${i}`;
		return `${name}: ${p.toString()}`;
	});
	const returnStr = returnType?.toString?.() ?? 'void';

	const prefix = `${methodName}${genericPart}(`;
	const sigLabel = `${prefix}${paramStrs.join(', ')}) => ${returnStr}`;

	// Build offset-based ParameterInformation so VSCode highlights the active param
	let offset = prefix.length;
	const paramInfos: ParameterInformation[] = [];
	for (const p of paramStrs) {
		paramInfos.push({ label: [offset, offset + p.length] as [number, number] });
		offset += p.length + 2; // +2 for ', '
	}

	return { label: sigLabel, parameters: paramInfos };
}

// ---------------------------------------------------------------------------

connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		const document = documents.get(_textDocumentPosition.textDocument.uri);
		const line = _textDocumentPosition.position.line;
		if (!document) {
			return [];
		}
		// Text on the current line up to the cursor
		const text = document.getText({
			start: { line, character: 0 },
			end: { line, character: _textDocumentPosition.position.character }
		});
		const kindMap:any = {
			'Function': 3, 'Reference': 18, 'Class': 7, 'Value': 12
		};

		const astInfo = documentASTs.get(_textDocumentPosition.textDocument.uri);

		// ----------------------------------------------------------------
		// Property completion: after 'varName.'
		// ----------------------------------------------------------------
		const propertyReg = /(\w+)\.(\w*)$/;
		const propertyMatch = propertyReg.exec(text);
		if (propertyMatch) {
			const varName = propertyMatch[1];
			const partial = propertyMatch[2].toLowerCase();

			// --- Primary path: fresh re-parse + name-based type lookup ---
			const completionAstInfo = reparseForPropertyCompletion(document, line);
			if (completionAstInfo) {
				const { tree } = completionAstInfo;
				const typeObjects = collectInferredTypeObjects(tree);
				const inferredType = typeObjects.get(varName);
				const resolved = resolveTypeToPropertiesMap(inferredType);
				if (resolved && resolved.length > 0) {
					const typeLabel = getTypeString(inferredType);
					return resolved
						.filter(p => p.name.toLowerCase().startsWith(partial))
						.map(p => {
							const optMarker = p.optional ? '?' : '';
							const isFunction = p.typeStr.startsWith('(') || p.typeStr.includes('=>');
							return {
								label: p.name,
								kind: isFunction ? CompletionItemKind.Method : CompletionItemKind.Property,
								detail: `${p.name}${optMarker}: ${p.typeStr}`,
								documentation: `(${typeLabel}) → ${p.name}${optMarker}: ${p.typeStr}`
							};
						});
				}
			}

			// --- Fallback: manually extracted variable types (annotation-only) ---
			const variables = documentVariables.get(_textDocumentPosition.textDocument.uri);
			if (variables && variables.has(varName)) {
				const varType = variables.get(varName);
				const typeDefs = documentTypeDefinitions.get(_textDocumentPosition.textDocument.uri);
				let typeStructure = varType;
				if (typeDefs && typeDefs.has(varType!)) {
					const typeInfo = typeDefs.get(varType!);
					if (typeInfo) typeStructure = typeInfo.structure;
				}
				if (typeStructure) {
					const props = extractPropertyNames(typeStructure);
					return props
						.filter(prop => prop.toLowerCase().startsWith(partial))
						.map(prop => ({
							label: prop,
							kind: CompletionItemKind.Property,
							detail: `Property of ${varType}`,
							documentation: `${varName}.${prop}`
						}));
				}
			}

			// --- Built-in object properties ---
			// @ts-expect-error - properties dynamic indexing
			if (properties[varName]) {
				const array: any[] = [];
				// @ts-expect-error - properties dynamic indexing
				properties[varName].forEach((item: String) => {
					// @ts-expect-error - globalMetadata dynamic indexing
					const builtinForItem = (globalMetadata[item.toString()] || { type: 'Function' });
					const documentation = builtinForItem.documentation;
					const detail = builtinForItem.detail;
					const type = kindMap[builtinForItem.type];
					array.push({ label: item, detail, kind: type, documentation });
				});
				if (array.length > 0) return array;
			}
		}

		// ----------------------------------------------------------------
		// Type annotation completion: after ': '
		// ----------------------------------------------------------------
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

		// ----------------------------------------------------------------
		// In-scope variable / function completion from the inference engine
		// ----------------------------------------------------------------
		const partialWord = (text.match(/(\w+)$/) || ['', ''])[1];
		if (astInfo && partialWord.length >= 1) {
			const { tree } = astInfo;
			const symbols = collectInferredSymbols(tree);
			const partialLower = partialWord.toLowerCase();
			const symbolCompletions: CompletionItem[] = [];
			for (const [name, typeStr] of symbols) {
				if (name.toLowerCase().startsWith(partialLower) && name !== partialWord) {
					// Decide the completion kind based on the type string
					let kind: CompletionItemKind = CompletionItemKind.Variable;
					if (typeStr.startsWith('(') || typeStr.includes('=>')) kind = CompletionItemKind.Function;
					symbolCompletions.push({
						label: name,
						kind,
						detail: typeStr,
						documentation: `${name}: ${typeStr}`
					});
				}
			}
			if (symbolCompletions.length > 0) return symbolCompletions;
		}

		// ----------------------------------------------------------------
		// Basic builtin global completion
		// ----------------------------------------------------------------
		const reg0 = /(\s|^)([\w]{3,})/;
		const result2 = reg0.exec(text);
		if (result2) {
			const name = result2[2];
			// @ts-expect-error - globalMetadata dynamic indexing
			if (globalMetadata[name]) {
				// @ts-expect-error - globalMetadata dynamic indexing
				const builtinForItem = globalMetadata[name];
				return [{
					label: name,
					detail: builtinForItem.detail,
					kind: kindMap[builtinForItem.type],
					documentation: builtinForItem.documentation
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
 * Signature help: show parameter hints when the user types `varName.method(`
 */
connection.onSignatureHelp((params): SignatureHelp | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const { line, character } = params.position;
	const text = document.getText({
		start: { line, character: 0 },
		end: { line, character }
	});

	// Detect `varName.methodName(` — find the last un-closed call
	// Walk backwards to find the unmatched opening '('
	let depth = 0;
	let callOpenIdx = -1;
	for (let i = text.length - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === ')' || ch === ']' || ch === '}') depth++;
		else if (ch === '(' || ch === '[' || ch === '{') {
			if (depth === 0 && ch === '(') { callOpenIdx = i; break; }
			depth--;
		}
	}
	if (callOpenIdx < 0) return null;

	// The part before '(' should end with `varName.methodName`
	const beforeParen = text.slice(0, callOpenIdx);
	const accessMatch = /(\w+)\.(\w+)$/.exec(beforeParen);
	if (!accessMatch) return null;

	const varName = accessMatch[1];
	const methodName = accessMatch[2];

	// Count active parameter: commas at depth 0 after the opening '('
	const argsText = text.slice(callOpenIdx + 1);
	let activeParam = 0;
	let argDepth = 0;
	for (const ch of argsText) {
		if (ch === '(' || ch === '[' || ch === '{') argDepth++;
		else if (ch === ')' || ch === ']' || ch === '}') argDepth--;
		else if (ch === ',' && argDepth === 0) activeParam++;
	}

	// Re-parse truncated at dot to get the inferred Type object for varName
	const completionAstInfo = reparseForPropertyCompletion(document, line);
	if (!completionAstInfo) return null;

	const typeObjects = collectInferredTypeObjects(completionAstInfo.tree);
	const inferredType = typeObjects.get(varName);
	if (!inferredType) return null;

	// Use getPropertyType to get the raw FunctionType object — no string round-trip
	const methodType = getPropertyType(inferredType, methodName, completionAstInfo.typeAliases);
	if (!methodType) return null;

	const sig = buildSignatureFromFunctionType(methodType, methodName);
	if (!sig) return null;

	return {
		signatures: [sig],
		activeSignature: 0,
		activeParameter: Math.min(activeParam, (sig.parameters?.length ?? 1) - 1)
	};
});

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
 * Find the most specific child node at position - drill down to the leaf with a value
 */
function findMoreSpecificChild(node: any, offset: number, stream: any[]): any {
	if (!node) return null;
	
	let bestChild: any = null;
	let bestLen = Infinity;
	let hasValue = false;
	
	// Recursively search for the most specific node with a value
	function search(n: any): void {
		if (!n || n.stream_index === undefined) return;
		
		const token = stream[n.stream_index];
		if (!token) return;
		
		const tokenStart = token.start;
		const tokenEnd = token.start + token.len;
		
		// Check if offset is within this token's range
		if (offset >= tokenStart && offset <= tokenEnd) {
			const nodeHasValue = !!n.value;
			
			if (!bestChild) {
				bestChild = n;
				bestLen = token.len;
				hasValue = nodeHasValue;
			} else {
				// Prefer nodes with a value
				if (nodeHasValue && !hasValue) {
					bestChild = n;
					bestLen = token.len;
					hasValue = true;
				} else if (nodeHasValue === hasValue) {
					// Both have/don't have values; pick the smaller one (more specific)
					if (token.len < bestLen) {
						bestChild = n;
						bestLen = token.len;
					}
				}
			}
		}
		
		// Always recurse into children to find the most specific
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
 * Find the parent chain (ancestors) of a node by traversing from the root
 */
function findParentChain(root: any, targetNode: any): any[] {
	const chain: any[] = [];
	let currentParent: any = null;
	
	function traverse(node: any, parent: any): boolean {
		if (!node) return false;
		
		currentParent = parent;
		
		// If we found the target, we're done
		if (node === targetNode) {
			if (parent) chain.push(parent);
			return true;
		}
		
		// Check children
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) {
				if (traverse(child, node)) {
					return true;
				}
			}
		}
		
		// Check named properties
		if (node.named && typeof node.named === 'object') {
			for (const key in node.named) {
				const child = node.named[key];
				if (child && typeof child === 'object') {
					if (traverse(child, node)) {
						return true;
					}
				}
			}
		}
		
		return false;
	}
	
	traverse(root, null);
	return chain;
}


/**
 * Convert a file:// URI to an absolute file system path
 */
function uriToPath(uri: string): string {
	return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

/**
 * Convert an absolute file system path to a file:// URI
 */
function pathToUri(filePath: string): string {
	return 'file://' + filePath;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the character offset of a top-level definition for `name` in file content.
 * Looks for: `def name`, `async def name`, `class name`, or `name =` / `name:... =` at line start.
 * Returns -1 if not found.
 */
function findDefinitionInFile(content: string, name: string): number {
	const escaped = escapeRegex(name);

	// Function definition: (async) def name(
	const defPattern = new RegExp(`(?:^|\\n)(?:async\\s+)?def\\s+(${escaped})\\b`);
	let match = defPattern.exec(content);
	if (match) {
		const nameOffset = match[0].lastIndexOf(name);
		return match.index + nameOffset;
	}

	// Class definition: class name
	const classPattern = new RegExp(`(?:^|\\n)class\\s+(${escaped})\\b`);
	match = classPattern.exec(content);
	if (match) {
		const nameOffset = match[0].lastIndexOf(name);
		return match.index + nameOffset;
	}

	// Variable/constant assignment at line start: name = or name: Type =
	const assignPattern = new RegExp(`(?:^|\\n)(${escaped})\\s*(?::[^=\\n]*)?\s*=`);
	match = assignPattern.exec(content);
	if (match) {
		const nameOffset = match[0].indexOf(name);
		return match.index + nameOffset;
	}

	return -1;
}

/**
 * Parse all import statements in a document and return a map of
 * localName -> resolved absolute file path.
 *
 * Handles:
 *   import { foo, bar as baz } from './file'  -> foo: file, baz: file
 *   import DefaultName from './file'           -> DefaultName: file
 *   import './file' as DefaultName             -> DefaultName: file
 */
function buildImportMap(text: string, currentFilePath: string): Map<string, string> {
	const map = new Map<string, string>();
	const dir = path.dirname(currentFilePath);

	const importBracedRegex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm;
	const importDefaultRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm;
	const importBareAsRegex   = /^import\s+['"]([^'"]+)['"]\s+as\s+(\w+)/gm;

	let m: RegExpExecArray | null;

	while ((m = importBracedRegex.exec(text)) !== null) {
		const relPath = m[2];
		if (!relPath.startsWith('.')) continue;
		const resolved = path.resolve(dir, relPath);
		for (const entry of m[1].split(',')) {
			const parts = entry.trim().split(/\s+as\s+/);
			const originalName = parts[0].trim();
			const localName = parts.length > 1 ? parts[1].trim() : originalName;
			if (localName) map.set(localName, resolved);
		}
	}

	while ((m = importDefaultRegex.exec(text)) !== null) {
		const relPath = m[2];
		if (!relPath.startsWith('.')) continue;
		const resolved = path.resolve(dir, relPath);
		map.set(m[1].trim(), resolved);
	}

	while ((m = importBareAsRegex.exec(text)) !== null) {
		const relPath = m[1];
		if (!relPath.startsWith('.')) continue;
		const resolved = path.resolve(dir, relPath);
		map.set(m[2].trim(), resolved);
	}

	return map;
}

/**
 * Return the identifier word that spans the given character position on a line.
 */
function getWordAtPosition(lineText: string, character: number): string | null {
	const wordRe = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
	let m: RegExpExecArray | null;
	while ((m = wordRe.exec(lineText)) !== null) {
		if (character >= m.index && character <= m.index + m[0].length) {
			return m[0];
		}
	}
	return null;
}

// Go to Definition handler – navigate from imported names to their declaration
connection.onDefinition((params: DefinitionParams): Location | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}

	// Read the full line the cursor is on
	const line = params.position.line;
	const lineText = document.getText({
		start: { line, character: 0 },
		end: { line, character: 10000 }
	});

	// Match: import { name, name as alias, ... } from './file'
	//     or import DefaultName from './file'
	const importBracedRegex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
	const importDefaultRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
	// Also: import 'string' as name  or  import 'file'
	const importBareRegex = /^import\s+['"]([^'"]+)['"]/;

	let filePath: string | null = null;
	let targetName: string | null = null;

	const bracedMatch = importBracedRegex.exec(lineText);
	if (bracedMatch) {
		filePath = bracedMatch[2];
		const namesList = bracedMatch[1]; // e.g. "createRouter, foo as bar"
		const charPos = params.position.character;

		// Walk each imported name and check if the cursor falls on it
		let searchFrom = lineText.indexOf('{') + 1;
		for (const entry of namesList.split(',')) {
			const trimmed = entry.trim();
			if (!trimmed) continue;

			// The original name (before a potential `as` alias)
			const originalName = trimmed.split(/\s+as\s+/)[0].trim();

			// Find the position of originalName in the line (after the opening brace)
			const nameIdx = lineText.indexOf(originalName, searchFrom);
			if (nameIdx !== -1 && charPos >= nameIdx && charPos <= nameIdx + originalName.length) {
				targetName = originalName;
				break;
			}
			searchFrom = nameIdx + trimmed.length;
		}
	} else {
		const defaultMatch = importDefaultRegex.exec(lineText);
		if (defaultMatch) {
			filePath = defaultMatch[2];
			const importedName = defaultMatch[1];
			const nameIdx = lineText.indexOf(importedName);
			const charPos = params.position.character;
			if (charPos >= nameIdx && charPos <= nameIdx + importedName.length) {
				targetName = importedName;
			}
		} else {
			const bareMatch = importBareRegex.exec(lineText);
			if (bareMatch) {
				filePath = bareMatch[1];
				// No specific name – go to top of file
			}
		}
	}

	if (!filePath) {
		// Not on an import line – check if the word under the cursor is an imported name
		const currentFilePath = uriToPath(params.textDocument.uri);
		const fullText = document.getText();
		const importMap = buildImportMap(fullText, currentFilePath);

		const word = getWordAtPosition(lineText, params.position.character);
		if (!word || !importMap.has(word)) {
			return null;
		}

		const resolvedPath = importMap.get(word)!;
		if (!fs.existsSync(resolvedPath)) {
			return null;
		}

		const targetUri = pathToUri(resolvedPath);
		const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
		const defOffset = findDefinitionInFile(targetContent, word);

		let targetLine = 0;
		let targetChar = 0;
		if (defOffset !== -1) {
			const upToOffset = targetContent.slice(0, defOffset);
			const defLines = upToOffset.split('\n');
			targetLine = defLines.length - 1;
			targetChar = defLines[defLines.length - 1].length;
		}

		return {
			uri: targetUri,
			range: {
				start: { line: targetLine, character: targetChar },
				end: { line: targetLine, character: targetChar + word.length }
			}
		};
	}

	// Only handle local / relative imports
	if (!filePath.startsWith('.')) {
		return null;
	}

	// Resolve the file path relative to the current document
	const currentFilePath = uriToPath(params.textDocument.uri);
	const resolvedPath = path.resolve(path.dirname(currentFilePath), filePath);

	if (!fs.existsSync(resolvedPath)) {
		return null;
	}

	const targetUri = pathToUri(resolvedPath);

	// If no specific name, point to the beginning of the file
	if (!targetName) {
		return {
			uri: targetUri,
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 0 }
			}
		};
	}

	// Search for the definition of targetName in the target file
	const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
	const defOffset = findDefinitionInFile(targetContent, targetName);

	let targetLine = 0;
	let targetChar = 0;

	if (defOffset !== -1) {
		const upToOffset = targetContent.slice(0, defOffset);
		const lines = upToOffset.split('\n');
		targetLine = lines.length - 1;
		targetChar = lines[lines.length - 1].length;
	}

	return {
		uri: targetUri,
		range: {
			start: { line: targetLine, character: targetChar },
			end: { line: targetLine, character: targetChar + targetName.length }
		}
	};
});

// Hover handler - show inferred types
connection.onHover((params: TextDocumentPositionParams): Hover | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}
	
	// Get the AST for this document
	const astInfo = documentASTs.get(params.textDocument.uri);
	if (!astInfo) {
		return null;
	}
	
	const { tree, stream, typeAliases } = astInfo;
	
	// Convert position to character offset
	const offset = document.offsetAt(params.position);
	
	// Find the node at this position
	let node = findNodeAtPosition(tree, offset, stream);
	if (!node) {
		return null;
	}
	
	// Refine to the most specific child node (which has the stamped inferredType)
	const moreSpecific = findMoreSpecificChild(node, offset, stream);
	if (moreSpecific) {
		node = moreSpecific;
	}

	// Walk up the parent chain to find the first node with an inferred type
	let inferredType = node.inferredType;
	
	if (!inferredType) {
		const parentChain = findParentChain(tree, node);
		for (const ancestor of parentChain) {
			if (ancestor.inferredType) {
				inferredType = ancestor.inferredType;
				break;
			}
		}
	}
	
	// Fallback: if it's a type alias name, show the alias
	if (!inferredType && node.type === 'name' && node.value && typeAliases.has(node.value)) {
		inferredType = node.value;
	}
	
	// Fallback: literal types, but avoid showing "name" for variable references
	if (!inferredType) {
		const literalTypes: Record<string, string> = {
			'number': 'number',
			'str': 'string',
			'true': 'boolean',
			'false': 'boolean',
			'null': 'null',
			'undefined': 'undefined'
		};
		// For 'name' nodes, only use a fallback if it's a known literal type, otherwise return null
		if (node.type === 'name') {
			inferredType = literalTypes[node.type];
		} else {
			inferredType = literalTypes[node.type] || node.type || node.value;
		}
	}
	
	if (!inferredType) {
		return null;
	}
	
	// Convert Type object to string if needed
	const typeString = typeof inferredType === 'string'
		? inferredType
		: (inferredType.kind === 'literal'
			? (inferredType as any).baseType?.toString() ?? inferredType.toString()
			: inferredType.toString?.() || String(inferredType));
	
	// Get the token range for highlighting
	const token = stream[node.stream_index];
	if (!token) {
		return null;
	}
	
	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: `\`${typeString}\``
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

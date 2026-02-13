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
	Location
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const tokensDefinition = require('./tokensDefinition').tokensDefinition;
const parser = require('./parser');
const displayError = require('./utils').displayError;
const grammar = require('./grammar').grammar;
const builtin = require('./builtin').all;
const backend = require('./backend');
const { inference } = require('./inference');
const properties = require('./properties.js');
const { enhanceErrorMessage, formatEnhancedError } = require('./errorMessages');
const { tokenPosition } = require('./utils');
const { selectBestFailure } = require('./selectBestFailure');

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

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

	const tree = parser.parse(stream, 0);

	if (!tree.success && settings.maxNumberOfProblems > 0) {
		// Use statistics to select the best failure from the array
		const bestFailure = tree.best_failure_array 
			? selectBestFailure(tree.best_failure_array, tree.best_failure || tree)
			: (tree.best_failure || tree);
		
		// Generate enbestFailurced error message for editor (without redundant location/context info)
		const errorParts = enhanceErrorMessage(stream, tokensDefinition, grammar, bestFailure);
		const positions = tokenPosition(bestFailure.token);
		const errorMsg = formatEnhancedError(errorParts, positions, true);

		const token = tree.token;
		const diagnosic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(token.start),
				end: textDocument.positionAt(token.start + Math.max(1, token.len))
			},
			message: errorMsg,
			source: 'blop'
		};
		// if (hasDiagnosticRelatedInformationCapability) { }
		diagnostics.push(diagnosic);
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		return;
	}

	if (tree.success && settings.maxNumberOfProblems > 0) {
		// _backend(node, _stream, _input, _filename = false, rootSource, resolve = false)
		const result = backend.generateCode(tree, stream, text, textDocument.uri.split(':')[1], undefined, true);

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
		inference(tree, stream).forEach((warning: any) => {
			diagnostics.push(
				generateDiagnosis(warning, textDocument, DiagnosticSeverity.Warning)
			);
		});
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
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
		// Object.<something completion>
		const reg1 = /(\s|^)([\w]+)\./;
		const result = reg1.exec(text);
		if (result) {
			const name = result[2];
			if (properties[name]) {
				const array: any[] = [];
				properties[name].forEach((item: String) => {
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
			if (builtin[name]) {
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

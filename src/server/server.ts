import {
  RENAME_TAG_METHOD,
  RenameTagParms,
  REFRESH_TAGS_TREE_METHOD,
  RefreshTagsTreeParams,
  FileSavedParams,
  FILE_SAVED_NOTIFICATION_METHOD,
} from "./../constants";
import { TagHandler } from "./tagParser";
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
  Range,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { CreateVirtualDocumentParams, CREATE_VIRTUAL_DOCUMENT_METHOD, GetAllTagsParams, GET_ALL_TAGS_METHOD } from "../constants";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
// console.log = connection.console.log.bind(connection.console);
// console.error = connection.console.error.bind(connection.console);
// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  console.log("initializing language server");
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [" "],
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

const tagHandler = new TagHandler();

connection.onRequest(GET_ALL_TAGS_METHOD, (params: GetAllTagsParams) => {
  return tagHandler.getAllTags(params.workspaceRoot);
});

connection.onRequest(CREATE_VIRTUAL_DOCUMENT_METHOD, (params: CreateVirtualDocumentParams) => {
  return tagHandler.createVirtualDocument(params.tag, params.destinationPath, params.EOL);
});

connection.onRequest(RENAME_TAG_METHOD, (params: RenameTagParms) => {
  return tagHandler.renameTag(params.filePath, params.oldTag, params.newTag, params.EOL);
});

documents.onDidSave((change) => {
  const tagsToElement = tagHandler.handleSavedFile(change.document.uri, change.document.languageId, change.document.version);
  if (tagsToElement) {
    const params: RefreshTagsTreeParams = { tagsToElement: tagsToElement };
    connection.sendNotification(REFRESH_TAGS_TREE_METHOD, params);
  }
});

connection.onNotification(FILE_SAVED_NOTIFICATION_METHOD, (params: FileSavedParams) => {
  const tagsToElement = tagHandler.handleSavedFile(params.filePath);
  if (tagsToElement) {
    const params: RefreshTagsTreeParams = { tagsToElement: tagsToElement };
    connection.sendNotification(REFRESH_TAGS_TREE_METHOD, params);
  }
});

connection.onInitialized(() => {
  console.log("language server initialized");
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined).then((e) => {
      connection.console.log("config change event received.");
    });
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
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

connection.onDidChangeConfiguration((change) => {
  globalSettings = <ExampleSettings>(change.settings.languageServerExample || defaultSettings);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(_textDocumentPosition.textDocument.uri);
  if (document == null) {
    return [];
  }

  const range = Range.create(_textDocumentPosition.position.line, 0, _textDocumentPosition.position.line, _textDocumentPosition.position.character);
  const line = document.getText(range);

  return tagHandler.provideCompletionItems(line);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

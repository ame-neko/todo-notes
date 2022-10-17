import {
  RENAME_TAG_METHOD,
  RenameTagParms,
  REFRESH_TAGS_TREE_METHOD,
  RefreshTagsTreeParams,
  FileSavedParams,
  FILE_SAVED_NOTIFICATION_METHOD,
} from "./../constants";
import { TagHandler } from "./tagHandler";
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Range,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { CreateVirtualDocumentParams, CREATE_VIRTUAL_DOCUMENT_METHOD, GET_ALL_TAGS_METHOD } from "../constants";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasWorkspaceFolderCapability = false;
let tagHandler: TagHandler;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  const workspaceRoot =
    params.workspaceFolders && params.workspaceFolders[0].uri.startsWith("file://") ? params.workspaceFolders[0].uri.substring("file://".length) : "";
  tagHandler = new TagHandler(workspaceRoot);

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [" ", "/"],
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

connection.onRequest(GET_ALL_TAGS_METHOD, () => {
  return tagHandler.getAllTags();
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

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(_textDocumentPosition.textDocument.uri);
  if (document == null) {
    return [];
  }

  const range = Range.create(_textDocumentPosition.position.line, 0, _textDocumentPosition.position.line, _textDocumentPosition.position.character);
  const line = document.getText(range).trimStart();

  return tagHandler.provideCompletionItems(line);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

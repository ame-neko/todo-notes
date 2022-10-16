// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require("path");
import * as vscode from "vscode";
import { addTodo, addTodoWithoutMetadata } from "./addTodo";
import { completeTodo } from "./completeTodo";
import { Element, NotesTagsProvider } from "./tagsTreeView";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join("out", "server", "server.js"));
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    // TODO: add untitled schema
    documentSelector: [{ scheme: "file", language: "markdown" }],
  };
  // Create the language client and start the client.
  client = new LanguageClient("languageServerExample", "Language Server Example", serverOptions, clientOptions);

  // Start the client. This will also launch the server
  client.start();

  const addTodoDisposable = vscode.commands.registerCommand("todo-notes.addTodo", () => {
    addTodo();
  });
  context.subscriptions.push(addTodoDisposable);

  const addSimpleTodoDisposable = vscode.commands.registerCommand("todo-notes.addSimpleTodo", () => {
    addTodoWithoutMetadata();
  });
  context.subscriptions.push(addSimpleTodoDisposable);

  const completeAndCopyTodoDisposable = vscode.commands.registerCommand("todo-notes.completeAndCopyTodo", () => {
    completeTodo(true, true);
  });
  context.subscriptions.push(completeAndCopyTodoDisposable);

  const completeAndDiscardTodoDisposable = vscode.commands.registerCommand("todo-notes.completeAndDiscardTodo", () => {
    completeTodo(false, true);
  });
  context.subscriptions.push(completeAndDiscardTodoDisposable);

  const completeTodoDisposable = vscode.commands.registerCommand("todo-notes.completeTodo", () => {
    completeTodo(false, false);
  });
  context.subscriptions.push(completeTodoDisposable);

  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
  if (rootPath) {
    const provider = new NotesTagsProvider(rootPath, client);

    const completinProviderDisposable = vscode.languages.registerCompletionItemProvider("markdown", provider, " ");
    context.subscriptions.push(completinProviderDisposable);

    const treeViewDisposable = vscode.window.createTreeView("todoNotesTags", {
      treeDataProvider: provider,
      showCollapseAll: true,
    });
    const refreshDisposable = vscode.commands.registerCommand("todoNotesTags.refreshEntry", () => provider.refresh());
    context.subscriptions.push(refreshDisposable);
    const renameDisposable = vscode.commands.registerCommand("todoNotesTags.renameTag", (element: Element) => provider.renameTag(element.name));
    context.subscriptions.push(renameDisposable);

    const createVirtualDocumentDisposable = vscode.commands.registerCommand("todoNotesTags.createVirtualDocument", async (element: Element) => {
      const uri = vscode.Uri.parse("tags:" + element.name);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.languages.setTextDocumentLanguage(doc, "markdown");
      await vscode.window.showTextDocument(doc, { preview: true });
    });
    context.subscriptions.push(createVirtualDocumentDisposable);

    const tagAllDocumentProvider = new (class implements vscode.TextDocumentContentProvider {
      async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return await provider.callLanguageServerForVirtualDocument(
          uri,
          vscode?.workspace?.workspaceFolders ? vscode?.workspace?.workspaceFolders[0].uri.path : null
        );
      }
    })();
    const tagAllDocumentProviderDisposable = vscode.workspace.registerTextDocumentContentProvider("tags", tagAllDocumentProvider);
    context.subscriptions.push(tagAllDocumentProviderDisposable);

    treeViewDisposable.onDidChangeSelection((e) => {
      if (e.selection.length > 0 && e.selection[0].filePath) {
        const openPath = vscode.Uri.file(e.selection[0].filePath);
        vscode.workspace.openTextDocument(openPath).then((doc) => {
          vscode.window.showTextDocument(doc);
        });
      }
    });
    context.subscriptions.push(treeViewDisposable);
  }
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

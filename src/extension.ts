// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { addTodo, addTodoWithoutMetadata } from "./addTodo";
import { completeTodo } from "./completeTodo";
import { Element, NotesTagsProvider } from "./tagsTreeView";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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
    const provider = new NotesTagsProvider(rootPath);

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
        return await provider.createVirtualDocument(uri, vscode?.workspace?.workspaceFolders ? vscode?.workspace?.workspaceFolders[0].uri.path : null);
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
export function deactivate() {}

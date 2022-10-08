// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { completeTodo } from "./completeTodo";
import { Element, NotesTagsProvider } from "./tagsTreeView";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "todo-notes" is now active!');

  let addTodoDisposable = vscode.commands.registerCommand(
    "todo-notes.addTodo",
    () => {
      const TODO_MARKDOWN = "- [ ] ";
      const editor = vscode.window.activeTextEditor;
      editor?.edit((e) => {
        e.insert(
          new vscode.Position(editor.selection.active.line, 0),
          TODO_MARKDOWN
        );
      });
    }
  );
  context.subscriptions.push(addTodoDisposable);

  let completeTodoDisposable = vscode.commands.registerCommand(
    "todo-notes.completeTodo",
    () => {
      // const editor = vscode.window.activeTextEditor;
      // if (editor){
      // 	const currentLine = editor.document.lineAt(editor.selection.active.line)
      // 	const newLine = currentLine.text.replace(/^- \[ \]/, "- [x]", )
      // 	editor?.edit(e => {e.replace(currentLine.range, newLine)});
      // }
      completeTodo();
    }
  );
  context.subscriptions.push(completeTodoDisposable);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "todo-notes.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Todo Notes!");
    }
  );

  context.subscriptions.push(disposable);

  const rootPath =
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  if (rootPath) {
    const provider = new NotesTagsProvider(rootPath);
    let treeViewDisposable = vscode.window.createTreeView("todoNotesTags", {
      treeDataProvider: provider,
    });
    let refreshDisposable = vscode.commands.registerCommand(
      "todoNotesTags.refreshEntry",
      () => provider.refresh()
    );
    context.subscriptions.push(refreshDisposable);

    let createVirtualDocumentDisposable = vscode.commands.registerCommand(
      "todoNotesTags.createVirtualDocument",
      async (element: Element) => {
        let uri = vscode.Uri.parse("tags:" + element.name);
        let doc = await vscode.workspace.openTextDocument(uri);
        await vscode.languages.setTextDocumentLanguage(doc, "markdown");
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    );
    context.subscriptions.push(createVirtualDocumentDisposable);

    const tagAllDocumentProvider = new (class
      implements vscode.TextDocumentContentProvider
    {
      async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        return await provider.createVirtualDocument(uri);
      }
    })();
    let tagAllDocumentProviderDisposable =
      vscode.workspace.registerTextDocumentContentProvider(
        "tags",
        tagAllDocumentProvider
      );
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
export function deactivate() {}

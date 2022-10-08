// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "todo-notes" is now active!');

	vscode.commands.registerCommand('todo-notes.addTodo', () => {
		const TODO_MARKDOWN = "- [ ] "
		const editor = vscode.window.activeTextEditor;
		editor?.edit(e => {e.insert(new vscode.Position(editor.selection.active.line, 0), TODO_MARKDOWN)});
	})

	vscode.commands.registerCommand('todo-notes.completeTodo', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor){
			const currentLine = editor.document.lineAt(editor.selection.active.line)
			const newLine = currentLine.text.replace(/^- \[ \]/, "- [x]", )
			editor?.edit(e => {e.replace(currentLine.range, newLine)});
		}
	})

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('todo-notes.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Todo Notes!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

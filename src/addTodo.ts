/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { getDateStr, loadConfiguration, loadIndentConfig } from "./vscodeUtils";
import { getIndentOfLine } from "./utils";

export function addTodo() {
  const config = loadConfiguration();
  const indentConfig = loadIndentConfig();
  const indent = indentConfig.useSpace ? " ".repeat(indentConfig.tabSize) : "\t";
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const currentCursorPosition = editor.selection.active;
  const newPosition = new vscode.Position(currentCursorPosition.line, currentCursorPosition.character + 6);

  const currentLine = editor.document.lineAt(editor.selection.active.line).text;
  const indentChar = indentConfig.useSpace ? " " : "\t";
  const numIndent = getIndentOfLine(currentLine, indentChar);
  const currentCursorIndent = indentChar.repeat(numIndent);
  const insertStr = `- [ ] 

${currentCursorIndent}${indent}[metadata]: # (Tags: [])
${currentCursorIndent}${indent}[metadata]: # (FolderPath: )
${currentCursorIndent}${indent}[metadata]: # (Title: )
${currentCursorIndent}${indent}[metadata]: # (FileName: )
${currentCursorIndent}${indent}[metadata]: # (AppendMode: )
${currentCursorIndent}${indent}[metadata]: # (CreatedDate: "${getDateStr(config)}")
${indent}`;

  editor.edit((e) => {
    e.insert(editor.selection.active, insertStr);
  });

  editor.selection = new vscode.Selection(newPosition, newPosition);
}

export function addTodoWithoutMetadata() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const insertStr = `- [ ] `;

  editor.edit((e) => {
    e.insert(editor.selection.active, insertStr);
  });
}

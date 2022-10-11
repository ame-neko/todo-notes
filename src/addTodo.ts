/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { loadConfiguration, loadIndentConfig, getDateStr, getIndentOfLine } from "./utils";

export function addTodo() {
  const config = loadConfiguration();
  const indentConfig = loadIndentConfig();
  const indent = indentConfig.useSpace ? " ".repeat(indentConfig.tabSize) : "\t";
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const currentLine = editor.document.lineAt(editor.selection.active.line).text;
  const indentChar = indentConfig.useSpace ? " " : "\t";
  const numIndent = getIndentOfLine(currentLine, indentChar);
  const currentCursolIndent = indentChar.repeat(numIndent);
  const insertStr = `${currentCursolIndent}- [ ] 

${currentCursolIndent}${indent}[metadata]: # (Tags: [])
${currentCursolIndent}${indent}[metadata]: # (Title: )
${currentCursolIndent}${indent}[metadata]: # (FileName: )
${currentCursolIndent}${indent}[metadata]: # (FolderPath: )
${currentCursolIndent}${indent}[metadata]: # (AppendMode: )
${currentCursolIndent}${indent}[metadata]: # (CreatedDate: "${getDateStr(config)}")
`;
  editor?.edit((e) => {
    e.insert(new vscode.Position(editor.selection.active.line, 0), insertStr);
  });
}

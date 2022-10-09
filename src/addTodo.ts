/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { loadConfiguration, getIndentConfig, getDateStr } from "./utils";

export function addTodo() {
  const config = loadConfiguration();
  const indentConfig = getIndentConfig();
  const indent = indentConfig.useSpace ? " ".repeat(indentConfig.tabSize) : "\t";
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const currentLine = editor.document.lineAt(editor.selection.active.line).text;

  const indentChar = indentConfig.useSpace ? " " : "\t";
  let numIndent = 0;
  for (let i = 0; i < currentLine.length; i++) {
    if (currentLine[i] === indentChar) {
      numIndent += 1;
    } else {
      break;
    }
  }
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

/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { loadConfiguration, getIndentConfig } from "./utils";

export function addTodo() {
  const config = loadConfiguration();
  const indentConfig = getIndentConfig();
  const indentChar = indentConfig.useSpace ? " ".repeat(indentConfig.tabSize) : "\t";

  const TODO_MARKDOWN = config.EOL + "- [ ] ";
  const METADATA = `

${indentChar}[metadata]: # (Tags: [])
${indentChar}[metadata]: # (Title: )
${indentChar}[metadata]: # (FileName: )
${indentChar}[metadata]: # (FolderPath: )
`;
  const editor = vscode.window.activeTextEditor;
  editor?.edit((e) => {
    e.insert(new vscode.Position(editor.selection.active.line, 0), TODO_MARKDOWN + METADATA);
  });
}

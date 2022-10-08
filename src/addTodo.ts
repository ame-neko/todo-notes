/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { loadConfiguration } from "./utils";

export function addTodo() {
  const config = loadConfiguration();
  const TODO_MARKDOWN = config.EOL + "- [ ] ";
  const METADATA = `

[metadata]: # (Tags: [])
[metadata]: # (Title: )
[metadata]: # (FileName: )
[metadata]: # (FolderPath: )
`;
  const editor = vscode.window.activeTextEditor;
  editor?.edit((e) => {
    e.insert(new vscode.Position(editor.selection.active.line, 0), TODO_MARKDOWN + METADATA);
  });
}

/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as os from "os";
const OS_EOL = os.EOL;

interface config {
  EOL: string;
  todoRangeDetectionMode: "strict" | "next-todo";
  saveNotesPath: string;
}

interface indentConfig {
  useSpace: boolean;
  tabSize: number;
}

export function loadConfiguration(): config {
  const configurations = vscode.workspace.getConfiguration("todoNotes");
  const todoRangeDetectionMode: "strict" | "next-todo" = configurations.get("todoRangeDetectionMode") === "strict" ? "strict" : "next-todo";
  const saveNotesPath: string = configurations.get("saveNotesPath") ?? "";
  let EOL = null;
  switch (configurations.get("eol")) {
    case "LF":
      EOL = "\n";
      break;
    case "CRLF":
      EOL = "\r\n";
      break;
    default:
      EOL = OS_EOL;
  }
  return {
    EOL: EOL,
    todoRangeDetectionMode: todoRangeDetectionMode,
    saveNotesPath: saveNotesPath,
  };
}

export function getIndentConfig(defaultSize = 4, defaultUseSpace = true): indentConfig {
  const activeTextTabSize = vscode.window.activeTextEditor?.options.tabSize ?? defaultSize;
  const useSpace = vscode.window.activeTextEditor?.options.insertSpaces ?? defaultUseSpace;

  return {
    useSpace: typeof useSpace === "boolean" ? useSpace : useSpace === "true",
    tabSize: typeof activeTextTabSize === "number" ? activeTextTabSize : parseInt(activeTextTabSize),
  };
}

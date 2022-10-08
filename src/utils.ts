/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as os from "os";
const OS_EOL = os.EOL;

interface config {
  EOL: string;
  todoRangeDetectionMode: "strict" | "next-todo";
  saveNotesPath: string;
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

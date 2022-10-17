/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as os from "os";
const dateFormat = require("dateformat");

const OS_EOL = os.EOL;

export interface extensionConfig {
  EOL: string;
  todoRangeDetectionMode: "strict" | "next-todo";
  saveNotesPath: string;
  dateFormat: string;
  addCompletionDate: boolean;
  showDialogueWhenFileExist: boolean;
  appendMode: "append" | "overwrite" | "increment";
  colorizeTagIcon: boolean;
  inheritParentTodoMetadata: boolean;
}

interface indentConfig {
  useSpace: boolean;
  tabSize: number;
}

export const SPECIAL_METADATA_NAMES = ["Tags", "FolderPath", "Title", "FileName", "AppendMode", "CreatedDate"];

export function loadConfiguration(): extensionConfig {
  const configurations = vscode.workspace.getConfiguration("todoNotes");
  const todoRangeDetectionMode: "strict" | "next-todo" = configurations.get("todoRangeDetectionMode") === "strict" ? "strict" : "next-todo";
  const appendMode: extensionConfig["appendMode"] =
    configurations.get("appendMode") === "Append" ? "append" : configurations.get("appendMode") === "Increment" ? "increment" : "overwrite";
  const saveNotesPath: string = configurations.get("saveNotesPath") ?? "";
  const dateFormat: string = configurations.get("dateFormat") ?? "";
  const addCompletionDate: boolean = configurations.get("addCompletionDate") ?? true;
  const showDialogueWhenFileExist: boolean = configurations.get("showDialogueWhenFileExist") ?? true;
  const colorizeTagIcon: boolean = configurations.get("colorizeTagIcon") ?? true;
  const inheritParentTodoMetadata: boolean = configurations.get("inheritParentTodoMetadata") ?? true;
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
    dateFormat: dateFormat,
    addCompletionDate: addCompletionDate,
    showDialogueWhenFileExist: showDialogueWhenFileExist,
    appendMode: appendMode,
    colorizeTagIcon: colorizeTagIcon,
    inheritParentTodoMetadata: inheritParentTodoMetadata,
  };
}

export function loadIndentConfig(defaultSize = 4, defaultUseSpace = true): indentConfig {
  const activeTextTabSize = vscode.window.activeTextEditor?.options.tabSize ?? defaultSize;
  const useSpace = vscode.window.activeTextEditor?.options.insertSpaces ?? defaultUseSpace;

  return {
    useSpace: typeof useSpace === "boolean" ? useSpace : useSpace === "true",
    tabSize: typeof activeTextTabSize === "number" ? activeTextTabSize : parseInt(activeTextTabSize),
  };
}

export function getDateStr(config: extensionConfig): string {
  const now = Date.now();
  return config.dateFormat ? dateFormat(now, config.dateFormat) : dateFormat(new Date());
}

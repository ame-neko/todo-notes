/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
const unified = require("unified");
const remarkParse = require("remark-parse");
const remarkGfm = require("remark-gfm");
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

export function getIndentOfLine(line: string, indentChar: " " | "\t"): number {
  let numIndent = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === indentChar) {
      numIndent += 1;
    } else {
      break;
    }
  }
  return numIndent;
}

export function replaceUrl(text: string, from: string, to: string) {
  const flattened = parseMarkdown(text);
  const newTextList = [];
  let currentIndex = 0;
  flattened.forEach((element: any) => {
    if (element?.type === "image") {
      const oldUrl = element.url;
      if (path.isAbsolute(oldUrl)) {
        return;
      }
      if (isURL(oldUrl)) {
        return;
      }

      const newUrl = path.join(path.relative(to, from), oldUrl);
      const begin = element.position.start.offset;
      const end = element.position.end.offset;

      newTextList.push(text.substring(currentIndex, begin));
      newTextList.push(text.substring(begin, end).replace(oldUrl, newUrl));
      currentIndex = end;
    }
  });
  newTextList.push(text.substring(currentIndex, text.length));

  return newTextList.join("");
}

function flattenParsedMarkDown(elementsList: any[], parsed: any, level: number) {
  parsed.level = level;
  elementsList.push(parsed);
  if (parsed?.children) {
    [...parsed.children].forEach((e) => {
      // Create a link to the parent
      e.parent = parsed;
      flattenParsedMarkDown(elementsList, e, level + 1);
    });
  }
  return elementsList;
}

function isURL(pathStr: string) {
  try {
    new URL(pathStr);
    return true;
  } catch {
    return false;
  }
}

export function parseMarkdown(text: string) {
  const parseResult = unified().use(remarkParse).use(remarkGfm).parse(text);
  const flattend: any[] = flattenParsedMarkDown([], parseResult, 0);
  flattend.sort((a, b) => a.position.start.line - b.position.start.line);
  return flattend;
}

export function getDateStr(config: extensionConfig): string {
  const now = Date.now();
  return config.dateFormat ? dateFormat(now, config.dateFormat) : dateFormat(new Date());
}

export function stringHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    hash = hash * 31 + charCode;
    hash = hash | 0;
  }
  return hash;
}

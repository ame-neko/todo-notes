/* eslint-disable @typescript-eslint/no-var-requires */
import { posix } from "path";
import * as vscode from "vscode";
import sanitize = require("sanitize-filename");
import * as path from "path";
import { parse, stringify } from "yaml";
import { loadConfiguration } from "./utils";
const unified = require("unified");
const remarkParse = require("remark-parse");
const remarkGfm = require("remark-gfm");

interface yamlMetadata {
  FolderPath?: string;
  Title?: string;
  FileName?: string;
}

function replaceUrl(text: string, from: string, to: string) {
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

function isURL(pathStr: string) {
  try {
    new URL(pathStr);
    return true;
  } catch {
    return false;
  }
}

async function writeToFile(folderUri: vscode.Uri, fileName: string, header: any, title: string, body: string, EOL: string) {
  const writeStr = header + EOL + title + EOL + body;
  const writeData = Buffer.from(writeStr, "utf-8");
  const fileUri = folderUri.with({ path: posix.join(folderUri.path, fileName) });
  await vscode.workspace.fs.createDirectory(folderUri);
  await vscode.workspace.fs.writeFile(fileUri, writeData);
}

function isTodo(element: any): boolean {
  if (element?.type === "listItem" && element?.checked != null) {
    return true;
  }
  return false;
}

function getCurrentLineLevel(flattenParsedResult: any[], currentLineNumberFrom1: number) {
  let level = -1;
  for (const element of flattenParsedResult) {
    if (
      element?.position?.start.line &&
      element?.position?.start.line <= currentLineNumberFrom1 &&
      element?.position?.end.line &&
      element?.position?.end.line >= currentLineNumberFrom1 &&
      element?.level != null
    ) {
      if (element.level > level) {
        level = element.level;
      }
    }
  }
  return level;
}

function detectCompletedTodoRange(
  flattenParsedResult: any[],
  currentLineNumberFrom1: number,
  editor: vscode.TextEditor,
  todoRangeDetectionMode: "strict" | "next-todo"
): vscode.Range | null {
  let startLineFrom1 = -1;
  let startLineLevel = -1;
  let endLineFrom1 = -1;
  let startLineIsChecked = false;
  // minimum level of todo is 2
  const currentLineLevel = Math.max(getCurrentLineLevel(flattenParsedResult, currentLineNumberFrom1), 2);
  for (const element of flattenParsedResult) {
    if (element.position.start.line <= currentLineNumberFrom1) {
      // start position detection
      if (isTodo(element) && element.level <= currentLineLevel) {
        startLineFrom1 = element.position.start.line;
        startLineLevel = element.level;
        startLineIsChecked = element.checked;
      }
    } else {
      // end position detection
      if (startLineFrom1 < 0 || startLineIsChecked || startLineIsChecked == null) {
        return null;
      }
      if (todoRangeDetectionMode === "strict") {
        if (element.level < startLineLevel) {
          endLineFrom1 = element.position.start.line - 1;
          break;
        }
        if (isTodo(element) && element.level == startLineLevel) {
          endLineFrom1 = element.position.start.line - 1;
          break;
        }
      } else if (todoRangeDetectionMode === "next-todo") {
        if (element.level <= startLineLevel && isTodo(element)) {
          endLineFrom1 = element.position.start.line - 1;
          break;
        }
      }
    }
  }

  if (startLineFrom1 < 0 || startLineIsChecked || startLineIsChecked == null) {
    return null;
  }
  if (endLineFrom1 < 0) {
    // end line is last line of file
    endLineFrom1 = editor.document.lineCount;
  }

  const endLineLength = editor.document.lineAt(endLineFrom1 - 1).text.length;
  return new vscode.Range(new vscode.Position(startLineFrom1 - 1, 0), new vscode.Position(endLineFrom1 - 1, endLineLength));
}

function parseMarkdown(text: string) {
  const parseResult = unified().use(remarkParse).use(remarkGfm).parse(text);
  const flattend: any[] = flattenParsedMarkDown([], parseResult, 0);
  flattend.sort((a, b) => a.position.start.line - b.position.start.line);
  return flattend;
}

function flattenParsedMarkDown(elementsList: any[], parsed: any, level: number) {
  parsed.level = level;
  elementsList.push(parsed);
  if (parsed?.children) {
    [...parsed.children].forEach((e) => {
      flattenParsedMarkDown(elementsList, e, level + 1);
    });
  }
  return elementsList;
}

function parseYamlMetadata(elementsList: any[], todoRange: vscode.Range): { metadata: yamlMetadata; lines: number[] } {
  let metadata: yamlMetadata = {};
  let todoLineLevel = -1;
  const lines: number[] = [];
  elementsList.forEach((e) => {
    if (e?.position?.start?.line < todoRange.start.line + 1 || e?.position?.start?.line > todoRange.end.line + 1) {
      return;
    }
    if (isTodo(e) && e?.position?.start?.line === todoRange.start.line + 1) {
      todoLineLevel = e?.level;
      return;
    }

    // metadata line level is todoLineLevel + 1
    if (e?.level && e?.level <= todoLineLevel + 1 && e?.type === "definition" && e?.identifier === "metadata" && e?.title) {
      const meta = parse(e.title);
      if (e?.position?.start?.line != null) {
        // -1 to make line number start from 0
        lines.push(e?.position?.start?.line - 1);
      }
      metadata = { ...metadata, ...meta };
    }
  });
  return {
    metadata: metadata,
    lines: lines,
  };
}

function getTodoConetntsWithoutMetadataLine(document: vscode.TextDocument, todoContentsRange: vscode.Range, lines: number[], EOL: string): string {
  let text = "";
  for (let li = todoContentsRange.start.line; li <= todoContentsRange.end.line; li++) {
    if (!lines.includes(li)) {
      text += document.lineAt(li).text + EOL;
    }
  }
  return text;
}

export async function completeTodo() {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) {
    return;
  }
  try {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("No folder or workspace opened");
      throw new Error("Failed to create file because no folder or workspace opened.");
    }
    const currentLineNumber = editor.selection.active.line;
    const currentLineNumberFrom1 = currentLineNumber + 1;
    const activeDocumentText = editor.document.getText();
    const parsed = parseMarkdown(activeDocumentText);
    const config = loadConfiguration();

    const todoRange = detectCompletedTodoRange(parsed, currentLineNumberFrom1, editor, config.todoRangeDetectionMode);

    if (todoRange != null) {
      const todoLine = editor.document.lineAt(todoRange.start.line);
      let todoContentsRange: vscode.Range | null = null;
      if (todoRange.end.line > todoRange.start.line) {
        todoContentsRange = new vscode.Range(new vscode.Position(todoRange.start.line + 1, todoRange.start.character), todoRange.end);
        const { metadata, lines } = parseYamlMetadata(parsed, todoRange);
        const folderPath: string = metadata.FolderPath ?? config.saveNotesPath;

        const title = metadata.Title ?? todoLine.text.replace(/.*?- \[ \]\s*/, "");
        const fileName = sanitize(metadata.FileName ?? title + ".md");
        const workspaceFolderUri = vscode.workspace.workspaceFolders[0].uri;
        const toDir = workspaceFolderUri.with({ path: posix.join(workspaceFolderUri.path, folderPath) });
        const currentFilePath = vscode.window.activeTextEditor?.document.fileName;
        const fromDir = currentFilePath ? path.dirname(currentFilePath) : workspaceFolderUri.path;
        const body = getTodoConetntsWithoutMetadataLine(editor.document, todoContentsRange, lines, config.EOL);
        const bodyUrlReplaced = replaceUrl(body, fromDir, toDir.path);

        const metadataStr = stringify(metadata);
        const header = metadataStr.length > 0 ? "---" + config.EOL + metadataStr + "---" : "";

        await writeToFile(toDir, fileName, header, "# " + title, bodyUrlReplaced, config.EOL);
      }

      editor.edit((e) => {
        const newLine = todoLine.text.replace(/- \[ \]/, "- [x]");
        e.replace(todoLine.range, newLine);
        if (todoContentsRange != null) {
          e.delete(todoContentsRange);
        }
      });
    }
  } catch (e) {
    vscode.window.showErrorMessage("Failed to write notes to file");
  }
}

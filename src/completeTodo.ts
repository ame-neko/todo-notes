/* eslint-disable @typescript-eslint/no-var-requires */
import { posix } from "path";
import * as vscode from "vscode";
import sanitize = require("sanitize-filename");
import * as path from "path";
import { parse, stringify, YAMLError } from "yaml";
import { getDateStr, loadConfiguration, parseMarkdown, replaceUrl, extensionConfig, loadIndentConfig, getIndentOfLine } from "./utils";
import * as fs from "fs";

interface yamlMetadata {
  FolderPath?: string;
  Title?: string;
  FileName?: string;
  CompletedDate?: string;
  AppendMode?: string;
}

class FileAlreadyExistError extends Error {}

const TODO_REGEX = /.*?- \[ \]\s*/;

async function writeToFile(
  folderUri: vscode.Uri,
  folderPath: string,
  fileName: string,
  header: string | null,
  title: string,
  body: string,
  EOL: string,
  config: extensionConfig,
  metadataAppendMode?: string
) {
  const writeStr = header != null ? header + EOL + title + EOL + body : title + EOL + body;
  let appendMode: extensionConfig["appendMode"] = config.appendMode;
  const metadataAppendModeLower = metadataAppendMode?.toLocaleLowerCase();
  if (metadataAppendModeLower && (metadataAppendModeLower === "append" || metadataAppendModeLower === "overwrite" || metadataAppendModeLower === "increment")) {
    appendMode = metadataAppendModeLower;
  }

  await vscode.workspace.fs.createDirectory(folderUri);
  let fileUri = folderUri.with({ path: posix.join(folderUri.path, fileName) });

  if (appendMode === "increment") {
    let fileNameIndex = 1;
    const fileNameWithoutExtension = path.parse(fileName).name;
    const extension = path.parse(fileName).ext;
    while (fs.existsSync(fileUri.path)) {
      fileUri = folderUri.with({ path: posix.join(folderUri.path, fileNameWithoutExtension + "-" + fileNameIndex + extension) });
      fileNameIndex += 1;
    }
  } else if (appendMode === "overwrite" && config.showDialogueWhenFileExist && fs.existsSync(fileUri.path)) {
    const answer = await vscode.window.showWarningMessage(`Note file ${fileName} already exist. Do you want to overwrite it?`, "Yes", "No");
    if (answer !== "Yes") {
      throw new FileAlreadyExistError(`Destination file ${fileUri.path} already exist.`);
    }
  }

  if (appendMode === "append" && fs.existsSync(fileUri.path)) {
    const fileData = await vscode.workspace.fs.readFile(fileUri);
    const writeData = Buffer.concat([fileData, Buffer.from(config.EOL + writeStr, "utf-8")]);
    await vscode.workspace.fs.writeFile(fileUri, writeData);
    vscode.window.showInformationMessage(`Todo content has been appended to "${folderPath + "/" + fileName}".`);
  } else {
    const writeData = Buffer.from(writeStr, "utf-8");
    await vscode.workspace.fs.writeFile(fileUri, writeData);
    vscode.window.showInformationMessage(`Todo content has been copied to "${folderPath + "/" + fileName}".`);
  }
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
function parseParentMetadata(element: any): yamlMetadata {
  let metadata = {};
  if (element?.children != null) {
    element.children.forEach((e: any) => {
      if (e?.type === "definition" && e?.identifier === "metadata" && e?.title) {
        const meta = parse(e.title);
        metadata = { ...meta, ...metadata };
      }
    });
  }
  if (element?.parent != null) {
    const parentMeta = parseParentMetadata(element.parent);
    metadata = { ...parentMeta, ...metadata };
  }
  return metadata;
}

function parseYamlMetadata(elementsList: any[], todoRange: vscode.Range): { metadata: yamlMetadata; metadataLines: number[] } {
  let metadata: yamlMetadata = {};
  let todoLineLevel = -1;
  const lines: number[] = [];
  elementsList.forEach((e) => {
    if (e?.position?.start?.line < todoRange.start.line + 1 || e?.position?.start?.line > todoRange.end.line + 1) {
      return;
    }
    if (isTodo(e) && e?.position?.start?.line === todoRange.start.line + 1) {
      todoLineLevel = e?.level;
      if (e?.parent != null) {
        metadata = parseParentMetadata(e.parent);
      }
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
    metadataLines: lines,
  };
}

function isChildTodoCompleted(elementsList: any[], todoContentsRange: vscode.Range) {
  for (const e of elementsList) {
    if (e?.position?.start?.line < todoContentsRange.start.line + 1 || e?.position?.start?.line > todoContentsRange.end.line + 1) {
      continue;
    }
    if (isTodo(e) && !e?.checked) {
      return false;
    }
  }
  return true;
}

function removeMetadataLineFromTodoContents(document: vscode.TextDocument, todoContentsRange: vscode.Range, metadataLines: number[]): string[] {
  const lines: string[] = [];
  for (let li = todoContentsRange.start.line; li <= todoContentsRange.end.line; li++) {
    if (!metadataLines.includes(li)) {
      lines.push(document.lineAt(li).text);
    }
  }
  return lines;
}

function removeIndentFromTodoContents(lines: string[], todoLine: string): string[] {
  const indentConfig = loadIndentConfig();
  const indentChar = indentConfig.useSpace ? " " : "\t";
  const numIndent = (getIndentOfLine(todoLine, indentChar) + 1) * indentConfig.tabSize;
  if (numIndent > 0) {
    const pattern = new RegExp(`^[${indentChar}]{0,${numIndent}}`);
    lines = lines.map((line) => {
      return line.replace(pattern, "");
    });
  }
  return lines;
}

export async function completeTodo(copyToNotes: boolean, removeContents: boolean) {
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
        if (!isChildTodoCompleted(parsed, todoContentsRange)) {
          const answer = await vscode.window.showWarningMessage("Uncompleted Todo exist. Do you want to proceed?", "Yes", "No");
          if (answer !== "Yes") {
            return;
          }
        }
        if (copyToNotes) {
          const { metadata, metadataLines } = parseYamlMetadata(parsed, todoRange);
          const folderPath: string = metadata.FolderPath ?? config.saveNotesPath;

          const title = metadata.Title ?? todoLine.text.replace(TODO_REGEX, "").trim();
          const fileName = sanitize(metadata.FileName ?? title + ".md");
          const workspaceFolderUri = vscode.workspace.workspaceFolders[0].uri;
          const toDir = workspaceFolderUri.with({ path: posix.join(workspaceFolderUri.path, folderPath) });
          const currentFilePath = vscode.window.activeTextEditor?.document.fileName;
          const fromDir = currentFilePath ? path.dirname(currentFilePath) : workspaceFolderUri.path;
          let lines = removeMetadataLineFromTodoContents(editor.document, todoContentsRange, metadataLines);
          lines = removeIndentFromTodoContents(lines, todoLine.text);
          const bodyUrlReplaced = replaceUrl(lines.join(config.EOL), fromDir, toDir.path);

          if (config.addCompletionDate) {
            metadata["CompletedDate"] = getDateStr(config);
          }
          const header = Object.keys(metadata).length > 0 ? "---" + config.EOL + stringify(metadata) + "---" : null;
          //TODO: ask user when the destination note already exist
          await writeToFile(toDir, folderPath, fileName, header, "# " + title, bodyUrlReplaced, config.EOL, config, metadata.AppendMode);
        }
      }

      editor.edit((e) => {
        const newLine = todoLine.text.replace(/- \[ \]/, "- [x]");
        e.replace(todoLine.range, newLine);
        if (removeContents && todoContentsRange != null) {
          // create new range to delete new line character in the todo line
          const removeRange = new vscode.Range(
            new vscode.Position(todoContentsRange.start.line - 1, editor.document.lineAt(todoContentsRange.start.line - 1).text.length),
            todoContentsRange.end
          );
          e.delete(removeRange);
          if (!copyToNotes) {
            vscode.window.showInformationMessage(`Todo content has been deleted.`);
          }
        }
      });
    }
  } catch (e) {
    if (e instanceof FileAlreadyExistError) {
      return;
    }
    if (e instanceof YAMLError) {
      vscode.window.showErrorMessage("Failed to parse metadata. Please make sure that metadata is written in YAML format.");
    } else {
      vscode.window.showErrorMessage("Failed to write notes to file.");
    }
  }
}

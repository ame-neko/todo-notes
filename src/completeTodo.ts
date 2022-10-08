const frontMatter = require("front-matter");
import { posix } from "path";
import * as vscode from "vscode";
import sanitize = require("sanitize-filename");
var unified = require("unified");
const remarkParse = require("remark-parse");

import * as path from "path";

interface editUrl {
  begin: number;
  end: number;
  oldUrl: string;
  newUrl: string;
}

function replaceUrl(text: string, from: string, to: string) {
  const parseResult = unified().use(remarkParse).parse(text);
  const changeUrlList: editUrl[] = getReplaceUrlList(parseResult, from, to);
  changeUrlList.sort((a, b) => b.begin - a.begin);
  changeUrlList.forEach((e) => {
    const partialText = text
      .substring(e.begin, e.end)
      .replace(e.oldUrl, e.newUrl);
    text =
      text.substring(0, e.begin) +
      partialText +
      text.substring(e.end, text.length);
  });
  return text;
}

function isURL(pathStr: string) {
  try {
    new URL(pathStr);
    return true;
  } catch {
    return false;
  }
}

function getReplaceUrlList(json: any, from: string, to: string): editUrl[] {
  const editUrls: editUrl[] = [];
  if (!json?.children) {
    return [];
  }
  const children: any[] = json.children;
  children.forEach((element: any) => {
    if (element?.type === "image") {
      const oldUrl = element.url;
      if (path.isAbsolute(oldUrl)) {
        return;
      }
      if (isURL(oldUrl)){
        return;
      }

      const newUrl = path.join(path.relative(to, from), oldUrl);
      editUrls.push({
        begin: element.position.start.offset,
        end: element.position.end.offset,
        oldUrl: oldUrl,
        newUrl: newUrl,
      });
    }
    if (element?.children) {
      editUrls.push(...getReplaceUrlList(element, from, to));
    }
  });
  return editUrls;
}

async function writeToFile(
  folderUri: vscode.Uri,
  todoTitle: string,
  contents: any,
  body: string
) {
  const title = "# " + (contents?.attributes?.title ?? todoTitle);
  const header = "---\n" + contents?.frontmatter + "\n---" ?? "";
  // TODO: change new line character
  const writeStr = header + "\n" + title + "\n" + body;
  const writeData = Buffer.from(writeStr, "utf-8");

  const fileName = sanitize(contents?.attributes?.fileName ?? title + ".md");
  const fileUri = folderUri.with({
    path: posix.join(folderUri.path, fileName),
  });
  await vscode.workspace.fs.createDirectory(folderUri);

  await vscode.workspace.fs.writeFile(fileUri, writeData);
}

function detectCompletedTodoRange(
  editor: vscode.TextEditor
): vscode.Range | null {
  if (editor.selection.active.line >= editor.document.lineCount - 1) {
    // no content
    return null;
  }
  const start = editor.selection.active.line + 1;
  let end;
  let endLineLength;
  for (let i = start; i < editor.document.lineCount; i++) {
    const line = editor.document.lineAt(i).text;
    // TODO: improve todo range detection rule
    if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
      if (i == start) {
        // no content
        return null;
      }

      end = i;
      endLineLength = 0;
      break;
    }
    end = i;
    endLineLength = line.length;
  }
  if (end != null && endLineLength != null) {
    return new vscode.Range(
      new vscode.Position(start, 0),
      new vscode.Position(end, endLineLength)
    );
  }
  return null;
}

export async function completeTodo() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    try {
      const currentLine = editor.document.lineAt(editor.selection.active.line);
      const newLine = currentLine.text.replace(/^- \[ \]/, "- [x]");
      if (!currentLine.text.startsWith("- [ ]")) {
        return;
      }
      const range = detectCompletedTodoRange(editor);
      if (range) {
        const title = currentLine.text.replace(/^- \[ \]\s*/, "");
        const text = editor.document.getText(range);
        const contents = frontMatter(text);

        const configurations = vscode.workspace.getConfiguration("todo-notes");
        if (!vscode.workspace.workspaceFolders) {
          vscode.window.showErrorMessage("No folder or workspace opened");
          throw new Error(
            "Failed to create file because no folder or workspace opened."
          );
        }
        const workspaceFolderUri = vscode.workspace.workspaceFolders[0].uri;
        const folderPath: string =
          contents?.attributes?.folderPath ??
          configurations.get("saveNotesPath") ??
          "";
        const folderUri = workspaceFolderUri.with({
          path: posix.join(workspaceFolderUri.path, folderPath),
        });

        const currentFilePath =
          vscode.window.activeTextEditor?.document.fileName;
        const fromDir = currentFilePath
          ? path.dirname(currentFilePath)
          : workspaceFolderUri.path;
        const body = replaceUrl(contents.body, fromDir, folderUri.path);
        await writeToFile(folderUri, title, contents, body);
      }
      editor.edit((e) => {
        e.replace(currentLine.range, newLine);
        if (range) {
          e.delete(range);
        }
      });
    } catch (e) {
      vscode.window.showErrorMessage("Failed to write notes to file");
    }
  }
}

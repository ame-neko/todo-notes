import { posix } from "path";
import * as vscode from "vscode";
import sanitize = require("sanitize-filename");
const frontMatter = require("front-matter");

async function writeToFile(todoTitle: string, contents: any) {
  const configurations = vscode.workspace.getConfiguration("todo-notes");
  const folderPath: string =
    contents?.attributes?.folderPath ??
    configurations.get("saveNotesPath") ??
    "";
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("No folder or workspace opened");
    throw new Error(
      "Failed to create file because no folder or workspace opened."
    );
  }
  const title = "# " + (contents?.attributes?.title ?? todoTitle);
  const header = "---\n" + contents?.frontmatter + "\n---" ?? "";
  const body = contents?.body ?? "";
  // TODO: change new line character
  const writeStr = header + "\n" + title + "\n" + body;
  const writeData = Buffer.from(writeStr, "utf-8");
  const workspaceFolderUri = vscode.workspace.workspaceFolders[0].uri;

  const folderUri = workspaceFolderUri.with({
    path: posix.join(workspaceFolderUri.path, folderPath),
  });
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
    console.log("start: " + start + ", end: " + end);
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
        await writeToFile(title, contents);
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

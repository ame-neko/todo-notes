import { posix } from "path";
import * as vscode from "vscode";

async function writeToFile(lines: string[]) {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("No folder or workspace opened");
    throw new Error(
      "Failed to create file because no folder or workspace opened."
    );
  }
  // TODO: change new line character
  const writeStr = lines.join("\n");
  const writeData = Buffer.from(writeStr, "utf-8");
  const folderUri = vscode.workspace.workspaceFolders[0].uri;
  const fileUri = folderUri.with({
    path: posix.join(folderUri.path, "test.txt"),
  });
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

function getTodoContents(
  editor: vscode.TextEditor,
  range: vscode.Range
): string[] {
  let lines: string[] = [];
  for (let i = range.start.line; i <= range.end.line; i++) {
    const line = editor.document.lineAt(i).text;
    lines.push(line);
  }
  return lines;
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
        const lines = getTodoContents(editor, range);
        await writeToFile(lines);
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

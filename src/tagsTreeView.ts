import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
const frontMatter = require("front-matter");

class Element extends vscode.TreeItem {
  type: "tag" | "file";
  name: string;
  filePath: string | null;
  constructor(type: "tag" | "file", name: string, filePath: string | null) {
    const collapsibleState: vscode.TreeItemCollapsibleState =
      type === "tag"
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    super(name, collapsibleState);
    this.type = type;
    this.name = name;
    this.filePath = filePath;
    if (type === "tag") {
      this.iconPath = new vscode.ThemeIcon("tag");
    } else {
      this.iconPath = new vscode.ThemeIcon("file");
    }
  }
}

export class NotesTagsProvider implements vscode.TreeDataProvider<Element> {
  tagToElements: { [key: string]: Element[] };
  constructor(private workspaceRoot: string) {
    this.tagToElements = {};
  }

  getTreeItem(element: Element): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Element): Thenable<Element[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No dependency in empty workspace");
      return Promise.resolve([]);
    }

    if (element) {
      // children
      if (element.name in this.tagToElements) {
        return Promise.resolve(this.tagToElements[element.name]);
      } else {
        return Promise.resolve([]);
      }
    } else {
      // root level
      return this.getAllTags();
    }
  }

  async walk(dirPath: string): Promise<Element[]> {
    const filePaths: Element[] = [];
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    dirents
      .filter((dirent) => !dirent.isDirectory())
      .forEach((dirent) => {
        const fp = path.join(dirPath, dirent.name);
        filePaths.push(new Element("file", dirent.name, fp));
      });
    await Promise.all(
      dirents
        .filter((dirent) => dirent.isDirectory())
        .map(async (dirent) => {
          const fp = path.join(dirPath, dirent.name);
          const children = await this.walk(fp);
          filePaths.push(...children);
        })
    );
    return filePaths;
  }

  async extractTagFromNote(fp: string): Promise<string[]> {
    const data = await fs.promises.readFile(fp, "utf-8");
    const yamlHeader = frontMatter(data);
    if (yamlHeader?.attributes?.tags) {
      if (Array.isArray(yamlHeader?.attributes?.tags)) {
        return yamlHeader?.attributes?.tags;
      } else if (typeof yamlHeader?.attributes?.tags === "string") {
        return [yamlHeader?.attributes?.tags];
      }
    }
    return [];
  }

  async getAllTags() {
    const elements = await this.walk(this.workspaceRoot);
    await Promise.all(
      elements.map(async (element) => {
        if (!element.filePath) {
          return;
        }
        const tags = await this.extractTagFromNote(element.filePath);
        tags.forEach((tag) => {
          if (tag in this.tagToElements) {
            this.tagToElements[tag].push(element);
          } else {
            this.tagToElements[tag] = [element];
          }
        });
      })
    );

    return Promise.resolve(
      Object.keys(this.tagToElements).map(
        (key) => new Element("tag", key, null)
      )
    );
  }
}

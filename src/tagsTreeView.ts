/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { loadConfiguration } from "./utils";
const frontMatter = require("front-matter");

export class Element extends vscode.TreeItem {
  type: "tag" | "file";
  name: string;
  filePath: string | null;
  constructor(type: "tag" | "file", name: string, filePath: string | null) {
    const collapsibleState: vscode.TreeItemCollapsibleState = type === "tag" ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
    super(name, collapsibleState);
    this.type = type;
    this.name = name;
    this.filePath = filePath;
    this.contextValue = type;
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

  private _onDidChangeTreeData: vscode.EventEmitter<Element | undefined | null | void> = new vscode.EventEmitter<Element | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Element | undefined | null | void> = this._onDidChangeTreeData.event;
  refresh(): void {
    this.tagToElements = {};
    this._onDidChangeTreeData.fire();
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
        return Promise.resolve(this.tagToElements[element.name].sort());
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
    const te: { [key: string]: Element[] } = {};
    await Promise.all(
      elements.map(async (element) => {
        if (!element.filePath) {
          return;
        }
        const tags = await this.extractTagFromNote(element.filePath);
        tags.forEach((tag) => {
          if (tag in te) {
            te[tag].push(element);
          } else {
            te[tag] = [element];
          }
        });
      })
    );

    // sort files
    Object.keys(te).forEach((key) => {
      te[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    this.tagToElements = te;

    return Promise.resolve(
      Object.keys(this.tagToElements)
        // sort tags
        .sort()
        .map((key) => new Element("tag", key, null))
    );
  }

  async createVirtualDocument(uri: vscode.Uri): Promise<string> {
    const config = loadConfiguration();
    const tag = uri.path;
    if (!this.tagToElements[tag]) {
      return "";
    }
    const texts = await Promise.all(
      this.tagToElements[tag]?.map((element) => {
        if (element.filePath) {
          return fs.promises.readFile(element.filePath, "utf-8");
        }
      })
    );
    return texts.filter((v) => typeof v === "string").join(config.EOL + config.EOL + "* * * * * * * * * * * * * * *" + config.EOL + config.EOL);
  }
}

import { LanguageClient } from "vscode-languageclient/node";
/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import { stringHashCode } from "./utils";
import { loadConfiguration } from "./vscodeUtils";
import {
  CreateVirtualDocumentParams,
  CREATE_VIRTUAL_DOCUMENT_METHOD,
  GET_ALL_TAGS_METHOD,
  RefreshTagsTreeParams,
  REFRESH_TAGS_TREE_METHOD,
  RenameTagParms,
  RENAME_TAG_METHOD,
} from "./constants";

const COLOR_IDS = ["charts.red", "charts.blue", "charts.yellow", "charts.orange", "charts.green", "charts.purple"];

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

    const config = loadConfiguration();
    if (type === "tag") {
      if (config.colorizeTagIcon) {
        this.iconPath = new vscode.ThemeIcon("tag", new vscode.ThemeColor(this.getColorId(name)));
      } else {
        this.iconPath = new vscode.ThemeIcon("tag");
      }
    } else {
      this.iconPath = new vscode.ThemeIcon("file");
    }
  }

  getColorId(name: string): string {
    return COLOR_IDS[Math.abs(stringHashCode(name) % COLOR_IDS.length)];
  }
}

export class NotesTagsProvider implements vscode.TreeDataProvider<Element> {
  tagToElements: { [key: string]: Element[] };
  client: LanguageClient;
  constructor(private workspaceRoot: string, client: LanguageClient) {
    this.tagToElements = {};
    this.client = client;

    this.client.onReady().then(() => {
      this.client.onNotification(REFRESH_TAGS_TREE_METHOD, (params: RefreshTagsTreeParams) => {
        this.tagToElements = params.tagsToElement;
        this._onDidChangeTreeData.fire();
      });
    });
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

  async callLanguageServerForTagTree(): Promise<Element[]> {
    const res: { tag: string; files: { name: string; filePath: string }[] }[] = await this.client
      .onReady()
      .then(() => this.client.sendRequest(GET_ALL_TAGS_METHOD));

    this.tagToElements = {};
    res.forEach((val) => (this.tagToElements[val.tag] = val.files.map((file) => new Element("file", file.name, file.filePath))));
    return res.map((val) => new Element("tag", val.tag, null));
  }

  getChildren(element?: Element): Thenable<Element[]> {
    if (this.workspaceRoot == null) {
      vscode.window.showInformationMessage("No dependency in empty workspace");
      return Promise.resolve([]);
    }

    if (element != null) {
      // children
      if (element.name in this.tagToElements) {
        return Promise.resolve(this.tagToElements[element.name].sort());
      } else {
        return Promise.resolve([]);
      }
    } else {
      // root level
      return this.callLanguageServerForTagTree();
    }
  }

  async callLanguageServerForVirtualDocument(uri: vscode.Uri, destinationPath: string | null): Promise<string> {
    const tag = uri.path;
    if (!this.tagToElements[tag]) {
      return "";
    }
    const config = loadConfiguration();
    const parms: CreateVirtualDocumentParams = { EOL: config.EOL, tag: tag, destinationPath: destinationPath ?? "" };
    return await this.client.onReady().then(() => this.client.sendRequest(CREATE_VIRTUAL_DOCUMENT_METHOD, parms));
  }

  async callLanguageServerToRenameTag(oldTag: string) {
    const newTag = await vscode.window.showInputBox({ placeHolder: oldTag, title: "Rename Tag", prompt: "Please input new name of tag." });
    if (newTag == null) {
      return;
    }
    if (!(oldTag in this.tagToElements)) {
      return;
    }
    const config = loadConfiguration();

    await Promise.all(
      this.tagToElements[oldTag].map((element) => {
        if (element.filePath == null) {
          return;
        }
        const parms: RenameTagParms = { filePath: element.filePath, oldTag: oldTag, newTag: newTag, EOL: config.EOL };
        return this.client.onReady().then(() => this.client.sendRequest(RENAME_TAG_METHOD, parms));
      })
    );
    this.refresh();
  }
}

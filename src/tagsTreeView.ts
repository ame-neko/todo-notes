import { LanguageClient } from "vscode-languageclient/node";
/* eslint-disable @typescript-eslint/no-var-requires */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { replaceUrl, stringHashCode } from "./utils";
import { extensionConfig, loadConfiguration } from "./vscodeUtils";
import { stringify } from "yaml";
import { CREATE_VIRTUAL_DOCUMENT_METHOD, GET_ALL_TAGS_METHOD } from "./constants";

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

export class NotesTagsProvider implements vscode.TreeDataProvider<Element>, vscode.CompletionItemProvider {
  tagToElements: { [key: string]: Element[] };
  client: LanguageClient;
  constructor(private workspaceRoot: string, client: LanguageClient) {
    this.tagToElements = {};
    this.client = client;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    const line = document.lineAt(position).text.trimStart();
    if (!line.startsWith("[metadata]: #") && !line.includes("Tags:")) {
      return;
    }
    const tags = Object.keys(this.tagToElements);
    return tags.map((tag) => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Keyword));
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
      .then(() => this.client.sendRequest(GET_ALL_TAGS_METHOD, { workspaceRoot: this.workspaceRoot }));

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

    return this.client
      .onReady()
      .then(() => this.client.sendRequest(CREATE_VIRTUAL_DOCUMENT_METHOD, { EOL: config.EOL, tag: tag, destinationPath: destinationPath }));
  }

  // async doRanmeTag(filePath: string, oldTag: string, newTag: string, config: extensionConfig) {
  //   const fileUri = vscode.Uri.parse(filePath);
  //   const text = await (await vscode.workspace.fs.readFile(fileUri)).toString();
  //   const yamlHeader = frontMatter(text);
  //   if (yamlHeader?.attributes == null || Object.keys(yamlHeader.attributes).length == 0) {
  //     return;
  //   }
  //   let newTags;
  //   if (yamlHeader?.attributes?.Tags != null) {
  //     if (Array.isArray(yamlHeader?.attributes?.Tags)) {
  //       newTags = yamlHeader.attributes.Tags.map((tag: string) => {
  //         if (tag === oldTag) {
  //           return newTag;
  //         }
  //         return tag;
  //       });
  //       newTags = Array.from(new Set(newTags));
  //     } else if (typeof yamlHeader?.attributes?.Tags === "string") {
  //       newTags = yamlHeader?.attributes?.Tags === oldTag ? newTag : yamlHeader?.attributes?.Tags;
  //     }
  //     yamlHeader.attributes.Tags = newTags;
  //   }
  //   const newHeader = "---" + config.EOL + stringify(yamlHeader.attributes) + "---";
  //   const newText = newHeader + config.EOL + yamlHeader.body ?? "";
  //   const writeData = Buffer.from(newText, "utf-8");
  //   await vscode.workspace.fs.writeFile(fileUri, writeData);
  // }

  async renameTag(oldTag: string) {
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
        // return this.doRanmeTag(element.filePath, oldTag, newTag, config);
      })
    );
    this.refresh();
  }
}

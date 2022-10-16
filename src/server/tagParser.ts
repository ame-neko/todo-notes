/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from "path";
import * as fs from "fs";
import { compareSortedArray, replaceUrl } from "../utils";
import { stringify } from "yaml";
const frontMatter = require("front-matter");

interface TagToFile {
  [key: string]: FileInfo[];
}

interface FileInfo {
  name: string;
  filePath: string;
  version: number;
  tags: string[];
}

export class TagHandler {
  tagToElements: TagToFile = {};
  notesDir = null;
  filePathToFileInfo: { [filePath: string]: FileInfo } = {};

  async extractTagFromNote(fp: string): Promise<string[]> {
    const data = await fs.promises.readFile(fp, "utf-8");
    const yamlHeader = frontMatter(data);
    if (yamlHeader?.attributes?.Tags) {
      if (Array.isArray(yamlHeader?.attributes?.Tags)) {
        return yamlHeader?.attributes?.Tags;
      } else if (typeof yamlHeader?.attributes?.Tags === "string") {
        return [yamlHeader?.attributes?.Tags];
      }
    }
    return [];
  }

  async walk(dirPath: string): Promise<FileInfo[]> {
    const filePaths: FileInfo[] = [];
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    dirents
      .filter((dirent) => !dirent.isDirectory())
      .forEach((dirent) => {
        const fp = path.join(dirPath, dirent.name);
        filePaths.push({ name: dirent.name, filePath: fp, version: -1, tags: [] });
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

  generateTagsToElements(elements: FileInfo[]): TagToFile {
    const te: TagToFile = {};
    elements.forEach((e) => {
      e.tags.forEach((tag) => {
        if (tag in te) {
          te[tag].push(e);
        } else {
          te[tag] = [e];
        }
      });
    });

    // sort files
    Object.keys(te).forEach((key) => {
      te[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    return te;
  }

  async getAllTags(workspaceRoot: string) {
    //   const config = loadConfiguration();
    const config = {
      saveNotesPath: "",
    };
    const elements = await this.walk(config.saveNotesPath ? path.join(workspaceRoot, config.saveNotesPath) : workspaceRoot);
    const te: TagToFile = {};
    await Promise.all(
      elements.map(async (element) => {
        if (!element.filePath) {
          return;
        }
        const tags = await this.extractTagFromNote(element.filePath);
        element.tags = tags;
        tags.forEach((tag) => {
          if (tag in te) {
            te[tag].push(element);
          } else {
            te[tag] = [element];
          }
        });
      })
    );

    this.tagToElements = this.generateTagsToElements(elements);
    Object.keys(te).forEach((key) => {
      te[key].forEach((fileInfo) => (this.filePathToFileInfo[fileInfo.filePath] = fileInfo));
    });

    return Promise.resolve(
      Object.keys(te)
        // sort tags
        .sort()
        .map((key) => {
          return { tag: key, files: te[key] };
        })
    );
  }

  async createVirtualDocument(tag: string, destinationPath: string | null, EOL: string): Promise<string> {
    if (this.tagToElements == null || this.tagToElements[tag] == null) {
      return "";
    }
    const texts = await Promise.all(
      this.tagToElements[tag]?.map((element) => {
        if (element.filePath) {
          return fs.promises.readFile(element.filePath, "utf-8").then((text) => {
            return element.filePath && destinationPath != null ? replaceUrl(text, path.dirname(element.filePath), destinationPath) : text;
          });
        }
      })
    );
    return texts.filter((v) => typeof v === "string").join(EOL + EOL + "* * * * * * * * * * * * * * *" + EOL + EOL);
  }

  async renameTag(filePath: string, oldTag: string, newTag: string, EOL: string) {
    const text = await (await fs.promises.readFile(filePath)).toString();
    const yamlHeader = frontMatter(text);
    if (yamlHeader?.attributes == null || Object.keys(yamlHeader.attributes).length == 0) {
      return;
    }
    let newTags;
    if (yamlHeader?.attributes?.Tags != null) {
      if (Array.isArray(yamlHeader?.attributes?.Tags)) {
        newTags = yamlHeader.attributes.Tags.map((tag: string) => {
          if (tag === oldTag) {
            return newTag;
          }
          return tag;
        });
        newTags = Array.from(new Set(newTags));
      } else if (typeof yamlHeader?.attributes?.Tags === "string") {
        newTags = yamlHeader?.attributes?.Tags === oldTag ? newTag : yamlHeader?.attributes?.Tags;
      }
      yamlHeader.attributes.Tags = newTags;
    }
    const newHeader = "---" + EOL + stringify(yamlHeader.attributes) + "---";
    const newText = newHeader + EOL + yamlHeader.body ?? "";
    const writeData = Buffer.from(newText, "utf-8");
    await fs.promises.writeFile(filePath, writeData);
  }

  async handleSavedFile(fileUri: string, languageId?: string, version?: number) {
    if (languageId != null && languageId !== "markdown") {
      return;
    }
    if (!fileUri.startsWith("file://")) {
      return;
    }
    const filePath = fileUri.substring("file://".length);
    if (this.filePathToFileInfo[filePath] == null || version == null || this.filePathToFileInfo[filePath].version !== version) {
      const tags = await this.extractTagFromNote(filePath);
      let newFileInfo: FileInfo;
      if (this.filePathToFileInfo[filePath] != null) {
        if (version != null) {
          this.filePathToFileInfo[filePath].version = version;
        }
        const oldTags = this.filePathToFileInfo[filePath].tags;
        if (compareSortedArray(tags.sort(), oldTags.sort())) {
          // tags not changed
          return;
        }
        this.filePathToFileInfo[filePath].tags = tags;
      } else {
        // new file
        const fileName = path.basename(filePath);
        newFileInfo = { name: fileName, filePath: filePath, version: version ?? -1, tags: tags };
        this.filePathToFileInfo[filePath] = newFileInfo;
      }
    }

    this.tagToElements = this.generateTagsToElements(Object.values(this.filePathToFileInfo));
    return this.tagToElements;
  }
}

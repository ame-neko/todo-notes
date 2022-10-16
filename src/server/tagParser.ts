/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from "path";
import * as fs from "fs";
import { replaceUrl } from "../utils";
import { stringify } from "yaml";
const frontMatter = require("front-matter");

interface TagToFile {
  [key: string]: FileInfo[];
}

interface FileInfo {
  name: string;
  filePath: string;
}

export class TagHandler {
  tagToElements: TagToFile = {};

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
        filePaths.push({ name: dirent.name, filePath: fp });
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
}

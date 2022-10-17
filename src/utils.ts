/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from "path";
const unified = require("unified");
const remarkParse = require("remark-parse");
const remarkGfm = require("remark-gfm");

export const SPECIAL_METADATA_NAMES = ["Tags", "FolderPath", "Title", "FileName", "AppendMode", "CreatedDate"];

export function getIndentOfLine(line: string, indentChar: " " | "\t"): number {
  let numIndent = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === indentChar) {
      numIndent += 1;
    } else {
      break;
    }
  }
  return numIndent;
}

export function replaceUrl(text: string, from: string, to: string) {
  const flattened = parseMarkdown(text);
  const newTextList = [];
  let currentIndex = 0;
  flattened.forEach((element: any) => {
    if (element?.type === "image") {
      const oldUrl = element.url;
      if (path.isAbsolute(oldUrl)) {
        return;
      }
      if (isURL(oldUrl)) {
        return;
      }

      const newUrl = path.join(path.relative(to, from), oldUrl);
      const begin = element.position.start.offset;
      const end = element.position.end.offset;

      newTextList.push(text.substring(currentIndex, begin));
      newTextList.push(text.substring(begin, end).replace(oldUrl, newUrl));
      currentIndex = end;
    }
  });
  newTextList.push(text.substring(currentIndex, text.length));

  return newTextList.join("");
}

function flattenParsedMarkDown(elementsList: any[], parsed: any, level: number) {
  parsed.level = level;
  elementsList.push(parsed);
  if (parsed?.children) {
    [...parsed.children].forEach((e) => {
      // Create a link to the parent
      e.parent = parsed;
      flattenParsedMarkDown(elementsList, e, level + 1);
    });
  }
  return elementsList;
}

function isURL(pathStr: string) {
  try {
    new URL(pathStr);
    return true;
  } catch {
    return false;
  }
}

export function parseMarkdown(text: string) {
  const parseResult = unified().use(remarkParse).use(remarkGfm).parse(text);
  const flattend: any[] = flattenParsedMarkDown([], parseResult, 0);
  flattend.sort((a, b) => a.position.start.line - b.position.start.line);
  return flattend;
}

export function stringHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    hash = hash * 31 + charCode;
    hash = hash | 0;
  }
  return hash;
}

export function compareSortedArray(a: any[], b: any[]): boolean {
  if (a.length != b.length) {
    return false;
  }
  if (a === b) {
    return true;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return true;
}

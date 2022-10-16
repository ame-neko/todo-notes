export interface CreateVirtualDocumentParams {
  EOL: string;
  tag: string;
  destinationPath: string;
}
export const CREATE_VIRTUAL_DOCUMENT_METHOD = "createVirtualDocument";
export interface GetAllTagsParams {
  workspaceRoot: string;
}
export const GET_ALL_TAGS_METHOD = "getAllTags";
export interface RenameTagParms {
  filePath: string;
  oldTag: string;
  newTag: string;
  EOL: string;
}
export const RENAME_TAG_METHOD = "renameTag";

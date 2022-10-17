export interface CreateVirtualDocumentParams {
  EOL: string;
  tag: string;
  destinationPath: string;
}
export const CREATE_VIRTUAL_DOCUMENT_METHOD = "createVirtualDocument";
export const GET_ALL_TAGS_METHOD = "getAllTags";
export interface RenameTagParms {
  filePath: string;
  oldTag: string;
  newTag: string;
  EOL: string;
}
export const RENAME_TAG_METHOD = "renameTag";

export interface RefreshTagsTreeParams {
  tagsToElement: any;
}
export const REFRESH_TAGS_TREE_METHOD = "refreshTagsTree";

export interface FileSavedParams {
  filePath: string;
}
export const FILE_SAVED_NOTIFICATION_METHOD = "fileSavedNotifiation";

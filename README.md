# Todo Notes

Manage todo and take notes in markdown.

## Features

* Move todo contents to notes directory when the todo task is completed.  
  By using the `Complete Todo and Copy to Notes` command (`ctrl+d` or `cmd+d`), the contents of the checkbox at the cursor's location are copied to the notebook.
  ![](https://github.com/pixel-png/todo-notes/blob/master/images/complete-todo-explanation.gif)
  
* Links to image files are automatically updated.  
* Metadata can be added to each todo task. Metadata is converted to yaml front matter in the destination note.  
  - You can add any metadata in following syntax:   
    `[metadata]: # (YOUR_METADATA_KEY_VALUE_IN_YAML_FORMAT)`
  - Special metadata:  
    - `[metadata]: # (Tags: [])`: Tags of notes. Notes are categorized by tags in tree view.
    - `[metadata]: # (Title: )`: Title of note markdown. The title will be inserted on the first line of the note. Default is the text of checkbox.
    - `[metadata]: # (FileName: )`: File name of note where todo contents will be copied.
    - `[metadata]: # (FolderPath: )`: Specify the path from workspace where note file will be created (Default: The value of `todoNotes.saveNotesPath` setting).
  ![](https://github.com/pixel-png/todo-notes/blob/master/images/metadata-explanation.gif)
* Tree view is generated based on the tags of each notes.  
    Tags need to be specified in yaml front matter of each note files.  
    For example:
    ```
    ---
    Tags: [TAG_A, TAG_B]
    ---
    YOUR NOTES CONTENTS
    ```
* You can generate a virtual document that contains the contents of all notes for a given tag.
  ![](https://github.com/pixel-png/todo-notes/blob/master/images/tag-tree-explanation.gif)

## Keybindings
* `ctrl+k` (`cmd+k`): Add new checkbox with template.
* `ctrl+d` (`cmd+d`): Set checkbox checked and copy todo contents to new note file.
* `ctrl+alt+j` (`cmd+alt+j`): Set checkbox checked.
* `ctrl+e` (`cmd+e`): Set checkbox checked and delete contents of todo.

## Extension Settings

This extension contributes the following settings:

* `todoNotes.saveNotesPath`: Path to directory where notes will be saved.
* `todoNotes.todoRangeDetectionMode`: Toggle todo range detection mode. strict: Detect todo range strictly following GFM markdwon syntax. next-todo: Todo range continues until next same or higher indent level todo.
* `todoNotes.eol`: End of Line character of created note.


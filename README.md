# Todo Notes

Manage todo and take notes in markdown.

## Features

* Move todo contents to notes directory when the todo task is completed.
  * Links to image are automatically updated.
* Metadata can be added to each todo task. Metadata is converted to yaml front matter in the destination note.
* Tree view is generated based on the tags of each notes.
* You can generate a virtual document that contains the contents of all notes for a given tag.

## Extension Settings

This extension contributes the following settings:

* `todoNotes.saveNotesPath`: Path to directory where notes will be saved.
* `todoNotes.todoRangeDetectionMode`: Toggle todo range detection mode. strict: Detect todo range strictly following GFM markdwon syntax. next-todo: Todo range continues until next same or higher indent level todo.
* `todoNotes.eol`: End of Line character of created note.


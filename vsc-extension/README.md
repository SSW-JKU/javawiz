# JavaWiz

JavaWiz is a visualization plugin for Java programs targeted at programming beginners. Users can step through the program line by line and follow the execution in the visualization panel.

JavaWiz is developed and maintained by the [Institute for System Software](https://ssw.jku.at/), Johannes Kepler University Linz, Austria.

## Features
At the moment it provides eight visualizations:
- Flow charts, visually representing the control flow of the program.
- A memory visualization. It displays statics, the stack, and the heap, to help understand how program memory works.
- A "tabular view" displaying the variable changes from line to line, which is useful for understanding simple algorithms.
- Three dedicated visualizations for 
  - arrays,
  - singly linked lists, and 
  - binary trees
  
  The goal is a simple and easy-to-follow representation to support understanding algorithms on these data structures.
- Sequence diagrams, which shows how objects relate to each other by depicting the method calls between them.
- Input buffer visualization
  - _Hint: To use this feature, you have to use JavaWiz's `In.java` class to read input. This class can easily be added to your project by right-clicking on the project folder in the explorer and selecting "Create In.java"._

## How to use
The extension requires at least **JDK 17** to run.

### Start

After installing JavaWiz from the VSCode marketplace and opening a .java file, the tool can be started by either:
- clicking <kbd>Run in JavaWiz</kbd> above the main method, or
- right click into the opened editor and selecting <kbd>Run in JavaWiz</kbd> from the context menu, or
- using the shortcut <kbd>CTRL + SHIFT + J</kbd>.

### Navigation

***An explanation of the user interface can be accessed by clicking on the Help button inside JavaWiz.***

The arrow buttons in the toolbar navigate through the program, the yellow arrow restarts the program.

It is possible to step back and repeat parts of the program, i.e., there's no need to restart the program to re-inspect previous steps.

The current status (_live_ or _replay_) is displayed in the toolbar.

The visualization tools (heap view, desk test, etc.) can be revealed using the selection buttons on the main view.
To close a tool, press ❌.
Some tools are customizable. Change their settings by pressing ⚙.

### Code completion

For didactic reasons, certain code completion features can be activated and deactived using JavaWiz.
For this, use the _Disable Advanced Java Support_ and _Enable Advanced Java Support_ context menu items in the editor.

## Further information

Please note that the tool is targeted at beginners and is under active development, so not all language features of Java might be supported.

--------------------------------------
<font size="2">Icon sources:
- Desk test button: made by <a href="https://www.flaticon.com/authors/darius-dan" title="Darius Dan">Darius Dan</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Editor button: made by <a href="https://www.flaticon.com/authors/becris" title="Becris">Becris</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Stack button: made by <a href="https://www.flaticon.com/authors/hirschwolf" title="hirschwolf">hirschwolf</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Heap button: made by <a href="https://www.flaticon.com/authors/alfredo-hernandez" title="Alfredo Hernandez">Alfredo Hernandez</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Wizard in help menu: made by <a href="https://www.flaticon.com/authors/smashicons" title="Smashicons">Smashicons</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Live/replay indicators: made by <a href="https://www.flaticon.com/authors/google" title="Google">Google</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.com</a>
- Help button: made by <a href="https://www.flaticon.com/authors/freepik" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon"> www.flaticon.
  com</a>
- Linked list, tree, forwards/backwards, step over, reset button: made by SSW
</font>

All notable changes to this project will be documented in this file.

[1.7.3] (released on 2025-04-28)
* JW-290: Migrate to composition API
* JW-293: Migrate from webpack to vite
* JW-305: Flowchart: Rectangles for inline methods are not correctly sized for constructor calls
* JW-306: Failed In.open() produces ugly output in Input view
* JW-307: StepOver targetReached incorrect
* JW-308: Reunify eslint versions
* JW-312: Update In.java, Out.java and Rand.java to match JKU-SW1-Style
* JW-313: Put the HTML code for javawiz.net in the repository

[1.7.2] (released on 2025-02-03)
* JW-302: "Auto inline methods" in flowchart broken
* JW-303: Rectangle that indicates method in flowchart is not wide enough

[1.7.1] (released on 2025-01-13)
* JW-295: Change changelog.md to CHANGELOG.md
* JW-296: Add a SUPPORT.md to the VSC extension
* JW-297: Add galleryBanner information to package.json to provide nicer marketplace experience
* JW-298: Check package.json for adherence to https://code.visualstudio.com/api/references/extension-manifest
* JW-300: Set license to GPL3
* JW-301: Test on latest JDK and LTS JDKs on build; provide testAll gradle task to test on all JDKs

[1.7.0] (released on 2025-01-07)
* JW-154: Do not show "Wont Fix" issues on release changelog.
* JW-180: Move from javaparser to java.compiler API
* JW-223: Sequence Diagrams
* JW-246: Warn the user if they use unsupported features
* JW-247: Flowcharts: Method expansion
* JW-264: Hover Sync: Unhover in heap not always triggered
* JW-265: Replace ClassVisitor by Symbol table resolution
* JW-267: Create context menu item to auto-generate In/Out/Rand
* JW-269: Error messages in frontend broken:
* JW-270: List Viz broken on complex nodes
* JW-271: Cannot manually create In/Out inside package in web version
* JW-272: First class is main by default feature broken
* JW-273: Desk Test: Uri resolution broken
* JW-274: Frontend randomly freezes
* JW-275: Sequence diagrams: No expand feature if nothing to expand
* JW-277: Hover Sync: Statics highlighting broken for classes inside packages
* JW-279: Sequence Diagrams: Collapse broken
* JW-280: NullPointerException: sym.owner null
* JW-281: "Disable/Enable Advanced Java Support" context menu entries are also visible in non-Java files
* JW-282: Refactor main-branch to simplify merging into Espresso&WebImage-branch
* JW-283: Cache backend.js (WebImage)
* JW-285: Editor broken on reload
* JW-287: Hover performance: Heap view is redrawn even without relevant changes
* JW-288: Pattern matching instanceof (e.g., x instanceof Person p) not working
* JW-289: List view properties in dropdows (class names) cannot be changed
* JW-291: Extension: File loading unreliable

[1.6.1] (released on 2024-08-22)
* JW-18: Check the Java version of the user and give a warning if it's too low
* JW-156: Show better error message when no Java is found on path
* JW-174: Synchronized highlight across visualizations
* JW-186: Compile in extension mode even though unused java files in workspace have syntax errors
* JW-187: Warn user when they use threads
* JW-235: Check all z-index in the whole frontend and try to somehow find a suitable system to organize them (central documentation?)
* JW-253: Repeatedly hitting 'Run in JavaWiz' breaks line highlighting
* JW-254: InViz shows incorrect return type on 'In.open()'
* JW-256: Extension cannot be restarted after being stopped
* JW-257: Auto-reconnect in front end causes disconnection
* JW-263: Extension does not reliably kill debugger
* JW-286: Frontend extremely slow in development mode

[1.6.0] (released on 2024-07-24)
* JW-139: InViz: Pane should have correct height on first show
* JW-185: DeskTest: Header hidden when scrolling down, make sticky
* JW-190: Extension: Don't stop debug on editor close
* JW-193: Improve splitpanes layouting
* JW-194: Generate WebImage configuration for reflection with a script
* JW-198: Close running JavaWiz if "Run in JavaWiz" is pressed again
* JW-200: Connection failed error on javawiz startup
* JW-202: Add "About" and "Developers" information
* JW-206: Flowcharts: zoom to home activated when stepping into method of class defined in seperate file
* JW-207: Re-enable static examples loadable via uri
* JW-208: [ArrayViz] Animation for array movements does not work if array becomes pointed by two local variables
* JW-209: ArrayViz: Null pointers are not visible
* JW-210: Parameterize Tests
* JW-211: FlowDiagram: Visualization should remember whether true-false or false-true order was selected for if-statements.
* JW-212: InputViz and Console (I/O view) are separated by a splitpane, but InputViz is not resizeable -> Make InputViz resizable
* JW-213: Separate console from InViz
* JW-214: Remove fakedLocals
* JW-215: Backend Support for Object Structure Visualization
* JW-218: Clean up code (Reduce amount of Code in Home.vue, introduce Pinia stores, etc.)
* JW-219: Remove minimap from Monaco
* JW-220: Make DeskTest correctly scrolling again
* JW-221: Give JavaWiz a real favicon and drop the default vue one
* JW-222: Object Structure Visualization: Do not call method while in constructor
* JW-224: [SplitPanes]: "Open XYZ" to "Move XYZ" and make all buttons purely white
* JW-225: [SplitPanes]: ToolTips are cut off
* JW-226: Show compilation erros in console instead of pop-up
* JW-228: Rework toolbar, unify color format, remove unnecessary borders, ...
* JW-229: Update help pop-up
* JW-230: Automatically reconnect if "Connect" button does not succeed
* JW-231: [SplitPanes]: Center visualization chooser
* JW-232: Rework Icon Tooltips
* JW-233: [Toolbar] Show all step buttons side-by-side by default and switch to "dropdown mode" for small-width screens
* JW-234: [Toolbar] Fix that tooltips do not disappear if mouse moves over them
* JW-237: Flowchart: statics overlay overlaps with navbar
* JW-239: Line stays highlighted on debug end
* JW-240: Refactor Notifications into separate component
* JW-241: graphviz loading broken in extension mode
* JW-242: Splitpanes not rendered correctly
* JW-243: Top toolbar jiggly when compilation spinner is shown
* JW-244: Help Overlay overflows screen
* JW-248: Make Gradle toolchains work again
* JW-249: Introduce general "Overlay" component to allow easy adding of new dialogs
* JW-250: Show JavaWiz version in title bar and about overlay
* JW-252: Make OutOfMemoryError-Test more robust
* JW-258: Multifile Handling: Line highlighting broken in web editor

[1.5.3] (released on 2024-04-14)
* JW-9: Automatic zoom does not work perfectly sometimes
* JW-13: Discuss future of web version
* JW-24: Discuss future of hiding configuration
* JW-173: Multifile in web version
* JW-178: Remove Feature: Keyboard navigation
* JW-191: Remove bootstrap dependency
* JW-203: No value present error on startup in extension version
* JW-204: Web Version: Store Editor Text in Local Storage and Retrieve on Load
* JW-205: Input Viz does not show anything

[1.5.2] (released on 2024-02-20)
* JW-171: Make internal class patterns modifiable
* JW-179: Remove websockethistory
* JW-182: Hide inner classes of hidden classes automatically
* JW-183: InViz does not work

[1.5.1] (released on 2024-02-13)
* JW-181: Fix which panes are hidden by default

[1.5.0] (released on 2024-02-13)
* JW-57: Changes are currently calculated from trace state to trace state. Yet, after performing a STEP_OVER, STEP_OUT or RUN_TO_LINE, changes should be calculated across all relevant trace states.
* JW-144: DebugWebSocketServerTest.kt: Get rid of warnings (unnecessary casts, etc.)
* JW-148: Flowchart: Variable info box stops moving during animation if one hovers it
* JW-152: Parse error in vsc does not indicate File name where problem occurred
* JW-155: Desktest: Array dropdown broken
* JW-157: Border of second column in Desk Test is visible when hovering it
* JW-158: Input buffer visualization is slow when In is in package inout
* JW-159: ArrayViz: Filter variables by dynamic type rather than static type
* JW-160: Pressing CTRL+Minus while JavaWiz is running opens settings.json
* JW-161: First "Run with JavaWiz" after VSCode start (or PC reboot?) is nearly always stuck in endless loop
* JW-162: Upgrade d3 to v7, d3-graphviz to v5.2.0, @hpcc-js/wasm to 2.14.1 (Graphviz 9.0.0)
* JW-163: Flowchart: Cannot enter "this"-call in constructor.
* JW-164: Flowcharts: inline functions broken for static constructor
* JW-165: TreeViz: Cannot read properties of undefined (reading 'children')
* JW-168: Router paths broken in vue-cli serve
* JW-169: Processed Trace State in Home.vue stays undefined after first step
* JW-170: Flowcharts: variable overlay hidden when on last line of while loop
* JW-172: Discussion: where to put hiding buttons
* JW-175: On syntax error, javawiz shows javaparser error rather than compiler error
* JW-176: Flowcharts: to hide or not to hide variable overlay
* JW-177: Print source file on compile/parse error

[1.4.4] (released on 2023-10-04)
* JW-146: Slow changed detection for array cells in Trace#calculateProcessedTraceState
* JW-147: In DeskTest, instructions are not cut off at cell end
* JW-149: Change order of visualizations
* JW-150: Store visualization visibility in local storage and restore settings for subsequent sessions
* JW-153: Change DeskTest borders to better fit its new position

[1.4.3] (released on 2023-09-25)
* JW-145: Do not show sequence diagram icon yet

[1.4.2] (released on 2023-09-22)
* JW-129: Also print stderr and not only stdout during publish - and print them constantly
* JW-141: Publish Script: Only commit new version to repo if publish was successful
* JW-143: Build script: Backend is not always copied to extension assets

[1.4.1] (released on 2023-09-21)
* JW-130: InViz: Use monospace at suitable locations
* JW-131: InViz: Write In.done() value in green (true) and red (false)
* JW-132: InViz: Change "Return value" to "Latest return value" and use correct quotation for strings and chars
* JW-133: InViz: Show type and name of last called In-method
* JW-134: InViz: Font size should match other visualizations such as desk test
* JW-135: InViz: Sanitize and escape char values, shorten long strings and long floating point numbers
* JW-136: Change generateVizString in DataProcessor to put ellipsis in the middle of the string and not at the end
* JW-138: Flowcharts: Hide variable info pane on hover (or make it (semi-)transparent)
* JW-140: print_changelog_from_youtrack.py should only consider resolved issues

[1.4.0] (released on 2023-09-21)
* JW-26: Create a knowledge base with important information
* JW-36: Zoom buttons for HeapViz
* JW-84: History-based back stepping
* JW-88: Order of DeskTest columns should correspond to stack frame order
* JW-89: DeskTest: move conditions from separate column to their scope
* JW-91: New Input Stream Visualization system
* JW-100: Flowcharts: Show variable value on hover
* JW-101: Flowcharts: Improve Layout
* JW-105: Flowcharts: Statements are highlighted in all inline methods
* JW-106: Flowcharts: add sidebar icons analogous to list/array viz
* JW-107: Flowcharts: Inline methods don't work correctly
* JW-109: Flowchart: crash in following case
* JW-110: Flowcharts: elements that contain active inline functions are collapsible
* JW-111: Flowcharts: comments and statements get swapped
* JW-112: Don't show locals that went out of scope
* JW-113: Flowcharts: Highlight end of method
* JW-114: HeapViz: add Navigation Bar
* JW-115: Flowcharts: Don't show locals that went out of scope
* JW-116: Flowcharts: move to active statement
* JW-117: Flowcharts: Method Inlining broken for DoWhile Conditions
* JW-118: Debuggee not killed in extension
* JW-119: Flowcharts: show static values in corner
* JW-120: Flowchart Layout: IfThenElse broken when condition has inlined method
* JW-121: Flowcharts: Enable method calls from external classes
* JW-122: Flowcharts: Inline method hitboxes positioned incorrectly in for loop
* JW-123: Flowcharts: Properly enable Multi-File Handling
* JW-124: Flowcharts: Control structures without block don't work
* JW-125: Flowcharts: Autoinlining broken for method calls inside packages
* JW-126: Flowcharts: end of method triangle positioned inconsistently
* JW-127: Flowcharts: Method bounding box calculation not updated
* JW-128: Flowchart: Inline method render gets without completing

[1.3.2] (released on 2023-07-12)
* JW-50: Discuss representation of floating point values
* JW-102: Auto-focus console when waiting for input
* JW-104: Handle InputResponses correctly in frontend

[1.3.1] (released on 2023-07-05)
* JW-77: Refactor code of data structure visualizations
* JW-93: Support node values of different dynamic types in list visualization
* JW-98: Certain steps sometimes not correctly resumed after being suspended by input

[1.3.0] (released on 2023-07-04)
* JW-15: Rework/rethink isInputExpected
* JW-19: Current date is shortly visible when starting the frontend in the extension
* JW-31: Implicit toString() (probably in combination with a string concat) can show Java-internal stack frames + Out.print(Object) can show "Out-internal" stack frames
* JW-34: Special characters are not displayed correctly in outputs
* JW-43: Trace array access in the backend for visualization
* JW-44: Array visualization
* JW-48: processedTrace and deskTestLines should be updated incrementally instead of fully when new trace states are added
* JW-49: Step buttons should be disabled while vm.currentlyTalking is true
* JW-52: Make sure that RUN_TO_LINE feature does not only take class name into account but also package name
* JW-53: When performing "Run in JavaWiz", WebView sometimes cannot be opened, especially after extension rebuilding and publishing.
* JW-54: Input and output should also work for STEP_OVER and RUN_TO_LINE
* JW-55: In a for-loop, sometimes the $JavaWiz-internal call is visible on the stack, even though a class filter is set in the debugger
* JW-56: Remove exception line number adjustment code if not needed anymore.
* JW-60: Runtime exception in backend when starting workspace
* JW-61: Make Run-To-Line Input field execute on pressing ENTER
* JW-62: Enable Debugger to handle multiple events per eventSet, as well as multiple eventSets in eventQueue
* JW-63: Create typing for StepResult on frontend
* JW-64: Reintroduce the user notification that the program is waiting for input
* JW-65: Disable step buttons once we reach end of trace and isVMRunning-flag of last step result was false
* JW-67: Fuzzy checking for class names in data structure visualizations
* JW-68: Inconsistent handling of escape characters
* JW-69: Enum.valueOf displayed in stack
* JW-70: In the desk test, for loops do not display the last value of their loop variable once the conditions goes false.
* JW-71: NullPointerException in backend when calling constructor of static inner class
* JW-72: Discuss Exception tracing/visualization
* JW-74: .vscode folder that is created to store settings confuses users, need to get rid of it
* JW-75: Strings too large in desktest
* JW-76: NoSuchElementException on backend in recursive program
* JW-78: More step features
* JW-79: Opening Array visualization crashes frontend
* JW-80: Update extension's README to include data structure visualizations
* JW-85: Refactor DeskTest CSS
* JW-95: RUN_TO_END prematurely kills VM if input is expected
* JW-96: After input, just continue the previous step request (if existing) instead of performing a single STEP_INTO and then continuing
* JW-97: Some backend unit tests are broken

[1.2.1] (released on 2023-01-18)
* JW-17: Update icons in toolbar

[1.2.0] (released on 2023-01-01)
* JW-4: Multi-File support
* JW-10: More step features: "Step into", "Step over", "Run to line X"
* JW-39: Error messages can be hard to read -> Display error messages in console instead of in popups
* JW-42: Having a text field selected in the DataStructureViz configuration pane, pressing the arrow keys also steps through trace states
* JW-45: Multi-File Support: WebView loses focus after opening new editor
* JW-46: Limiting float precision in visualization doesn't work in arrays
* JW-51: Use JUnit Assertions in test cases

[1.1.1] (released on 2022-12-02)
* JW-41: Additional node is shown when fields of Node class are arranged in certain order

[1.1.0] (released on 2022-12-01)
* JW-2: Condition followed by Blockkommentar seems to break JavaWiz
* JW-3: Mail Report: Broken Heap Vizualization
* JW-5: Dynamic data structure visualization
* JW-6: Do not show desk test by default
* JW-7: Changes are not correctly detected in recursive calls
* JW-8: Reduce amount of pop-up boxes in JavaWiz VSC extenstion
* JW-14: Stop heap vis. from jiggling after spamming step button
* JW-21: Make sure the $JavaWiz class is accessible everywhere
* JW-23: Desk test should auto-scroll
* JW-25: Display returned objects after return
* JW-27: Do not enter default constructor
* JW-29: Synchronize fonts between heapviz and data structure visualization
* JW-30: Collapse objects if they have more than X fields
* JW-32: Write " ... show X more fields ..." instead of "! show more" below collapsed large objects in HeapViz
* JW-33: Instead of / Additionally to collapsing large heap objects in HeapViz, by default do not expand fields of large objects

[1.0.1] (released on 2022-11-11)
* JW-92: Tee debugger stdout & stderr into logging files

[1.0.0] (released on 2022-11-09)
* JW-1: First issue


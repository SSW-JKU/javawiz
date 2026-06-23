* JW-304: Add frontend debug configurations for VS Code and IntelliJ
* JW-338: IntelliJ Plugin
* JW-339: IntelliJ Plugin: Correctly fill in plugin.xml according to JetBrains documentation
* JW-343: Update Java (25), Kotlin (2.3) and Gradle (9.x) version
* JW-344: Upgrade all Frontend dependencies to latest version
* JW-348: Enhance build script such that it can work with four-place numbers (A.B.C.D)
* JW-349: Provide setting to release without testing (for quick-fixes after broken releases)
* JW-350: Do not access the `Project` object at run time in Gradle build script as this is deprecated
* JW-351: Enable bug report feature -- without leaking Discord webhook this time
* JW-352: Add globals.browser to eslint definition
* JW-353: Fix build script such that versions with numbers >= 10 are working (such as 1.8.10)
* JW-354: Rename CNAME.txt to CNAME
* JW-355: Rename "javawiz-frontend" project to "frontend", rename "websocket-debugger" to "backend", and clean up IntelliJ project
* JW-356: Check whether "defineComponent" is really needed in <script setup>
* JW-357: Refactor visualization store to provide uniform way to define new visualizations
* JW-358: Convert every component to <script setup> Composition API
* JW-361: Current line is offset by one trace state
* JW-362: Fix broken VS Code logo on website
* JW-363: Split class-pattern settings into three orthogonal concerns
* JW-364: Enable recording of Java data structures (java.util.List, ...)
* JW-365: Add paper preprint to website
* JW-367: Get rid of all "defineComponent" calls by upgrading all components from options API to composition API
* JW-368: Establish agent/AI workflow conventions in copilot instructions
* JW-369: Fix Vue warning: visualization components stored as reactive objects in VisualizationStore
* JW-370: Add runJavaWiz Copilot CLI skill
* JW-371: Add YouTrack → Discord webhook notifications for new issues and comments
* JW-372: Extract publish ignore list to FILES_AND_DIRS_TO_IGNORE_ON_PUBLISH.txt
* JW-373: Refine agent workflow conventions in copilot instructions
* JW-374: Upgrade all Typescript-based systems to Typescript 6.0
* JW-375: Add run-javawiz Copilot skill for browser-based JavaWiz interaction
* JW-376: Add familiarize Copilot skill for pre-task codebase briefing
* JW-377: Rework TheHeapVisualization d3-graphviz rendering architecture
* JW-378: Fix ESLint config to correctly parse Vue template blocks
* JW-380: Settings dialog in Memory View is unclickable when SVG is present
* JW-381: Memory View: Add "Show internal class fields" settings panel
* JW-382: Refactor JDI pipeline for readability
* JW-383: Fix wrong identifier prefix "localvar_" in thisVar (should be "l_")
* JW-384: Rename DOT placeholder ###CLASS### to ###CSSCLASS### for heap elements
* JW-385: Extract and fix click listener setup logic in HeapVisualization
* JW-387: Improve .github/copilot-instructions.md
* JW-390: Audit and reduce unnecessary TypeScript/tooling drift across TS subprojects
* JW-393: Memory View: Add title attribute to all DOT template cells
* JW-394: Improve run-javawiz Copilot skill: reliable editor setValue and process shutdown
* JW-395: Secure .serena folder and document publishing process
* JW-396: Add agent instructions for Claude Code and OpenCode
* JW-398: Fix npm install failure in frontend due to alpha typescript-eslint versions
* JW-399: Fix frontend TypeScript build errors (duplicate identifiers and type incompatibility)
* JW-400: Fix frontend build and lint errors
* JW-401: Do not add faked objects when we just left a lambda
* JW-402: Do not track static fields of detail-classes
* JW-403: Add more comprehensive compilation output on backend
* JW-404: Set up ESLint and fix all warnings across frontend, shared, and vsc-extension
* JW-405: Align TypeScript compilation targets to ES2022 across all subprojects
* JW-406: Add Kiro steering files for AI-assisted development
* JW-407: Standardize MCP server configuration across all AI coding tools
* JW-408: IntelliJ Plugin: Fix action labeling, duplicate actions block, and missing Kotlin code lens
* JW-411: IntelliJ Plugin: Improve port discovery robustness
* JW-412: IntelliJ Plugin: Fix WebSocket connection list management (stale sessions, multi-connection inconsistency)
* JW-413: IntelliJ Plugin: Migrate to modern IntelliJ plugin standards (Gradle plugin 2.x, untilBuild, invalid module dependency)
* JW-414: IntelliJ Plugin: Clean up stale files from previous plugin versions on startup
* JW-415: IntelliJ Plugin: Fix startup/shutdown resilience and partial-failure cleanup
* JW-416: IntelliJ Plugin: Update release mechanism to include plugin builds and publishing
* JW-417: IntelliJ Plugin: Integrate into root multi-project Gradle build
* JW-419: Fix .gitignore to exclude generated/local files from IntelliJ plugin
* JW-420: Inject Frontend and Backend resources into IntelliJ plugin at build time
* JW-421: Java Stream API Visualization
* JW-422: IntelliJ Plugin: Prioritize editor content over file content; add Java diagnostic logging
* JW-423: Memory View: Title-based attribute injection + HeapLookup bounding-box helper
* JW-424: Fix AI assistant MCP server connections
* JW-425: Refresh AI assistant repository guidance
* JW-426: Harden YouTrack MCP startup after restart
* JW-427: Stream visualization controls are clipped
* JW-428: Use value type for stream marble colors
* JW-429: Exclude internal agent files from public mirror
* JW-430: Add local public mirror preview script
* JW-431: Exclude local build cache directories from public mirror
* JW-432: Support path-based public mirror exclusions
* JW-434: IntelliJ Plugin: Store extracted resources in home-based version directory
* JW-435: Release backend.jar, frontend.zip, intellij-plugin.jar as well as vsc-extension.vsix as GitHub release assests when new version is published.
* JW-436: Update AI guidance for YouTrack issue field handling
* JW-437: Keep backend compile timing output contiguous
* JW-438: Improve request logging timing output
* JW-439: IntelliJ rerun of parameterized Gradle tests fails with invocation index (generated by AI)
* JW-440: Adjust stream instrumentation collection for statement-scoped calls
* JW-441: Add backend test for multiple stream visualization statements
* JW-442: Add backend test for stream collect inside string concatenation
* JW-443: Add backend test for operation after stream min
* JW-444: Add backend test that stream field initializer is not instrumented
* JW-445: Disable flaky backend OutOfMemory test

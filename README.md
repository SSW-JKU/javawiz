# JavaWiz

***JavaWiz*** is an educational *visualization tool* / *graphical debugger*.

Find us on [javawiz.net](https://javawiz.net).

## Structure

This project is a Gradle multi-project workspace consisting of five sub-projects:

- **backend** – Kotlin/JVM WebSocket server that compiles and step-debugs Java programs using JDK internals
- **frontend** – Vue 3 + TypeScript + Vite visualization UI
- **shared** – TypeScript types shared between `frontend` and `vsc-extension`
- **vsc-extension** – TypeScript VS Code extension that orchestrates backend and frontend
- **intellij-plugin** – Kotlin IntelliJ IDEA plugin, modelled on the VS Code extension, that embeds the same backend and frontend into an IDE tool window

The frontend requires the backend to run to work properly.

## Building

To build all projects, run `gradlew clean build` in the root folder

To only build the frontend, run `gradlew :frontend:clean :frontend:build` in the root folder.

To only build the debugger, run `gradlew :backend:clean :backend:build` in the root folder.

To only build the IntelliJ plugin, run `gradlew :intellij-plugin:buildPlugin` in the root folder.

The build result can be found in

* frontend:

  `./frontend/dist/index.html`

* backend:

  `./backend/build/libs/backend-<version>.jar`

* IntelliJ plugin:

  `./intellij-plugin/build/distributions/JavaWiz-*.zip`

## Running

To locally run the frontend in development mode, run `gradlew :frontend:run`

To locally run the debugger, run `gradlew :backend:run` in the root folder.

To run the IntelliJ plugin in a sandboxed IDE instance, run `gradlew :intellij-plugin:runIde` in the root folder.

Both of these tasks are also included as *IntelliJ Run Configurations*, i.e., if you import this project in IntelliJ you can start both projects from within your IDE without 
using the command line.

## Icons

Icons taken from [Flaticon](https://www.flaticon.com/) and others, for detailed attribution [see here](https://github.com/SSW-JKU/javawiz/blob/main/frontend/src/assets/sources.txt).
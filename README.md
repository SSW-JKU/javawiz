# JavaWiz

***JavaWiz*** is an educational *visualization tool* / *graphical debugger*.

Find us on [javawiz.net](https://javawiz.net).

## Structure

This project consists of four sub-projects

- javawiz-frontend (Gradle project name `frontend`)
- websocket-debugger (Gradle project name `backend`)
- vsc-extension
- shared

The frontend requires the debugger to run to work properly.

## Building

To build all projects, run `gradlew clean build` in the root folder

To only build the frontend, run `gradlew :frontend:clean :frontend:build` in the root folder.

To only build the debugger, run `gradlew :debugger:clean :debugger:build` in the root folder.

The build result can be found in

* javawiz-frontend:
  
  `./javawiz-frontend/dist/index.html`
  
* websocket-debugger:

  `./websocket-debugger/build/libs/backend-<version>.jar`

## Running

To locally run the frontend in development mode, run `gradlew :frontend:run`

To locally run the debugger, run `gradlew :debugger:run` in the root folder.

Both of these tasks are also included as *IntelliJ Run Configurations*, i.e., if you import this project in IntelliJ you can start both projects from within your IDE without 
using the command line.

## Icons

Icons taken from [Flaticon](https://www.flaticon.com/), for detailed attribution [see here](https://github.com/SSW-JKU/javawiz/blob/main/javawiz-frontend/src/assets/sources.txt).

## Icons

Icons taken from [Flaticon](https://www.flaticon.com/), for detailed attribution [see here](https://github.com/SSW-JKU/javawiz/blob/main/javawiz-frontend/src/assets/sources.txt).
# Explanation
* If we are in the extension, we want to prioritize some files when searching for main. 
* For example, we would expect to find main in the currently open java editor rather than somewhere else in the workspace.
* In particular, there may be multiple main methods in a workspace. 
* We want the debugger to scan the files for main in the order that they are provided in the compile request.
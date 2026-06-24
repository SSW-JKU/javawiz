package at.jku.ssw.javawiz.intellij.service.app

import at.jku.ssw.javawiz.intellij.general.Globals.Props
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.util.PathUtil
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.util.jar.JarFile
import kotlin.io.path.absolutePathString

// https://plugins.jetbrains.com/docs/intellij/plugin-services.html
// Get via service<JavaWizApplicationService>()
@Service(Service.Level.APP)
class JavaWizApplicationService : Disposable {
    // There are two ways to store information:
    // ApplicationManager.getApplication().putUserData / getUserData -> Extension-wide (once for whole IDE)
    // Project.putUserData -> Project-wide (for each opened project)
    // Both are non-persistent, i.e. they are lost when the IDE is closed
    // For persistent storage, we would have to define IntelliJ settings
    val TEMP_DIR_PATH: String by lazy {
        val version = Props.PLUGIN_VERSION

        // Version-stamped subdirectory: <home>/javawiz/<version>/
        // This ensures files from previous plugin versions (e.g. renamed Vite
        // content-hashed frontend assets) never linger alongside the current ones.
        /* This does not work on Ubuntu if using a browser installed via snap.
        Such browsers run in a sandbox and cannot access files outside of the home directory (and those in the home directory must not be hidden).
        val versionedDir = Paths.get(System.getProperty("java.io.tmpdir"), Props.TEMP_DIR_NAME, version)
        */
        val versionedDir = Path.of(System.getProperty("user.home"), Props.PLUGIN_EXTRACTION_PATH, version)

        // Delete sibling version directories before creating ours. Keep the cleanup scoped
        // to version-like names so an unexpected directory under javawiz-tmp is not removed.
        val parentDir = versionedDir.parent.toFile()
        if (parentDir.exists()) {
            parentDir.listFiles()
                ?.filter { it.isDirectory && it.name != version }
                ?.forEach { stale ->
                    println("Deleting stale plugin version directory: ${stale.absolutePath}")
                    stale.deleteRecursively()
                }
        }

        versionedDir.toFile().mkdirs()

        versionedDir.absolutePathString()
    }

    val BACKEND_JAR_PATH: String
        get() = Paths.get(TEMP_DIR_PATH, Props.BACKEND, Props.BACKEND_JAR_NAME).toString()
    val DEFAULT_FRONTEND_URL_PATH: String
        get() = Paths.get(TEMP_DIR_PATH, Props.DEFAULT, Props.DEFAULT_INDEX_URL).toString()

    // do not use .toUri().toString() as this can cause problems with ktor
    // .toString() will result in a working configuration, see log "Configuring to serve frontend from path C:\Users\marku\AppData\Local\Temp\javawiz-tmp\Frontend on port 43210 ..."
    // .toUri().toString() will result in a non-working configuration, see log "Configuring to serve frontend from path file:///C:/Users/marku/AppData/Local/Temp/javawiz-tmp/Frontend/ on port 43210 ..."
    val JAVAWIZ_FRONTEND_URL_PATH: String
        get() = Paths.get(TEMP_DIR_PATH, Props.FRONTEND).toString()

    init {
        println("Plugin is initializing...")
        extractJarOnStartup()
        println("Temp dir ${TEMP_DIR_PATH} created ")
    }

    /**
     * Recursively prints every file and directory within Globals.Paths.TEMP_DIR_PATH.
     *
     * The output is formatted as a tree structure:
     * - Directories are prefixed with "- "
     * - Files are prefixed with "* "
     * - Indentation is used to show nesting.
     *
     * For example:
     * - temp
     *   - docs
     *     * manual.txt
     *     * notes.txt
     *   - images
     *     * icon.png
     *   * config.json
     */
    fun printTempDir() {
        // Helper function to perform the recursive directory traversal.
        fun printDirectoryTree(file: File, indent: String) {
            // Print the current directory name.
            println("$indent- ${file.name}")

            // Get all files and subdirectories, handle null case if the directory is not readable.
            val children = file.listFiles()
            if (children != null) {
                // Sort to show directories first, then files, both alphabetically.
                children.sortedWith(compareBy({ !it.isDirectory }, { it.name })).forEach { child ->
                    if (child.isDirectory) {
                        // If the child is a directory, recurse with increased indentation.
                        printDirectoryTree(child, "$indent  ")
                    } else {
                        // If it's a file, print its name with the appropriate prefix and indentation.
                        println("$indent  * ${child.name}")
                    }
                }
            }
        }

        // Get the root directory from the specified path.
        val rootDir = File(TEMP_DIR_PATH)

        // Check if the path exists and is a directory before starting the process.
        if (rootDir.exists() && rootDir.isDirectory) {
            printDirectoryTree(rootDir, "")
        } else {
            println("Directory not found or is not a directory: ${TEMP_DIR_PATH}")
        }
    }

    private fun extractJarOnStartup() {
        try {
            // Find the JAR file and its entries
            val location = PathUtil.getJarPathForClass(this::class.java)
            val jarFile = JarFile(location)
            val entries = jarFile.entries()

            val allEntries = mutableListOf<String>()

            // Extract all entries from the JAR file
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                allEntries.add(entry.name)
                val entryTargetFile = Paths.get(TEMP_DIR_PATH, entry.name).toFile()

                if (entry.isDirectory) {
                    entryTargetFile.mkdirs()
                    continue
                }

                // Create parent directories for the file
                entryTargetFile.parentFile?.mkdirs()

                val existing = entryTargetFile.exists()
                // Copy the entry to the file
                jarFile.getInputStream(entry).use { input ->
                    try {
                        Files.copy(input, entryTargetFile.toPath(), StandardCopyOption.REPLACE_EXISTING)
                    } catch (e: Exception) {
                        println("[ERROR] Error ${if (existing) "replacing existing" else "creating"} target file for JAR entry ${entry.name}: $e")
                    }
                }
            }

            println("Processed JAR entries: ${allEntries.joinToString("\n") { "-  $it" }}")

            // Check that all necessary directories are present in the JAR
            // Otherwise, the developer (we ;)) might have forgotten to include them in the artifacts
            if (allEntries.none { entryName -> Props.FRONTEND in entryName }) {
                error("[ERROR] Extraction failed: ${Props.FRONTEND} directory not found in extracted entries.")
            }
            if (allEntries.none { entryName -> Props.BACKEND in entryName }) {
                error("[ERROR] Extraction failed: ${Props.BACKEND} directory not found in extracted entries.")
            }
            if (allEntries.none { entryName -> Props.DEFAULT in entryName }) {
                error("[ERROR] Extraction failed: ${Props.DEFAULT} directory not found in extracted entries.")
            }
        } catch (e: Exception) {
            println("[ERROR] Error extracting JAR: ${e.toString()}")
        }
    }

    override fun dispose() {
        print("JavaWizService disposed")
        // Here we can add code that should be executed when IntelliJ ends
    }
}

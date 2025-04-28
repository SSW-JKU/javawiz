package at.jku.ssw.wsdebug.debugger.recording.identifiers

import java.net.URI
import java.nio.file.Paths

fun getURIName (uri: String): URIName {
    val normalizedPath = uri.replace("\\", "/")
    try {
        val path = URI(normalizedPath)
        if (path.isAbsolute) {
            return CompleteURI(normalizedPath)
        }
    } catch (e: Exception){
        println("invalid uri")
    }
    val workspaceRelativeURI = Paths.get("").toAbsolutePath()
    val filePath = Paths.get(normalizedPath).toAbsolutePath()
    if (filePath.isAbsolute && filePath.startsWith(workspaceRelativeURI)) {
        return WorkspaceRelativeURI(normalizedPath)
    }
    if (normalizedPath.startsWith("/")) {
        return PackageRelativeURI(normalizedPath)
    }
    return FileName(normalizedPath)
}

fun areEqualWrapperTypes (firstName: URIName, secondName: URIName): Boolean {
    return firstName.kind == secondName.kind
}

fun areEqualURIs (firstPath: URIName, secondPath: URIName): Boolean {
    if (areEqualWrapperTypes(firstPath, secondPath)) {
        return firstPath.uri == secondPath.uri
    } else {
        if (firstPath.kind == "CompleteURI") {
            return firstPath.uri == convertPath(secondPath, "CompleteURI").uri
        } else if (secondPath.kind == "CompleteURI") {
            return secondPath.uri == convertPath(secondPath, "CompleteURI").uri
        } else if (firstPath.kind == "WorkspaceRelativeURI") {
            return firstPath.uri == convertPath(secondPath, "WorkspaceRelativeURI").uri
        } else if (secondPath.kind == "WorkspaceRelativeURI") {
            return secondPath.uri == convertPath(firstPath, "WorkspaceRelativeURI").uri
        } else if (firstPath.kind == "FileName") {
            return firstPath.uri == convertPath(secondPath, "FileName").uri
        } else if (secondPath.kind == "FileName") {
            return secondPath.uri == convertPath(firstPath, "FileName").uri
        } else {
            return firstPath.uri == secondPath.uri
        }
    }
}

fun convertPath (uri: URIName, kind: String): URIName {
    when (kind) {
        "CompleteURI" -> return CompleteURI(convertToComplete(uri, Paths.get("").toAbsolutePath().toString()))
        "WorkspaceRelativeURI" -> return WorkspaceRelativeURI(convertToWorkspaceRelative(uri, Paths.get("").toAbsolutePath().toString()))
        "FileName" -> return FileName(convertToFileName(uri.uri))
        else -> return uri
    }
}

// Convert Complete URI to Workspace-Relative URI
fun convertToWorkspaceRelative (completeUri: URIName, baseDir: String): String {
    when (completeUri.kind) {
        "CompleteURI" -> {
            val basePath = Paths.get(baseDir)
            return basePath.relativize(Paths.get(completeUri.uri)).toString().substring(2).replace("\\", "/")
        }
        "WorkspaceRelativeURI" -> return completeUri.uri
        else -> {
            val completePath = convertToComplete(completeUri, baseDir)
            val basePath = Paths.get(baseDir)
            return basePath.relativize(Paths.get(completePath)).toString().substring(2).replace("\\", "/")
        }
    }
}

// Convert to Complete URI
fun convertToComplete (relativePath: URIName, baseDir: String): String {
    when (relativePath.kind) {
        "CompleteURI" -> return relativePath.uri.toString()
        "WorkspaceRelativeURI" -> {
            val basePath = Paths.get(baseDir)  // Base directory (workspace root)
            val fullPath = basePath.resolve(relativePath.uri.substring(1)).toAbsolutePath()  // Resolve to complete path
            return fullPath.toString().replace("\\", "/")
        }
        "PackageRelativeURI" -> {
            // Check if the package-relative URI starts with '/'
            val normalizedUri = if (relativePath.uri.startsWith("/")) {
                relativePath.uri.substring(1)  // Remove leading slash
            } else {
                relativePath.uri
            }

            // Try to find the resource on the classpath
            val resource = Thread.currentThread().contextClassLoader.getResource(normalizedUri)

            // If the resource is found, convert it to URI
            return resource?.toURI().toString()
        }
        else -> {
            // Resolve the file name into an absolute path.
            val filePath = if (baseDir.isEmpty()) {
                Paths.get(relativePath.uri).toAbsolutePath() // Uses current working directory
            } else {
                Paths.get(baseDir, relativePath.uri).toAbsolutePath() // Uses the specified base directory
            }

            // Convert to URI and return
            return filePath.toUri().toString()
        }
    }
}

fun convertToFileName (uri: String): String {
    return uri.substring(uri.lastIndexOf('/') + 1)
}
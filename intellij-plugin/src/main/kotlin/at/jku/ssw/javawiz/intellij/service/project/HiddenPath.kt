package at.jku.ssw.javawiz.intellij.service.project

/**
 * Returns whether a file or directory name is dot-prefixed and should be
 * excluded from Java source discovery.
 */
internal fun isHiddenFileOrDirectory(name: String): Boolean = name.startsWith(".")

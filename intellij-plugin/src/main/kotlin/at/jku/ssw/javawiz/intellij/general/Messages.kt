package at.jku.ssw.javawiz.intellij.general

import kotlinx.serialization.Serializable

// Data classes for serialization
@Serializable
data class FileContent(val localUri: String, val content: String)

@Serializable
data class GetFileContentsData(val fileContents: List<FileContent>, val openEditorLocalUri: String)

@Serializable
data class Response(
  val message: FrontendMessage,
  val result: String,
)

@Serializable
data class ResponseData(
  val message: FrontendMessage,
  val result: String,
  val data: GetFileContentsData,
)

@Serializable
data class ConsoleMessage(
  val kind: String,
  val consoleInput: String,
)

@Serializable
data class FrontendMessage(
  val kind: String,
  val line: Int? = null,
  val uri: String? = null,
  val consoleEnabled: Boolean? = null,
  val message: String? = null,
  val newConsoleHistory: List<ConsoleHistoryItem>? = null,
  val type: String? = null
)

@Serializable
data class ConsoleHistoryItem(
  val input: String,
  val output: String,
  val error: String
)
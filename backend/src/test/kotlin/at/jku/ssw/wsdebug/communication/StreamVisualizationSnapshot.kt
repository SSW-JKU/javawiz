package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.debugger.recording.stream.MarbleDiagramData
import at.jku.ssw.wsdebug.debugger.recording.stream.MarbleDiagramDataCollection
import at.jku.ssw.wsdebug.debugger.recording.stream.MarbleDiagramItem
import at.jku.ssw.wsdebug.debugger.recording.stream.MarbleDiagramMarble

/**
 * Renders a StreamViz payload as readable text for golden-file comparison.
 *
 * Pixel positions and runtime IDs are replaced by stable names: a marble is written as `lane@column`,
 * where `column` is the rank of the marble's x position within its stream (1 = leftmost). The text has
 * two levels that mirror `TheStreamViz.vue`:
 * - `playback`: every marble and link in recorded order with its playback step, i.e. the event trace.
 * - `final`: what the frontend shows at the last step, i.e. the latest marble per marble key and the
 *   links whose two endpoints are visible.
 *
 * List and map marbles are written with their contents, for example `[map@1, map@2:"5"]` or
 * `{false=[map@1], true=[]}`: an element marble as its position, a value computed from an element as
 * `position:"value"` (drawn in that element's color), and a value without a known element in quotes.
 */
internal object StreamVisualizationSnapshot {
    fun render(collection: MarbleDiagramDataCollection): String {
        val streamNumbers = collection.streams.withIndex().associate { (index, stream) -> stream.id to index + 1 }
        return collection.streams.joinToString("\n") { stream ->
            val parent = stream.parentStreamId?.let { " (child of stream ${streamNumbers[it]})" } ?: ""
            "stream ${streamNumbers[stream.id]}$parent\n" + renderStream(stream)
        }
    }

    private fun renderStream(stream: MarbleDiagramData): String = buildString {
        val lanes = stream.operationLanes.entries.sortedBy { it.value.y }
        val laneNames = lanes.associate { (operationId, lane) ->
            val sameName = lanes.count { it.value.operation == lane.operation } > 1
            operationId to if (sameName) "${lane.operation}#${lanes.indexOfFirst { it.key == operationId } + 1}" else lane.operation
        }
        val columns = stream.marbles.map { it.x }.distinct().sorted().withIndex().associate { (index, x) -> x to index + 1 }
        fun position(marble: MarbleDiagramMarble) = "${laneNames[marble.operationId]}@${columns[marble.x]}"
        // Links and list items point at marble keys; resolve each key to the marble the frontend shows at that step.
        fun visibleAt(key: String, step: Int) = stream.marbles.filter { it.marbleKey == key && it.playbackStep <= step }.maxByOrNull { it.playbackStep }
        // An item equal to its element is written as that marble's position, a value from an element as `position:"value"`,
        // and a value without a known element in quotes.
        fun item(item: MarbleDiagramItem, step: Int): String {
            val value = "\"${item.value}\""
            val key = item.marbleKey ?: return value
            val origin = visibleAt(key, step) ?: return "missing($key)"
            return if (origin.label == item.value && origin.type == item.type) position(origin) else "${position(origin)}:$value"
        }
        fun items(items: List<MarbleDiagramItem>, step: Int) = items.joinToString(", ", "[", "]") { item(it, step) }
        fun label(marble: MarbleDiagramMarble): String {
            val step = marble.playbackStep
            return when {
                marble.items != null -> items(marble.items, step)
                marble.entries != null -> marble.entries.joinToString(", ", "{", "}") { entry ->
                    "${entry.key}=" + items(entry.items, step)
                }
                else -> "\"${marble.label}\""
            }
        }
        fun describe(marble: MarbleDiagramMarble) = "${position(marble)} ${marble.eventKind} ${marble.type} ${label(marble)}"

        appendLine("  lanes")
        lanes.forEach { (operationId, lane) ->
            appendLine("    ${laneNames[operationId]} | ${lane.type} | ${lane.parameter ?: ""}".trimEnd())
        }

        appendLine("  playback")
        stream.marbles.forEach { appendLine("    step ${it.playbackStep}: ${describe(it)}") }
        stream.links.forEach { link ->
            val source = visibleAt(link.source, link.visibleFromStep)?.let(::position) ?: "missing(${link.source})"
            val target = visibleAt(link.target, link.visibleFromStep)?.let(::position) ?: "missing(${link.target})"
            appendLine("    link from step ${link.visibleFromStep}: $source -> $target")
        }

        val lastStep = stream.marbles.maxOfOrNull { it.playbackStep } ?: 0
        val finalMarbles = stream.marbles.groupBy { it.marbleKey }.values.map { group -> group.maxBy { it.playbackStep } }
        val finalKeys = finalMarbles.map { it.marbleKey }.toSet()
        appendLine("  final")
        finalMarbles
            .sortedWith(compareBy({ it.y }, { it.x }))
            .forEach { appendLine("    ${describe(it)}") }
        stream.links
            .filter { it.source in finalKeys && it.target in finalKeys }
            .map { "${position(visibleAt(it.source, lastStep)!!)} -> ${position(visibleAt(it.target, lastStep)!!)}" }
            .distinct()
            .forEach { appendLine("    link $it") }
    }
}

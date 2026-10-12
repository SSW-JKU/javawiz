package at.jku.ssw.wsdebug.debugger.recording

import java.awt.Color

/** Converts recorded stream executions into the frontend-facing marble diagram payload. */
class MarbleDiagramGenerator {
    private val skippableOperationNames = setOf("filter", "distinct", "skip")
    private val terminalOperations = setOf("count", "max", "min", "reduce", "collect", "forEach", "forEachOrdered", "toArray", "toList", "toSet", "findFirst", "findAny", "anyMatch", "allMatch", "noneMatch", "sum", "average")
    private val baseMarbleColors = listOf(
        "#e41a1c",
        "#377eb8",
        "#4daf4a",
        "#ff7f00",
        "#ffff33",
        "#a65628",
        "#f781bf"
    )

    /** Includes every registered execution, including executions that have no observed element. */
    fun generate(executions: Collection<StreamExecution>): MarbleDiagramDataCollection =
        MarbleDiagramDataCollection(executions.map(::generateData).toMutableList())

    private fun generateData(execution: StreamExecution): MarbleDiagramData {
        val data = MarbleDiagramData(
            execution.id,
            execution.parentExecutionId,
            mutableListOf(),
            mutableListOf(),
            mutableMapOf(),
            layoutCursorX = 50,
            previousOperationId = Int.MAX_VALUE
        )
        val marbles = data.marbles
        val links = data.links
        val operationLanes = data.operationLanes
        val recordedEvents = execution.events
        var currentSequence = 0
        var sequenceOffset = 0
        val compactTypes = setOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "void")
        val singleRowTypes = compactTypes + "java.lang.String"
        val laidOutSortedOperationIds = mutableSetOf<Int>()
        var previousElementType = ""
        var hasComplexType = false
        val operationOrder = recordedEvents.map { it.operationId }.distinct()
        val operationOrderIndex = operationOrder.withIndex().associate { it.value to it.index }
        val predecessorOperationOrder = operationOrder.filter { operationId ->
            recordedEvents.any { event ->
                event.operationId == operationId && event.eventKind in setOf(StreamEventKind.START, StreamEventKind.OUT)
            }
        }

        for (event in recordedEvents) {
            if (!hasComplexType && !compactTypes.contains(event.type)) hasComplexType = true

            if (!operationLanes.containsKey(event.operationId)) {
                val maxLaneY = operationLanes.values.maxByOrNull { it.y }?.y ?: 0
                val offset = when {
                    operationLanes.isEmpty() -> 0
                    !singleRowTypes.contains(previousElementType) -> 200
                    else -> 100
                }
                operationLanes[event.operationId] = MarbleDiagramLane(event.operation, maxLaneY + offset, event.type, event.operationParameter)
            }

            if (event.seq > 0 || (event.eventKind == StreamEventKind.IN && event.operation in skippableOperationNames)) {
                if (event.operation in skippableOperationNames) {
                    if (event.eventKind == StreamEventKind.OUT) {
                        marbles.last().color = colorForEvent(event)
                        marbles.last().eventKind = event.eventKind
                        sequenceOffset--
                        continue
                    }
                    sequenceOffset++
                    currentSequence++
                } else {
                    currentSequence = event.seq + sequenceOffset
                }

                if (event.operation == "sorted" && !laidOutSortedOperationIds.contains(event.operationId)) {
                    data.layoutCursorX += if (operationLanes[event.operationId]!!.type !in setOf("int", "long", "double", "float", "boolean")) 200 else 100
                    laidOutSortedOperationIds.add(event.operationId)
                }

                if (operationOrderIndex[event.operationId] != null) {
                    data.layoutCursorX += if (hasComplexType) {
                        if (event.type?.endsWith("[]") == true && event.type.removeSuffix("[]") !in setOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "java.lang.String")) 300 else 200
                    } else {
                        100
                    }
                }

                data.previousOperationId = event.operationId
                val marbleKey = "${event.elementId}.${event.operationId}"
                val predecessorOperationId = predecessorOperationOrder.indexOf(event.operationId)
                    .minus(1)
                    .let { predecessorIndex ->
                        if (predecessorIndex >= 0) predecessorOperationOrder.getOrNull(predecessorIndex) else null
                    }
                val parentMarbles = event.parentIds.mapNotNull { parentId ->
                    predecessorOperationId?.let { predecessor -> marbles.find { it.marbleKey == "$parentId.$predecessor" } }
                }
                if (parentMarbles.isNotEmpty()) {
                    parentMarbles.forEach { parentMarble -> links.add(MarbleDiagramLink(parentMarble.marbleKey, marbleKey, currentSequence)) }
                }
                val label = when (event.type) {
                    "List", "Array", "Set" -> parentMarbles.joinToString(", ") { it.marbleKey }
                    "Map" -> event.observedValue.toString()
                    else -> event.observedValue.toString()
                }
                marbles.add(
                    MarbleDiagramMarble(
                        currentSequence,
                        marbleKey,
                        data.layoutCursorX,
                        operationLanes[event.operationId]!!.y,
                        event.type,
                        label,
                        event.operationId,
                        event.operation,
                        colorForEvent(event),
                        event.eventKind
                    )
                )
                previousElementType = event.type ?: previousElementType
            }
        }
        return data
    }

    private fun colorForEvent(event: StreamEvent): String {
        if (event.eventKind == StreamEventKind.IN) return "#FFFFFF"
        if (event.type == "List") return "#DBDBDB"
        if (event.type == "Array") return "#CCEEFF"
        if (event.type == "Set") return "#FFDDCC"
        if (event.type == "Map") return "#FFFCCC"
        if (event.operation in terminalOperations) return "#e4cde7"

        val elementColorIndex = event.elementId - 1
        val baseColor = Color.decode(baseMarbleColors[elementColorIndex % baseMarbleColors.size])
        val hsb = Color.RGBtoHSB(baseColor.red, baseColor.green, baseColor.blue, null)
        var saturation = hsb[1] * 0.8f
        var brightness = hsb[2]
        when ((elementColorIndex / baseMarbleColors.size) % 5) {
            1 -> brightness *= 0.8f
            2 -> brightness = minOf(1f, brightness * 1.3f)
            3 -> saturation = minOf(1f, saturation * 1.3f)
            4 -> saturation *= 0.6f
        }
        val color = Color.getHSBColor(hsb[0], saturation, brightness)
        return "#%02x%02x%02x".format(color.red, color.green, color.blue)
    }
}

/** Represents one positioned, replayable element in a generated marble diagram. */
data class MarbleDiagramMarble(
    var playbackStep: Int,
    val marbleKey: String,
    val x: Int,
    val y: Int,
    val type: String?,
    val label: String,
    val operationId: Int,
    val operation: String,
    var color: String,
    var eventKind: StreamEventKind
)

/** Connects a source marble to a downstream marble at a playback step. */
data class MarbleDiagramLink(
    val source: String,
    val target: String,
    val visibleFromStep: Int
)

/** Describes the rendered row for one stream operation. */
data class MarbleDiagramLane(
    val operation: String,
    val y: Int,
    val type: String?,
    val parameter: String?
)

data class MarbleDiagramDataCollection(
    val streams: MutableList<MarbleDiagramData>
) {
    fun snapshot(): MarbleDiagramDataCollection =
        MarbleDiagramDataCollection(streams.map { it.snapshot() }.toMutableList())
}

data class MarbleDiagramData(
    val id: Int,
    val parentStreamId: Int?,
    val marbles: MutableList<MarbleDiagramMarble>,
    val links: MutableList<MarbleDiagramLink>,
    val operationLanes: MutableMap<Int, MarbleDiagramLane>,
    var layoutCursorX: Int,
    var previousOperationId: Int
) {
    fun snapshot(): MarbleDiagramData = MarbleDiagramData(
        id,
        parentStreamId,
        marbles.map { it.copy() }.toMutableList(),
        links.toMutableList(),
        operationLanes.mapValues { (_, lane) -> lane.copy() }.toMutableMap(),
        layoutCursorX,
        previousOperationId
    )
}

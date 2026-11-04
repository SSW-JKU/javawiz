package at.jku.ssw.wsdebug.debugger.recording.stream

import java.awt.Color

/** Converts recorded stream executions into the frontend-facing marble diagram payload. */
class MarbleDiagramGenerator {
    // These operations may drop an element, so each input is drawn and turned into an output only when the element passes.
    private val skippableOperationNames = setOf("filter", "distinct", "skip", "takeWhile", "dropWhile")
    private val terminalOperations = setOf("count", "max", "min", "reduce", "collect", "forEach", "forEachOrdered", "toArray", "toList", "findFirst", "findAny", "anyMatch", "allMatch", "noneMatch", "sum", "average")
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
        val elementProducingOperationIds = operationOrder.filter { operationId ->
            recordedEvents.any { event ->
                event.operationId == operationId && event.eventKind in setOf(StreamEventKind.START, StreamEventKind.OUT)
            }
        }.toSet()
        // A new element starts when an event belongs to the same or an earlier pipeline stage than the previous drawn event.
        var previousOrderIndex = -1

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

                val orderIndex = operationOrderIndex.getValue(event.operationId)
                if (orderIndex <= previousOrderIndex) {
                    data.layoutCursorX += if (hasComplexType) {
                        if (event.type?.endsWith("[]") == true && event.type.removeSuffix("[]") !in setOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "java.lang.String")) 300 else 200
                    } else {
                        100
                    }
                }

                previousOrderIndex = orderIndex
                val marbleKey = marbleKey(event.elementId, event.operationId)
                // Terminal operations only record END events, so their predecessor is the closest earlier stage that emits elements.
                val predecessorOperationId = operationOrder.take(orderIndex).lastOrNull { it in elementProducingOperationIds }
                val parentMarbles = event.parentIds.mapNotNull { parentId ->
                    predecessorOperationId?.let { predecessor -> marbles.find { it.shows(parentId, predecessor) } }
                }
                if (parentMarbles.isNotEmpty()) {
                    parentMarbles.forEach { parentMarble -> links.add(MarbleDiagramLink(parentMarble.marbleKey, marbleKey, currentSequence)) }
                }
                val state = event.observedValue as? CollectorState
                val previousMarble = marbles.lastOrNull { it.operationId == event.operationId }
                val newValueKey = if (state != null) newCollectValueMarbleKey(event, recordedEvents, predecessorOperationId, parentMarbles) else null
                val items = when {
                    state is CollectorState.Items -> collectItems(state.values, previousMarble?.items.orEmpty(), newValueKey)
                    state == null && StreamDisplayType.of(event.type)?.isCollection == true -> parentMarbles.map { MarbleDiagramItem(it.marbleKey, it.type, it.label) }
                    event.observedValue is CollectionElements -> event.observedValue.elements.map { MarbleDiagramItem(null, it.type, it.value.toString()) }
                    else -> null
                }
                val entries = (state as? CollectorState.Entries)?.let { collectEntries(it.entries, previousMarble?.entries.orEmpty(), newValueKey) }
                val label = when {
                    state is CollectorState.Single -> state.value.value.toString()
                    // An array or collection element keeps its text, so a collect result that contains it can find it.
                    event.observedValue is CollectionElements -> event.observedValue.toString()
                    items != null || entries != null -> ""
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
                        event.eventKind,
                        items,
                        entries
                    )
                )
                previousElementType = event.type ?: previousElementType
            }
        }
        return data
    }

    /**
     * Returns the marble that the values new in this collect marble came from, or `null` if that is unknown.
     *
     * The tracer records one collect event each time an element reaches the accumulator, and appends that element's ID
     * to the event's parentIds (see `StreamOperationTracer.recordCollectorState`). So the last parent is the element
     * that the collector just processed. Every value that is new in this state was produced from that element, also
     * when a lambda computed it. Example: after `map(n -> n * 2)`, `toMap(n -> n, n -> n * n)` receives the element
     * with value 4. The state changes from `{2=4}` to `{2=4, 4=16}`, and 16 is new, so it comes from that element.
     * StreamViz links 16 to the element's marble in the lane before collect (`map`) and draws it in that color.
     *
     * Returns `null` for the value returned by collect after pending running marbles: those marbles show no values,
     * so it is unknown which element added which value (see `StreamOperationTracer.reconcileCollectResult`).
     */
    private fun newCollectValueMarbleKey(
        event: StreamEvent,
        recordedEvents: List<StreamEvent>,
        predecessorOperationId: Int?,
        parentMarbles: List<MarbleDiagramMarble>
    ): String? {
        val previousState = recordedEvents.lastOrNull { it.operationId == event.operationId && it.seq < event.seq }?.observedValue
        if (previousState == CollectorState.PENDING) return null
        val elementId = event.parentIds.lastOrNull() ?: return null
        val predecessor = predecessorOperationId ?: return null
        // The element's marble in the lane before collect must be one of the parent marbles.
        return parentMarbles.firstOrNull { it.shows(elementId, predecessor) }?.marbleKey
    }

    /**
     * Builds the items of a list or set shown in a collect marble, each linked to the element marble it came from.
     *
     * A collect marble is drawn again after every element, and each time the collector has added the values of one
     * element only. So a value that the previous marble already showed keeps that item's link, and every other value
     * is new and links to [newValueKey]. Each previous item can be reused once, so equal values keep separate links:
     * `[4]`, then `[4, 4]`, then `[4, 4, 4]` links the three 4s to the first, second, and third element.
     * Values are compared by type and shown text, because that is what the user sees.
     */
    private fun collectItems(values: List<CollectedValue>, previousItems: List<MarbleDiagramItem>, newValueKey: String?): List<MarbleDiagramItem> {
        val unused = previousItems.toMutableList()
        return values.map { value ->
            val text = value.value.toString()
            val previousItem = unused.firstOrNull { it.type == value.type && it.value == text }
            if (previousItem != null) unused.remove(previousItem)
            MarbleDiagramItem(if (previousItem != null) previousItem.marbleKey else newValueKey, value.type, text)
        }
    }

    /**
     * Builds the entries of a map shown in a collect marble. The values of each key are linked like [collectItems],
     * compared with the values of the same key in the previous marble. For `toMap(n -> n, n -> n * n)`, the value of
     * key 2 keeps its link in every later marble, while the value of a new key links to the element just processed.
     */
    private fun collectEntries(entries: List<CollectedEntry>, previousEntries: List<MarbleDiagramEntry>, newValueKey: String?): List<MarbleDiagramEntry> {
        val previousItemsByKey = previousEntries.associate { it.key to it.items }
        return entries.map { entry -> MarbleDiagramEntry(entry.key, collectItems(entry.values, previousItemsByKey[entry.key].orEmpty(), newValueKey)) }
    }

    private fun colorForEvent(event: StreamEvent): String {
        if (event.eventKind == StreamEventKind.IN) return "#FFFFFF"
        when (StreamDisplayType.of(event.type)) {
            StreamDisplayType.LIST -> return "#DBDBDB"
            StreamDisplayType.ARRAY -> return "#CCEEFF"
            StreamDisplayType.SET -> return "#FFDDCC"
            StreamDisplayType.MAP -> return "#FFFCCC"
            else -> {}
        }
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

/**
 * Builds the key of a marble: the stream element it shows and the operation lane it is drawn in, as
 * "elementId.operationId". Example: "2.3" is element 2 in the lane of operation 3. All marbles drawn for the same
 * element in the same lane share the key, for example a collect marble that is drawn again after each element;
 * the newest one is shown. Links and list items refer to marbles by this key. The frontend and the tests only
 * compare keys, so this is the only place that knows their format.
 */
private fun marbleKey(elementId: Int, operationId: Int): String = "$elementId.$operationId"

/** Whether this marble shows element [elementId] in the lane of operation [operationId] (see [marbleKey]). */
private fun MarbleDiagramMarble.shows(elementId: Int, operationId: Int): Boolean = marbleKey == marbleKey(elementId, operationId)

/**
 * Represents one positioned, replayable element in a generated marble diagram.
 * List, Set, and Array marbles describe their contents in [items], and Map marbles in [entries]; their [label] is empty.
 * A stream element that is an array or a collection, for example `int[]` or a `List`, also lists its elements in [items]
 * and keeps its text, such as `[1, 2]`, as [label].
 */
data class MarbleDiagramMarble(
    var playbackStep: Int,
    /** Identifies the marble; see the function `marbleKey()`. Equal for all marbles of one element in one lane. */
    val marbleKey: String,
    val x: Int,
    val y: Int,
    val type: String?,
    val label: String,
    val operationId: Int,
    val operation: String,
    var color: String,
    var eventKind: StreamEventKind,
    val items: List<MarbleDiagramItem>? = null,
    val entries: List<MarbleDiagramEntry>? = null
)

/**
 * One value shown inside a list or map marble: its [value] of [type], and the [MarbleDiagramMarble.marbleKey] of the
 * element marble it came from, if known. For `mapping(n -> n + 1, toList())`, the item `int "3"` comes from the element marble with value 2;
 * StreamViz draws it as the value 3 in that marble's color. An item that equals its element is drawn as that element.
 */
data class MarbleDiagramItem(
    val marbleKey: String?,
    val type: String?,
    val value: String?
)

/** One map entry shown inside a map marble: its key as text and its values. A single value is a one-item list. */
data class MarbleDiagramEntry(
    val key: String,
    val items: List<MarbleDiagramItem>
)

/** Connects a source marble to a downstream marble at a playback step, both given by [MarbleDiagramMarble.marbleKey]. */
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

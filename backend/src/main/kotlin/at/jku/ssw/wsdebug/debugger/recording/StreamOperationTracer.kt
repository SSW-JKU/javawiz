package at.jku.ssw.wsdebug.debugger.recording

import java.awt.Color
import kotlin.math.absoluteValue
import kotlin.math.round

class StreamOperationTracer {
    val skipableOperations = setOf("filter", "distinct", "skip")
    var streamtrace = mutableMapOf<Int, MutableList<StreamOperationValue>>()
    var actualStreamId = 0
    val lastTraceValue: StreamOperationValue?
        get() = streamtrace[actualStreamId]?.lastOrNull()
    var lastInOps = mutableMapOf<Int, MutableMap<Int, StreamOperationValue>>()
    var sortedTrace = mutableListOf<StreamOperationValue>()

    var sequenceCounter = mutableMapOf<Int, Int>()
    var elementcounter = 1

    val baseColors = listOf(
        "#e41a1c",
        "#377eb8",
        "#4daf4a",
        "#ff7f00",
        "#ffff33",
        "#a65628",
        "#f781bf"
    )

    var visualizationObjects = StreamVisualizationInfo(
        marbles = mutableListOf(),
        links = mutableListOf(),
        operationLines = mutableMapOf(),
        lastX = 50,
        lastOpId = Int.MAX_VALUE
    )

    fun addStreamOperationValue(
        type: String,
        direction: String,
        operationId: Int,
        elementId: Int,
        parentIds: MutableList<Int>,
        valuetype: String?,
        value: Any,
        param: String
    ) {
        // increment sequence counter if dircetion is not IN, because IN operations are not needed in the visualization later
        val seq = if (direction != "IN") {
            val newSeq = sequenceCounter[actualStreamId]?.plus(1) ?: 1
            sequenceCounter[actualStreamId] = newSeq
            newSeq
        } else {
            0
        }
        val streamOperationValue = StreamOperationValue(
            seq, type, direction, operationId, elementId, parentIds, valuetype, value, param
        )
        streamtrace[actualStreamId]?.add(streamOperationValue)
        if (direction != "OUT") {
            if (type == "sorted") {
                sortedTrace.add(streamOperationValue)
            }
            lastInOps.getOrPut(actualStreamId) { mutableMapOf() }[operationId] = streamOperationValue
        }
    }

    fun traceStartStream(
        type: String,
        operationId: Int,
        value: Any,
        valuetype: String?,
        streamId: Int
    ) {
        actualStreamId = streamId
        if (!sequenceCounter.containsKey(streamId)) {
            sequenceCounter[streamId] = 0
            streamtrace[streamId] = mutableListOf()
        }
        addStreamOperationValue(type, "START", operationId, elementcounter, mutableListOf(elementcounter), valuetype, value, "")
        elementcounter++
    }

    fun traceInStream(
        type: String,
        operationId: Int,
        value: Any,
        valuetype: String?,
        streamId: Int,
        param: String
    ) {
        actualStreamId = streamId
        addStreamOperationValue(type, "IN", operationId, lastTraceValue!!.elementId, mutableListOf(lastTraceValue!!.elementId), valuetype, value, param)//lastTraceValue!!.parentIds
        // .toMutableList(),
        // value)
    }

    fun traceOutStream(
        type: String,
        operationId: Int,
        value: Any,
        valuetype: String?,
        streamId: Int,
        param: String
    ) {
        actualStreamId = streamId
        var elemId = if (type == "flatMap" && lastInOps[actualStreamId]?.get(operationId)!!.value != value) {
            val id = elementcounter
            elementcounter++
            id
        } else {
            lastTraceValue!!.elementId
        }
        var parentIds = lastInOps[actualStreamId]?.get(operationId)!!.parentIds//lastTraceValue!!.parentIds
        if (type == "sorted") {
            val nextSorted = sortedTrace.find { it.value == value }
            parentIds = nextSorted!!.parentIds
            elemId = nextSorted.elementId
            sortedTrace.remove(nextSorted)
        }
        addStreamOperationValue(type, "OUT", operationId, elemId, parentIds.toMutableList(), valuetype, value, param)
    }

    fun traceEndStream(
        type: String,
        operationId: Int,
        streamId: Int,
        param: String,
        value: String?
    ) {
        actualStreamId = streamId
        when (type) {
            "count" -> {
                val lastCountOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastCountOp?.elementId ?: elementcounter.also { elementcounter++ }
                // parentIds is the list of parent IDs of the last count operation plus the current element ID or the last trace value's element ID
                val parentIds = (lastCountOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                val count = (lastCountOp?.value.let {
                    when (it) {
                        is Int -> it + 1
                        is String -> (it.toIntOrNull() ?: 0) + 1
                        else -> 1
                    }
                })
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, "int", count, param)
            }

            "collect",
            "toList", "toArray" -> {
                if (lastTraceValue == null) {
                    return
                }
                val lastListOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastListOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastListOp?.parentIds ?: mutableListOf()).toMutableList().apply { lastTraceValue?.let { add(it.elementId) } }
                val list = parentIds.toMutableList()
                var noList = false
                var transformedValue = value
                val resultType = when (type) {
                    "toList" -> "List"
                    "toArray" -> "Array"
                    "collect" -> {
                        val paramLower = param.substringBefore('(').takeIf { it.isNotEmpty() }?.lowercase() ?: param.lowercase()
                        when {
                            paramLower.contains("set") -> "Set"
                            paramLower.contains("list") -> "List"
                            paramLower.contains("array") -> "Array"
                            paramLower.contains("map") -> "Map"
                            paramLower.contains("grouping") -> "Map"
                            paramLower.contains("joining") -> "String"
                            paramLower.contains("averaging") -> {
                                noList = true
                                transformedValue = value?.trim()
                                    ?.removeSurrounding("[", "]")
                                    ?.split(",")
                                    ?.mapNotNull { it.trim().toDoubleOrNull() }
                                    ?.let { avgValues ->
                                        when {
                                            avgValues.size == 2 -> round(avgValues[0] / avgValues[1] * 1000.0) / 1000.0
                                            avgValues.size == 4 -> round(avgValues[0] / avgValues[2] * 1000.0) / 1000.0
                                            else -> transformedValue
                                        }.toString()
                                    }
                                "Average"
                            }
                            else -> "Object"
                        }
                    }

                    else -> type
                }
                if (resultType == "Map") {
                    // for map, parentIds are pairs of key and value IDs, so we need to group them
                    val mapEntries = mutableListOf<Pair<String, String>>()
                    // value is a string with json like format {key1:value1, key2:value2, ...}
                    // transform into json
                    val keyValuePairs = value.toString().trim().split(";").map { it.trim() }
                    for (pair in keyValuePairs) {
                        val (key, value) = pair.split("=").map { it.trim() }
                        mapEntries.add(Pair(key, value))
                    }

                    addStreamOperationValue(type, "END", operationId, elemId, parentIds, resultType, mapEntries, param)
                    return
                }
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, resultType, if (!noList) list else transformedValue!!, param)
            }

            "sum" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }

                val prev = when (val v = lastInOp?.value) {
                    is Number -> v.toDouble()
                    is String -> v.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val current = when (val v = lastTraceValue!!.value) {
                    is Number -> v.toDouble()
                    is String -> v.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val sum = if (prev % 1.0 != 0.0 || current % 1.0 != 0.0) prev + current else (prev.toInt() + current.toInt())
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, "double", sum, param)
            }
            "forEach", "forEachOrdered" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, "void", "forEach", param)
            }
            "findFirst", "findAny" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                val foundValue = lastTraceValue?.value
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, lastTraceValue?.valuetype ?: "find", foundValue ?: "null", param)
            }
            "average" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                val outBeforeValues = streamtrace[actualStreamId]
                    ?.filter { it.operationId == operationId + 1 && it.direction == "OUT" }
                    ?.mapNotNull { v ->
                        when (val x = v.value) {
                            is Number -> x.toDouble()
                            is String -> x.toDoubleOrNull()
                            else -> null
                        }
                    } ?: emptyList()

                val average = if (outBeforeValues.isNotEmpty()) {
                    outBeforeValues.sum() / outBeforeValues.size
                } else {
                    when (val v = lastInOp?.value) {
                        is Number -> v.toDouble()
                        is String -> v.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    }
                }
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, "double", round(average * 1000.0) / 1000.0, param)
            }
            "max", "min" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                val prev = when (val v = lastInOp?.value) {
                    is Number -> v.toDouble()
                    is String -> v.toDoubleOrNull() ?: Double.NEGATIVE_INFINITY
                    else -> Double.NEGATIVE_INFINITY
                }
                val current = when (val v = lastTraceValue!!.value) {
                    is Number -> v.toDouble()
                    is String -> v.toDoubleOrNull() ?: Double.NEGATIVE_INFINITY
                    else -> Double.NEGATIVE_INFINITY
                }
                var newVal = lastInOp == null
                if (!newVal) {
                    newVal = if(type == "max") prev < current else prev > current
                }
                if (newVal) {
                    addStreamOperationValue(type, "END", operationId, elemId, parentIds,
                        lastTraceValue!!.valuetype, current, param)
                } else {
                    addStreamOperationValue(type, "END", operationId, elemId, parentIds,
                        lastInOp?.valuetype, prev, param)
                }
            }
            "anyMatch", "allMatch", "noneMatch" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, "boolean", value.toString(), param)
            }
            "reduce" -> {
                val lastInOp = lastInOps[actualStreamId]?.get(operationId)
                val elemId = lastInOp?.elementId ?: elementcounter.also { elementcounter++ }
                val parentIds = (lastInOp?.parentIds ?: mutableListOf()).toMutableList().apply { add(lastTraceValue!!.elementId) }
                addStreamOperationValue(type, "END", operationId, elemId, parentIds, lastTraceValue?.valuetype, value.toString(), param)
            }
            else -> {
                addStreamOperationValue(type, "END", operationId, lastTraceValue!!.elementId, lastTraceValue!!.parentIds.toMutableList(), null, "", param)
            }
        }
    }

    fun traceNOPEndStream(operationId: Int) {
        val lastListOp = lastInOps[actualStreamId]?.get(operationId)!!
        val parentIds = lastListOp.parentIds.toMutableList().apply { lastTraceValue?.let { add(it.elementId) } }
        addStreamOperationValue(
            lastListOp.type,
            lastListOp.direction,
            lastListOp.operationId,
            lastListOp.elementId,
            parentIds,
            lastListOp.valuetype,
            lastListOp.value,
            lastListOp.param
        )
    }

    fun collectAndTransformStreamOperationValues(): StreamVisualizationInfo {
        println("Starting collectAndTransformStreamOperationValues")
        visualizationObjects.reset()
        val nodes = visualizationObjects.marbles
        val links = visualizationObjects.links
        val lines = visualizationObjects.operationLines

        val operations = streamtrace[actualStreamId] ?: mutableListOf()
        var lastOpId = visualizationObjects.lastOpId
        var currentseq = 0
        var seqOffset = 0

        val nonBigTypes = setOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "void")
        val smallHeightTypes = setOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "void", "java.lang.String")

        val sortedOperations = mutableSetOf<Int>()

        var lastValueType = ""
        var containsBigType = false
        for (op in operations) {
            println("Processing stream operation: $op")
            println("Checking valuetype: ${op.valuetype}")
            if (!containsBigType && !nonBigTypes.contains(op.valuetype)) {
                containsBigType = true
                println("Found big type: ${op.valuetype}")
            }

            if (!lines.containsKey(op.operationId)) {
                println("Found operationId without existing line -> create new line")
                val maxCurLineY = lines.values.maxByOrNull { it.y }?.y ?: 0
                // By default, lines move down by 100 pixels ...
                val offset = if (lines.isEmpty()) {
                    // ... but first line does not move ...
                    0
                } else if (!smallHeightTypes.contains(lastValueType)) {
                    // ... and if the last processed element was a non-string reference type, we move down 200 pixels to accommodate object box visualization
                    200
                } else {
                    100
                }
                val newLineY = maxCurLineY + offset
                println("Previous line was at $maxCurLineY, offset is $offset -> new line posistioned on y = $newLineY")
                lines[op.operationId] = StreamOperationLine(op.type, newLineY, op.valuetype, op.param)
            }
            if (op.seq > 0 || (op.direction == "IN" && op.type in skipableOperations)) {
                if (op.type in skipableOperations) {
                    if (op.direction == "OUT") {
                        nodes.last().color = getMarbleColor(op)
                        nodes.last().direction = op.direction
                        seqOffset--
                        continue
                    } else {
                        seqOffset++
                        currentseq += 1
                    }
                } else {
                    currentseq = op.seq + seqOffset
                }

                if (op.type == "sorted" && !sortedOperations.contains(op.operationId)) {
                    visualizationObjects.lastX += if (!arrayOf("int", "long", "double", "float", "boolean").contains(lines[op.operationId]!!.valuetype)) {
                        200
                    } else {
                        100
                    }
                    sortedOperations.add(op.operationId)
                }

                if (op.operationId >= lastOpId) {
                    if (containsBigType) {
                        if (op.valuetype!!.endsWith("[]") &&
                            !arrayOf("int", "long", "double", "float", "boolean", "char", "byte", "short", "java.lang.String").contains(op.valuetype.removeSuffix("[]"))
                        ) {
                            visualizationObjects.lastX += 300
                        } else {
                            visualizationObjects.lastX += 200
                        }
                    } else {
                        visualizationObjects.lastX += 100
                    }
                }

                visualizationObjects.lastOpId = op.operationId
                val y = lines[op.operationId]!!.y
                val elemId = "${op.elementId}.${op.operationId}"
                val parents = op.parentIds.mapNotNull { parentId ->
                    nodes.find { it.elemId == "$parentId.${op.operationId + 1}" }
                }
                if (parents.isNotEmpty()) {
                    val visibleAt = currentseq
                    parents.forEach { p -> links.add(StreamLink(p.elemId, elemId, visibleAt)) }
                }
                val label = when (op.valuetype) {
                    "List", "Array", "Set" -> parents.joinToString(", ") { p -> p.elemId }
                    "Map" -> op.value.toString()
                    else -> op.value.toString()
                }
                nodes.add(StreamMarble(currentseq, elemId, visualizationObjects.lastX, y, op.valuetype, label, op.operationId, op.type, getMarbleColor(op), op.direction))
                lastOpId = op.operationId
                lastValueType = op.valuetype ?: lastValueType
            }
        }

        return visualizationObjects
    }

    private fun getMarbleColor(value: StreamOperationValue): String {
        if (value.direction == "IN") return "#FFFFFF"
        when (value.valuetype) {
            "List" -> return "#DBDBDB" // light gray
            "Array" -> return "#CCEEFF" // light blue
            "Set" -> return "#FFDDCC" // light orange
            "Map" -> return "#FFFCCC" // light yellow
            else -> {
                if (value.operationId == 0) {
                    return "#e4cde7" // default color for non-complex terminal operations
                }
                val elemId = value.elementId - 1
                val baseColorStr = baseColors[elemId % baseColors.size]
                val baseColor = Color.decode(baseColorStr)

                val hsb = Color.RGBtoHSB(
                    baseColor.red,
                    baseColor.green,
                    baseColor.blue,
                    null
                )

                var h = hsb[0]
                var s = hsb[1]
                var b = hsb[2]

                s *= 0.8f // overall less saturated for better visibility

                when ((elemId / baseColors.size) % 5) {
                    1 -> b *= 0.8f // slightly darker
                    2 -> b = minOf(1f, b*1.3f) // slightly brighter
                    3 -> s = minOf(1f, s*1.3f) // slightly more saturated
                    4 -> s *= 0.6f // slightly less saturated
                }


                val color = Color.getHSBColor(h, s, b)
                return "#%02x%02x%02x".format(color.red, color.green, color.blue)
            }
        }
    }
}

data class StreamOperationValue(
    val seq: Int,
    val type: String,
    val direction: String,
    val operationId: Int,
    val elementId: Int,
    val parentIds: List<Int>,
    val valuetype: String?,
    val value: Any,
    val param: String
)

data class StreamMarble(
    var id: Int,
    val elemId: String,
    val x: Int,
    val y: Int,
    val valuetype: String?,
    val label: String,
    val operationId: Int,
    val type: String,
    var color: String,
    var direction: String
) {

}

data class StreamLink(
    val source: String,
    val target: String,
    val visibleAt: Int
)

data class StreamOperationLine(
    val type: String,
    val y: Int,
    val valuetype: String?,
    val param: String?
)

data class StreamVisualizationInfo(
    val marbles: MutableList<StreamMarble>,
    val links: MutableList<StreamLink>,
    val operationLines: MutableMap<Int, StreamOperationLine>,
    var lastX: Int,
    var lastOpId: Int
) {
    fun snapshot(): StreamVisualizationInfo {
        return StreamVisualizationInfo(
            marbles.map { it.copy() }.toMutableList(),
            links.toMutableList(),
            operationLines.mapValues { (_, line) -> line.copy() }.toMutableMap(),
            lastX,
            lastOpId
        )
    }

    fun reset() {
        marbles.clear()
        links.clear()
        operationLines.clear()
        lastX = 50
        lastOpId = Int.MAX_VALUE
    }

    fun marblesToJson(): String {
        return marbles.joinToString(separator = ",", prefix = "[", postfix = "]") {
            """{"id": "${it.elemId}", "x": ${it.x}, "y": ${it.y}, "valuetype": "${it.valuetype}, "label": "${it.label}", "operationId": ${it.operationId}, "type": "${it.type}",
                |"color": 
                |"${it.color}", "step": ${it.id}}""".trimMargin()
        }
    }

    fun linksToJson(): String {
        return links.joinToString(separator = ",", prefix = "[", postfix = "]") {
            """{"source": "${it.source}", "target": "${it.target}", "step": ${it.visibleAt}}"""
        }
    }

    fun linesToJson(): String {
        return operationLines.entries.joinToString(separator = ",", prefix = "[", postfix = "]") {
            """{"type": "${it.value.type}", "y": ${it.value.y}}"""
        }
    }
}

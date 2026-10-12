package at.jku.ssw.wsdebug.debugger.recording

import kotlin.math.round

/** Identifies how an observed element participates in a stream operation. */
enum class StreamEventKind {
    START,
    IN,
    OUT,
    END,
    COMPLETION,
    REPLAY_LAST_TERMINAL
}

class StreamOperationTracer {
    private val allStreams = linkedSetOf<StreamExecution>()
    private val currentlyExecutingStreams = mutableListOf<StreamExecution>()

    /** The active stream is the innermost stream in the current parent/child execution stack. */
    private val activeExecution: StreamExecution?
        get() = currentlyExecutingStreams.lastOrNull()

    private val marbleDiagramGenerator = MarbleDiagramGenerator()
    private var nextElementId = 1

    val latestRecordedEvent: StreamEvent?
        get() = activeExecution?.latestEvent
    var streamVisualizationData = MarbleDiagramDataCollection(mutableListOf())

    private fun createRuntimeStream(
        executionId: Int,
        parentStreamExecution: StreamExecution?,
        streamObjectId: Long? = null
    ): StreamExecution {
        val runtimeStream = StreamExecution(executionId, parentStreamExecution, streamObjectId)
        allStreams.add(runtimeStream)
        return runtimeStream
    }

    private fun activateStream(executionId: Int): Boolean {
        val runtimeStream = allStreams.firstOrNull { it.id == executionId } ?: return false
        activateStream(runtimeStream)
        return true
    }

    /** Rebuilds the active stack from a stream’s parent chain so its parent context is available. */
    private fun activateStream(runtimeStream: StreamExecution) {
        currentlyExecutingStreams.clear()
        generateSequence(runtimeStream) { it.parentStreamExecution }
            .toList()
            .asReversed()
            .also(currentlyExecutingStreams::addAll)
    }

    /** Records one observed stream event in the active execution. */
    fun recordStreamEvent(
        operation: String,
        eventKind: StreamEventKind,
        operationId: Int,
        elementId: Int,
        parentIds: List<Int>,
        type: String?,
        observedValue: Any,
        operationParameter: String
    ) {
        activeExecution?.recordEvent(operation, eventKind, operationId, elementId, parentIds, type, observedValue, operationParameter)
    }

    fun recordStreamStart(
        operation: String,
        operationId: Int,
        observedValue: Any,
        type: String?,
        executionId: Int
    ) {
        val runtimeStream = allStreams.firstOrNull { it.id == executionId }
            ?: createRuntimeStream(executionId, activeExecution)
        activateStream(runtimeStream)
        recordStreamEvent(operation, StreamEventKind.START, operationId, nextElementId, listOf(nextElementId), type, observedValue, "")
        nextElementId++
    }

    fun recordElementInput(
        operation: String,
        operationId: Int,
        observedValue: Any,
        type: String?,
        executionId: Int,
        operationParameter: String
    ) {
        if (!activateStream(executionId)) return
        recordStreamEvent(operation, StreamEventKind.IN, operationId, latestRecordedEvent!!.elementId, listOf(latestRecordedEvent!!.elementId), type, observedValue, operationParameter)
    }

    fun recordElementOutput(
        operation: String,
        operationId: Int,
        observedValue: Any,
        type: String?,
        executionId: Int,
        operationParameter: String
    ) {
        if (!activateStream(executionId)) return
        // Each flatMap emission is a distinct occurrence, even when its value equals the input.
        // Reusing the last event's ID can replace another child after a terminal accumulator event.
        var elementId = if (operation == "flatMap") {
            val id = nextElementId
            nextElementId++
            id
        } else {
            latestRecordedEvent!!.elementId
        }
        val execution = activeExecution ?: return
        var parentIds = execution.latestEventForOperation(operationId)?.parentIds
            ?: execution.latestEvent?.parentIds
            ?: emptyList()
        if (operation == "sorted") {
            val nextSortedEvent = execution.pendingSortedEvents.firstOrNull { it.observedValue == observedValue }
            if (nextSortedEvent != null) {
                execution.takePendingSortedEvent(observedValue)
                parentIds = nextSortedEvent.parentIds
                elementId = nextSortedEvent.elementId
            }
        }
        recordStreamEvent(operation, StreamEventKind.OUT, operationId, elementId, parentIds, type, observedValue, operationParameter)
    }

    fun recordTerminalResult(
        operation: String,
        operationId: Int,
        executionId: Int,
        operationParameter: String,
        observedValue: String?
    ) {
        if (!activateStream(executionId)) return
        when (operation) {
            "count" -> {
                val latestCountEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestCountEvent?.elementId ?: nextElementId.also { nextElementId++ }
                // parentIds is the list of parent IDs of the last count operation plus the current element ID or the last trace value's element ID
                val parentIds = (latestCountEvent?.parentIds ?: emptyList()).toMutableList().apply {
                    latestRecordedEvent?.let { add(it.elementId) }
                }
                val count = (latestCountEvent?.observedValue.let {
                    when (it) {
                        is Int -> it + 1
                        is String -> (it.toIntOrNull() ?: 0) + 1
                        null -> 0
                        else -> 1
                    }
                })
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "int", count, operationParameter)
            }

            "collect",
            "toList", "toArray" -> {
                if (latestRecordedEvent == null) {
                    return
                }
                val latestCollectionEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestCollectionEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestCollectionEvent?.parentIds ?: emptyList()).toMutableList().apply { latestRecordedEvent?.let { add(it.elementId) } }
                val precedingOutputElementIds = parentIds.toMutableList()
                var isScalarResult = false
                var terminalDisplayValue = observedValue
                val terminalDisplayType = when (operation) {
                    "toList" -> "List"
                    "toArray" -> "Array"
                    "collect" -> {
                        val normalizedOperationName = operationParameter.substringBefore('(').takeIf { it.isNotEmpty() }?.lowercase() ?: operationParameter.lowercase()
                        when {
                            normalizedOperationName.contains("set") -> "Set"
                            normalizedOperationName.contains("list") -> "List"
                            normalizedOperationName.contains("array") -> "Array"
                            normalizedOperationName.contains("map") -> "Map"
                            normalizedOperationName.contains("grouping") -> "Map"
                            normalizedOperationName.contains("joining") -> "String"
                            normalizedOperationName.contains("averaging") -> {
                                isScalarResult = true
                                terminalDisplayValue = observedValue?.trim()
                                    ?.removeSurrounding("[", "]")
                                    ?.split(",")
                                    ?.mapNotNull { it.trim().toDoubleOrNull() }
                                    ?.let { avgValues ->
                                        when {
                                            avgValues.size == 2 -> round(avgValues[0] / avgValues[1] * 1000.0) / 1000.0
                                            avgValues.size == 4 -> round(avgValues[0] / avgValues[2] * 1000.0) / 1000.0
                                            else -> terminalDisplayValue
                                        }.toString()
                                    }
                                "Average"
                            }
                            else -> "Object"
                        }
                    }

                    else -> operation
                }
                if (terminalDisplayType == "Map") {
                    // for map, parentIds are pairs of key and value IDs, so we need to group them
                    val formattedMapEntries = mutableListOf<Pair<String, String>>()
                    // value is a string with json like format {key1:value1, key2:value2, ...}
                    // transform into json
                    val entryTexts = observedValue.toString().trim().split(";").map { it.trim() }
                    for (entryText in entryTexts) {
                        val (entryKey, entryValue) = entryText.split("=").map { it.trim() }
                        formattedMapEntries.add(Pair(entryKey, entryValue))
                    }

                    recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, terminalDisplayType, formattedMapEntries, operationParameter)
                    return
                }
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, terminalDisplayType, if (!isScalarResult) precedingOutputElementIds else terminalDisplayValue!!, operationParameter)
            }

            "sum" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }

                val previousNumericValue = when (val numericValue = latestOperationEvent?.observedValue) {
                    is Number -> numericValue.toDouble()
                    is String -> numericValue.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val currentNumericValue = when (val numericValue = this@StreamOperationTracer.latestRecordedEvent!!.observedValue) {
                    is Number -> numericValue.toDouble()
                    is String -> numericValue.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val sum = if (previousNumericValue % 1.0 != 0.0 || currentNumericValue % 1.0 != 0.0) previousNumericValue + currentNumericValue else (previousNumericValue.toInt() + currentNumericValue.toInt())
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "double", sum, operationParameter)
            }
            "forEach", "forEachOrdered" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "void", "forEach", operationParameter)
            }
            "findFirst", "findAny" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                val foundObservedValue = this@StreamOperationTracer.latestRecordedEvent?.observedValue
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, this@StreamOperationTracer.latestRecordedEvent?.type ?: "find", foundObservedValue ?: "null", operationParameter)
            }
            "average" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                val precedingOutputValues = activeExecution
                    ?.events
                    ?.filter { it.eventKind == StreamEventKind.OUT }
                    ?.map { it.observedValue }
                    ?.mapNotNull { event ->
                        when (val numericValue = event) {
                            is Number -> numericValue.toDouble()
                            is String -> numericValue.toDoubleOrNull()
                            else -> null
                        }
                    } ?: emptyList()

                val average = if (precedingOutputValues.isNotEmpty()) {
                    precedingOutputValues.sum() / precedingOutputValues.size
                } else {
                    when (val numericValue = latestOperationEvent?.observedValue) {
                        is Number -> numericValue.toDouble()
                        is String -> numericValue.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    }
                }
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "double", round(average * 1000.0) / 1000.0, operationParameter)
            }
            "max", "min" -> {
                val previousOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = previousOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (previousOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(latestRecordedEvent!!.elementId) }

                // Keep both raw candidates because the selected value's runtime type controls its display format.
                val previousObservedValue = previousOperationEvent?.observedValue
                val currentEvent = latestRecordedEvent!!
                val currentObservedValue = currentEvent.observedValue

                // Convert only for comparison because the original values must remain available for display.
                val previousNumericValue = when (previousObservedValue) {
                    is Number -> previousObservedValue.toDouble()
                    is String -> previousObservedValue.toDoubleOrNull() ?: Double.NEGATIVE_INFINITY
                    else -> Double.NEGATIVE_INFINITY
                }
                val currentNumericValue = when (currentObservedValue) {
                    is Number -> currentObservedValue.toDouble()
                    is String -> currentObservedValue.toDoubleOrNull() ?: Double.NEGATIVE_INFINITY
                    else -> Double.NEGATIVE_INFINITY
                }

                // The operation name selects the comparison direction, while the trace value preserves type and display data together.
                val currentElementWins = when {
                    previousOperationEvent == null -> true
                    operation == "max" -> previousNumericValue < currentNumericValue
                    else -> previousNumericValue > currentNumericValue
                }
                val selectedEvent = if (currentElementWins) currentEvent else requireNotNull(previousOperationEvent)
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds,
                    selectedEvent.type, selectedEvent.observedValue, operationParameter)
            }
            "anyMatch", "allMatch", "noneMatch" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "boolean", observedValue.toString(), operationParameter)
            }
            "reduce" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, this@StreamOperationTracer.latestRecordedEvent?.type, observedValue.toString(), operationParameter)
            }
            else -> {
                val latestEvent = this.latestRecordedEvent!!
                recordStreamEvent(operation, StreamEventKind.END, operationId, latestEvent.elementId, latestEvent.parentIds, null, "", operationParameter)
            }
        }
    }

    /** Records a terminal return value when a reduction produced no accumulator event. */
    fun recordTerminalCompletion(
        operation: String,
        operationId: Int,
        executionId: Int,
        operationParameter: String,
        observedValue: String?,
        type: String?
    ) {
        if (!activateStream(executionId)) return
        val execution = activeExecution ?: return
        if (execution.latestEventForOperation(operationId)?.operation == operation) return

        val completionValue = normalizeReductionCompletion(type, observedValue)
        val elementId = nextElementId++
        val latestElementEvent = execution.latestEvent
        val parentIds = if (latestElementEvent?.eventKind == StreamEventKind.START || latestElementEvent?.eventKind == StreamEventKind.OUT) {
            listOf(latestElementEvent.elementId)
        } else {
            emptyList()
        }
        recordStreamEvent(
            operation,
            StreamEventKind.END,
            operationId,
            elementId,
            parentIds,
            completionValue.type,
            completionValue.value,
            operationParameter
        )
    }

    /** Converts Optional return text into the value and type that StreamViz should display. */
    private fun normalizeReductionCompletion(type: String?, observedValue: String?): ReductionCompletionValue {
        val text = observedValue ?: "null"
        return when {
            text == "Optional.empty" -> ReductionCompletionValue("Optional", text)
            text.startsWith("Optional[") && text.endsWith("]") -> ReductionCompletionValue("Optional", text.removeSurrounding("Optional[", "]"))
            text == "OptionalInt.empty" -> ReductionCompletionValue("OptionalInt", text)
            text.startsWith("OptionalInt[") && text.endsWith("]") -> ReductionCompletionValue("int", text.removeSurrounding("OptionalInt[", "]"))
            text == "OptionalLong.empty" -> ReductionCompletionValue("OptionalLong", text)
            text.startsWith("OptionalLong[") && text.endsWith("]") -> ReductionCompletionValue("long", text.removeSurrounding("OptionalLong[", "]"))
            text == "OptionalDouble.empty" -> ReductionCompletionValue("OptionalDouble", text)
            text.startsWith("OptionalDouble[") && text.endsWith("]") -> ReductionCompletionValue("double", text.removeSurrounding("OptionalDouble[", "]"))
            else -> ReductionCompletionValue(type, text)
        }
    }

    /** Completes one execution after the debuggee terminal wrapper has returned. */
    fun completeStreamVisualization(
        executionId: Int,
        operation: String,
        operationId: Int,
        operationParameter: String,
        resultText: String,
        type: String?
    ) {
        val execution = allStreams.firstOrNull { it.id == executionId }
            ?: createRuntimeStream(executionId, activeExecution)
        activateStream(execution)
        if (execution.events.none { it.operationId == operationId && it.operation == operation }) {
            val elementId = nextElementId++
            execution.recordEvent(
                operation,
                StreamEventKind.END,
                operationId,
                elementId,
                execution.latestEvent?.let { listOf(it.elementId) } ?: emptyList(),
                type,
                resultText,
                operationParameter
            )
        }
        streamVisualizationData = marbleDiagramGenerator.generate(allStreams)
        if (currentlyExecutingStreams.lastOrNull()?.id == executionId) currentlyExecutingStreams.removeAt(currentlyExecutingStreams.lastIndex)
    }

    /** Closes a flatMap child, including an empty child with no START event. */
    fun endNestedFlatmapStream(executionId: Int) {
        // TODO: Generalize this boundary for child streams created in arbitrary callbacks.
        val execution = allStreams.firstOrNull { it.id == executionId }
            ?: createRuntimeStream(executionId, activeExecution)
        activateStream(execution)
        streamVisualizationData = marbleDiagramGenerator.generate(allStreams)
        if (currentlyExecutingStreams.lastOrNull()?.id == executionId) currentlyExecutingStreams.removeAt(currentlyExecutingStreams.lastIndex)
    }

    fun replayLastTerminalEvent(operationId: Int, streamId: Int? = null) {
        if (streamId != null && !activateStream(streamId)) return
        val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)!!
        val parentIds = latestOperationEvent.parentIds.toMutableList().apply { this@StreamOperationTracer.latestRecordedEvent?.let { add(it.elementId) } }
        recordStreamEvent(
            latestOperationEvent.operation,
            latestOperationEvent.eventKind,
            latestOperationEvent.operationId,
            latestOperationEvent.elementId,
            parentIds,
            latestOperationEvent.type,
            latestOperationEvent.observedValue,
            latestOperationEvent.operationParameter
        )
    }

    /** Rebuilds the latest payload and releases the active execution to its parent context. */
    fun rebuildStreamVisualization(): MarbleDiagramDataCollection =
        rebuildStreamVisualization(releaseActiveStream = true)

    private fun rebuildStreamVisualization(releaseActiveStream: Boolean): MarbleDiagramDataCollection {
        streamVisualizationData = marbleDiagramGenerator.generate(allStreams)
        if (releaseActiveStream) {
            if (currentlyExecutingStreams.isNotEmpty()) currentlyExecutingStreams.removeAt(currentlyExecutingStreams.lastIndex)
        }
        return streamVisualizationData
    }
}

/** Holds the display type and label derived from a completed reduction. */
private data class ReductionCompletionValue(
    val type: String?,
    val value: String
)

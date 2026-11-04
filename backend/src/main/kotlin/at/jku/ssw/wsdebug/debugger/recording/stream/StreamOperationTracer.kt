package at.jku.ssw.wsdebug.debugger.recording.stream

import kotlin.math.round

/** Identifies how an observed element participates in a stream operation. */
enum class StreamEventKind {
    START,
    IN,
    OUT,
    END,
    COMPLETION
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
                        null -> 1
                        else -> 1
                    }
                })
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "int", count, operationParameter)
            }

            "toList", "toArray" -> {
                if (latestRecordedEvent == null) {
                    return
                }
                val latestCollectionEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestCollectionEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestCollectionEvent?.parentIds ?: emptyList()).toMutableList().apply { latestRecordedEvent?.let { add(it.elementId) } }
                val terminalDisplayType = (if (operation == "toList") StreamDisplayType.LIST else StreamDisplayType.ARRAY).label
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, terminalDisplayType, parentIds.toList(), operationParameter)
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
                val currentEvent = latestRecordedEvent!!
                // The traced comparator first runs when the second element arrives, comparing it with the first one.
                // That first element never produced a max/min event, so take it from the preceding operation instead.
                val firstElementEvent = if (previousOperationEvent == null) {
                    activeExecution!!.events.lastOrNull {
                        it.operationId == currentEvent.operationId &&
                            it.eventKind in setOf(StreamEventKind.START, StreamEventKind.OUT) &&
                            it.elementId != currentEvent.elementId
                    }
                } else {
                    null
                }
                val previousCandidate = previousOperationEvent ?: firstElementEvent
                val elementId = previousOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (previousOperationEvent?.parentIds ?: listOfNotNull(firstElementEvent?.elementId)).toMutableList().apply { add(currentEvent.elementId) }

                // Keep both raw candidates because the selected value's runtime type controls its display format.
                val previousObservedValue = previousCandidate?.observedValue
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
                    previousCandidate == null -> true
                    operation == "max" -> previousNumericValue < currentNumericValue
                    else -> previousNumericValue > currentNumericValue
                }
                val selectedEvent = if (currentElementWins) currentEvent else requireNotNull(previousCandidate)
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds,
                    selectedEvent.type, selectedEvent.observedValue, operationParameter)
            }
            "anyMatch", "allMatch", "noneMatch" -> {
                val latestOperationEvent = activeExecution!!.latestEventForOperation(operationId)
                val elementId = latestOperationEvent?.elementId ?: nextElementId.also { nextElementId++ }
                val parentIds = (latestOperationEvent?.parentIds ?: emptyList()).toMutableList().apply { add(this@StreamOperationTracer.latestRecordedEvent!!.elementId) }
                // The traced value is the predicate result, which noneMatch must invert to show the operation's result so far.
                val matchResult = if (operation == "noneMatch") (!observedValue.toBoolean()).toString() else observedValue.toString()
                recordStreamEvent(operation, StreamEventKind.END, operationId, elementId, parentIds, "boolean", matchResult, operationParameter)
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

    /**
     * Records the state of a collect accumulator after one more element was added. The collect marble keeps one
     * element ID, and every element that reached the accumulator becomes one of its parents, also when the state
     * did not change (for example an element rejected by `Collectors.filtering`). The element that just reached the
     * accumulator is always the last parent, so [MarbleDiagramGenerator] can give it the values that are new in [state]
     * and draw them in that element's color.
     */
    fun recordCollectorState(operationId: Int, executionId: Int, operationParameter: String, state: CollectorState) {
        if (!activateStream(executionId)) return
        val execution = activeExecution ?: return
        val latestElementEvent = execution.latestEvent ?: return
        val latestCollectEvent = execution.latestEventForOperation(operationId)
        val elementId = latestCollectEvent?.elementId ?: nextElementId++
        val parentIds = (latestCollectEvent?.parentIds ?: emptyList()) + latestElementEvent.elementId
        execution.recordEvent("collect", StreamEventKind.END, operationId, elementId, parentIds, state.displayType, state, operationParameter)
    }

    /**
     * Makes sure the last collect marble shows [result], the value collect returned. The running states read from the
     * accumulator are only correct when the accumulator already is the result, or when its layout is known (see
     * `CollectorStateReader`). Otherwise, for example for a `collectingAndThen` finisher, the running marbles show
     * [CollectorState.PENDING] and the last one shows the result, whose values have no known origin. A collect
     * without accumulator events (an empty stream) is recorded later by [completeStreamVisualization].
     */
    private fun reconcileCollectResult(execution: StreamExecution, operationId: Int, result: CollectorState) {
        val latestState = execution.latestEventForOperation(operationId) ?: return
        val latestCollectorState = latestState.observedValue as? CollectorState
        if (latestCollectorState != null && sameContent(latestCollectorState, result)) return
        execution.replaceEvents(operationId) { event ->
            val state = if (event === latestState) result else CollectorState.PENDING
            event.copy(type = state.displayType, observedValue = state)
        }
    }

    /**
     * Compares two states the way StreamViz shows them. Sets and maps are compared without regard to order,
     * because `toUnmodifiableSet` and `toUnmodifiableMap` iterate in a different order than the running `HashSet`/`HashMap`.
     */
    private fun sameContent(a: CollectorState, b: CollectorState): Boolean = when {
        a is CollectorState.Items && b is CollectorState.Items && a.type == StreamDisplayType.SET ->
            a.type == b.type && a.values.toSet() == b.values.toSet() && a.values.size == b.values.size
        a is CollectorState.Entries && b is CollectorState.Entries -> a.entries.toSet() == b.entries.toSet() && a.entries.size == b.entries.size
        else -> a == b
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
            text == "Optional.empty" -> ReductionCompletionValue(StreamDisplayType.OPTIONAL.label, text)
            text.startsWith("Optional[") && text.endsWith("]") -> ReductionCompletionValue(StreamDisplayType.OPTIONAL.label, text.removeSurrounding("Optional[", "]"))
            text == "OptionalInt.empty" -> ReductionCompletionValue(StreamDisplayType.OPTIONAL_INT.label, text)
            text.startsWith("OptionalInt[") && text.endsWith("]") -> ReductionCompletionValue("int", text.removeSurrounding("OptionalInt[", "]"))
            text == "OptionalLong.empty" -> ReductionCompletionValue(StreamDisplayType.OPTIONAL_LONG.label, text)
            text.startsWith("OptionalLong[") && text.endsWith("]") -> ReductionCompletionValue("long", text.removeSurrounding("OptionalLong[", "]"))
            text == "OptionalDouble.empty" -> ReductionCompletionValue(StreamDisplayType.OPTIONAL_DOUBLE.label, text)
            text.startsWith("OptionalDouble[") && text.endsWith("]") -> ReductionCompletionValue("double", text.removeSurrounding("OptionalDouble[", "]"))
            else -> ReductionCompletionValue(type, text)
        }
    }

    /**
     * Completes one execution after the debuggee terminal wrapper has returned.
     * [collectResult] is the value that collect returned; it is `null` for every other terminal operation.
     */
    fun completeStreamVisualization(
        executionId: Int,
        operation: String,
        operationId: Int,
        operationParameter: String,
        resultText: String,
        type: String?,
        collectResult: CollectorState? = null
    ) {
        val execution = allStreams.firstOrNull { it.id == executionId }
            ?: createRuntimeStream(executionId, activeExecution)
        activateStream(execution)
        if (collectResult != null) reconcileCollectResult(execution, operationId, collectResult)
        if (execution.events.none { it.operationId == operationId && it.operation == operation }) {
            val elementId = nextElementId++
            // Only an emitted element reached the terminal; an element whose last event is an IN was dropped, for example by filter.
            val latestElementEvent = execution.latestEvent
            val parentIds = if (latestElementEvent?.eventKind == StreamEventKind.START || latestElementEvent?.eventKind == StreamEventKind.OUT) {
                listOf(latestElementEvent.elementId)
            } else {
                emptyList()
            }
            execution.recordEvent(
                operation,
                StreamEventKind.END,
                operationId,
                elementId,
                parentIds,
                // StreamViz draws void terminals as an ellipse, also when no element reached forEach.
                collectResult?.displayType ?: type ?: if (operation == "forEach" || operation == "forEachOrdered") "void" else null,
                collectResult ?: resultText,
                operationParameter
            )
        }
        streamVisualizationData = marbleDiagramGenerator.generate(allStreams)
        if (currentlyExecutingStreams.lastOrNull()?.id == executionId) currentlyExecutingStreams.removeAt(currentlyExecutingStreams.lastIndex)
    }

    /**
     * Closes a flatMap or `Collectors.flatMapping` child, including an empty child with no START event. Such a child
     * has no terminal operation in the user's code, so `$JavaWiz` reports its end explicitly.
     * Streams created in other callbacks need no such boundary: their first START creates them as children of the
     * active execution, and their terminal completion or the next event of the calling stream releases them.
     */
    fun endNestedFlatmapStream(executionId: Int) {
        val execution = allStreams.firstOrNull { it.id == executionId }
            ?: createRuntimeStream(executionId, activeExecution)
        activateStream(execution)
        streamVisualizationData = marbleDiagramGenerator.generate(allStreams)
        if (currentlyExecutingStreams.lastOrNull()?.id == executionId) currentlyExecutingStreams.removeAt(currentlyExecutingStreams.lastIndex)
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

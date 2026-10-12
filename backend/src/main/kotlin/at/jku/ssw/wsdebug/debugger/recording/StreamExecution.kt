package at.jku.ssw.wsdebug.debugger.recording

/**
 * Aggregates the metadata, parent context, and event indexes for one runtime stream execution.
 * A stream execution owns this mutable recording state so sibling executions cannot share pending
 * events or operation history accidentally.
 */
class StreamExecution(
    val id: Int,
    val parentStreamExecution: StreamExecution?,
    val streamObjectId: Long?
) {
    val parentExecutionId: Int?
        get() = parentStreamExecution?.id

    private val mutableEvents = mutableListOf<StreamEvent>()
    private val latestEventsByOperationId = mutableMapOf<Int, StreamEvent>()
    private val mutablePendingSortedEvents = mutableListOf<StreamEvent>()
    private var lastSequence = 0

    val events: List<StreamEvent>
        get() = mutableEvents
    val pendingSortedEvents: List<StreamEvent>
        get() = mutablePendingSortedEvents
    val latestEvent: StreamEvent?
        get() = mutableEvents.lastOrNull()

    fun latestEventForOperation(operationId: Int): StreamEvent? = latestEventsByOperationId[operationId]

    fun precedingOutputValues(operationId: Int): List<Any> =
        mutableEvents
            .filter { it.operationId == operationId && it.eventKind == StreamEventKind.OUT }
            .map { it.observedValue }

    /** Records an event and updates only the indexes owned by this execution. */
    fun recordEvent(
        operation: String,
        eventKind: StreamEventKind,
        operationId: Int,
        elementId: Int,
        parentIds: List<Int>,
        type: String?,
        observedValue: Any,
        operationParameter: String
    ): StreamEvent {
        val sequence = if (eventKind == StreamEventKind.IN) 0 else ++lastSequence
        val event = StreamEvent(sequence, operation, eventKind, operationId, elementId, parentIds, type, observedValue, operationParameter)
        mutableEvents.add(event)
        if (eventKind != StreamEventKind.OUT) {
            if (operation == "sorted") mutablePendingSortedEvents.add(event)
            latestEventsByOperationId[operationId] = event
        }
        return event
    }

    /** Matches one sorted output with its earlier input occurrence and consumes that pending match. */
    fun takePendingSortedEvent(observedValue: Any): StreamEvent {
        val event = mutablePendingSortedEvents.first { it.observedValue == observedValue }
        mutablePendingSortedEvents.remove(event)
        return event
    }
}

/** Captures one stream event together with its operation, identity, type, and observed value. */
data class StreamEvent(
    val seq: Int,
    val operation: String,
    val eventKind: StreamEventKind,
    val operationId: Int,
    val elementId: Int,
    val parentIds: List<Int>,
    val type: String?,
    val observedValue: Any,
    val operationParameter: String
)

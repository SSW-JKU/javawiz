package at.jku.ssw.wsdebug.debugger.recording

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Test

/** Locks the boundary between runtime stream execution state and marble payload generation. */
class StreamExecutionTest {
    @Test
    fun executionKeepsItsParentObjectAndDerivedParentId() {
        val parent = StreamExecution(1, null, 100L)
        val child = StreamExecution(2, parent, 101L)

        assertSame(parent, child.parentStreamExecution)
        assertEquals(1, child.parentExecutionId)
    }

    @Test
    fun executionOwnsEventIndexesAndPendingSortedEvents() {
        val execution = StreamExecution(1, null, 100L)
        val sortedEvent = execution.recordEvent(
            operation = "sorted",
            eventKind = StreamEventKind.START,
            operationId = 1,
            elementId = 1,
            parentIds = listOf(1),
            type = "int",
            observedValue = 3,
            operationParameter = ""
        )

        assertEquals(listOf(sortedEvent), execution.events)
        assertSame(sortedEvent, execution.latestEventForOperation(1))
        assertEquals(listOf(sortedEvent), execution.pendingSortedEvents)
    }

    @Test
    fun generatorBuildsACollectionFromExecutionsIncludingEmptyExecutions() {
        val execution = StreamExecution(1, null, 100L)
        val collection = MarbleDiagramGenerator().generate(listOf(execution))

        assertEquals(1, collection.streams.size)
        assertEquals(1, collection.streams.single().id)
        assertEquals(emptyList<MarbleDiagramMarble>(), collection.streams.single().marbles)
    }
}

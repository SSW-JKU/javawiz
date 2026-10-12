package at.jku.ssw.wsdebug.debugger.recording

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Verifies the element identities and parent links consumed by StreamViz playback. */
class StreamOperationTracerTest {
    /** Records runtime stream identities separately from compile-time descriptor IDs. */
    @Test
    fun runtimeExecutionsKeepParentsAndRepeatedSourcesSeparate() {
        val tracer = StreamOperationTracer()
        tracer.recordStreamStart("stream", 2, 1, "int", 1)
        tracer.recordElementInput("flatMap", 1, 1, "int", 1, "")

        tracer.recordStreamStart("chars", 1, 65, "int", 2)
        tracer.recordElementInput("mapToObj", 2, 65, "int", 2, "")
        tracer.recordElementOutput("mapToObj", 2, 'A', "char", 2, "")
        tracer.endNestedFlatmapStream(2)
        val firstChildId = tracer.streamVisualizationData.streams.last().id

        tracer.recordStreamStart("chars", 1, 66, "int", 3)
        tracer.recordElementInput("mapToObj", 2, 66, "int", 3, "")
        tracer.recordElementOutput("mapToObj", 2, 'B', "char", 3, "")

        val visualization = tracer.rebuildStreamVisualization()
        val children = visualization.streams.filter { it.parentStreamId != null }
        assertEquals(2, children.size)
        assertEquals(2, children.map { it.id }.distinct().size)
        assertNotEquals(firstChildId, children.last().id)
        assertEquals(setOf(visualization.streams.first { it.parentStreamId == null }.id), children.map { it.parentStreamId }.toSet())
        assertEquals(listOf("chars", "mapToObj"), children.first().operationLanes.values.map { it.operation })
        assertEquals(listOf("chars", "mapToObj"), children.last().operationLanes.values.map { it.operation })
    }

    /** A source is represented even when laziness produces no source element event. */
    @Test
    fun emptyExecutionsRemainInThePayload() {
        val tracer = StreamOperationTracer()
        tracer.completeStreamVisualization(1, "count", 7, "", "0", "long")

        val empty = tracer.streamVisualizationData.streams.single()
        assertEquals(1, empty.id)
        assertNull(empty.parentStreamId)
        assertEquals(listOf("count"), empty.operationLanes.values.map { it.operation })
        assertEquals("0", empty.marbles.single().label)
        assertEquals(listOf("count"), tracer.rebuildStreamVisualization().streams.single().operationLanes.values.map { it.operation })
    }

    /** Records a reduce return value without inventing an accumulator event or parent link. */
    @Test
    fun reduceCompletionRepresentsEmptyResultsAndSkipsOrdinaryDuplicates() {
        val emptyTracer = StreamOperationTracer()
        emptyTracer.completeStreamVisualization(21, "reduce", 0, "Math::max", "OptionalInt.empty", "java.util.OptionalInt")

        val emptyVisualization = emptyTracer.rebuildStreamVisualization().streams.single()
        assertEquals(listOf("reduce"), emptyVisualization.operationLanes.values.map { it.operation })
        val emptyResult = emptyVisualization.marbles.single { it.operation == "reduce" }
        assertEquals("OptionalInt.empty", emptyResult.label)
        assertTrue(emptyVisualization.links.none { it.target == emptyResult.marbleKey })

        val ordinaryTracer = StreamOperationTracer()
        ordinaryTracer.recordStreamStart("stream", 1, 8, "int", 0)
        ordinaryTracer.recordElementInput("reduce", 0, 8, "int", 0, "Math::max")
        ordinaryTracer.recordTerminalResult("reduce", 0, 0, "Math::max", "8")
        ordinaryTracer.recordTerminalCompletion("reduce", 0, 0, "Math::max", "8", "int")

        val ordinaryReduction = ordinaryTracer.rebuildStreamVisualization().streams.single().marbles
            .filter { it.operation == "reduce" }
        assertEquals(1, ordinaryReduction.size)
        assertEquals("8", ordinaryReduction.single().label)
    }

    /** Completing a child restores the enclosing context for subsequent parent events. */
    @Test
    fun rebuildingChildRestoresParentContext() {
        val tracer = StreamOperationTracer()
        tracer.recordStreamStart("stream", 2, 1, "int", 30)
        tracer.recordElementInput("flatMap", 1, 1, "int", 30, "")
        tracer.recordStreamStart("stream", 1, 2, "int", 31)
        tracer.endNestedFlatmapStream(31)

        tracer.recordElementOutput("flatMap", 1, 2, "int", 30, "")
        assertEquals("flatMap", tracer.latestRecordedEvent?.operation)
        assertNull(tracer.streamVisualizationData.streams.first { it.parentStreamId == null }.parentStreamId)
    }

    /** Reproduces successive expansions with terminal events between their outputs. */
    @Test
    fun flatMapChildrenRemainDistinctAcrossParentsWithInterleavedSum() {
        val tracer = StreamOperationTracer()
        val expectedParents = mutableListOf<String>()
        for (input in listOf(3, 2)) {
            tracer.recordStreamStart("stream", 3, input, "int", 0)
            tracer.recordElementInput("limit", 2, input, "int", 0, "3")
            tracer.recordElementOutput("limit", 2, input, "int", 0, "3")
            val parentId = tracer.latestRecordedEvent!!.elementId
            tracer.recordElementInput("flatMap", 1, input, "int", 0, "")
            for (output in 1..input) {
                tracer.recordElementOutput("flatMap", 1, output, "int", 0, "")
                assertEquals(listOf(parentId), tracer.latestRecordedEvent!!.parentIds)
                expectedParents.add("$parentId.2")
                tracer.recordTerminalResult("sum", 0, 0, "", null)
            }
        }

        val visualization = tracer.rebuildStreamVisualization().streams.single()
        val children = visualization.marbles.filter { it.operation == "flatMap" }
        assertEquals(listOf("1", "2", "3", "1", "2"), children.map { it.label })
        assertEquals(5, children.map { it.marbleKey }.distinct().size)
        val childLinks = visualization.links.filter { link -> children.any { it.marbleKey == link.target } }
        assertEquals(expectedParents, childLinks.map { it.source })
        assertEquals(children.map { it.marbleKey }, childLinks.map { it.target })
        // Playback keeps only the latest marble per element ID; both parents' children must survive.
        assertEquals(5, children.associateBy { it.marbleKey }.size)
    }

    /** Equal values are separate occurrences, even when they also equal the input. */
    @Test
    fun repeatedEqualFlatMapOutputsHaveFreshIdentities() {
        val tracer = StreamOperationTracer()
        tracer.recordStreamStart("stream", 2, 2, "int", 0)
        val parentId = tracer.latestRecordedEvent!!.elementId
        tracer.recordElementInput("flatMap", 1, 2, "int", 0, "")
        val childIds = (1..3).map {
            tracer.recordElementOutput("flatMap", 1, 2, "int", 0, "")
            assertEquals(listOf(parentId), tracer.latestRecordedEvent!!.parentIds)
            tracer.latestRecordedEvent!!.elementId
        }
        assertEquals(3, childIds.distinct().size)
        childIds.forEach { assertNotEquals(parentId, it) }
    }

    /** An empty expansion must not affect the next parent's child or downstream map identity. */
    @Test
    fun emptyFlatMapExpansionAndOrdinaryMapPreserveParentIdentity() {
        val tracer = StreamOperationTracer()
        tracer.recordStreamStart("stream", 3, 0, "int", 0)
        tracer.recordElementInput("flatMap", 2, 0, "int", 0, "")
        tracer.recordStreamStart("stream", 3, 1, "int", 0)
        val parentId = tracer.latestRecordedEvent!!.elementId
        tracer.recordElementInput("flatMap", 2, 1, "int", 0, "")
        tracer.recordElementOutput("flatMap", 2, 1, "int", 0, "")
        val childId = tracer.latestRecordedEvent!!.elementId
        assertEquals(listOf(parentId), tracer.latestRecordedEvent!!.parentIds)
        tracer.recordElementInput("map", 1, 1, "int", 0, "")
        tracer.recordElementOutput("map", 1, 10, "int", 0, "")
        assertEquals(childId, tracer.latestRecordedEvent!!.elementId)
        val visualization = tracer.rebuildStreamVisualization().streams.single()
        assertEquals(1, visualization.marbles.count { it.operation == "flatMap" })
        assertEquals("$parentId.3", visualization.links.first().source)
    }

    /** Numeric comparison must not change the representation shown in max and min marbles. */
    @Test
    fun maxAndMinPreserveIntegerAndFractionalLabels() {
        val maxTracer = StreamOperationTracer()
        maxTracer.recordStreamStart("stream", 1, 8, "int", 0)
        maxTracer.recordElementInput("max", 0, 8, "int", 0, "")
        maxTracer.recordElementInput("map", 1, 3, "int", 0, "")
        maxTracer.recordTerminalResult("max", 0, 0, "", null)
        maxTracer.recordElementInput("map", 1, 11, "int", 0, "")
        maxTracer.recordTerminalResult("max", 0, 0, "", null)

        val maxLabels = maxTracer.rebuildStreamVisualization().streams.single()
            .marbles
            .filter { it.operation == "max" }
            .map { it.label }
        assertEquals(listOf("8", "11"), maxLabels)

        val minTracer = StreamOperationTracer()
        minTracer.recordStreamStart("stream", 1, 8, "int", 0)
        minTracer.recordElementInput("min", 0, 8, "int", 0, "")
        minTracer.recordElementInput("map", 1, 3, "int", 0, "")
        minTracer.recordTerminalResult("min", 0, 0, "", null)
        minTracer.recordElementInput("map", 1, 11, "int", 0, "")
        minTracer.recordTerminalResult("min", 0, 0, "", null)

        val minLabels = minTracer.rebuildStreamVisualization().streams.single()
            .marbles
            .filter { it.operation == "min" }
            .map { it.label }
        assertEquals(listOf("3", "3"), minLabels)

        val floatingPointTracer = StreamOperationTracer()
        floatingPointTracer.recordStreamStart("stream", 1, 8.5, "double", 0)
        floatingPointTracer.recordElementInput("max", 0, 8.5, "double", 0, "")
        floatingPointTracer.recordElementInput("map", 1, 3.25, "double", 0, "")
        floatingPointTracer.recordTerminalResult("max", 0, 0, "", null)
        floatingPointTracer.recordElementInput("map", 1, 9.75, "double", 0, "")
        floatingPointTracer.recordTerminalResult("max", 0, 0, "", null)

        val floatingPointLabels = floatingPointTracer.rebuildStreamVisualization().streams.single()
            .marbles
            .filter { it.operation == "max" }
            .map { it.label }
        assertEquals(listOf("8.5", "9.75"), floatingPointLabels)
    }
}

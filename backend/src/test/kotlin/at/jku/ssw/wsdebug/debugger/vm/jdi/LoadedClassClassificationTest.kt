package at.jku.ssw.wsdebug.debugger.vm.jdi

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

internal class LoadedClassClassificationTest {
    @Test
    fun `data structures collect fields even when heap traversal stops`() {
        assertEquals(
            LoadedClassClassification(
                isHeapTraversalStop = true,
                isJavaDataStructure = true,
                hasCollectedFields = true
            ),
            classifyLoadedClass(
                "java.util.ArrayList",
                heapTraversalStopPatterns = listOf("java.*"),
                dataStructurePatterns = listOf("java.util.*")
            )
        )
    }

    @Test
    fun `ordinary and stopped classes use the traversal decision`() {
        assertEquals(
            LoadedClassClassification(false, false, true),
            classifyLoadedClass("example.Ordinary", listOf("internal.*"), emptyList())
        )
        assertEquals(
            LoadedClassClassification(true, false, false),
            classifyLoadedClass("internal.Stopped", listOf("internal.*"), emptyList())
        )
    }
}

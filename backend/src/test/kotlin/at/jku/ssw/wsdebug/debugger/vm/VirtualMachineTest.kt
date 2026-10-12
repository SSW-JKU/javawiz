package at.jku.ssw.wsdebug.debugger.vm

import at.jku.ssw.wsdebug.compilation.ParseInfo
import at.jku.ssw.wsdebug.debugger.recording.HeapArray
import at.jku.ssw.wsdebug.debugger.recording.HeapObject
import at.jku.ssw.wsdebug.debugger.recording.HeapString
import at.jku.ssw.wsdebug.debugger.recording.InputBufferInfo
import at.jku.ssw.wsdebug.debugger.recording.MarbleDiagramDataCollection
import at.jku.ssw.wsdebug.debugger.recording.ReferenceVal
import at.jku.ssw.wsdebug.debugger.recording.StackFrame
import at.jku.ssw.wsdebug.debugger.recording.StepResult
import at.jku.ssw.wsdebug.debugger.recording.TraceState
import at.jku.ssw.wsdebug.debugger.recording.Var
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Verifies heap items retained across a method return without launching JDI. */
class VirtualMachineTest {
    /** Keeps String backing arrays as hidden support items for detailed frontend traversal. */
    @Test
    fun retainsBackingArraysForFakedStringsWithoutMakingThemVisibleRoots() {
        val backingArray = HeapArray(2, "byte[]", false, emptyList())
        val string = HeapString(
            1,
            "java.lang.String",
            false,
            "A",
            Var("value", "byte[]", ReferenceVal(backingArray.id))
        )
        val ordinaryObject = HeapObject(3, "Example", false, emptyList())
        val previous = trace(
            stack = listOf(stackFrame("demo")),
            heap = mutableListOf(string, backingArray, ordinaryObject)
        )
        val current = trace(stack = emptyList(), heap = mutableListOf())

        TestVirtualMachine(previous).addFakeObjects(current)

        assertEquals(setOf(1L, 2L, 3L), current.heap.map { it.id }.toSet())
        assertTrue(current.heap.single { it.id == string.id }.faked)
        assertTrue(current.heap.single { it.id == ordinaryObject.id }.faked)
        assertFalse(current.heap.single { it.id == backingArray.id }.faked)
    }

    /** Creates the smallest trace needed by the fake-object retention contract. */
    private fun trace(stack: List<StackFrame>, heap: MutableList<at.jku.ssw.wsdebug.debugger.recording.HeapItem>) =
        TraceState(
            sourceFileUri = "Test.java",
            line = 1,
            stack = stack,
            heap = heap,
            loadedClasses = emptyList(),
            output = "",
            error = "",
            input = "",
            inputBufferInfo = InputBufferInfo.EMPTY,
            stepProcessingTime = 0,
            timeSinceLastStep = 0,
            streamVisualizationData = MarbleDiagramDataCollection(mutableListOf())
        )

    /** Creates a user frame whose removal triggers fake-object retention. */
    private fun stackFrame(method: String) = StackFrame(
        line = 1,
        `class` = "Example",
        method = method,
        signature = "()V",
        displaySignature = "$method()",
        genericSignature = null,
        localVariables = mutableListOf(),
        conditionValues = emptyList(),
        arrayAccessValues = emptyList(),
        `this` = null,
        internal = false
    )

    /** Supplies only the previous trace needed by [VirtualMachine.addFakeObjects]. */
    private class TestVirtualMachine(private val previous: TraceState) : VirtualMachine {
        override val fullyQualifiedMainClassName = "Example"
        override val cp = ""
        override val parseInfos: List<ParseInfo> = emptyList()
        override fun launchAndSetup() = unsupported()
        override fun handleSingleStep(): StepResult? = unsupported()
        override fun resume() = unsupported()
        override fun exit(exitCode: Int) = unsupported()
        override fun isRunning(): Boolean = false
        override fun input(input: String) = unsupported()
        override fun getPreviousTraceState(): TraceState = previous

        /** Fails if the focused test accidentally invokes unrelated VM behavior. */
        private fun unsupported(): Nothing = error("Not used by this test")
    }
}

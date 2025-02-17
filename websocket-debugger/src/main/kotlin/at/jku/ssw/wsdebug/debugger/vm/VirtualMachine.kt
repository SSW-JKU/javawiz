package at.jku.ssw.wsdebug.debugger.vm

import at.jku.ssw.wsdebug.communication.FilepathAndContent
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE
import at.jku.ssw.wsdebug.compilation.ParseInfo
import at.jku.ssw.wsdebug.debugger.recording.HeapString
import at.jku.ssw.wsdebug.debugger.recording.ReferenceVal
import at.jku.ssw.wsdebug.debugger.recording.StepResult
import at.jku.ssw.wsdebug.debugger.recording.TraceState

interface VirtualMachine {
    companion object {
        const val IN_CLASS_NAME = "In"
        val INTERNAL_CLASS_PATTERNS: List<String> = listOf(
        "java.*", "javax.*", "javafx.*", "sun.*", "com.sun.*", "jdk.*", "*.In", "*.Out", "*.Rand", "In", "Out", "Rand", "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS")



    }

    val fullyQualifiedMainClassName: String
    val cp: String
    val parseInfos: List<ParseInfo>

    /**
     * Starts the virtual machines and sets it up, i.e., installing needed event listeners, breakpoints, ...
     */
    fun launchAndSetup()

    /**
     * Retrieves a [StepResult] that may include one or zero instances of [TraceState] after a single step.
     * @return a [StepResult] with potentially one or zero [TraceState] instances, or null if another event needs to be processed
     */
    fun handleSingleStep(): StepResult?

    /**
     * Resumes the execution of the virtual machine.
     */
    fun resume()

    /**
     * Causes the virtual machine to terminate with the given error code.
     * @param exitCode code to terminate the virtual machine with
     */
    fun exit(exitCode: Int)

    /**
     * Checks whether the virtual machine is currently in an active running state.
     * @return `true` if the virtual machine is still running, `false` otherwise
     */
    fun isRunning(): Boolean

    /**
     * Sends input to the virtual machine.
     * @param input is sent to the machine
     */
    fun input(input: String)

    /**
     * Retrieves the previous [TraceState] of the virtual machine.
     * @return previous [TraceState]
     */
    fun getPreviousTraceState(): TraceState

    /**
     * Resumes the virtual machine, if the virtual machine is still running and calls [handleSingleStep].
     * @return a [StepResult] with potentially one or zero [TraceState] instances
     */
    fun resumeAndSingleStep(): StepResult {
        while (isRunning()) {
            resume()
            val result = handleSingleStep()
            if(result != null) {
                return result
            }
        }
        return StepResult(isVMRunning = false)
    }

    /**
     * Generates a map from type name to its parse info for easy lookup while debugging.
     * @return A map mapping fully qualified type names to their parse info.
     */
    fun generateParseInfoByTypeNames() = buildMap {
        putAll(parseInfos.flatMap { info -> info.typeNames.map { name -> Pair(name, info) } })
    }

    /**
     * Adds faked objects to the given trace state using the previous trace state.
     * @param traceState The trace state the faked objects should be added to.
     */
    fun addFakeObjects(traceState: TraceState) {
        val previousTraceState = getPreviousTraceState()
        if (traceState.stack.size < previousTraceState.stack.size) {
            val existingIds = traceState.heap.map { it.id }.toSet() + // do not fake existing objects ...
                    previousTraceState.heap.filterIsInstance<HeapString>().map { (it.charArr.value as ReferenceVal).reference } // ... nor previous string arrays
            val fakes = previousTraceState.heap.filter { it.id !in existingIds }.map { it.copyAsFaked() }
            traceState.heap += fakes
        }
    }
}
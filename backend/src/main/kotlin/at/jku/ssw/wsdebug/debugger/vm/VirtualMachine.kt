package at.jku.ssw.wsdebug.debugger.vm

import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE
import at.jku.ssw.wsdebug.compilation.ParseInfo
import at.jku.ssw.wsdebug.debugger.recording.HeapString
import at.jku.ssw.wsdebug.debugger.recording.ReferenceVal
import at.jku.ssw.wsdebug.debugger.recording.StepResult
import at.jku.ssw.wsdebug.debugger.recording.TraceState
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS

interface VirtualMachine {
    companion object {
        const val IN_CLASS_NAME = "In"

        /**
         * Default patterns for classes that are excluded from stepping and instrumentation,
         * and whose fields are not collected ([INTERNAL_CLASS_PATTERNS] is used as the default
         * for both [excludeFromSteppingPatterns] and [excludeFieldsPatterns] in [RequestHandling]).
         */
        val INTERNAL_CLASS_PATTERNS: List<String> = listOf(
            "java.*",
            "javax.*",
            "javafx.*",
            "sun.*",
            "com.sun.*",
            "jdk.*",
            "*.In",
            "*.Out",
            "*.Rand",
            "In",
            "Out",
            "Rand",
            "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS"
        )

        val DATA_STRUCTURE_CLASSES = listOf(
            // --- Core Interfaces ---
            "java.util.Collection",
            "java.util.List",
            "java.util.Set",
            "java.util.Map",
            "java.util.Queue",
            "java.util.Deque",
            "java.util.SortedSet",
            "java.util.SortedMap",
            "java.util.NavigableSet",
            "java.util.NavigableMap",

            // --- Lists ---
            "java.util.ArrayList",
            "java.util.LinkedList",
            "java.util.Vector",
            "java.util.Stack",

            // --- Sets ---
            "java.util.HashSet",
            "java.util.LinkedHashSet",
            "java.util.TreeSet",
            "java.util.BitSet",
            "java.util.EnumSet",

            // --- Maps ---
            "java.util.HashMap",
            "java.util.LinkedHashMap",
            "java.util.TreeMap",
            "java.util.Hashtable",
            "java.util.Properties",
            "java.util.WeakHashMap",
            "java.util.IdentityHashMap",
            "java.util.EnumMap",

            // --- Queues & Deques (Standard) ---
            "java.util.PriorityQueue",
            "java.util.ArrayDeque",

            // --- Concurrent Collections (java.util.concurrent) ---
            "java.util.concurrent.ConcurrentHashMap",
            "java.util.concurrent.CopyOnWriteArrayList",
            "java.util.concurrent.CopyOnWriteArraySet",
            "java.util.concurrent.ConcurrentSkipListMap",
            "java.util.concurrent.ConcurrentSkipListSet",
            "java.util.concurrent.ConcurrentLinkedQueue",
            "java.util.concurrent.ConcurrentLinkedDeque",

            // --- Blocking Queues (java.util.concurrent) ---
            "java.util.concurrent.ArrayBlockingQueue",
            "java.util.concurrent.LinkedBlockingQueue",
            "java.util.concurrent.LinkedBlockingDeque",
            "java.util.concurrent.PriorityBlockingQueue",
            "java.util.concurrent.DelayQueue",
            "java.util.concurrent.SynchronousQueue",
            "java.util.concurrent.LinkedTransferQueue",

            // Returned by Arrays.asList()
            "java.util.Arrays\$ArrayList",

            // Returned by Collections.singletonList(), etc.
            "java.util.Collections\$SingletonList",
            "java.util.Collections\$SingletonSet",
            "java.util.Collections\$SingletonMap",
            "java.util.Collections\$EmptyList",
            "java.util.Collections\$EmptySet",
            "java.util.Collections\$EmptyMap",

            // Returned by Java 9+ List.of(), Set.of(), Map.of()
            "java.util.ImmutableCollections\$List12",
            "java.util.ImmutableCollections\$ListN",
            "java.util.ImmutableCollections\$Set12",
            "java.util.ImmutableCollections\$SetN",
            "java.util.ImmutableCollections\$Map1",
            "java.util.ImmutableCollections\$MapN"
        )
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
            if (result != null) {
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
     *
     * Fakes objects are objects that are currently not referenced from a variable but should be included in the trace, for example to show them on the memory view.
     * Our use case for this is when we step out of constructors: The constructor just created the object (which was referenced by `this` while we were in the constructor), but
     * when we step out of the constructor, this object is not yet referenced from another variable (since the assignment to the variable just happens on the next step).
     * In this case, we want to fake the object in the trace after stepping out of the constructor, so that it is visible in the memory view and can be inspected by the user,
     * even before being assigned to the variable.
     *
     * @param traceState The trace state the faked objects should be added to.
     */
    fun addFakeObjects(traceState: TraceState) {
        val previousTraceState = getPreviousTraceState()

        val previousMostInnerFrame = previousTraceState.stack.first()

        if (traceState.stack.size < previousTraceState.stack.size && !previousMostInnerFrame.method.contains("lambda$")) { // only fake heap objects if we did not leave a lambda function
            val existingIds = traceState.heap.map { it.id }.toSet() + // do not fake existing objects ...
                    previousTraceState.heap.filterIsInstance<HeapString>().map { (it.charArr.value as ReferenceVal).reference } // ... nor previous string arrays
            val fakes = previousTraceState.heap.filter { it.id !in existingIds }.map { it.copyAsFaked() }
            traceState.heap += fakes
        }
    }
}
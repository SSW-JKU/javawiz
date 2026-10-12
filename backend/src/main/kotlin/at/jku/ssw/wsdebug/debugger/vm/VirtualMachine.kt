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
         * for both [excludeFromSteppingPatterns] and [heapTraversalStopPatterns] in [RequestHandling]).
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
     * Keeps heap objects visible for one extra step after a method returns.
     *
     * The returned object briefly has no variable pointing to it: the method's variables are already gone,
     * but the caller has not stored the result yet. We copy the previous heap into this gap and mark its objects
     * as `faked`, which tells the frontend to show them temporarily.
     *
     * Strings need their internal array to come along with them, but we do not want to force-show these backing arrays.
     * The backing arrays are not marked as `faked`, which would show them in every memory view.
     * The detailed memory view can still find it by following the String's reference.
     *
     * @param traceState the state to which the previous heap objects are added
     */
    fun addFakeObjects(traceState: TraceState) {
        val previousTraceState = getPreviousTraceState()

        val previousMostInnerFrame = previousTraceState.stack.first()

        // A smaller stack means that a method has just returned. Lambda returns do not create this gap.
        if (traceState.stack.size < previousTraceState.stack.size && !previousMostInnerFrame.method.contains("lambda$")) {
            val existingIds = traceState.heap.map { it.id }.toSet()
            val previousStringArrayIds = previousTraceState.heap
                .filterIsInstance<HeapString>()
                .map { (it.charArr.value as ReferenceVal).reference }
                .toSet()
            val retainedHeapItems = previousTraceState.heap
                .filter { it.id !in existingIds }
                .map { previousItem ->
                    // Force-show regular objects on every view by marking them as faked.
                    // Also record String backing arrays, but do not mark them as `faked` -> no force show, but
                    // displayable in "Data Structure Details" view.
                    if (previousItem.id in previousStringArrayIds) previousItem else previousItem.copyAsFaked()
                }
            traceState.heap += retainedHeapItems
        }
    }
}

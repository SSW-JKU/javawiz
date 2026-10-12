package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.debugger.recording.*
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
import com.sun.jdi.AbsentInformationException
import com.sun.jdi.Method
import com.sun.jdi.ReferenceType
import com.sun.jdi.event.LocatableEvent

fun buildTraceState(
    event: LocatableEvent,
    fileUri: String,
    lineNumber: Int,
    conditionValues: Map<Int, Set<ConditionValue>>,
    arrayAccessValues: Map<Int, Set<ArrayAccessValue>>,
    streamVisualizationData: MarbleDiagramDataCollection,
    output: String,
    error: String,
    input: String,
    loadedClassClassifications: Map<ReferenceType, LoadedClassClassification>,
    inputBufferInfo: InputBufferInfo,
    excludeFromSteppingPatterns: List<String>,
    latestSingleStepStartTime: Long,
    stepProcessingTime: Long,
    timeSinceLastStep: Long
): TraceState {
    val heap: MutableMap<Long, HeapItem> = mutableMapOf()
    val classesWithCollectedFields = loadedClassClassifications
        .filterValues { it.hasCollectedFields }
        .keys

    val frameCount = event.thread().frameCount()
    val stackFrameToConditionValues: Map<com.sun.jdi.StackFrame, Set<ConditionValue>> = conditionValues
        .mapKeys { (stackDepth, _) -> event.thread().frame(stackDepth) }

    val stackFrameToArrayAccessValues: Map<com.sun.jdi.StackFrame, Set<ArrayAccessValue>> = arrayAccessValues
        .mapKeys { (stackDepth, _) -> event.thread().frame(stackDepth) }

    val stackFrames = event.thread().frames()
        .map { frame ->
            buildStackItem(
                frame,
                heap,
                stackFrameToConditionValues[frame] ?: setOf(),
                stackFrameToArrayAccessValues[frame] ?: setOf(),
                excludeFromSteppingPatterns,
                classesWithCollectedFields
            )
        }
    val loadedClasses = loadedClassClassifications
        // Keep traversal-stop metadata when an object of that class reached the heap, but do not
        // expose every prepared JDK helper class merely because class-prepare events are observed.
        .filter { (clazz, classification) ->
            classification.hasCollectedFields || heap.values.any { heapItem -> heapItem.type == clazz.name() }
        }
        .map { (clazz, classification) ->
            LoadedClass(
                clazz.name(),
                if (classification.hasCollectedFields) {
                    clazz
                        .allFields()
                        .filter { it.isStatic && !it.isSynthetic }
                        .map { field -> createVar(field, heap, classesWithCollectedFields) }
                } else {
                    emptyList()
                },
                classification.isHeapTraversalStop,
                classification.isJavaDataStructure,
                classification.hasCollectedFields
            )
        }

    val traceState = TraceState(
        fileUri,
        lineNumber,
        stackFrames,
        heap.values.toMutableList(),
        loadedClasses,
        output.normalizeLineEndings(),
        error.normalizeLineEndings(),
        input.normalizeLineEndings(),
        inputBufferInfo.normalizeLineEndings(),
        stepProcessingTime,
        timeSinceLastStep,
        streamVisualizationData.snapshot()
    )

    return traceState
}

private fun String.normalizeLineEndings(): String =
    replace("\r\n", "\n").replace("\r", "\n")

private fun InputBufferInfo.normalizeLineEndings(): InputBufferInfo =
    copy(
        past = past.normalizeLineEndings(),
        future = future.normalizeLineEndings(),
        latestValue = latestValue.normalizeLineEndings(),
        latestMethod = latestMethod.normalizeLineEndings()
    )

private fun buildStackItem(
    frame: com.sun.jdi.StackFrame,
    heap: MutableMap<Long, HeapItem>,
    conditionValues: Collection<ConditionValue>,
    arrayAccessValues: Collection<ArrayAccessValue>,
    excludeFromSteppingPatterns: List<String>,
    classesWithCollectedFields: Collection<ReferenceType>
): StackFrame {
    val loc = frame.location()
    val methodRef = loc.method()
    val declaringTypeName = loc.declaringType().name()
    val isInternal = declaringTypeName.outerClassMatchesOuterClassPattern(excludeFromSteppingPatterns)

    val line = loc.lineNumber()
    val clazz = declaringTypeName
    val method = methodRef.name()
    val signature = methodRef.signature()
    val displaySignature = buildDisplaySignature(methodRef)
    val genericSignature = methodRef.genericSignature()
    val localVariables = mutableListOf<Var>()
    if (!isInternal) {
        try {
            localVariables += frame.visibleVariables().map { createVar(frame, it, heap, classesWithCollectedFields) }
        } catch (ex: Exception) {
            // Could happen if no local variable information is available / if the method is native.
            // For example, this is the case (or has at least been the case in one test case) if the
            // .toString() method is called implicitly instead of explicitly.
            println("- Could not read local variables of $frame due to $ex")
            // In this case, assume we have no local variables
        }
    }
    val thisVar = frame.thisObject()?.let { createThisVar(declaringTypeName, it, heap, classesWithCollectedFields) }

    return StackFrame(
        line,
        clazz,
        method,
        signature,
        displaySignature,
        genericSignature,
        localVariables,
        conditionValues,
        arrayAccessValues,
        thisVar?.value as ReferenceVal?,
        isInternal
    )
}

private fun buildDisplaySignature(method: Method): String {
    try {
        val s = "${removePackageOrOuterClass(method.returnTypeName())} ${method.name()} (${
            method.arguments().joinToString(", ") { "${removePackageOrOuterClass(it.typeName())} ${it.name()}" }
        })"
        return s
    } catch (e: AbsentInformationException) {
        return method.signature()
    }
}

private fun removePackageOrOuterClass(typeName: String): String {
    val idx = maxOf(typeName.lastIndexOf('$'), typeName.lastIndexOf('.'))
    return typeName.substring(idx + 1)
}

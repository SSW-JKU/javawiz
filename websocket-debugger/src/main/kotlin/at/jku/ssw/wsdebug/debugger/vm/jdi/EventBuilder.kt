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
    output: String,
    error: String,
    input: String,
    relevantClasses: List<ReferenceType>,
    inputBufferInfo: InputBufferInfo,
    internalClassPatterns: List<String>,
    timeSinceLastStep : Long,
    stepProcessingTime : Long
): TraceState {
    val heap: MutableMap<Long, HeapItem> = mutableMapOf()

    val frameCount = event.thread().frameCount()
    val stackFrameToConditionValues: Map<com.sun.jdi.StackFrame, Set<ConditionValue>> = conditionValues
        .mapKeys { (stackDepth, _) -> event.thread().frame(frameCount - stackDepth) }

    val stackFrameToArrayAccessValues: Map<com.sun.jdi.StackFrame, Set<ArrayAccessValue>> = arrayAccessValues
        .mapKeys { (stackDepth, _) -> event.thread().frame(event.thread().frameCount() - stackDepth) }

    val stackFrames = event.thread().frames()
        .map { frame ->
            buildStackItem(
                frame,
                heap,
                stackFrameToConditionValues[frame] ?: setOf(),
                stackFrameToArrayAccessValues[frame] ?: setOf(),
                internalClassPatterns,
                relevantClasses
            )
        }
    val loadedClasses = relevantClasses.map { buildStaticClassComponent(it, heap, relevantClasses) }

    return TraceState(
        fileUri,
        lineNumber,
        stackFrames,
        heap.values.toMutableList(),
        loadedClasses,
        output,
        error,
        input,
        inputBufferInfo,
        timeSinceLastStep,
        stepProcessingTime
    )
}

private fun buildStackItem(
    frame: com.sun.jdi.StackFrame,
    heap: MutableMap<Long, HeapItem>,
    conditionValues: Collection<ConditionValue>,
    arrayAccessValues: Collection<ArrayAccessValue>,
    internalClassPatterns: List<String>,
    relevantClasses: List<ReferenceType>
):
        StackFrame {
    if (outerClassMatchesOuterClassPattern(frame.location().declaringType().name(), internalClassPatterns)) {
        return StackFrame(
            frame.location().lineNumber(),
            frame.location().declaringType().name(),
            frame.location().method().name(),
            frame.location().method().signature(),
            buildDisplaySignature(frame.location().method()),
            frame.location().method().genericSignature(),
            mutableListOf(),
            mutableListOf(),
            mutableListOf(),
            null,
            internal = true
        )
    }
    if (frame.thisObject() != null) {
        createVar(frame, frame.thisObject(), heap, relevantClasses)
    }

    return StackFrame(
        frame.location().lineNumber(),
        frame.location().declaringType().name(),
        frame.location().method().name(),
        frame.location().method().signature(),
        buildDisplaySignature(frame.location().method()),
        frame.location().method().genericSignature(),
        try {
            frame.visibleVariables().map { createVar(frame, it, heap, relevantClasses) }.toMutableList()
        } catch (ex: Exception) {
            // Could happen if no local variable information is available / if the method is native.
            // For example, this is the case (or has at least been the case in one test case) if the
            // .toString() method is called implicitly instead of explicitly.
            println("- Could not read local variables of $frame due to $ex")
            mutableListOf() // In this case, assume we have no local variables
        },
        conditionValues,
        arrayAccessValues,
        if (frame.thisObject() != null) frame.thisObject()?.let { ReferenceVal(it.uniqueID()) } else null,
        internal = false
    )
}

private fun buildStaticClassComponent(
    ref: ReferenceType,
    heap: MutableMap<Long, HeapItem>,
    relevantClasses: List<ReferenceType>
): LoadedClass {
    return LoadedClass(
        ref.name(),
        ref.allFields().filter { it.isStatic && !it.isSynthetic }.map { createVar(it, heap, relevantClasses) }
    )
}

private fun buildDisplaySignature(method: Method): String {
    try {
        val s = "${removePackageOrOuterClass(method.returnTypeName())} ${method.name()} (${method.arguments().map {"${removePackageOrOuterClass(it.typeName())} ${it.name()}"}
            .joinToString(", ")})"
        return s
    } catch (e: AbsentInformationException) {
        return method.signature()
    }
}

private fun removePackageOrOuterClass (typeName: String): String {
    var idx = -1
    if (typeName.lastIndexOf('$') != -1) {
        idx = typeName.lastIndexOf('$')
    } else if (typeName.lastIndexOf('.') != -1) {
        idx = typeName.lastIndexOf('.')
    }
    return typeName.substring(idx + 1, typeName.length)
}
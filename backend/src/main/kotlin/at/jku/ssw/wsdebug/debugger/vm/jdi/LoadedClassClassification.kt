package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern

/** Describes how one loaded class participates in heap collection and specialized views. */
data class LoadedClassClassification(
    val isHeapTraversalStop: Boolean,
    val isJavaDataStructure: Boolean,
    val hasCollectedFields: Boolean
)

/**
 * Classifies a loaded class from the two independent pattern groups.
 *
 * Data structures deliberately override traversal stops so their fields remain available to specialized views.
 */
fun classifyLoadedClass(
    className: String,
    heapTraversalStopPatterns: List<String>,
    dataStructurePatterns: List<String>
): LoadedClassClassification {
    val isHeapTraversalStop = className.outerClassMatchesOuterClassPattern(heapTraversalStopPatterns)
    val isJavaDataStructure = className.outerClassMatchesOuterClassPattern(dataStructurePatterns)
    return LoadedClassClassification(
        isHeapTraversalStop,
        isJavaDataStructure,
        !isHeapTraversalStop || isJavaDataStructure
    )
}

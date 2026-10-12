package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE

/** Describes one text fragment to insert at a zero-based source position. */
data class SourceInsertion(
    val sourceLine: Int,
    val sourceColumn: Int,
    val insertedText: String,
    val samePositionOrder: Int = 0
)

/** Builds source insertions for ordinary tracing and independent stream operation sites. */
fun buildInstrumentationInsertions(
    conditions: List<Condition>,
    arrayAccessIndexWrappers: List<IndexWrapper>,
    streamOperationInstrumentationInfos: List<StreamOperationInstrumentationInfo>
): List<SourceInsertion> = buildConditionSourceInsertions(conditions) +
    buildArrayAccessSourceInsertions(arrayAccessIndexWrappers) +
    streamOperationInstrumentationInfos.flatMap(::buildStreamOperationSourceInsertions)

private fun buildConditionSourceInsertions(conditions: List<Condition>): List<SourceInsertion> = conditions.flatMap {
    listOf(
        SourceInsertion(it.beginLine, it.beginColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.recordCondition("),
        SourceInsertion(it.endLine, it.endColumn, ",${it.id})")
    )
}

private fun buildArrayAccessSourceInsertions(indexWrappers: List<IndexWrapper>): List<SourceInsertion> = indexWrappers.flatMap {
    listOf(
        SourceInsertion(it.beginLine, it.beginColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.recordArrayAccess(${it.outerIndexedVariableName},"),
        SourceInsertion(it.endLine, it.endColumn, ",${it.accessId},${it.dimension})")
    )
}

private fun buildStreamOperationSourceInsertions(operation: StreamOperationInstrumentationInfo): List<SourceInsertion> =
    if (operation.isStreamSource) buildStreamSourceInsertions(operation)
    else buildNonSourceStreamInsertions(operation)

private fun buildStreamSourceInsertions(operation: StreamOperationInstrumentationInfo): List<SourceInsertion> = listOf(
    SourceInsertion(
        operation.invocationEndLine,
        operation.invocationEndColumn,
        ".peek(element -> $JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceStream(\"START\", element, \"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\"))"
    )
)

private fun buildNonSourceStreamInsertions(operation: StreamOperationInstrumentationInfo): List<SourceInsertion> {
    val insertions = mutableListOf<SourceInsertion>()
    if (operation.isTerminal) {
        val voidTerminal = operation.operationName == "forEach" || operation.operationName == "forEachOrdered"
        val prefix = if (voidTerminal) {
            "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.completeStreamVisualization(\"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\", () -> "
        } else {
            "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.completeStreamVisualization(\"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\", "
        }
        insertions += SourceInsertion(operation.invocationBeginLine, operation.invocationBeginColumn, prefix)
        insertions += SourceInsertion(
            operation.invocationEndLine,
            operation.invocationEndColumn,
            ")",
            samePositionOrder = 1
        )
        insertions += buildTerminalInsertions(operation, voidTerminal)
    } else {
        insertions += buildIntermediateInsertions(operation)
    }
    if (operation.operationName in setOf("flatMap", "flatMapToInt", "flatMapToLong", "flatMapToDouble") && operation.hasParameter) {
        val wrapperName = when {
            operation.operationName == "flatMapToInt" || operation.receiverStreamType == "java.util.stream.IntStream" -> "wrapFlatMapToIntMapper"
            operation.operationName == "flatMapToLong" || operation.receiverStreamType == "java.util.stream.LongStream" -> "wrapFlatMapToLongMapper"
            operation.operationName == "flatMapToDouble" || operation.receiverStreamType == "java.util.stream.DoubleStream" -> "wrapFlatMapToDoubleMapper"
            else -> "wrapFlatMapMapper"
        }
        val wrapper = "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.$wrapperName(${operation.operationId}, "
        if (operation.parameterBeginLine != null && operation.parameterBeginColumn != null &&
            operation.parameterEndLine != null && operation.parameterEndColumn != null) {
            insertions += SourceInsertion(operation.parameterBeginLine, operation.parameterBeginColumn, wrapper, samePositionOrder = -1)
            insertions += SourceInsertion(operation.parameterEndLine, operation.parameterEndColumn, ")", samePositionOrder = 1)
        }
    }
    return insertions
}

private fun buildTerminalInsertions(
    operation: StreamOperationInstrumentationInfo,
    voidTerminal: Boolean
): List<SourceInsertion> = buildList {
    if (operation.hasParameter) {
        if (operation.operationName in setOf("anyMatch", "allMatch", "noneMatch", "max", "min", "collect")) {
            val traceMethod = when (operation.receiverStreamType) {
                "java.util.stream.IntStream" -> "traceIntParam"
                "java.util.stream.LongStream" -> "traceLongParam"
                "java.util.stream.DoubleStream" -> "traceDoubleParam"
                else -> "traceParam"
            }
            add(SourceInsertion(operation.startLine, operation.startColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.$traceMethod(\"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\", "))
            add(SourceInsertion(operation.invocationEndLine, operation.invocationEndColumn, ")"))
        } else if (operation.operationName == "reduce") {
            if (operation.reductionAccumulatorEndLine != null && operation.reductionAccumulatorEndColumn != null) {
                add(SourceInsertion(operation.startLine, operation.startColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceBiParam(\"reduce\", ${operation.operationId}, \"${operation.parameter}\", (${operation.reductionCastType}) "))
                add(SourceInsertion(operation.reductionAccumulatorEndLine, operation.reductionAccumulatorEndColumn, ")"))
            } else {
                add(SourceInsertion(operation.startLine, operation.startColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceBinaryParam(\"reduce\", ${operation.operationId}, \"${operation.parameter}\", (${operation.reductionCastType}) ("))
                add(SourceInsertion(operation.invocationEndLine, operation.invocationEndColumn, "))"))
            }
        }
    } else if (!voidTerminal) {
        add(SourceInsertion(
            operation.startLine,
            operation.startColumn,
            ".peek(element -> $JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceStream(\"END\", element, \"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\"))"
        ))
    }
}

private fun buildIntermediateInsertions(operation: StreamOperationInstrumentationInfo): List<SourceInsertion> = listOf(
    SourceInsertion(
        operation.startLine,
        operation.startColumn,
        ".peek(element -> $JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceStream(\"IN\", element, \"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\"))"
    ),
    SourceInsertion(
        operation.invocationEndLine,
        operation.invocationEndColumn,
        ".peek(element -> $JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.traceStream(\"OUT\", element, \"${operation.operationName}\", ${operation.operationId}, \"${operation.parameter}\"))"
    )
)

/** Applies insertions from right to left so earlier coordinates remain valid. */
fun applySourceInsertions(original: String, insertions: List<SourceInsertion>): String {
    val code = original.lines().toMutableList()
    insertions.sortedWith(
        Comparator.comparing(SourceInsertion::sourceLine)
            .thenComparing(SourceInsertion::sourceColumn)
            .thenComparing(SourceInsertion::samePositionOrder)
            .reversed()
    ).forEach { insertion ->
        code[insertion.sourceLine] = code[insertion.sourceLine].substring(0, insertion.sourceColumn) +
            insertion.insertedText + code[insertion.sourceLine].substring(insertion.sourceColumn)
    }
    return code.joinToString("\n")
}

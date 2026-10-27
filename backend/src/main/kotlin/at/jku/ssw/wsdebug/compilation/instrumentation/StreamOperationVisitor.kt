@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.OperationIdAllocator
import com.sun.tools.javac.code.Symbol
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

/** Collects independent stream-operation instrumentation sites in source order. */
fun collectStreamOperationInstrumentationInfos(
    tree: JCTree.JCCompilationUnit,
    positioning: Positioning,
    operationIdAllocator: OperationIdAllocator = OperationIdAllocator()
): List<StreamOperationInstrumentationInfo> {
    // 1. Attribute the complete compilation unit before inspecting stream types and positions.
    val visitor = StreamOperationVisitor(positioning, operationIdAllocator)
    // 2. Visit every method invocation, including invocations nested in lambdas and callbacks.
    tree.accept(visitor)
    // 3. Return independent operation records; runtime executions are created later by START events.
    return visitor.getStreamOperationInstrumentationInfos()
}

class StreamOperationVisitor(
    val pos: Positioning,
    private val operationIdAllocator: OperationIdAllocator = OperationIdAllocator()
) : TreeScanner() {
    private val statementStack = ArrayDeque<JCTree.JCStatement>()
    // These names are recognized by their attributed return/receiver types, not by variable names.
    private val terminalOperations = setOf(
        "count", "max", "min", "reduce", "collect", "forEach", "toArray", "toList", "toSet",
        "findFirst", "findAny", "anyMatch", "allMatch", "noneMatch", "sum", "average"
    )
    private val startOperations = setOf(
        "stream", "intStream", "longStream", "doubleStream", "of", "range", "rangeClosed",
        "iterate", "generate", "empty"
    )
    private val operationInfos = mutableListOf<StreamOperationInstrumentationInfo>()

    override fun scan(tree: JCTree?) {
        // Keep the enclosing statement so source rewriting can close wrappers at statement scope.
        val isStatement = tree is JCTree.JCStatement
        if (isStatement) statementStack.addLast(tree)
        try {
            super.scan(tree)
        } finally {
            if (isStatement) statementStack.removeLast()
        }
    }

    override fun visitApply(methodInvocation: JCTree.JCMethodInvocation) {
        // First record the current invocation, then recurse so nested callback streams get their own IDs.
        describeOperation(methodInvocation)?.takeUnless { isFieldDeclaration() }?.let {
            operationInfos += createOperationInfo(methodInvocation, it)
        }
        super.visitApply(methodInvocation)
    }

    private fun describeOperation(invocation: JCTree.JCMethodInvocation): OperationDescription? {
        // Member calls represent stream operations; bare calls are accepted only for stream factories.
        val expression = invocation.meth
        val returnType = invocation.type?.tsym?.toString() ?: ""
        val receiverType: String
        val operationName: String
        when (expression) {
            is JCTree.JCFieldAccess -> {
                // The receiver type prevents unrelated methods such as List.map from being instrumented.
                operationName = expression.name.toString()
                receiverType = expression.selected.type?.tsym?.toString() ?: ""
                if (!isStreamType(receiverType) && !isStreamType(returnType)) return null
            }
            else -> {
                // Static factories have no stream receiver, so validate their owner and factory name.
                operationName = expression.toString()
                receiverType = invocation.args.firstOrNull()?.type?.tsym?.toString() ?: ""
                val ownerTypeName = expression.type?.tsym?.owner?.toString() ?: ""
                if (operationName !in startOperations ||
                    (ownerTypeName != "java.util.stream" && ownerTypeName != "")) return null
            }
        }
        return OperationDescription(
            operationName,
            receiverType,
            operationName in startOperations || (isStreamType(returnType) && !isStreamType(receiverType)),
            operationName in terminalOperations
        )
    }

    private fun createOperationInfo(
        invocation: JCTree.JCMethodInvocation,
        description: OperationDescription
    ): StreamOperationInstrumentationInfo {
        // Compute insertion coordinates first; terminal arguments may need wrapper-specific coordinates.
        val statement = statementStack.last()
        var startLine = pos.getStreamOperationStartLine(invocation.meth)
        var startColumn = pos.getStreamOperationStartColumn(invocation.meth)
        var reductionCastType: String? = null
        var reductionAccumulatorEndLine: Int? = null
        var reductionAccumulatorEndColumn: Int? = null
        if (description.isTerminal && invocation.args.isNotEmpty() && description.name != "forEach") {
            startLine = pos.getStreamOperationStartLine(invocation.args[0])
            startColumn = pos.getBeginColumn(invocation.args[0]) - 1
        }
        if (description.name == "reduce" && invocation.args.size >= 2) {
            reductionCastType = invocation.args[1].type.toString()
            startLine = pos.getStreamOperationStartLine(invocation.args[1])
            startColumn = pos.getBeginColumn(invocation.args[1]) - 1
            if (invocation.args.size == 3) {
                reductionAccumulatorEndLine = pos.getEndLine(invocation.args[1]) - 1
                reductionAccumulatorEndColumn = pos.getEndColumn(invocation.args[1]) - 1
            }
        } else if (description.name == "reduce" && invocation.args.size == 1) {
            reductionCastType = invocation.args[0].type.toString()
        }
        return StreamOperationInstrumentationInfo(
            startLine = startLine,
            startColumn = startColumn,
            invocationBeginLine = pos.getBeginLine(invocation) - 1,
            invocationBeginColumn = pos.getBeginColumn(invocation) - 1,
            invocationEndLine = pos.getEndLine(invocation) - 1,
            invocationEndColumn = pos.getEndColumn(invocation) - 1,
            operationName = description.name,
            operationId = operationIdAllocator.next(),
            hasParameter = invocation.args.isNotEmpty() && description.name != "forEach",
            parameter = invocation.args.firstOrNull()?.toString()?.let(::escapeForJavaString) ?: "",
            parameterBeginLine = invocation.args.firstOrNull()?.let { pos.getBeginLine(it) - 1 },
            parameterBeginColumn = invocation.args.firstOrNull()?.let { pos.getBeginColumn(it) - 1 },
            parameterEndLine = invocation.args.firstOrNull()?.let { pos.getEndLine(it) - 1 },
            parameterEndColumn = invocation.args.firstOrNull()?.let { pos.getEndColumn(it) - 1 },
            receiverStreamType = description.receiverType,
            reductionCastType = reductionCastType,
            reductionAccumulatorEndLine = reductionAccumulatorEndLine,
            reductionAccumulatorEndColumn = reductionAccumulatorEndColumn,
            statementEndLine = pos.getEndLine(statement) - 1,
            statementEndColumn = pos.getEndColumn(statement) - 1,
            // A source starts an execution at runtime; all other records describe one operation site.
            isStreamSource = description.isSource,
            isTerminal = description.isTerminal
        )
    }

    fun getStreamOperationInstrumentationInfos(): List<StreamOperationInstrumentationInfo> = operationInfos

    private fun isFieldDeclaration(): Boolean = statementStack.lastOrNull() is JCTree.JCVariableDecl &&
        (statementStack.last() as JCTree.JCVariableDecl).isField()

    private fun isStreamType(type: String?): Boolean = type == "java.util.stream.Stream" ||
        type == "java.util.stream.IntStream" || type == "java.util.stream.LongStream" ||
        type == "java.util.stream.DoubleStream"

    private fun escapeForJavaString(text: String): String = text
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\t", "\\t")

}

private data class OperationDescription(
    val name: String,
    val receiverType: String,
    val isSource: Boolean,
    val isTerminal: Boolean
)

private fun JCTree.JCVariableDecl.isField() = sym?.owner is Symbol.ClassSymbol

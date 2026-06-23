@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.tools.javac.code.Symbol
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

fun generateStreamOps(tree: JCTree.JCCompilationUnit): List<StreamOperation> {
    val visitor = StreamOperationVisitor(Positioning(tree))
    tree.accept(visitor)
    return visitor.getStreamOperations()
}

class StreamOperationVisitor(val pos: Positioning) : TreeScanner() {

    private val statementStack = ArrayDeque<JCTree.JCStatement>()

    override fun scan(tree: JCTree?) {
        val isStatement = tree is JCTree.JCStatement

        if (isStatement) {
            statementStack.addLast(tree)
        }

        try {
            super.scan(tree)
        } finally {
            if (isStatement) {
                statementStack.removeLast()
            }
        }
    }

    override fun visitMethodDef(methodDef: JCTree.JCMethodDecl) {
        if (methodDef.name.toString() != "main") {
            return
        }

        super.visitMethodDef(methodDef)
    }

    override fun visitApply(methodInvocation: JCTree.JCMethodInvocation) {
        if (lambdaLevel > 0) {
            // Skip method invocations inside lambdas
            super.visitApply(methodInvocation)
            return
        }
        invocationStack.addLast(methodInvocation)
        try {
            val meth = methodInvocation.meth
            var receiverType = ""
            var name = ""
            val isVisitableMethod: Boolean = when (meth) {
                is JCTree.JCFieldAccess -> {
                    name = meth.name.toString()
                    receiverType = meth.selected.type?.tsym.toString()
                    val returnType = methodInvocation.type?.tsym?.toString()

                    val isRealStreamOperation =
                        isStreamType(receiverType) ||
                                isStreamType(returnType)

                    isRealStreamOperation
                }

                else -> {
                    val methodName = meth.toString()
                    val owner = meth.type?.tsym?.owner?.toString() ?: ""
                    val isRealStreamFactory =
                        methodName in startOperations &&
                                (owner == "java.util.stream" || owner == "")

                    if (isRealStreamFactory) {
                        name = "stream"
                        receiverType = methodInvocation.args.firstOrNull()?.type?.tsym.toString()
                        true
                    } else {
                        false
                    }
                }
            }

            val realEnd = getCurrentStatement()
            val isFieldDeclaration = realEnd is JCTree.JCVariableDecl && realEnd.isField()

            if (isVisitableMethod && !isFieldDeclaration) {
                var beginLine: Int
                var beginColumn: Int
                var hasParam = false
                var castType: String? = null
                var endMiddleArgLine: Int? = null
                var endMiddleArgColumn: Int? = null

                val realEnd = getCurrentStatement()
                val realEndLine = pos.getEndLine(realEnd) - 1
                val realEndColumn = pos.getEndColumn(realEnd) - 1

                if (name in startOperations) {
                    streamOperations[actualStreamID]?.add(
                        StreamOperation(
                            0,
                            0,
                            pos.getEndLine(methodInvocation) - 1,
                            pos.getEndColumn(methodInvocation) - 1,
                            "stream",
                            streamOperations[actualStreamID]!!.size,
                            false,
                            "",
                            actualStreamID,
                            receiverType,
                            null,
                            realEndLine = realEndLine,
                            realEndColumn = realEndColumn
                        )
                    )
                    openStreams.remove(actualStreamID)
                    actualStreamID = openStreams.lastOrNull() ?: -1
                } else if (isStreamType(receiverType) && name != "concat") {
                    var firstArgAsString: String = ""
                    if (name in terminalOperations) {
                        actualStreamID = ++numberOfStreams
                        openStreams.add(numberOfStreams)
                        streamOperations[actualStreamID] = mutableListOf()

                        if (methodInvocation.args.isNotEmpty() && name != "forEach") {
                            hasParam = true
                            beginLine = pos.getBeginLineStreamOp(methodInvocation.args[0])
                            beginColumn = pos.getBeginColumn(methodInvocation.args[0]) - 1
                        } else {
                            beginLine = pos.getBeginLineStreamOp(meth)
                            beginColumn = pos.getBeginColumnStreamOp(meth)
                        }
                    } else {
                        beginLine = pos.getBeginLineStreamOp(meth)
                        beginColumn = pos.getBeginColumnStreamOp(meth)
                    }

                    if (methodInvocation.args.isNotEmpty()) {
                        hasParam = name != "forEach"
                        firstArgAsString = methodInvocation.args[0].toString()
                        firstArgAsString = escapeForJavaString(firstArgAsString)
                        if (name == "reduce" && methodInvocation.args.size >= 2) {
                            castType = methodInvocation.args[1].type.toString()
                            beginLine = pos.getBeginLineStreamOp(methodInvocation.args[1])
                            beginColumn = pos.getBeginColumn(methodInvocation.args[1]) - 1
                            if (methodInvocation.args.size == 3) {
                                endMiddleArgLine = pos.getEndLine(methodInvocation.args[1]) - 1
                                endMiddleArgColumn = pos.getEndColumn(methodInvocation.args[1]) - 1
                            }
                        } else if (name == "reduce" && methodInvocation.args.size == 1) {
                            castType = methodInvocation.args[0].type.toString()
                        }
                    }

                    streamOperations[actualStreamID]?.add(
                        StreamOperation(
                            beginLine,
                            beginColumn,
                            pos.getEndLine(methodInvocation) - 1,
                            pos.getEndColumn(methodInvocation) - 1,
                            name,
                            streamOperations[actualStreamID]!!.size,
                            hasParam,
                            firstArgAsString,
                            actualStreamID,
                            receiverType,
                            castType,
                            endMiddleArgLine,
                            endMiddleArgColumn,
                            realEndLine,
                            realEndColumn
                        )
                    )

                    if (meth is JCTree.JCFieldAccess) {
                        val selectedindent = meth.selected
                        if (selectedindent is JCTree.JCIdent) {
                            if (selectedindent.sym.kind.name == "VAR") {
                                streamOperations[actualStreamID]?.add(
                                    StreamOperation(
                                        beginLine,
                                        beginColumn,
                                        beginLine,//pos.getEndLine(methodInvocation) - 1,
                                        beginColumn,//pos.getEndColumn(methodInvocation) - 1,
                                        "stream",
                                        streamOperations[actualStreamID]!!.size,
                                        hasParam,
                                        firstArgAsString,
                                        actualStreamID,
                                        receiverType,
                                        castType,
                                        realEndLine = beginLine,
                                        realEndColumn = beginColumn
                                    )
                                )
                            }
                        }
                    }
                }
            }
            super.visitApply(methodInvocation)
        } finally {
            invocationStack.removeLast()
        }

    }

    private val streamOperations = mutableMapOf<Int, MutableList<StreamOperation>>()
    private val openStreams = mutableListOf<Int>()
    private var numberOfStreams = -1
    private var actualStreamID = -1
    private val terminalOperations = setOf(
        "count", "max", "min", "reduce", "collect", "forEach", "toArray", "toList", "toSet", "findFirst", "findAny", "anyMatch", "allMatch",
        "noneMatch", "sum", "average"
    )
    private val startOperations = setOf("stream", "intStream", "longStream", "doubleStream", "of", "range", "rangeClosed", "iterate", "generate", "empty")
    private var lambdaLevel = 0
    private val invocationStack = ArrayDeque<JCTree.JCMethodInvocation>()

    fun getStreamOperations(): List<StreamOperation> {
        return streamOperations.values.flatten()//streamOperations.toList()
    }

    private fun isStreamType(type: String?): Boolean {
        if (type == null) return false

        return type == "java.util.stream.Stream" ||
                type == "java.util.stream.IntStream" ||
                type == "java.util.stream.LongStream" ||
                type == "java.util.stream.DoubleStream"
    }

    private fun escapeForJavaString(text: String): String {
        return text
            .replace("\\", "\\\\")   // erst Backslashes doppeln
            .replace("\"", "\\\"")   // dann Anf├╝hrungszeichen escapen
            .replace("\r\n", "\\\\n") // Windows-Zeilenumbr├╝che
            .replace("\n", "\\\\n")   // Unix-Zeilenumbr├╝che
            .replace("\t", "\\\\t")   // Tabs
    }

    override fun visitLambda(tree: JCTree.JCLambda) {
        lambdaLevel++
        super.visitLambda(tree)
        lambdaLevel--
    }

    override fun visitReference(tree: JCTree.JCMemberReference) {
        lambdaLevel++
        super.visitReference(tree)
        lambdaLevel--
    }

    private fun getCurrentStatement() = statementStack.last()
}

private fun JCTree.JCVariableDecl.isField() = sym?.owner is Symbol.ClassSymbol

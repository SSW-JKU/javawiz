@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.ast

import at.jku.ssw.wsdebug.compilation.ast.lang.*
import at.jku.ssw.wsdebug.compilation.instrumentation.Positioning
import com.sun.source.tree.CompilationUnitTree
import com.sun.tools.javac.tree.JCTree

val CONSTRUCTOR_NAME = "<init>"

fun generateAst(tree: JCTree.JCCompilationUnit, callFixup: CallFixup): AbstractSyntaxTree {
    val astFile = AstGenerator(Positioning(tree.lineMap, tree.endPositions), callFixup).generateAstFile(tree)
    return AbstractSyntaxTree(astFile, tree.sourceFile.name)
}


class AstGenerator(val pos: Positioning, val callFixup: CallFixup) {
    fun generateAstFile(node: CompilationUnitTree): AstFile {
        val real = node as JCTree.JCCompilationUnit
        fun classes(decl: JCTree.JCClassDecl): List<Class> =
            listOf(generateClass(decl))+
                    decl.defs.filterIsInstance<JCTree.JCClassDecl>().flatMap {classes(it)}
        val file = AstFile(
            pos.getBeginLine(real),
            pos.getEndLine(real),
            real.typeDecls.filterIsInstance<JCTree.JCClassDecl>().flatMap { classes(it) }
        )
        file.labelEndOfStatementList()
        return file
    }

   private fun generateClass(node: JCTree.JCClassDecl): Class {
        return Class(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            node.sym.flatName().toString(),
            node.members.filterIsInstance<JCTree.JCMethodDecl>()
                .filterNot { it.body == null }
                .map { generateMethod(it) },
        )
    }

    private fun generateMethod(node: JCTree.JCMethodDecl): Method {
        val uuid = callFixup.registerMethodOrConstructor(node)
        val className = node.sym.owner.name.toString()
        var signature = "${node.restype} ${node.name} (${node.params})"
        if (node.sym.isConstructor) {
            signature = "$className $className (${node.params})"
        }
        return Method(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            node.name.toString(),
            signature,
            generateBlock(node.getBody()),
            className,
            node.params.length(),
            uuid
        )
    }

    private fun generateBlock(node: JCTree.JCBlock): Block {
        return Block(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            node.statements.map { generateAstItem(it) }
        )
    }

    private fun generateIf(node: JCTree.JCIf): IfStatement {
        var falseCase: Block? = null
        if (node.elseStatement !== null) {
            val elseStmt = node.elseStatement
            falseCase =
                if (elseStmt is JCTree.JCIf) {
                    val elseThen = generateIf(elseStmt)
                    Block(elseThen.begin, elseThen.end, listOf(elseThen))
                } else {
                    if (elseStmt is JCTree.JCBlock) {
                        generateBlock(elseStmt)
                    } else {
                        Block(
                            pos.getBeginLine(elseStmt),
                            pos.getEndLine(elseStmt),
                            listOf(generateAstItem(elseStmt))
                        )
                    }
                }
        }
        val code = (node.condition as JCTree.JCParens).expr.toString()
        return IfStatement(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            "$code?",
            pos.getBeginLine(node.condition),
            pos.getEndLine(node.condition),
            if (node.thenStatement is JCTree.JCBlock) generateBlock(node.thenStatement as JCTree.JCBlock)
            else
                Block(
                    pos.getBeginLine(node.thenStatement),
                    pos.getEndLine(node.thenStatement),
                    listOf(generateAstItem(node.thenStatement))
                ),
            falseCase,
            findCalls(node.condition, code)
        )
    }

    private fun generateAstItem(node: JCTree.JCStatement): AstItem {
        return when(node) {
            is JCTree.JCBlock -> generateBlock(node)
            is JCTree.JCWhileLoop -> generateWhileLoop(node)
            is JCTree.JCIf -> generateIf(node)
            is JCTree.JCDoWhileLoop -> generateDoWhileLoop(node)
            is JCTree.JCBreak -> {
                return Statement(
                    pos.getBeginLine(node),
                    pos.getEndLine(node),
                    node.toString().dropLast(1),
                    findCalls(node),
                    StatementType.BREAK
                )
            }
            is JCTree.JCThrow -> {
                return Statement(
                    pos.getBeginLine(node),
                    pos.getEndLine(node),
                    node.toString().dropLast(1),
                    findCalls(node),
                    StatementType.THROW
                )
            }
            is JCTree.JCContinue -> {
                return Statement(
                    pos.getBeginLine(node),
                    pos.getEndLine(node),
                    node.toString().dropLast(1),
                    findCalls(node),
                    StatementType.CONTINUE
                )
            }
            is JCTree.JCReturn -> {
                return Statement(
                    pos.getBeginLine(node),
                    pos.getEndLine(node),
                    node.toString().dropLast(1),
                    findCalls(node),
                    StatementType.RETURN
                )
            }
            is JCTree.JCYield -> {
                return Statement(
                    pos.getBeginLine(node),
                    pos.getEndLine(node),
                    node.toString().dropLast(1),
                    findCalls(node),
                    StatementType.YIELD
                )
            }
            is JCTree.JCForLoop -> generateForLoop(node)
            is JCTree.JCSwitch -> generateSwitch(node)
            is JCTree.JCTry -> generateTryCatchFinallyBlock(node)
            else -> Statement(
                pos.getBeginLine(node),
                pos.getEndLine(node),
                node.toString(),
                findCalls(node),
            )
        }
    }

    private fun generateTryCatchFinallyBlock(node: JCTree.JCTry): TryCatchFinally {
        return TryCatchFinally(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            generateBlock(node.block),
            node.catches.map {
                CatchClause(
                    pos.getBeginLine(it),
                    if (it.body.statements.isEmpty()) {
                        pos.getEndLine(it)
                    } else {
                        pos.getEndLine(it.body.statements.last())
                    },
                    it.parameter.toString(),
                    pos.getBeginLine(it.parameter),
                    pos.getEndLine(it.parameter),
                    generateBlock(it.body)
                )
            },
            if (node.finallyBlock !== null) generateBlock(node.finallyBlock) else null
        )
    }

    private fun generateSwitch(node: JCTree.JCSwitch): Switch {
        val switchEntries = mutableListOf<SwitchEntry>()

        var defaultEntry: SwitchEntry? = null

        var currentBegin: Int? = null
        val leftOverLabels = mutableListOf<String>()
        for (entry in node.cases) {
            if (entry.labels.isEmpty()) {
                defaultEntry =
                    SwitchEntry(
                        pos.getBeginLine(entry),
                        pos.getEndLine(entry),
                        listOf("default"),
                        Block(
                            pos.getBeginLine(entry),
                            pos.getEndLine(entry),
                            entry.statements.map { stmt -> generateAstItem(stmt) }
                        ),
                        true
                    )
           } else if (entry.statements == null || entry.statements.isEmpty()) {
                currentBegin = pos.getBeginLine(entry)
                leftOverLabels.addAll(entry.labels.map { l -> l.toString() })
            } else {
                switchEntries.add(
                    SwitchEntry(
                        currentBegin ?: pos.getBeginLine(entry),
                        pos.getEndLine(entry),
                        leftOverLabels.union(entry.labels.map { l -> l.toString() }).toList(),
                        Block(
                            currentBegin ?: pos.getBeginLine(entry),
                            pos.getEndLine(entry),
                            entry.statements.map { stmt -> generateAstItem(stmt) }
                        )
                    )
                )
                currentBegin = null
                leftOverLabels.clear()
            }
        }

        return Switch(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            (node.selector as JCTree.JCParens).expression.toString(),
            switchEntries,
            defaultEntry
        )
    }

    private fun generateForLoop(node: JCTree.JCForLoop): Conditional {
        var header = ""
        val callExpressions: MutableList<MethodCallExpr> = mutableListOf()
        var i: MutableIterator<JCTree.JCStatement> = node.init.iterator()
        while (i.hasNext()) {
            val e = i.next()
            header += e.toString()
            callExpressions += findCalls(e)
            if (i.hasNext()) {
                header += ", "
            }
        }

        header += "; "
        if (node.cond !== null) {
            header += node.cond.toString()
            callExpressions += findCalls(node.cond, header)
        }
        header += "; "

        i = node.update.iterator()
        while (i.hasNext()) {
            val e = i.next()
            header += if (e.toString().get(e.toString().length - 1) == ';') e.toString().dropLast(1) else e.toString()
            callExpressions += findCalls(e, header)
            if (i.hasNext()) {
                header += ", "
            }

        }
        return Conditional(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            header,
            if (node.init.isNotEmpty()) pos.getBeginLine(node.init.first().tree) else 0,
            if(node.condition != null) pos.getEndLine(node.condition) else 0,
            generateStatementAsBlock(node.body),
            ConditionalType.FOR,
            callExpressions
        )
    }

    private fun generateStatementAsBlock(stmt: JCTree.JCStatement): Block {
        val parsed = generateAstItem(stmt)
        if (parsed is Block) {
            return parsed
        }
        return Block(
            parsed.begin,
            parsed.end,
            listOf(parsed)
        )
    }

    private fun generateDoWhileLoop(node: JCTree.JCDoWhileLoop): AstItem {
        val body = node.body
        val trueCase = if (body is JCTree.JCBlock) {
            generateBlock(body)
        } else {
            Block(
                pos.getBeginLine(body),
                pos.getEndLine(body),
                listOf(generateAstItem(body))
            )
        }

        val code = (node.condition as JCTree.JCParens).expression.toString()
        return Conditional(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            code,
            pos.getBeginLine(node.condition),
            pos.getEndLine(node.condition),
            trueCase = trueCase,
            type = ConditionalType.DO_WHILE,
            methodCallExpressions = findCalls(node.condition, code)
        )
    }


    private fun generateWhileLoop(node: JCTree.JCWhileLoop): AstItem {
        val body = node.body
        val trueCase = if (body is JCTree.JCBlock) {
            generateBlock(body)
        } else {
            Block(
                pos.getBeginLine(body),
                pos.getEndLine(body),
                listOf(generateAstItem(body))
            )
        }
        val code = (node.condition as JCTree.JCParens).expr.toString()
        return Conditional(
            pos.getBeginLine(node),
            pos.getEndLine(node),
            code,
            pos.getBeginLine(node.condition),
            pos.getEndLine(node.condition),
            trueCase = trueCase,
            type = ConditionalType.WHILE,
            methodCallExpressions = findCalls(node.condition, code)
        )
    }

    private fun findCalls(expr: JCTree.JCExpression, surrounding: String): List<MethodCallExpr> {
        val methodCallFinder = MethodCallFinder(pos, surrounding , callFixup)
        expr.accept(methodCallFinder)
        return methodCallFinder.getMethodCalls()
    }

    private fun findCalls(expr: JCTree.JCExpressionStatement, surrounding: String): List<MethodCallExpr> {
        val methodCallFinder = MethodCallFinder(pos, surrounding , callFixup)
        expr.accept(methodCallFinder)
        return methodCallFinder.getMethodCalls()
    }

    private fun findCalls(expr: JCTree.JCStatement): List<MethodCallExpr> {
        val methodCallFinder = MethodCallFinder(pos, expr.toString(), callFixup)
        expr.accept(methodCallFinder)
        return methodCallFinder.getMethodCalls()
    }


    private fun AstItem.labelEndOfStatementList() {
        when(this) {
            is AstFile -> classes.forEach { it.labelEndOfStatementList() }
            is Block -> {
                statements.forEachIndexed { i, item ->
                    item.labelEndOfStatementList()
                    if(i == 0) return@forEachIndexed
                    val previous = statements[i-1]
                    if(previous !is Statement) return@forEachIndexed
                    when(item) {
                        is Conditional -> previous.endOfStatementList = true
                        is Switch -> previous.endOfStatementList = true
                    }
                }
            }
            is CatchClause -> body.labelEndOfStatementList()
            is Class -> methods.forEach { it.labelEndOfStatementList() }
            is Method -> {
                body.labelEndOfStatementList()
                val last = body.statements.lastOrNull()
                if(last != null && last is Statement) {
                    last.endOfStatementList = true
                }
            }
            is Conditional -> {
                if(type != ConditionalType.DO_WHILE) return
                val last = trueCase.statements.lastOrNull()
                if(last != null && last is Statement) {
                    last.endOfStatementList = true
                }
            }
            is Switch -> {
                entries.forEach { it.labelEndOfStatementList() }
                defaultEntry?.labelEndOfStatementList()
            }
            is SwitchEntry -> {
                block.labelEndOfStatementList()
            }
        }
    }
}
@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner
import java.util.*

fun generateArrayAccessInfo(tree: JCTree.JCCompilationUnit): Pair<List<ArrayAccess>, List<IndexWrapper>> {
    val visitor = ArrayAccessVisitor(Positioning(tree))
    tree.accept(visitor)
    return Pair(visitor.getArrayAccessValues(), visitor.getIndexWrappers())
}

class ArrayAccessVisitor(val pos: Positioning) : TreeScanner() {
    private val arrayAccessValues = mutableListOf<ArrayAccess>()
    private var max_id = 0
    private val indexWrappers = mutableListOf<IndexWrapper>()

    fun getIndexWrappers(): List<IndexWrapper> = indexWrappers.toList()
    fun getArrayAccessValues(): List<ArrayAccess> = arrayAccessValues.toList()

    private var targets: Stack<AssignmentTarget> = Stack()
    private var isTarget = false
    private var sourceVariableNames = listOf<String>()

    override fun visitAssign(tree: JCTree.JCAssign) {
        //target = null
        sourceVariableNames = getVariableNames(tree.rhs)
        if(tree.lhs is JCTree.JCIdent) {
            targets += VariableTarget(tree.lhs.toString())
        } else if(tree.lhs is JCTree.JCArrayAccess) {
            isTarget = true
            scan(tree.lhs)
        }
        isTarget = false
        sourceVariableNames = listOf()
        scan(tree.rhs)
        targets.removeFirstOrNull()
    }

    override fun visitVarDef(tree: JCTree.JCVariableDecl) {
        assert(!isTarget)
        targets += VariableTarget(tree.name.toString())
        scan(tree.init)
        targets.removeFirstOrNull()
    }

    override fun visitAssignop(tree: JCTree.JCAssignOp) {
        //target = null
        sourceVariableNames = getVariableNames(tree.rhs) + getVariableNames(tree.lhs)
        if(tree.lhs is JCTree.JCIdent) { // TODO: test with field write operations
            targets += VariableTarget(tree.lhs.toString())
        } else if(tree.lhs is JCTree.JCArrayAccess) {
            isTarget = true
            scan(tree.lhs) // we explicitly do not scan the left hand side if it is not an array access
        }
        isTarget = false
        sourceVariableNames = listOf()
        scan(tree.rhs)
        targets.pop()
    }

    override fun visitIndexed(tree: JCTree.JCArrayAccess) {
        //assert(tree.indexed !is JCTree.JCArrayAccess) // no recursive visit call on tree.indexed => only get called at top level // TODO: doesn't hold
        val indices = mutableListOf<JCTree.JCExpression>()
        var current: JCTree.JCExpression = tree
        while (current is JCTree.JCArrayAccess) {
            indices.add(current.index)
            current = current.indexed
        }

        if (current !is JCTree.JCIdent) { // TODO: JCIdent == NameExpression?
            super.visitIndexed(tree)
            return
        }

        val accessID = max_id++ // using arrayAccessValues.size is inappropriate as we make a recursive call that adds elements before adding current element
        val indexExpressions = indices.map {
            IndexExpression(it.toString(), it is JCTree.JCIdent)
        }
        var dimension = 0
        var remaining: JCTree.JCExpression = tree
        while (remaining is JCTree.JCArrayAccess) {
            remaining.index.accept(this) // e.g. in case a[b[i]] we want to instrument b[i] as well
            indexWrappers += IndexWrapper(
                pos.getBeginLine(remaining.index) - 1,
                pos.getBeginColumn(remaining.index) - 1,
                pos.getEndLine(remaining.index) - 1,
                pos.getEndColumn(remaining.index) - 1,
                accessID,
                dimension,
                current.toString(),
            )
            remaining = remaining.indexed
            dimension += 1
        }

        //assert(sourceVariableNames.isEmpty() || target == null) // TODO: doesn't hold
        arrayAccessValues += ArrayAccess(accessID, indexExpressions, targets.lastOrNull(), sourceVariableNames, isTarget)
        if(isTarget) {
            targets += ArrayAccessTarget(accessID)
        }
    }
}
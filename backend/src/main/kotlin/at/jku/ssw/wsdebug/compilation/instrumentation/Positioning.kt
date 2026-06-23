@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.source.tree.LineMap
import com.sun.tools.javac.tree.EndPosTable
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeInfo

data class Positioning(val lineMap: LineMap, val endPositionTable: EndPosTable) {
    constructor(tree: JCTree.JCCompilationUnit) : this(tree.lineMap, tree.endPositions) {
    }
    fun getBeginLine(element: JCTree): Int {
        return lineMap.getLineNumber(TreeInfo.getStartPos(element).toLong()).toInt()
    }

    fun getBeginColumn(element: JCTree): Int {
        return lineMap.getColumnNumber(TreeInfo.getStartPos(element).toLong()).toInt()
    }

    fun getEndColumn(element: JCTree): Int {
        return lineMap.getColumnNumber(TreeInfo.getEndPos(element, endPositionTable).toLong()).toInt()
    }

    fun getEndLine(element: JCTree): Int {
        return lineMap.getLineNumber(TreeInfo.getEndPos(element, endPositionTable).toLong()).toInt()
    }

    fun getBeginLineStreamOp(element: JCTree): Int {
        return lineMap.getLineNumber(element.pos.toLong()).toInt() - 1
    }

    fun getBeginColumnStreamOp(element: JCTree): Int {
        return lineMap.getColumnNumber(element.pos.toLong()).toInt() - 1
    }
}
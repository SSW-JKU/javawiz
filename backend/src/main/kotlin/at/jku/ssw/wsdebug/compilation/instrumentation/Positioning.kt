@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.source.tree.CompilationUnitTree
import com.sun.source.util.SourcePositions
import com.sun.tools.javac.tree.JCTree

/**
 * Converts source offsets to line/column coordinates for one parsed compilation unit.
 * Source ranges are one-based with exclusive ends; stream anchors are zero-based.
 * Supply positions from the task that parsed the unit: `Positioning(unit, Trees.instance(task).sourcePositions)`.
 * The public compiler API hides javac's changing end-position storage, allowing the same build to run on JDK 25–27.
 */
class Positioning(private val tree: CompilationUnitTree, private val sourcePositions: SourcePositions) {
    private val lineMap = tree.lineMap

    fun getBeginLine(element: JCTree): Int {
        return lineMap.getLineNumber(sourcePositions.getStartPosition(tree, element)).toInt()
    }

    fun getBeginColumn(element: JCTree): Int {
        return lineMap.getColumnNumber(sourcePositions.getStartPosition(tree, element)).toInt()
    }

    fun getEndColumn(element: JCTree): Int {
        return lineMap.getColumnNumber(sourcePositions.getEndPosition(tree, element)).toInt()
    }

    fun getEndLine(element: JCTree): Int {
        return lineMap.getLineNumber(sourcePositions.getEndPosition(tree, element)).toInt()
    }

    fun getStreamOperationStartLine(element: JCTree): Int {
        return lineMap.getLineNumber(element.pos.toLong()).toInt() - 1
    }

    fun getStreamOperationStartColumn(element: JCTree): Int {
        return lineMap.getColumnNumber(element.pos.toLong()).toInt() - 1
    }
}

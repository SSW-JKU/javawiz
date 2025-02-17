package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE

data class Insert(val line: Int, val column: Int, val text: String)

fun modificationPoints(conditions: List<Condition>, arrayAccessIndexWrappers: List<IndexWrapper>): List<Insert> {
    return conditions.flatMap {
        return@flatMap listOf(
            Insert(it.beginLine, it.beginColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.recordCondition("),
            Insert(it.endLine, it.endColumn, "," + it.id + ")")
        )
    } + arrayAccessIndexWrappers.flatMap {
        return@flatMap listOf(
            Insert(it.beginLine, it.beginColumn, "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS.recordArrayAccess(" + it.outerIndexedVariableName + ","),
            Insert(it.endLine, it.endColumn, "," + it.accessID + "," + it.dimension + ")")
        )
    }
}

fun applyModifications(original: String, modificationPoints: List<Insert>): String {
    val code = original.lines().toMutableList()
    modificationPoints
        .sortedWith(
            Comparator.comparing(Insert::line)
                .thenComparing(Insert::column)
                .reversed()
        ).forEach { point ->
            code[point.line] = code[point.line].substring(0, point.column) + point.text + code[point.line].substring(point.column)
        }
   return code.joinToString("\n")
}
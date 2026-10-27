@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.communication.FilepathAndContent
import at.jku.ssw.wsdebug.compilation.FakeJavaSourceFile
import com.sun.source.util.JavacTask
import com.sun.source.util.SourcePositions
import com.sun.source.util.Trees
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import javax.tools.Diagnostic
import javax.tools.DiagnosticCollector
import javax.tools.JavaFileObject
import javax.tools.ToolProvider

class PositioningTest {
    @Test
    fun multilineConditionAndArrayAccessKeepExactSourceRanges() = withCompilationUnits { units, sourcePositions ->
        val tree = units.getValue("First.java")
        val positioning = Positioning(tree, sourcePositions)
        val conditions = mutableListOf<JCTree.JCIf>()
        val accesses = mutableListOf<JCTree.JCArrayAccess>()
        tree.accept(object : TreeScanner() {
            override fun visitIf(node: JCTree.JCIf) {
                conditions += node
                super.visitIf(node)
            }

            override fun visitIndexed(node: JCTree.JCArrayAccess) {
                accesses += node
                super.visitIndexed(node)
            }
        })

        assertRange(positioning, conditions.single().cond, 3, 12, 5, 10)
        assertRange(positioning, accesses.single(), 6, 20, 8, 14)
        assertRange(positioning, accesses.single().index, 7, 17, 7, 18)
    }

    @Test
    fun secondCompilationUnitUsesItsOwnLineMapAndEndPositions() = withCompilationUnits { units, sourcePositions ->
        val tree = units.getValue("Second.java")
        val positioning = Positioning(tree, sourcePositions)
        val calls = mutableListOf<JCTree.JCMethodInvocation>()
        val accesses = mutableListOf<JCTree.JCArrayAccess>()
        tree.accept(object : TreeScanner() {
            override fun visitApply(node: JCTree.JCMethodInvocation) {
                if (node.meth.toString() == "Math.abs") calls += node
                super.visitApply(node)
            }

            override fun visitIndexed(node: JCTree.JCArrayAccess) {
                accesses += node
                super.visitIndexed(node)
            }
        })

        assertRange(positioning, calls.single(), 5, 16, 7, 10)
        assertRange(positioning, accesses.single(), 6, 13, 6, 22)
        assertRange(positioning, accesses.single().index, 6, 20, 6, 21)
    }

    private fun assertRange(
        positioning: Positioning,
        node: JCTree,
        beginLine: Int,
        beginColumn: Int,
        endLine: Int,
        endColumn: Int
    ) {
        // Coordinates are one-based; the end is immediately after the final source character.
        assertEquals(
            listOf(beginLine, beginColumn, endLine, endColumn),
            listOf(
                positioning.getBeginLine(node), positioning.getBeginColumn(node),
                positioning.getEndLine(node), positioning.getEndColumn(node)
            ),
            node.toString()
        )
    }

    private fun withCompilationUnits(check: (Map<String, JCTree.JCCompilationUnit>, SourcePositions) -> Unit) {
        val sources = listOf(
            FilepathAndContent("First.java", """
                class First {
                    int read(int[] values) {
                        if (
                            values.length > 0
                        ) {
                            return values[
                                0
                            ];
                        }
                        return 0;
                    }
                }
            """.trimIndent()),
            // Different leading lines and offsets expose accidental reuse of the first unit's positions.
            FilepathAndContent("Second.java", "\n\n" + """
                class Second {
                    int read(int[] values) {
                        return Math.abs(
                            values[1]
                        );
                    }
                }
            """.trimIndent())
        )
        val compiler = ToolProvider.getSystemJavaCompiler()
        val diagnostics = DiagnosticCollector<JavaFileObject>()
        compiler.getStandardFileManager(diagnostics, null, null).use { fileManager ->
            val task = compiler.getTask(
                null, fileManager, diagnostics, listOf("-proc:none"), null, sources.map(::FakeJavaSourceFile)
            ) as JavacTask
            val units = task.parse().map { it as JCTree.JCCompilationUnit }.associateBy { it.sourceFile.name }
            task.analyze()
            assertTrue(diagnostics.diagnostics.none { it.kind == Diagnostic.Kind.ERROR }, diagnostics.diagnostics.toString())
            assertEquals(setOf("First.java", "Second.java"), units.keys)
            check(units, Trees.instance(task).sourcePositions)
        }
    }
}

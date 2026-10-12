@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.source.util.JavacTask
import com.sun.tools.javac.tree.JCTree
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.URI
import javax.tools.JavaFileObject
import javax.tools.SimpleJavaFileObject
import javax.tools.ToolProvider

/** Verifies independent operation-site metadata and global operation IDs. */
class StreamOperationInstrumentationTest {
    @Test
    fun fullStreamExamplesSourceIsInstrumentedAsIndependentOperationSites() {
        val source = StreamOperationInstrumentationTest::class.java
            .getResource("/TestCases/StreamVisualization/StreamExamples/Code/StreamExamples.java")!!
            .readText()
        val infos = collectInfos(source)
        val instrumented = applySourceInsertions(source, buildInstrumentationInsertions(emptyList(), emptyList(), infos))
        val expected = StreamOperationInstrumentationTest::class.java
            .getResource("/TestCases/StreamVisualization/StreamExamples/Code/StreamExamples.instrumented.java")!!
            .readText()

        assertEquals(expected, instrumented)
    }

    @Test
    fun storedStreamPipelineDocumentsSyntheticSourceFlags() {
        val source = """
            import java.util.OptionalInt;
            import java.util.stream.IntStream;
            import java.util.stream.Stream;

            class Main {
                void main() {
                    Stream<String> names = Stream.of("Max", "Susi", "Maya");
                    Stream<String> mnames = names.filter(x -> x.charAt(0) == 'M');
                    IntStream nameLengths = mnames.mapToInt(x -> x.length());
                    OptionalInt maximum = nameLengths.max();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.OptionalInt;
            import java.util.stream.IntStream;
            import java.util.stream.Stream;

            class Main {
                void main() {
                    Stream<String> names = Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 0, "\"Max\""));
                    Stream<String> mnames = names.peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 1, "(x)->x.charAt(0) == 'M'")).filter(x -> x.charAt(0) == 'M').peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 1, "(x)->x.charAt(0) == 'M'"));
                    IntStream nameLengths = mnames.peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "mapToInt", 2, "(x)->x.length()")).mapToInt(x -> x.length()).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "mapToInt", 2, "(x)->x.length()"));
                    OptionalInt maximum = jwdebug.${'$'}JavaWiz.completeStreamVisualization("max", 3, "", nameLengths.peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "max", 3, "")).max());
                }
            }
            """
        )

        assertEquals(4, infos.size)
        assertEquals(
            listOf(
                Triple("of", true, false),
                Triple("filter", false, false),
                Triple("mapToInt", false, false),
                Triple("max", false, true)
            ),
            infos.map { Triple(it.operationName, it.isStreamSource, it.isTerminal) }
        )
    }

    @Test
    fun returnedStreamSourceSharesInfoWithConsumerPipeline() {
        val source = """
            import java.util.stream.Stream;

            class Main {
                Stream<String> source() {
                    return Stream.of("Max", "Susi", "Maya");
                }

                void main() {
                    source().filter(x -> x.charAt(0) == 'M').count();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.stream.Stream;

            class Main {
                Stream<String> source() {
                    return Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 0, "\"Max\""));
                }

                void main() {
                    jwdebug.${'$'}JavaWiz.completeStreamVisualization("count", 1, "", source().peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 2, "(x)->x.charAt(0) == 'M'")).filter(x -> x.charAt(0) == 'M').peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 2, "(x)->x.charAt(0) == 'M'")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "count", 1, "")).count());
                }
            }
            """
        )

        assertEquals(3, infos.size)
        assertEquals(
            listOf(
                Triple("of", true, false),
                Triple("filter", false, false),
                Triple("count", false, true)
            ),
            infos.sortedWith(compareBy({ it.startLine }, { it.startColumn }))
                .map { Triple(it.operationName, it.isStreamSource, it.isTerminal) }
        )
    }

    @Test
    fun untrackedStreamParameterUsesSyntheticSourceWithoutRegistration() {
        val source = """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    consume(Stream.of("Max", "Susi", "Maya"));
                }

                void consume(Stream<String> stream) {
                    stream.filter(x -> x.charAt(0) == 'M').count();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    consume(Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 0, "\"Max\"")));
                }

                void consume(Stream<String> stream) {
                    jwdebug.${'$'}JavaWiz.completeStreamVisualization("count", 1, "", stream.peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 2, "(x)->x.charAt(0) == 'M'")).filter(x -> x.charAt(0) == 'M').peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 2, "(x)->x.charAt(0) == 'M'")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "count", 1, "")).count());
                }
            }
            """
        )

        assertEquals(setOf("of", "filter", "count"), infos.map { it.operationName }.toSet())
        assertTrue(infos.none { it.operationName == "stream" })
    }

    @Test
    fun directSourceArgumentKeepsItsVisibleSourceOperation() {
        val source = """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    consume(Stream.of("Max", "Susi", "Maya").filter(x -> x.length() > 3));
                }

                void consume(Stream<String> stream) {
                    stream.sorted().findFirst();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    consume(Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 1, "\"Max\"")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 0, "(x)->x.length() > 3")).filter(x -> x.length() > 3).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 0, "(x)->x.length() > 3")));
                }

                void consume(Stream<String> stream) {
                    jwdebug.${'$'}JavaWiz.completeStreamVisualization("findFirst", 2, "", stream.peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "sorted", 3, "")).sorted().peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "sorted", 3, "")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "findFirst", 2, "")).findFirst());
                }
            }
            """
        )

        assertEquals(setOf("of", "filter", "sorted", "findFirst"), infos.map { it.operationName }.toSet())
        assertEquals(4, infos.map { it.operationId }.distinct().size)
        assertTrue(infos.single { it.operationName == "of" }.isStreamSource)
    }

    @Test
    fun operationIdsAreGlobalAcrossIndependentPipelines() {
        val source = """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    Stream.of("Max").filter(x -> true).count();
                    Stream.of("Susi").filter(x -> true).count();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.stream.Stream;

            class Main {
                void main() {
                    jwdebug.${'$'}JavaWiz.completeStreamVisualization("count", 0, "", Stream.of("Max").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 2, "\"Max\"")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 1, "(x)->true")).filter(x -> true).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 1, "(x)->true")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "count", 0, "")).count());
                    jwdebug.${'$'}JavaWiz.completeStreamVisualization("count", 3, "", Stream.of("Susi").peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 5, "\"Susi\"")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("IN", element, "filter", 4, "(x)->true")).filter(x -> true).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("OUT", element, "filter", 4, "(x)->true")).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("END", element, "count", 3, "")).count());
                }
            }
            """
        )

        if (infos.map { it.operationId }.distinct().size != infos.size) error("ids=${infos.map { it.operationName to it.operationId }}")
        assertEquals(infos.size, infos.map { it.operationId }.distinct().size)
    }

    @Test
    fun sourceOperationNamesMatchFactoryMethods() {
        val source = """
            import java.util.stream.IntStream;
            import static java.util.stream.IntStream.of;

            class Main {
                void main() {
                    var staticValues = of(1, 2, 3);
                    var values = IntStream.of(4, 8, 4);
                    var range = IntStream.range(0, 3);
                    var empty = IntStream.empty();
                }
            }
            """.trimIndent()
        val infos = collectInfos(source)

        assertInstrumentedSource(
            source,
            """
            import java.util.stream.IntStream;
            import static java.util.stream.IntStream.of;

            class Main {
                void main() {
                    var staticValues = of(1, 2, 3).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 0, "1"));
                    var values = IntStream.of(4, 8, 4).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "of", 1, "4"));
                    var range = IntStream.range(0, 3).peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "range", 2, "0"));
                    var empty = IntStream.empty().peek(element -> jwdebug.${'$'}JavaWiz.traceStream("START", element, "empty", 3, ""));
                }
            }
            """
        )

        assertEquals(
            listOf("of", "of", "range", "empty"),
            infos.filter { it.isStreamSource }.map { it.operationName }
        )
    }

    @Test
    fun sourceInstrumentationSeparatesRegistrationFromStartTracing() {
        val operation = StreamOperationInstrumentationInfo(
            startLine = 0,
            startColumn = 0,
            invocationBeginLine = 0,
            invocationBeginColumn = 0,
            invocationEndLine = 0,
            invocationEndColumn = 10,
            operationName = "stream",
            operationId = 1,
            receiverStreamType = "java.util.stream.IntStream",
            reductionCastType = null,
            statementEndLine = 0,
            statementEndColumn = 10,
            isStreamSource = true
        )

        val insertionText = buildInstrumentationInsertions(emptyList(), emptyList(), listOf(operation)).joinToString("\n") { it.insertedText }

        assertEquals(
            ".peek(element -> jwdebug.${'$'}JavaWiz.traceStream(\"START\", element, \"stream\", 1, \"\"))",
            insertionText
        )
    }

    private fun collectInfos(source: String): List<StreamOperationInstrumentationInfo> {
        val compiler = ToolProvider.getSystemJavaCompiler()
        val sourceFile = object : SimpleJavaFileObject(URI.create("string:///Main.java"), JavaFileObject.Kind.SOURCE) {
            override fun getCharContent(ignoreEncodingErrors: Boolean): CharSequence = source
        }
        val task = compiler.getTask(null, null, null, listOf("-proc:none"), null, listOf(sourceFile)) as JavacTask
        val tree = task.parse().single() as JCTree.JCCompilationUnit
        task.analyze()
        return collectStreamOperationInstrumentationInfos(tree)
    }

    private fun instrument(source: String): String {
        val infos = collectInfos(source)
        return applySourceInsertions(source, buildInstrumentationInsertions(emptyList(), emptyList(), infos))
    }

    private fun assertInstrumentedSource(source: String, expected: String) {
        assertEquals(expected.trimIndent(), instrument(source))
    }
}

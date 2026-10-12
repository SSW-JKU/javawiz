package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.compilation.COMPILATION_DIR_NAME
import at.jku.ssw.wsdebug.compilation.ast.AstItem
import at.jku.ssw.wsdebug.compilation.ast.CONSTRUCTOR_NAME
import at.jku.ssw.wsdebug.compilation.ast.lang.*
import at.jku.ssw.wsdebug.compilation.instrumentation.ArrayAccessTarget
import at.jku.ssw.wsdebug.compilation.instrumentation.VariableTarget
import at.jku.ssw.wsdebug.debugger.MAX_STACK_DEPTH_EXCEEDED_MESSAGE
import at.jku.ssw.wsdebug.debugger.recording.HeapObject
import at.jku.ssw.wsdebug.debugger.recording.InputBufferInfo
import at.jku.ssw.wsdebug.debugger.recording.MarbleDiagramData
import at.jku.ssw.wsdebug.debugger.recording.TraceState
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import java.io.InputStreamReader
import java.net.InetSocketAddress


internal class DebugWebSocketServerTest {
    private fun TraceState.latestTopLevelStreamData(): MarbleDiagramData =
        streamVisualizationData.streams.lastOrNull { it.parentStreamId == null }
            ?: error("trace state does not contain a top-level stream")

    internal data class StoredStreamReduction(
        val call: String,
        val printedResult: String,
        val visualizationResult: String
    )

    internal data class StoredStreamFixture(
        val streamType: String,
        val factoryExpression: String,
        val sourceValues: List<String>,
        val reductions: List<StoredStreamReduction>
    )

    /** Describes one reduce expression whose terminal result must reach StreamViz. */
    internal data class ReduceCompletionCase(
        val name: String,
        val source: String,
        val printedResult: String,
        val visualizationResult: String,
        val operationLanes: List<String>,
        val expectedReduceMarbles: Int = 1
    )

    internal enum class ReceiverKind {
        LOCAL_VARIABLE,
        PARAMETER
    }

    private lateinit var server: DebugWebSocketServer

    companion object {
        const val PORT = 0 // use an ephemeral port, as we never connect to the server
        const val TEST_CASES = "/TestCases"
        const val BASIC_LANGUAGE_STRUCTURES = "$TEST_CASES/BasicLanguageStructures"
        const val MULTI_FILE_HANDLING = "$TEST_CASES/MultiFileHandling"
        const val ARRAY_ACCESS_TRACING = "$TEST_CASES/ArrayAccessTracing"
        const val MISC = "$TEST_CASES/Misc"
        const val AST = "$TEST_CASES/Ast"
        const val INPUT = "$TEST_CASES/Input"
        const val INVIZ = "$TEST_CASES/InViz"
        const val STREAM_VISUALIZATION = "$TEST_CASES/StreamVisualization"

        /** Exercises the same pipeline across source layouts and debugger navigation modes. */
        @JvmStatic
        fun sameLineStreamCases(): List<Arguments> = listOf(true, false).flatMap { compact ->
            listOf(true, false).flatMap { sameLineBrace ->
                listOf("run", "into", "over").flatMap { navigation ->
                    listOf("reduce", "sum").map { terminal ->
                        Arguments.of(compact, sameLineBrace, navigation, terminal)
                    }
                }
            }
        }

        @JvmStatic
        fun storedStreamReduceCases(): List<Arguments> = storedStreamFixtures.flatMap { fixture ->
            fixture.reductions.flatMap { reduction ->
                ReceiverKind.entries.map { receiver ->
                    Arguments.of(fixture, reduction, receiver)
                }
            }
        }

        /** Supplies empty, filtered, singleton, and ordinary reduce cases for backend integration tests. */
        @JvmStatic
        fun streamValueExpressionCases(): List<Arguments> = listOf(
            Arguments.of(
                "for initializer",
                """
                    void main() {
                        var names = java.util.List.of("Anne", "Benjamin", "Cici");
                        for (int n = names.stream().mapToInt(String::length).reduce(0, Math::max); n < 9; n++) {
                            System.out.println(n);
                        }
                    }
                """.trimIndent(),
                "8\n"
            ),
            Arguments.of(
                "conditional expression",
                """
                    void main() {
                        var names = java.util.List.of("Anne", "Benjamin", "Cici");
                        int result = true ? names.stream().mapToInt(String::length).reduce(0, Math::max) : -1;
                        System.out.println(result);
                    }
                """.trimIndent(),
                "8\n"
            ),
            Arguments.of(
                "multiple declarators",
                """
                    void main() {
                        var names = java.util.List.of("Anne", "Benjamin", "Cici");
                        int result = names.stream().mapToInt(String::length).reduce(0, Math::max), other = 1;
                        System.out.println(result + other);
                    }
                """.trimIndent(),
                "9\n"
            ),
            Arguments.of(
                "nested ordinary method argument",
                """
                    void main() {
                        var names = java.util.List.of("Anne", "Benjamin", "Cici");
                        System.out.println(Integer.toString(names.stream().mapToInt(String::length).reduce(0, Math::max)));
                    }
                """.trimIndent(),
                "8\n"
            )
        )

        private val storedStreamFixtures = listOf(
            StoredStreamFixture(
                streamType = "java.util.stream.Stream<Integer>",
                factoryExpression = "java.util.stream.Stream.of(4, 8, 4)",
                sourceValues = listOf("4", "8", "4"),
                reductions = listOf(
                    StoredStreamReduction("reduce(Math::max)", "Optional[8]", "8"),
                    StoredStreamReduction("reduce(0, Math::max)", "8", "8"),
                    StoredStreamReduction("reduce(0, Math::max, Math::max)", "8", "8")
                )
            ),
            StoredStreamFixture(
                streamType = "java.util.stream.IntStream",
                factoryExpression = "java.util.stream.IntStream.of(4, 8, 4)",
                sourceValues = listOf("4", "8", "4"),
                reductions = listOf(
                    StoredStreamReduction("reduce(Math::max)", "OptionalInt[8]", "8"),
                    StoredStreamReduction("reduce(0, Math::max)", "8", "8")
                )
            ),
            StoredStreamFixture(
                streamType = "java.util.stream.LongStream",
                factoryExpression = "java.util.stream.LongStream.of(4, 8, 4)",
                sourceValues = listOf("4", "8", "4"),
                reductions = listOf(
                    StoredStreamReduction("reduce(Math::max)", "OptionalLong[8]", "8"),
                    StoredStreamReduction("reduce(0, Math::max)", "8", "8")
                )
            ),
            StoredStreamFixture(
                streamType = "java.util.stream.DoubleStream",
                factoryExpression = "java.util.stream.DoubleStream.of(4, 8, 4)",
                sourceValues = listOf("4.0", "8.0", "4.0"),
                reductions = listOf(
                    StoredStreamReduction("reduce(Math::max)", "OptionalDouble[8.0]", "8.0"),
                    StoredStreamReduction("reduce(0, Math::max)", "8.0", "8.0")
                )
            )
        )

        /** Supplies empty, filtered, singleton, and ordinary reduce cases for backend integration tests. */
        @JvmStatic
        fun reduceCompletionCases(): List<Arguments> = listOf(
            ReduceCompletionCase(
                name = "singleton object optional",
                source = """
                    void main() {
                        var result = java.util.stream.Stream.of(8).reduce(Integer::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "Optional[8]\n",
                visualizationResult = "8",
                operationLanes = listOf("of", "reduce")
            ),
            ReduceCompletionCase(
                name = "singleton primitive optional",
                source = """
                    void main() {
                        var result = java.util.stream.Stream.of("Benjamin").mapToInt(String::length).reduce(Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "OptionalInt[8]\n",
                visualizationResult = "8",
                operationLanes = listOf("of", "mapToInt", "reduce")
            ),
            ReduceCompletionCase(
                name = "empty object optional",
                source = """
                    void main() {
                        var result = java.util.stream.Stream.<Integer>empty().reduce(Integer::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "Optional.empty\n",
                visualizationResult = "Optional.empty",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty int optional",
                source = """
                    void main() {
                        var result = java.util.stream.IntStream.empty().reduce(Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "OptionalInt.empty\n",
                visualizationResult = "OptionalInt.empty",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty long optional",
                source = """
                    void main() {
                        var result = java.util.stream.LongStream.empty().reduce(Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "OptionalLong.empty\n",
                visualizationResult = "OptionalLong.empty",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty double optional",
                source = """
                    void main() {
                        var result = java.util.stream.DoubleStream.empty().reduce(Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "OptionalDouble.empty\n",
                visualizationResult = "OptionalDouble.empty",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty nonzero int identity",
                source = """
                    void main() {
                        var result = java.util.stream.IntStream.empty().reduce(7, Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "7\n",
                visualizationResult = "7",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty long identity",
                source = """
                    void main() {
                        var result = java.util.stream.LongStream.empty().reduce(7L, Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "7\n",
                visualizationResult = "7",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty double identity",
                source = """
                    void main() {
                        var result = java.util.stream.DoubleStream.empty().reduce(7.5, Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "7.5\n",
                visualizationResult = "7.5",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "empty three argument object reduction",
                source = """
                    void main() {
                        var result = java.util.stream.Stream.<Integer>empty().reduce(5, Integer::max, Integer::sum);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "5\n",
                visualizationResult = "5",
                operationLanes = listOf("reduce")
            ),
            ReduceCompletionCase(
                name = "all inputs filtered out",
                source = """
                    void main() {
                        var result = java.util.stream.IntStream.of(1, 2).filter(value -> false).reduce(9, Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "9\n",
                visualizationResult = "9",
                operationLanes = listOf("of", "filter", "reduce")
            ),
            ReduceCompletionCase(
                name = "normal multi element reduction",
                source = """
                    void main() {
                        var result = java.util.stream.IntStream.of(4, 8, 4).reduce(0, Math::max);
                        System.out.println(result);
                    }
                """.trimIndent(),
                printedResult = "8\n",
                visualizationResult = "8",
                operationLanes = listOf("of", "reduce"),
                expectedReduceMarbles = 3
            )
        ).map { Arguments.of(it.name, it) }
    }

    @BeforeEach
    fun setUp() {
        server = DebugWebSocketServer(InetSocketAddress(PORT))
        server.start()
    }

    @AfterEach
    fun tearDown() {
        server.stop()
    }

    private fun request(req: Request): Response {
        return server.generateResponse(jacksonObjectMapper().writeValueAsString(req))
    }

    private fun requestCompile( // method for setting common default parameters
        classContents: List<FilepathAndContent>, vscExtensionActive: Boolean = false, internalClassPatterns: List<String>? = null,
        openEditorLocalUri: String? = null,
        heapTraversalStopPatterns: List<String>? = internalClassPatterns,
        dataStructurePatterns: List<String>? = emptyList()
    ): Response {
        return request(
            // dataStructurePatterns defaults to emptyList() so tests preserve pre-split behavior.
            Compile(classContents, vscExtensionActive, internalClassPatterns, heapTraversalStopPatterns, dataStructurePatterns, openEditorLocalUri)
        )
    }

    private fun fullTrace(
        classContents: List<FilepathAndContent>, vscExtensionActive: Boolean = false, checkAst: Boolean = true, internalClassPatterns: List<String>? = null,
        openEditorLocalUri: String? = null,
        testFlags: TestFlags,
        heapTraversalStopPatterns: List<String>? = internalClassPatterns,
        dataStructurePatterns: List<String>? = emptyList()
    ):
            List<TraceState> {
        val response = requestCompile(
            classContents,
            vscExtensionActive,
            internalClassPatterns,
            openEditorLocalUri,
            heapTraversalStopPatterns,
            dataStructurePatterns
        )



        if (response is ErrorResponse) {
            error(response.error)
        }
        if (response is CompileFailResponse) {
            error(response.error)
        }
        if (checkAst) {
            val files = (response as CompileSuccessResponse).data.asts.map { it.file }
            assertCorrectMethodCallOffsets(files)
            assertCorrectMethodCallLengths(files)
            checkEndOfStatementList(files)
        }
        val firstStates = (response as CompileSuccessResponse).data.firstStepResult.traceStates

        val result = request(
            RunToEnd()
        )
        assert(result is StepResultResponse) {
            (result as? ErrorResponse)?.error ?: result.toString()
        }

        return firstStates + (result as StepResultResponse).data.traceStates
    }

    private fun fullTrace(path: String, testFlags: TestFlags): List<TraceState> {
        val file = FilepathAndContent(
            path.split("Code/")[1], javaClass.getResourceAsStream(
                path
            )?.reader(Charsets.UTF_8)?.readText() ?: error("file $path not found")
        )

        return fullTrace(
            listOf(file),
            vscExtensionActive = true,
            testFlags = testFlags
        )
    }

    private fun assertLineNumbersEqual(trace: List<TraceState>, lineNumbers: MutableList<Int>) {
        val actual = trace.map { it.line }.toMutableList()

        if (actual.size < lineNumbers.size) {
            // to many lines recorded
            actual += buildList { repeat(lineNumbers.size - actual.size) { add(-1) } }
        } else if (lineNumbers.size < actual.size) {
            // not enough lines recorded
            lineNumbers += buildList { repeat(actual.size - lineNumbers.size) { add(-1) } }
        }
        assertIterableEquals(lineNumbers, actual) {
            "line numbers differ:\n" +
                    lineNumbers
                        .zip(actual) { e, a ->
                            String.format(
                                "%3s %3s %s",
                                if (e != -1) e.toString() else "N/A",
                                if (a != -1) a.toString() else "N/A",
                                if (e != a) "!" else ""
                            )
                        }
                        .joinToString("\n")

        }
    }

    private fun assertOutputEquals(trace: List<TraceState>, output: String) {
        val traceOutput = trace.joinToString("") { it.output }
        assertEquals(output, traceOutput) { "incorrect output" }
    }

    private fun assertNumberOfEvaluatedConditionsInTopStackFrameEquals(trace: List<TraceState>, expected: List<Int>) {
        val actual = trace.map { traceState ->
            traceState.stack[0].conditionValues.filter { it.evaluated }.size
        }

        assertEquals(expected.size, actual.size) { "number of evaluated conditions in the top stack frame not equal" }

        expected.forEachIndexed { index, value -> assertEquals(value, actual[index]) { "evaluated condition not equal" } }
    }

    private fun compiles(filePath: String, className: String, vscExtensionActive: Boolean = false, testFlags: TestFlags): Boolean {
        return compiles(listOf(Pair(filePath, className)), vscExtensionActive, testFlags)
    }

    private fun compiles(filePathsAndClassNames: List<Pair<String, String>>, vscExtensionActive: Boolean = false, testFlags: TestFlags): Boolean {
        val files = filePathsAndClassNames.map { (filePath, className) ->
            FilepathAndContent(
                className,
                javaClass.getResourceAsStream(filePath)
                    ?.reader()
                    ?.readText()
                    ?: error("could not find file $filePath in resources")
            )
        }
        val result = requestCompile(files, vscExtensionActive)
        println(result)
        return result.status == TaskResult.SUCCESS
    }

    private fun assertErrorEquals(trace: List<TraceState>, error: String) {
        val traceError = trace.joinToString("") { it.error }
        assertEquals(error, traceError) {
            listOf("incorrect error:", traceError, "expected error:", error).joinToString("\n")
        }
    }

    private fun createFilePathAndContent(directoryPath: String, name: String): FilepathAndContent {
        return FilepathAndContent(
            name,
            getResourceAsReader("$directoryPath/Code/", name)?.readText() ?: error("file $name not found in $directoryPath")
        )
    }

    private fun callRunToEndAndCompareTestcaseMetadataFiles(
        directoryPath: String,
        classNames: List<String>,
        vscExtensionActive: Boolean = false,
        checkAst: Boolean = true,
        internalClassPatterns: List<String>? = null,
        openEditorLocalUri: String? = null,
        testFlags: TestFlags
    ): List<TraceState> { // path within
        // resources folder, contains all assets for a test case
        val classContents = classNames.map { name ->
            createFilePathAndContent(directoryPath, name)
        }

        val trace =
            fullTrace(classContents, vscExtensionActive = vscExtensionActive, checkAst = checkAst, internalClassPatterns = internalClassPatterns, openEditorLocalUri, testFlags)

        // Check if lines have been executed in correct order if lines.txt is present in directoryPath
        getResourceAsReader(directoryPath, "lines.txt")
            ?.readLines()
            ?.map { Integer.parseInt(it) }
            ?.toMutableList()
            ?.let { lines -> assertLineNumbersEqual(trace, lines) }

        // Check if output is correct if output.txt is present in directoryPath
        getResourceAsReader(directoryPath, "output.txt")
            ?.readText()
            ?.let { output -> assertOutputEquals(trace, output) }

        // Check if error output is correct if error.txt is present in directoryPath
        getResourceAsReader(directoryPath, "error.txt")
            ?.readText()
            ?.let { error -> assertErrorEquals(trace, error) }

        // Check if number of evaluated conditions is correct if numberOfEvaluatedConditionsInTopStackFrame.txt is present in directoryPath
        getResourceAsReader(directoryPath, "numberOfEvaluatedConditionsInTopStackFrame.txt")
            ?.readLines()
            ?.map { Integer.parseInt(it) }
            ?.let { nEvaluated -> assertNumberOfEvaluatedConditionsInTopStackFrameEquals(trace, nEvaluated) }

        return trace
    }

    private fun getResourceAsReader(directoryPath: String, resource: String): InputStreamReader? {
        return javaClass.getResourceAsStream("$directoryPath/$resource")?.reader(Charsets.UTF_8)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testWhile(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/While", listOf("While.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testFor(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/For", listOf("For.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testDoWhile(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/DoWhile", listOf("DoWhile.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testBlockEscapingDoWhile(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/BlockEscapingDoWhile", listOf("BlockEscapingDoWhile.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testEscapeLoop(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/EscapeLoop", listOf("EscapeLoop.java"), checkAst = false, testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testForContinue(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ForContinue", listOf("ForContinue.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testForReplacement(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ForReplacement", listOf("ForReplacement.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testReturnFromFor(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ReturnFromFor", listOf("ReturnFromFor.java"), testFlags = testFlags)
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSpecialChars(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/SpecialChars", listOf("SpecialChars.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testIfElse(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/IfElse", listOf("IfElse.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testRecursion(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/Recursion", listOf("Recursion.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSingleLineNestedIf(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/SingleLineNestedIf", listOf("SingleLineNestedIf.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testForLines1(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ForLines1", listOf("ForLines1.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testForLines2(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ForLines2", listOf("ForLines2.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSwitchExpression(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/SwitchExpression", listOf("SwitchExpression.java"), checkAst = false, testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSwitchStmt(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/SwitchStmt", listOf("SwitchStmt.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testArraysContainingNull(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/ArraysContainingNull", listOf("ArraysContainingNull.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompactSourceFile(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "${BASIC_LANGUAGE_STRUCTURES}/CompactSourceFile",
            listOf("CompactSourceFile.java"),
            vscExtensionActive = true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompactSourceFileWithStaticMain(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "${BASIC_LANGUAGE_STRUCTURES}/CompactSourceFile",
            listOf("CompactStaticMain.java"),
            vscExtensionActive = true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompactSourceFileWithInstanceMainArguments(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "${BASIC_LANGUAGE_STRUCTURES}/CompactSourceFile",
            listOf("CompactInstanceMainArguments.java"),
            vscExtensionActive = true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompactSourceFileWithStaticMainArguments(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "${BASIC_LANGUAGE_STRUCTURES}/CompactSourceFile",
            listOf("CompactStaticMainArguments.java"),
            vscExtensionActive = true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompilesMainInEnum(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/MainInEnum.java", "MainInEnum.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompilesMainInPackage(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/MainInPackage.java", "MainInPackage.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompilesMainInRecord(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/MainInRecord.java", "MainInRecord.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompilesMSingleLineControlFlow(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/SingleLineControlFlow.java", "SingleLineControlFlow.java", testFlags = testFlags))
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testCompilesInstanceMainWithArguments(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/InstanceMainWithArguments.java", "InstanceMainWithArguments.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesMainInInner(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainInInner.java", "NoMainInInner.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesMainInInterface(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainInInterface.java", "NoMainInInterface.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesMainWithWrongSignature1(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainWithWrongSignature1.java", "NoMainWithWrongSignature1.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesMainWithWrongSignature2(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainWithWrongSignature2.java", "NoMainWithWrongSignature2.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesMainWithWrongSignature3(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainWithWrongSignature3.java", "NoMainWithWrongSignature3.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNotCompilesPrivateMain(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainPrivate.java", "NoMainPrivate.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testExceptions(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/Exceptions", listOf("Exceptions.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testIllegalArrayAccess(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/IllegalArrayAccess", listOf("IllegalArrayAccess.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConditions(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/Conditions", listOf("Conditions.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConditionBeforeException(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/ConditionBeforeException", listOf("ConditionBeforeException.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConditionBeforeException2(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/ConditionBeforeException2", listOf("ConditionBeforeException2.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConditions2(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/Conditions2", listOf("Conditions2.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultiFileHandlingNoConditionsInInout(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/NoConditionsInInout",
            listOf("NoConditionsInInout.java", "inout/In.java", "SomethIn.java"),
            true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultiFileHandlingNoConditionsInInoutInPackage(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/NoConditionsInInoutInPackage",
            listOf("NoConditionsInInoutInPackage.java", "mypackage/In.java", "SomethIn.java"),
            true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultiFileHandlingConditionInsidePackage(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/ConditionInsidePackage",
            listOf("ConditionInsidePackage.java", "pack/Local.java"),
            true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testPackageResolutionWithIn(testFlags: TestFlags) {
        val path = "$MULTI_FILE_HANDLING/PackageResolutionWithIn"
        val response = requestCompile(
            listOf(
                FilepathAndContent("Resolution.java", getResourceAsReader("$path/Code/", "Resolution.java")!!.readText()),
                FilepathAndContent("Out.java", getResourceAsReader("$path/Code/", "Out.java")!!.readText())
            ),
            vscExtensionActive = false
        )
        assert(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testShouldCompileFileFromWebVersion(testFlags: TestFlags) {
        val filePath = "/TestCases/ShouldCompile/"
        val fileName = "FileFromWebVersion.java"
        val file = getResourceAsReader(filePath, fileName)?.readText() ?: error("could not find file $filePath in resources")
        val result = requestCompile(listOf(FilepathAndContent(fileName, file)))
        assertTrue(result !is CompileFailResponse) { (result as CompileFailResponse).error }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testShouldCompileFileFromWebVersionWithPackageDecl(testFlags: TestFlags) {
        val filePath = "/TestCases/ShouldCompile/"
        val fileName = "FileFromWebVersionWithPackageDecl.java"
        val file = getResourceAsReader(filePath, fileName)?.readText() ?: error("could not find file $filePath in resources")
        val result = requestCompile(listOf(FilepathAndContent(fileName, file)))
        assertTrue(result !is CompileFailResponse) { (result as CompileFailResponse).error }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConditionsNotInitialized(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/ConditionsNotInitialized",
            listOf("ConditionsNotInitialized.java", "Out.java"),
            true,
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testDefaultConstructor(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$BASIC_LANGUAGE_STRUCTURES/DefaultConstructor", listOf("pack/DefaultConstructor.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testFindMainPriority(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/FindMainPriority",
            listOf("pack2/Main1.java", "pack1/Main1.java"),
            true,
            openEditorLocalUri = "pack2/Main1.java",
            testFlags = testFlags
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testFindMainPriority2(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/FindMainPriority2",
            listOf("Main2.java", "Main1.java"),
            true,
            openEditorLocalUri = "Main2.java",
            testFlags = testFlags
        )
        callRunToEndAndCompareTestcaseMetadataFiles(
            "$MULTI_FILE_HANDLING/FindMainPriority2",
            listOf("Main2.java", "Main1.java"),
            true,
            openEditorLocalUri = null,
            testFlags = testFlags
        )

    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testRunToLinePackageName(testFlags: TestFlags) {
        val vscExtensionActive = true
        val directoryPath = "$MISC/RunToLinePackageName"
        val classNames = listOf("package1/RunToLinePackageName.java", "package2/RunToLinePackageName.java")
        val classContents = classNames.map { name ->
            FilepathAndContent(
                name,
                getResourceAsReader("$directoryPath/Code/", name)?.readText() ?: error("file $name not found in $directoryPath")
            )
        }

        val response = requestCompile(classContents, vscExtensionActive)

        if (response !is CompileSuccessResponse) {
            error(if (response is CompileFailResponse) response.error else "could not compile for unknown reason")
        }
        val firstStates = response.data.firstStepResult.traceStates

        val line = 11
        val result = request(
            RunToLine(line, "package1.RunToLinePackageName")
        )
        if (result !is StepResultResponse) {
            error("could not trace")
        }

        val states = firstStates + result.data.traceStates

        val expectedLines = mutableListOf(
            9, 11, 12, 10, 11
        )

        assertLineNumbersEqual(states, expectedLines)
    }

    /*
    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultiFileHandlingEnforceMainFirst(testFlags: TestFlags) {
        val first = Pair("$MULTI_FILE_HANDLING/EnforceMainFirst/Code/First.java", "First.java")
        val second = Pair("$MULTI_FILE_HANDLING/EnforceMainFirst/Code/Second.java", "Second.java")
        assertTrue(compiles(listOf(first, second), true, testFlags = testFlags))
        assertFalse(compiles(listOf(second, first), true, testFlags = testFlags))
        assertTrue(compiles(listOf(first), false, testFlags = testFlags))
        assertFalse(compiles(listOf(second), false, testFlags = testFlags))
    }
    */

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInternalFrameTagging(testFlags: TestFlags) {
        assertTrue("inout.In".outerClassMatchesOuterClassPattern(INTERNAL_CLASS_PATTERNS))
        assertTrue("jdk.\$InternalDummyClassName1234".outerClassMatchesOuterClassPattern(INTERNAL_CLASS_PATTERNS))
        assertTrue("dummy.packaage123.In".outerClassMatchesOuterClassPattern(INTERNAL_CLASS_PATTERNS))
        assertFalse("SomethIn".outerClassMatchesOuterClassPattern(INTERNAL_CLASS_PATTERNS))
        assertFalse("jdk".outerClassMatchesOuterClassPattern(INTERNAL_CLASS_PATTERNS))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testStaticInner(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("${BASIC_LANGUAGE_STRUCTURES}/StaticInner", listOf("StaticInner.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testArrayAccessIsAssignmentTarget(testFlags: TestFlags) {
        val trace = fullTrace("$ARRAY_ACCESS_TRACING/ArrayAccessIsAssignmentTarget/Code/ArrayAccessIsAssignmentTarget.java", testFlags = testFlags)

        val accesses = trace.flatMap { state -> state.stack[0].arrayAccessValues }

        val isIdxAssignment = listOf(true, false, false, true, true, false, true)

        isIdxAssignment.forEachIndexed { idx, value ->
            assertTrue(
                accesses.any { it.evaluated && it.indexValues[0] == idx && it.arrayAccess.isWrittenTo == value }
            )
        }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testArrayAccessRecording(testFlags: TestFlags) {
        val trace = fullTrace("$ARRAY_ACCESS_TRACING/ArrayAccessRecording/Code/ArrayAccessRecording.java", testFlags = testFlags)

        val evaluatedIndexExpressions = listOf(
            "0",
            "0",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
            "size - i",
        )

        assertIterableEquals(
            evaluatedIndexExpressions,
            trace.flatMap { it.stack[0].arrayAccessValues }
                .filter { it.evaluated }
                .map { it.arrayAccess.indexExpressions[0].expression })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testArrayAccessIsVariable(testFlags: TestFlags) {
        val trace = fullTrace("$ARRAY_ACCESS_TRACING/ArrayAccessIsVariable/Code/ArrayAccessIsVariable.java", testFlags = testFlags)

        val target = listOf(true, false, false, true, false)

        assertIterableEquals(target, trace.flatMap { it.stack[0].arrayAccessValues }.filter { it.evaluated }.map { it.arrayAccess.indexExpressions[0].isVariable })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultiDimensionalArrayAccess(testFlags: TestFlags) {
        val directoryPath = "$ARRAY_ACCESS_TRACING/MultiDimensionalArrayAccess"
        val trace = fullTrace("$directoryPath/Code/MultiDimensionalArrayAccess.java", testFlags = testFlags)

        val evaluatedTopStackArrayAccesses = trace.flatMap { it.stack[0].arrayAccessValues }.filter { it.evaluated }


        getResourceAsReader("$directoryPath/", "lines.txt")
            ?.readLines()
            ?.map { Integer.parseInt(it) }
            ?.toMutableList()
            ?.let { lines -> assertLineNumbersEqual(trace, lines) }

        getResourceAsReader("$directoryPath/", "output.txt")
            ?.readText()
            ?.let { output -> assertOutputEquals(trace, output) }

        val evaluatedDim0IndexExpressions = listOf(
            "1",
            "2",
            "count",
            "count+1",
            "count++",
            "count",
            "++count",
            "1",
            "2",
            // foo()[0] not recorded
            "2", // really?
            "1",
            "a[2] = 0",
            "2"
        )

        assertIterableEquals(
            evaluatedDim0IndexExpressions.map { expression -> expression.filterNot { it.isWhitespace() } },
            evaluatedTopStackArrayAccesses.map { access -> access.arrayAccess.indexExpressions[0].expression.filterNot { it.isWhitespace() } })

        val evaluatedDim1IndexExpressions = listOf(
            "1",
            "2",
            "bar()"
        )

        assertIterableEquals(
            evaluatedDim1IndexExpressions,
            evaluatedTopStackArrayAccesses.filter { it.arrayAccess.indexExpressions.size > 1 }.map { it.arrayAccess.indexExpressions[1].expression })

        val evaluatedAssignmentTargetIds = listOf(
            null,
            0,
            null,
            2,
            null,
            4,
            5,
            null,
            11,
            null,
            null,
            null,
            null
        )

        assertIterableEquals(
            evaluatedAssignmentTargetIds,
            evaluatedTopStackArrayAccesses
                .map { it.arrayAccess.assignmentTarget }
                .map { if (it is ArrayAccessTarget) it.id else null }
        )

        val evaluatedIsAssignmentTarget = listOf(
            true,
            false,
            true,
            false,
            true,
            true,
            false,
            true,
            false,
            false,
            true,
            false,
            true
        )

        assertIterableEquals(
            evaluatedIsAssignmentTarget,
            evaluatedTopStackArrayAccesses.map { it.arrayAccess.isWrittenTo })

        val evaluatedDim0IndexValues = listOf(
            1,
            2,
            0,
            1,
            0,
            1,
            2,
            1,
            2,
            2,
            1,
            0,
            2
        )

        assertIterableEquals(
            evaluatedDim0IndexValues,
            evaluatedTopStackArrayAccesses.map { it.indexValues[0] })

        val evaluatedDim1IndexValues = listOf(
            1,
            2,
            1
        )

        assertIterableEquals(
            evaluatedDim1IndexValues,
            evaluatedTopStackArrayAccesses.filter { it.indexValues.size > 1 }.map { it.indexValues[1] })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testArrayAccessSourceTargetVariables(testFlags: TestFlags) {
        val directoryPath = "$ARRAY_ACCESS_TRACING/ArrayAccessSourceTargetVariables"
        val trace = fullTrace("$directoryPath/Code/ArrayAccessSourceTargetVariables.java", testFlags = testFlags)

        val evaluatedTopStackArrayAccesses = trace.flatMap { it.stack[0].arrayAccessValues }.filter { it.evaluated }


        getResourceAsReader("$directoryPath/", "lines.txt")
            ?.readLines()
            ?.map { Integer.parseInt(it) }
            ?.toMutableList()
            ?.let { lines -> assertLineNumbersEqual(trace, lines) }

        val targets = listOf(
            null,
            ArrayAccessTarget(0),
            VariableTarget("i"),
            VariableTarget("j"),
            VariableTarget("i"),
            VariableTarget("j"),
            null,
            null,
            ArrayAccessTarget(7),
        )

        val sources = listOf(
            listOf(),
            listOf(),
            listOf(),
            listOf(),
            listOf(),
            listOf(),
            listOf("i", "j"),
            listOf("i", "j"),
            listOf(),
        )

        assertEquals(sources.size, evaluatedTopStackArrayAccesses.size, "Wrong number of source variables")
        assertEquals(targets.size, evaluatedTopStackArrayAccesses.size, "Wrong number of target variables")

        sources.forEachIndexed { index, vars ->
            assertIterableEquals(
                vars, evaluatedTopStackArrayAccesses[index].arrayAccess.assignmentSourceVariableNames, "Wrong source " +
                        "variable names at step $index"
            )
        }
        assertIterableEquals(targets, evaluatedTopStackArrayAccesses.map { it.arrayAccess.assignmentTarget })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testStepRequests(testFlags: TestFlags) {
        val directoryPath = "$MISC/StepRequests"
        val className = "StepRequests.java"

        val response = requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        if (response is CompileFailResponse) {
            error(response.error)
        }
        // val firstStates = (response as CompileSuccessResponse).data.firstStepResult.traceStates

        val requests = listOf(
            StepInto(),
            StepInto(),
            StepOver(1),
            StepOver(1),
            StepInto(),
            StepInto(),
            StepInto(),
            StepOver(2),
            StepOver(2),
            StepOver(2),
            StepInto(),
            StepInto(),
            StepInto(),
            StepOut(3),
            StepInto(),
            StepOut(2),
            RunToLine(5, "StepRequests"),
            StepOut(2),
            RunToEnd()
        )

        val responses = requests.map { request(it) }

        val actualOutputs = responses.filterIsInstance<StepResultResponse>().map { res ->
            res.data.traceStates.joinToString("") { traceState ->
                traceState.output
            }
        }

        println("actual outputs:")
        actualOutputs.forEachIndexed { idx, item ->
            println(item); println("-------$idx------")
        }

        val sep = "\n"
        val outputs = listOf(
            "Step ",
            "into$sep",
            "Step ",
            "over$sep",
            "Step ",
            "",
            "into$sep",
            "Step ",
            "...",
            "over$sep",
            "Step ",
            "",
            "into$sep",
            "Step ",
            "out${sep}",
            "Step Into${sep}Step ...",
            "out${sep}Run to ......",
            "line${sep}Step ",
            " out${sep}Run to ......end$sep"
        )

        // assertEquals(outputs.size, responses.size) { "wrong number of responses" }

        outputs.forEachIndexed { index, value -> assertEquals(value, actualOutputs[index]) { "evaluated outputs not equal at index $index" } }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun continuePreviousSteps(testFlags: TestFlags) {
        val directoryPath = "$INPUT/TwoReads"
        val className = "TwoReads.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val stepRequest1 = StepOver(1)
        val stepResponse1 = request(stepRequest1)
        assertEquals(1, (stepResponse1 as StepResultResponse).data.traceStates.size)
        assertEquals(4, stepResponse1.data.traceStates[0].line)

        // This input does not continue since previous step was fully handled
        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)
        assertNull((inputResponse1 as InputResponse).data)
        assertEquals(TaskKind.INPUT, inputResponse1.request.task)

        val stepRequest2 = RunToLine(999, className)
        val stepResponse2 = request(stepRequest2)
        assertEquals(1, (stepResponse2 as StepResultResponse).data.traceStates.size)
        assertEquals(5, stepResponse2.data.traceStates[0].line)

        // This input automatically continues since previous step was not fully handled
        val inputRequest2 = Input("2")
        val inputResponse2 = request(inputRequest2)
        assertNotNull((inputResponse2 as InputResponse).data)
        assertEquals(6, inputResponse2.data!!.traceStates[0].line)
        assertEquals(TaskKind.INPUT, inputResponse2.request.task)

        val stepRequest3 = StepInto()
        val stepResponse3 = request(stepRequest3)
        assertEquals(0, (stepResponse3 as StepResultResponse).data.traceStates.size)
        assertFalse(stepResponse3.data.isVMRunning)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun stepOverWithEarlyInput(testFlags: TestFlags) {
        val directoryPath = "$INPUT/StepOverWithInput"
        val className = "StepOverWithInput.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))
        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)

        assertNull((inputResponse1 as InputResponse).data)
        assertEquals(TaskKind.INPUT, inputResponse1.request.task)

        val stepRequest1 = StepOver(1)
        val stepResponse1 = request(stepRequest1)

        assertEquals(3, (stepResponse1 as StepResultResponse).data.traceStates.size)
        assertEquals(8, stepResponse1.data.traceStates[0].line)
        assertEquals(9, stepResponse1.data.traceStates[1].line)
        assertEquals(4, stepResponse1.data.traceStates[2].line)

        val stepRequest2 = StepOver(1)
        val stepResponse2 = request(stepRequest2)

        assertEquals(1, (stepResponse2 as StepResultResponse).data.traceStates.size)
        assertEquals(5, stepResponse2.data.traceStates[0].line)

        val stepRequest3 = StepOver(1)
        val stepResponse3 = request(stepRequest3)

        assertEquals(0, (stepResponse3 as StepResultResponse).data.traceStates.size)
        assertFalse(stepResponse3.data.isVMRunning)
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun stepOverWithBlockingInput(testFlags: TestFlags) {
        val directoryPath = "$INPUT/StepOverWithInput"
        val className = "StepOverWithInput.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val stepRequest1 = StepOver(1)
        val stepResponse1 = request(stepRequest1)

        // Stepping into the method in front of readInt()
        // readInt() then is blocking
        assertEquals(1, (stepResponse1 as StepResultResponse).data.traceStates.size)
        assertEquals(8, stepResponse1.data.traceStates[0].line)

        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)

        assertNotNull((inputResponse1 as InputResponse).data)
        assertEquals(2, inputResponse1.data!!.traceStates.size)
        assertEquals(9, inputResponse1.data.traceStates[0].line)
        assertEquals(4, inputResponse1.data.traceStates[1].line)
        assertEquals(TaskKind.INPUT, inputResponse1.request.task)

        val stepRequest2 = StepOver(1)
        val stepResponse2 = request(stepRequest2)

        assertEquals(1, (stepResponse2 as StepResultResponse).data.traceStates.size)
        assertEquals(5, stepResponse2.data.traceStates[0].line)

        val stepRequest3 = StepOver(1)
        val stepResponse3 = request(stepRequest3)

        assertEquals(0, (stepResponse3 as StepResultResponse).data.traceStates.size)
        assertFalse(stepResponse3.data.isVMRunning)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun inputIsPreservedAcrossHiddenRecordConstructorState(testFlags: TestFlags) {
        val directoryPath = "$INPUT/RecordConstructorInput"
        val className = "ProblemDemo.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val runResponse = request(RunToEnd())
        assertTrue((runResponse as StepResultResponse).data.isWaitingForInput)

        val input = "Anna"
        val inputResponse = request(Input(input))
        val traceStates = (inputResponse as InputResponse).data?.traceStates

        assertNotNull(traceStates)
        assertTrue(traceStates!!.any { it.input == "$input\n" }) {
            "No emitted trace state contained the submitted input"
        }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun runToEndWithEarlyInput(testFlags: TestFlags) {
        val directoryPath = "$INPUT/RunToEndWithInput"
        val className = "RunToEndWithInput.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)

        assertNull((inputResponse1 as InputResponse).data)

        val inputRequest2 = Input("2")
        val inputResponse2 = request(inputRequest2)

        assertNull((inputResponse2 as InputResponse).data)

        val inputRequest3 = Input("3")
        val inputResponse3 = request(inputRequest3)

        assertNull((inputResponse3 as InputResponse).data)

        val stepRequest1 = RunToEnd()
        val stepResponse1 = request(stepRequest1)

        assertLineNumbersEqual(
            (stepResponse1 as StepResultResponse).data.traceStates, mutableListOf(
                4,
                5,
                6,
                7,
                8,
                9,
                10,
                16,
                17,
                18,
                19,
                11,
                12,
                13
            )
        )

        val stepRequest2 = RunToEnd()
        val stepResponse2 = request(stepRequest2)

        assertEquals(0, (stepResponse2 as StepResultResponse).data.traceStates.size)
        assertFalse(stepResponse2.data.isVMRunning)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun runToEndWithBlockingInput(testFlags: TestFlags) {
        val directoryPath = "$INPUT/RunToEndWithInput"
        val className = "RunToEndWithInput.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val stepRequest1 = RunToEnd()
        val stepResponse1 = request(stepRequest1)

        assertEquals(3, (stepResponse1 as StepResultResponse).data.traceStates.size)
        assertLineNumbersEqual(
            stepResponse1.data.traceStates, mutableListOf(
                4,
                5,
                6
            )
        )

        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)

        assertNotNull((inputResponse1 as InputResponse).data)
        assertEquals(3, inputResponse1.data!!.traceStates.size)
        assertLineNumbersEqual(
            inputResponse1.data.traceStates, mutableListOf(
                7,
                8,
                9
            )
        )
        assertEquals(TaskKind.INPUT, inputResponse1.request.task)

        val inputRequest2 = Input("2")
        val inputResponse2 = request(inputRequest2)

        assertNotNull((inputResponse2 as InputResponse).data)
        assertEquals(3, inputResponse2.data!!.traceStates.size)
        assertLineNumbersEqual(
            inputResponse2.data.traceStates, mutableListOf(
                10,
                16,
                17
            )
        )
        assertEquals(TaskKind.INPUT, inputResponse2.request.task)

        val inputRequest3 = Input("3")
        val inputResponse3 = request(inputRequest3)

        assertNotNull((inputResponse3 as InputResponse).data)
        assertEquals(5, inputResponse3.data!!.traceStates.size)
        assertLineNumbersEqual(
            inputResponse3.data.traceStates, mutableListOf(
                18,
                19,
                11,
                12,
                13
            )
        )
        assertEquals(TaskKind.INPUT, inputResponse3.request.task)

        val stepRequest2 = RunToEnd()
        val stepResponse2 = request(stepRequest2)

        assertEquals(0, (stepResponse2 as StepResultResponse).data.traceStates.size)
        assertFalse(stepResponse2.data.isVMRunning)
    }

    // The problem with this code is that the final array creation takes more than one second, thus the backend assumes we are waiting for input.
    // The stepping is immediately ended, before ever creating the OutOfMemory exception.
    // The test might be enabled again if we ever implemented a better "waiting for input" detection mechanism instead of a timout-based one
    /*
    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun outOfMemory(testFlags: TestFlags) {
        val directoryPath = "$MISC/Errors/OutOfMemory"
        val className = "OutOfMemory.java"

        val compileResult = requestCompile(listOf(createFilePathAndContent(directoryPath, className)))
        assertEquals(TaskResult.SUCCESS, compileResult.status)

        val stepRequest = RunToLine(111, className)
        val stepResponse = request(stepRequest)
        assert(stepResponse is StepResultResponse)
        assert((stepResponse as StepResultResponse).data.traceStates.size > 1)
        assert(stepResponse.data.traceStates.last().error.contains("java.lang.OutOfMemoryError")) {
            "Last trace state was not the expected OutOfMemoryError (as identified by error text) but program output is\n" + stepResponse.data.traceStates.map {
                it.input + it.output + it.error
            }.joinToString("\n")
        }
    } */

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun stackOverflow(testFlags: TestFlags) {
        val directoryPath = "$MISC/Errors/StackOverflow"
        val className = "StackOverflow.java"

        requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        val response = request(StepOver(1))
        assert(response is ErrorResponse)
        assertEquals("Error while processing request: $MAX_STACK_DEPTH_EXCEEDED_MESSAGE", (response as ErrorResponse).error)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun umlaut(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$MISC/Umlaut", listOf("Umlaut.java"), testFlags = testFlags)
    }

    /*
    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInVizInTest(testFlags: TestFlags) {
        val name = "InTest"
        val dir = "$INVIZ/$name"
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(dir, listOf("$name.java"), testFlags = testFlags)

        val inputBufferInfoFileName = buildString {
            append("inputbufferinfos")
            append(
                if (System.lineSeparator() == "\n")
                    "LF"
                else
                    "CR"
            )
            append(".txt")
        }

        val inputBufferInfo = jacksonObjectMapper()
            .readValue<List<InputBufferInfo>>(
                getResourceAsReader("$dir/", inputBufferInfoFileName)!!
            )

        assertIterableEquals(inputBufferInfo, trace.map { it.inputBufferInfo })
    }
     */

    private fun assertCorrectMethodCallOffsets(asts: List<AstFile>) {
        val items = asts.flatMap { it.descendents() }

        items.filterIsInstance<Conditional>().forEach { conditional ->
            conditional.methodCallExpressions.forEach { // filter our constructors
                assert(conditional.condition.substring(it.deltaBegin).startsWith(it.name)) {
                    "${conditional.condition} does not have method call expression \"${it.name}\" at offset ${it.deltaBegin}"
                }
            }
        }

        items.filterIsInstance<Statement>().forEach { statement ->
            statement.methodCallExpressions.filter { it.candidates.isNotEmpty() }.filter { it.name != "<init>" }.forEach {
                assert(
                    statement.code.substring(it.deltaBegin).startsWith(it.name)
                ) { "${statement.code} does not have method call expression \"${it.name}\" at offset ${it.deltaBegin}" }
            }
        }
    }

    private fun assertCorrectMethodCallLengths(asts: List<AstFile>) {
        val items = asts.flatMap { it.descendents() }
        val methodCallExpressions = buildSet {
            items.filterIsInstance<Conditional>().forEach { item -> addAll(item.methodCallExpressions) }
            items.filterIsInstance<Statement>().forEach { item -> addAll(item.methodCallExpressions) }
        }

        methodCallExpressions.forEach { expression ->
            if (expression.name == CONSTRUCTOR_NAME) {
                assertTrue(expression.length > 4) // length should be at least the length of the constructor call "this"
            } else {
                assertEquals(expression.length, expression.name.length)
            }
        }

    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNoParensInConditions(testFlags: TestFlags) {
        val response =
            requestCompile(listOf(createFilePathAndContent("$AST/NoParensInConditions", "NoParensInConditions.java")), vscExtensionActive = true, internalClassPatterns = listOf())
        assert(response is CompileSuccessResponse)
        response as CompileSuccessResponse
        response.data.asts.forEach { ast ->
            ast.file.descendents().forEach { item ->
                when (item) {
                    is Conditional -> assert(!item.condition.contains("(") && !item.condition.contains(")"))
                    is Switch -> assert(!item.selector.contains("(") && !item.selector.contains(")"))
                }
            }
        }
    }

    private fun AstItem.descendents(): List<AstItem> = listOf(this) + when (this) {
        is AstFile -> classes.flatMap { it.descendents() }
        is Block -> statements.flatMap { it.descendents() }
        is CatchClause -> body.descendents()
        is Class -> methods.flatMap { it.descendents() }
        is IfStatement -> trueCase.descendents() + (falseCase?.descendents() ?: listOf()) + methodCallExpressions
        is Method -> body.descendents()
        is Statement -> methodCallExpressions
        is Switch -> entries.flatMap { it.descendents() } + listOfNotNull(defaultEntry).flatMap { it.descendents() }
        is SwitchEntry -> block.descendents()
        is TryCatchFinally -> (listOf(tryBlock) + catchClauses).flatMap { it.descendents() }
        is Conditional -> trueCase.descendents()
        else -> error("unknown ast item type")

    }

    private fun checkEndOfStatementList(asts: List<AstFile>) {
        asts.flatMap { it.descendents() }.asSequence().filterIsInstance<Method>().map { decl ->
            decl.body.statements.lastOrNull()
        }.filterNotNull()
            .filterIsInstance<Statement>()
            .filter { it.type == StatementType.OTHER }.toList()
            .forEach {
                assert(it.endOfStatementList) { "${it.code} should be last statement within method" }
            }

        asts.flatMap { it.descendents() }.filterIsInstance<Method>()
            .filter { it.body.statements.none { stmt -> stmt is Conditional || stmt is Switch } }
            .flatMap { decl ->
                decl.body.statements.subList(0, decl.body.statements.size - 1)
            }
            .filterIsInstance<Statement>()
            .filter { it.type == StatementType.OTHER }
            .forEach {
                assert(!it.endOfStatementList) { "${it.code} should not be last statement within method" }
            }
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testWrongInClass(testFlags: TestFlags) {
        val name = "WrongInClass"
        val dir = "$INVIZ/$name"
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(dir, listOf("$name.java"), testFlags = testFlags)
        assert(trace.last().loadedClasses.any { it.`class` == name })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testAstHitBox(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$AST/HitBox", listOf("HitBox.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testAstConstructor(testFlags: TestFlags) {
        val directoryPath = "$AST/Constructor"
        val className = "Constructor.java"
        val response = requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        if (response is ErrorResponse) {
            error(response.error)
        }
        if (response is CompileFailResponse) {
            error(response.error)
        }
        assert(((response as CompileSuccessResponse).data.asts[0].file.classes[0].methods[1].body.statements.last() as Statement).endOfStatementList)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun astRepeatedLastStatement(testFlags: TestFlags) {
        callRunToEndAndCompareTestcaseMetadataFiles("$AST/RepeatedLastStatement", listOf("RepeatedLastStatement.java"), testFlags = testFlags)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSpacesInUri(testFlags: TestFlags) {
        val base = "$MULTI_FILE_HANDLING/SpacesInUri/Code/With Spaces"
        assert(
            compiles(
                listOf(
                    Pair("$base/Test.java", "$base/Test.java"),
                    Pair("$base/More  Space/Test2.java", "$base/More  Space/Test2.java")
                ),
                vscExtensionActive = true,
                testFlags = testFlags
            )
        )
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testPatternMatching(testFlags: TestFlags) {
        assertTrue(compiles("/TestCases/ShouldCompile/PatternMatching.java", "PatternMatching.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNoTraceIn(testFlags: TestFlags) {
        val directoryPath = "$MULTI_FILE_HANDLING/NoTraceIn"
        val classNames = listOf("NoTraceIn.java", "inout/In.java", "SomethIn.java")
        val classContents = classNames.map { name ->
            createFilePathAndContent(directoryPath, name)
        }


        val compileResponse = requestCompile(classContents, vscExtensionActive = true)

        assert(compileResponse is CompileSuccessResponse)

        val stepRequest1 = StepOver(1)
        request(stepRequest1)

        val inputRequest1 = Input("1")
        val inputResponse1 = request(inputRequest1)
        val states = (inputResponse1 as InputResponse).data?.traceStates
        assertNotEquals(null, states)
        states!!.forEach { state ->
            assert(state.stack.size < 3) { "entered wrong method" }
        }

        val endRequest = RunToEnd()
        val endResponse = request(endRequest)

        (endResponse as StepResultResponse).data.traceStates.forEach { state ->
            state.loadedClasses.forEach { cls ->
                assert(listOf("SomethIn", "NoTraceIn").contains(cls.`class`)) {
                    "unexpected loaded class ${cls.`class`}"
                }
            }
        }

    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConstructorCall(testFlags: TestFlags) {
        val directoryPath = "$AST/ConstructorCall"
        val className = "ConstructorCall.java"
        val response = requestCompile(listOf(createFilePathAndContent(directoryPath, className)))

        if (response is ErrorResponse) {
            error(response.error)
        }
        if (response is CompileFailResponse) {
            error(response.error)
        }
        val calls = ((response as CompileSuccessResponse).data.asts[0].file.descendents().filterIsInstance<MethodCallExpr>())
        val init = "<init>"
        // val clinit = "<clinit>"
        // TODO: reconsider this test case
        //assertEquals(9, calls.count {it.name==clinit})
        assertEquals(5, calls.count { it.name == init })
        assertEquals(1, calls.count { it.name == "eat" })
        /*val classNames = calls.map { it.className }
        assertEquals("Object", classNames[1])
        assertEquals("Cat", classNames[5])
        // don't check index 2 because className field is incorrect for dynamic calls
        assertEquals("Animal", classNames[9])
        assertEquals("Cat", classNames[12])*/
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testPackageResolutionWithSrc(testFlags: TestFlags) {
        val response = requestCompile(
            listOf(
                createFilePathAndContent("$MULTI_FILE_HANDLING/PackageResolutionWithSrc", "src/pack/A.java"),
                createFilePathAndContent("$MULTI_FILE_HANDLING/PackageResolutionWithSrc", "src/pack/B.java"),
                createFilePathAndContent("$MULTI_FILE_HANDLING/PackageResolutionWithSrc", "src/pack/ErroneousUnused.java"),

                ),
            vscExtensionActive = true
        )
        assert(response is CompileSuccessResponse) {
            (response as CompileFailResponse).error
        }
        val response2 = request(StepOver(0))
        assert(response2 is StepResultResponse)
        response2 as StepResultResponse
        assert(response2.data.traceStates[0].sourceFileUri.contains("src"))
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testAstClassName(testFlags: TestFlags) {
        val response = requestCompile(
            listOf(
                createFilePathAndContent("$AST/ClassName", "This.java"),
                createFilePathAndContent("$AST/ClassName", "pckg1/That.java"),
                createFilePathAndContent("$AST/ClassName", "pckg1/pckg2/Other.java")
            ),
            vscExtensionActive = true
        )
        assert(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
        response as CompileSuccessResponse
        val actual = response.data.asts.flatMap { it.file.classes }.map { it.name }
        assertIterableEquals(listOf("This", "pckg1.That", "pckg1.pckg2.Other", "pckg1.pckg2.Other\$Inner"), actual)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testParseError(testFlags: TestFlags) {
        val response = requestCompile(listOf(createFilePathAndContent("$MISC/ParseError", "ParseError.java")))
        assert(response is CompileFailResponse)
        assert(!(response as CompileFailResponse).error.contains("com.github.javaparser."))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testParseErrorLocation(testFlags: TestFlags) {
        val response = requestCompile(
            listOf(
                createFilePathAndContent("$MISC/ParseErrorLocation", "ParseErrorLocation.java"),
                createFilePathAndContent("$MISC/ParseErrorLocation", "Other.java")
            ),
            vscExtensionActive = true
        )
        assert(response is CompileFailResponse)
        response as CompileFailResponse
        assert(!response.error.contains(COMPILATION_DIR_NAME))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testParseErrorLocation2(testFlags: TestFlags) {
        val response = requestCompile(
            listOf(
                createFilePathAndContent("$MISC/ParseErrorLocation2", "ParseErrorLocation2.java"),
                createFilePathAndContent("$MISC/ParseErrorLocation2", "Other.java")
            )
        )
        assert(response is CompileFailResponse)
        response as CompileFailResponse
        assert(response.error.contains("Other")) { response.error }
        assert(!response.error.contains(COMPILATION_DIR_NAME))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInternalClassPatterns(testFlags: TestFlags) {
        val response = fullTrace(
            listOf(createFilePathAndContent("$MULTI_FILE_HANDLING/InternalClassPatterns", "InternalClassPatterns.java")), false, false,
            INTERNAL_CLASS_PATTERNS + listOf("Internal"),
            testFlags = testFlags
        )
        response.forEach { st ->
            st.heap.filterIsInstance<HeapObject>().flatMap { it.fields }.forEach { assertNotEquals(it.name, "i") }
        }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testLoadedClassClassificationControlsFieldCollection(testFlags: TestFlags) {
        val source = """
            class Ordinary { static int ordinaryStatic = 1; int value = 1; }
            class Stopped { static int stoppedStatic = 2; int hidden = 2; }
            class DataStructure { static int dataStructureStatic = 3; Ordinary child = new Ordinary(); }

            public class Classification {
                public static void main(String[] args) {
                    Ordinary ordinary = new Ordinary();
                    Stopped stopped = new Stopped();
                    DataStructure dataStructure = new DataStructure();
                    System.out.println(ordinary.value + stopped.hidden + dataStructure.child.value);
                }
            }
        """.trimIndent()
        val trace = fullTrace(
            classContents = listOf(FilepathAndContent("Classification.java", source)),
            vscExtensionActive = true,
            checkAst = false,
            internalClassPatterns = emptyList(),
            testFlags = testFlags,
            heapTraversalStopPatterns = listOf("Stopped", "DataStructure"),
            dataStructurePatterns = listOf("DataStructure")
        )
        val state = trace.first { current ->
            current.heap.filterIsInstance<HeapObject>().map { it.type }.containsAll(
                listOf("Ordinary", "Stopped", "DataStructure")
            )
        }

        val ordinaryClass = state.loadedClasses.single { it.`class` == "Ordinary" }
        assertFalse(ordinaryClass.isHeapTraversalStop)
        assertFalse(ordinaryClass.isJavaDataStructure)
        assertTrue(ordinaryClass.hasCollectedFields)
        assertEquals(listOf("ordinaryStatic"), ordinaryClass.staticFields.map { it.name })

        val stoppedClass = state.loadedClasses.single { it.`class` == "Stopped" }
        assertTrue(stoppedClass.isHeapTraversalStop)
        assertFalse(stoppedClass.isJavaDataStructure)
        assertFalse(stoppedClass.hasCollectedFields)
        assertTrue(stoppedClass.staticFields.isEmpty())

        val dataStructureClass = state.loadedClasses.single { it.`class` == "DataStructure" }
        assertTrue(dataStructureClass.isHeapTraversalStop)
        assertTrue(dataStructureClass.isJavaDataStructure)
        assertTrue(dataStructureClass.hasCollectedFields)
        assertEquals(listOf("dataStructureStatic"), dataStructureClass.staticFields.map { it.name })

        val objects = state.heap.filterIsInstance<HeapObject>().associateBy { it.type }
        assertEquals(listOf("value"), objects.getValue("Ordinary").fields.map { it.name })
        assertTrue(objects.getValue("Stopped").fields.isEmpty())
        assertEquals(listOf("child"), objects.getValue("DataStructure").fields.map { it.name })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNoSpuriousInWarning(testFlags: TestFlags) {
        val uri = "$TEST_CASES/Warnings/NoSpuriousInWarning"
        val response = requestCompile(
            listOf(
                createFilePathAndContent(uri, "In.java"),
                createFilePathAndContent(uri, "NoSpuriousInWarning.java")
            ),
            vscExtensionActive = true
        )
        assert(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
        response as CompileSuccessResponse
        assert(response.data.featureWarnings.isEmpty())
    }

    @Test
    fun testParallelStreamsAreRejectedBeforeLaunchingTheDebuggee() {
        val parallelSources = listOf(
            """
                void main() {
                    var names = java.util.List.of("Anne", "Benjamin", "Cici");
                    System.out.println(names.parallelStream().mapToInt(String::length).reduce(0, Math::max));
                }
            """.trimIndent(),
            """
                void main() {
                    var names = java.util.List.of("Anne", "Benjamin", "Cici");
                    System.out.println(names.stream().parallel().mapToInt(String::length).reduce(0, Math::max));
                }
            """.trimIndent(),
            """
                void main() {
                    System.out.println(java.util.stream.IntStream.range(1, 4).parallel().sum());
                }
            """.trimIndent(),
            """
                void main() {
                    var names = java.util.List.of("Anne", "Benjamin", "Cici");
                    System.out.println(names.stream().parallel().sequential().count());
                }
            """.trimIndent()
        )

        parallelSources.forEach { source ->
            val response = requestCompile(listOf(FilepathAndContent("Main.java", source)), vscExtensionActive = true)

            assertTrue(response is CompileFailResponse)
            assertTrue((response as CompileFailResponse).error.contains("Parallel stream execution is unsupported"))
            assertTrue(response.error.contains("sequential stream"))
        }

        val sequentialResponse = requestCompile(
            listOf(FilepathAndContent("Main.java", """
                void main() {
                    var names = java.util.List.of("Anne", "Benjamin", "Cici");
                    System.out.println(names.stream().mapToInt(String::length).reduce(0, Math::max));
                }
            """.trimIndent())),
            vscExtensionActive = true
        )
        assertTrue(sequentialResponse is CompileSuccessResponse) { (sequentialResponse as CompileFailResponse).error }
    }

    @Test
    fun testUserDefinedParallelMethodsAreNotRejected() {
        val source = """
            class Main {
                void parallel() { }
                void parallelStream() { }
                void main() {
                    parallel();
                    parallelStream();
                    System.out.println(8);
                }
            }
        """.trimIndent()

        val response = requestCompile(listOf(FilepathAndContent("Main.java", source)), vscExtensionActive = true)

        assertTrue(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInternalClassPatternsInnerClasses(testFlags: TestFlags) {
        val response = fullTrace(
            listOf(
                createFilePathAndContent("$MULTI_FILE_HANDLING/InternalClassPatternsInnerClasses", "A.java"),
                createFilePathAndContent("$MULTI_FILE_HANDLING/InternalClassPatternsInnerClasses", "B.java")
            ),
            vscExtensionActive = true, checkAst = true,
            INTERNAL_CLASS_PATTERNS + listOf("B"),
            testFlags = testFlags
        )
        response.forEach { assert(!it.stack[0].`class`.contains(("$"))) }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInInsideInout(testFlags: TestFlags) {
        val name = "InInsideInout"
        val dir = "$INVIZ/$name"
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(dir, listOf("$name.java", "inout/In.java"), vscExtensionActive = true, testFlags = testFlags)
        println(jacksonObjectMapper().writeValueAsString(trace.map { it.inputBufferInfo }))

        assert(trace.any { it.inputBufferInfo.future.isNotEmpty() || it.inputBufferInfo.past.isNotEmpty() })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testInInDefaultPackage(testFlags: TestFlags) {
        val name = "InOutsideInout"
        val dir = "$INVIZ/$name"
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(
            dir,
            listOf("$name.java", "In.java"),
            vscExtensionActive = true,
            internalClassPatterns = listOf("In"),
            testFlags = testFlags
        )
        println(jacksonObjectMapper().writeValueAsString(trace.map { it.inputBufferInfo }))

        assert(trace.any { it.inputBufferInfo.future.isNotEmpty() || it.inputBufferInfo.past.isNotEmpty() })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testAstWithAbstractMethod(testFlags: TestFlags) {
        val dir = "$AST/Abstract/Code/Abstract.java"
        assert(compiles(dir, "Abstract.java", testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testAstInterface(testFlags: TestFlags) {
        val dir = "$AST/Interface/Code/"
        assert(compiles(listOf(Pair(dir + "Main.java", "Main.java"), Pair(dir + "Interface.java", "Interface.java")), testFlags = testFlags))
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSyntaxEdgeCases(testFlags: TestFlags) {
        val path = "$AST/SyntaxEdgeCases"
        val response = requestCompile(listOf(createFilePathAndContent(path, "SyntaxEdgeCases.java")))
        assert(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
        response as CompileSuccessResponse
        assertEquals(1, response.data.asts.size)
        val ast = response.data.asts[0]
        val astDescendents = ast.file.descendents()

        val userDefinedMethods = astDescendents.filterIsInstance<Method>().filter { it.begin <= it.end } // some implicit constructors with end = 0 are added during analysis
        val methodBeginLines = setOf(59, 29, 36, 42, 48, 53)
        assertIterableEquals(methodBeginLines, userDefinedMethods.map { it.begin }.toSet())
        val methodEndLines = setOf(143, 33, 39, 45, 50, 55)
        assertIterableEquals(methodEndLines, userDefinedMethods.map { it.end }.toSet())
        val conditions = listOf("x < y?", "x == y?", "int i = 0; i < numbers.length; i++", "j < numbers.length", "k < numbers.length")
        assertIterableEquals(conditions, astDescendents.filterIsInstance<Conditional>().map { it.condition })
        astDescendents.filterIsInstance<Method>().map { it.begin }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMethodCall(testFlags: TestFlags) {
        val path = "$AST/MethodCall"
        val response = requestCompile(listOf(createFilePathAndContent(path, "MethodCall.java")))
        assert(response is CompileSuccessResponse) { (response as CompileFailResponse).error }
        response as CompileSuccessResponse
        val astFile = response.data.asts[0].file
        val methodCallExpressions = astFile.descendents().filterIsInstance<MethodCallExpr>()

        val foo1 = methodCallExpressions.find { it.name == "foo" && it.begin == 3 }
        val con1 = methodCallExpressions.find { it.name == "<init>" && it.begin == 4 }
        val bar1 = methodCallExpressions.find { it.name == "bar" && it.begin == 5 }
        val buzz1 = methodCallExpressions.find { it.name == "buzz" }
        val println1 = methodCallExpressions.find { it.name == "println" }
        val con2 = methodCallExpressions.find { it.begin == 8 }
        val con3 = methodCallExpressions.find { it.begin == 9 }
        val foo2 = methodCallExpressions.find { it.name == "foo" && it.begin == 10 }
        val foo3 = methodCallExpressions.find { it.name == "foo" && it.begin == 11 }
        val con4 = methodCallExpressions.find { it.begin == 12 }
        val foo4 = methodCallExpressions.find { it.name == "foo" && it.begin == 13 }

        val res = buildMap {
            methodCallExpressions.forEach { expr ->
                val methods = astFile.descendents().filterIsInstance<Method>().filter { method -> expr.candidates.contains(method.uuid) }
                put(expr, methods)
            }
        }

        listOf(foo1, con1, con3, con4, buzz1, foo2, foo3, foo4).forEach {
            assertEquals(1, res[it]!!.size) {
                it.toString()
            }
        }

        assertEquals(16, res[foo1]!![0].begin)
        assertEquals("A", res[con1]!![0].className)
        assertIterableEquals(
            res[bar1]!!.map { it.begin },
            listOf(26, 32, 41)
        )
        assertEquals(28, res[buzz1]!![0].begin)
        assert(res[println1]!!.isEmpty())
        assert(res[con2]!!.isEmpty())
        assertEquals("Base", res[con3]!![0].className)
        assertEquals(18, res[foo2]!![0].begin)
        assertEquals(20, res[foo3]!![0].begin)
        assertEquals("B", res[con4]!![0].className)
        assertEquals(22, res[foo4]!![0].begin)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testErrorMessage(testFlags: TestFlags) {
        val path = "$MISC/ErrorMessage"
        val response = requestCompile(
            listOf(
                createFilePathAndContent(path, "p/A.java"),
                createFilePathAndContent(path, "p/Main.java")
            ),
            vscExtensionActive = false
        )
        assert(response is CompileFailResponse)
        response as CompileFailResponse
        assert(!response.error.contains("duplicate"), { "incorrect error message: ${response.error}" })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testUriInInitialState(testFlags: TestFlags) {
        val actualPath = "$MULTI_FILE_HANDLING/UriInInitialState/Code/"
        val actualFile = "UriInInitialState.java"
        val name1 = "src/random/name/UriInInitialState.java"
        val trace1 = fullTrace(
            listOf(
                FilepathAndContent(
                    name1,
                    getResourceAsReader(actualPath, actualFile)?.readText() ?: error("file not found in $actualPath")
                )
            ),
            true,
            false,
            null,
            testFlags = testFlags
        )
        trace1.forEach { state -> assertEquals(name1, state.sourceFileUri) }
        val name2 = "UriInInitialState.java"
        val trace2 = fullTrace(
            listOf(
                FilepathAndContent(
                    name2,
                    getResourceAsReader(actualPath, actualFile)?.readText() ?: error("file not found in $actualPath")
                )
            ),
            false,
            false,
            null,
            testFlags = testFlags
        )
        trace2.forEach { state -> assertEquals(name2, state.sourceFileUri) }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testNoParseErrorCrash(testFlags: TestFlags) {
        val response = requestCompile(
            listOf(
                createFilePathAndContent("$MISC/NoParseErrorCrash", "HelloWorld.java"),
                createFilePathAndContent("$MISC/NoParseErrorCrash", "NoHelloWorld.java")
            )
        )
        assert(response !is ErrorResponse)
    }


    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSteppingLogic(testFlags: TestFlags) {
        val response1 = requestCompile(
            listOf(
                createFilePathAndContent("$BASIC_LANGUAGE_STRUCTURES/SteppingLogic", "Sum1.java"),
            )
        )
        assertTrue(response1 is CompileSuccessResponse)
        var response: Response
        val sizes1 = mutableListOf<Int>()
        while (true) {
            response = request(StepOver(1))
            if (response !is StepResultResponse || !response.data.isVMRunning) break
            sizes1.add(response.data.traceStates.size)
        }

        val response2 = requestCompile(
            listOf(
                createFilePathAndContent("$BASIC_LANGUAGE_STRUCTURES/SteppingLogic", "Sum2.java"),
            )
        )
        assertTrue(response2 is CompileSuccessResponse)
        val sizes2 = mutableListOf<Int>()
        while (true) {
            response = request(StepOver(1))
            if (response !is StepResultResponse || !response.data.isVMRunning) break
            sizes2.add(response.data.traceStates.size)
        }

        assertIterableEquals(sizes1, sizes2)
    }

    @ParameterizedTest
    @MethodSource("storedStreamReduceCases")
    fun testStoredStreamReduce(
        fixture: StoredStreamFixture,
        reduction: StoredStreamReduction,
        receiver: ReceiverKind
    ) {
        val source = if (receiver == ReceiverKind.PARAMETER) {
            """
                public class Main {
                    public static void main(String[] args) { main(${fixture.factoryExpression}); }
                    static void main(${fixture.streamType} stream) {
                        var result = ((stream))
                            .${reduction.call};
                        System.out.println(result);
                    }
                }
            """.trimIndent().replace("\n", "\r\n")
        } else {
            """
                void main() {
                    var stream = ${fixture.factoryExpression};
                    var result = stream.${reduction.call};
                    System.out.println(result);
                }
            """.trimIndent()
        }
        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())
        assertOutputEquals(trace, "${reduction.printedResult}\n")
        assertErrorEquals(trace, "")
        val visualization = trace.last { it.streamVisualizationData.streams.any { stream -> stream.parentStreamId == null && stream.marbles.isNotEmpty() } }
            .latestTopLevelStreamData()
        val sourceOperation = "of"
        assertEquals(listOf(sourceOperation, "reduce"), visualization.operationLanes.values.map { it.operation })
        assertEquals(fixture.sourceValues, visualization.marbles.filter { it.operation == sourceOperation }.map { it.label })
        assertEquals(reduction.visualizationResult, visualization.marbles.last { it.operation == "reduce" }.label)
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testStoredStreamReduceSuccessivePipelines(testFlags: TestFlags) {
        val source = """
            void main() {
                var first = java.util.stream.IntStream.of(4, 8, 4);
                int maximum = first.reduce(0, Math::max);
                System.out.println(maximum);
                var second = java.util.stream.IntStream.of(10, 20, 30).map(value -> value + 1);
                int sum = second.reduce(0, Integer::sum);
                System.out.println(sum);
            }
        """.trimIndent()
        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = testFlags)
        assertOutputEquals(trace, "8\n63\n")
        assertErrorEquals(trace, "")
        val visualizations = trace.last().streamVisualizationData.streams.filter { it.marbles.isNotEmpty() }
            .filter { it.parentStreamId == null }
        assertEquals(2, visualizations.size)
        assertEquals(listOf("of", "reduce"), visualizations[0].operationLanes.values.map { it.operation })
        assertEquals(listOf("of", "map", "reduce"), visualizations[1].operationLanes.values.map { it.operation })
        assertEquals(listOf(listOf("4", "8", "4"), listOf("10", "20", "30")),
            visualizations.map { visualization -> visualization.marbles.filter { it.operation == "of" }.map { it.label } })
        assertEquals(listOf("11", "21", "31"), visualizations[1].marbles.filter { it.operation == "map" }.map { it.label })
        assertEquals(listOf("8", "63"), visualizations.map { it.marbles.last { marble -> marble.operation == "reduce" }.label })
    }

    @Test
    fun testStoredIntermediateStreamPipelineVisualization() {
        val source = """
            import java.util.OptionalInt;
            import java.util.stream.IntStream;
            import java.util.stream.Stream;

            public class Main {
                public static void main(String[] args) {
                    Stream<String> names = Stream.of("Max", "Susi", "Maya");
                    Stream<String> mnames = names.filter(x -> x.charAt(0) == 'M');
                    IntStream nameLengths = mnames.mapToInt(x -> x.length());
                    OptionalInt maximum = nameLengths.max();
                    System.out.println(maximum);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "OptionalInt[4]\n")
        val visualization = trace.last().latestTopLevelStreamData()
        assertEquals(
            listOf("of", "filter", "mapToInt", "max"),
            visualization.operationLanes.values.map { it.operation }
        )
        assertEquals(listOf("Max", "Susi", "Maya"), visualization.marbles.filter { it.operation == "of" }.map { it.label })
        assertEquals(listOf("3", "4"), visualization.marbles.filter { it.operation == "mapToInt" }.map { it.label })
        assertEquals("4", visualization.marbles.last { it.operation == "max" }.label)
    }

    @Test
    fun testReturnedStreamSourcePipelineVisualization() {
        val source = """
            import java.util.stream.Stream;

            public class Main {
                Stream<String> source() {
                    return Stream.of("Max", "Susi", "Maya");
                }

                void main() {
                    long count = source().filter(x -> x.charAt(0) == 'M').count();
                    System.out.println(count);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "2\n")
        val visualization = trace.last().latestTopLevelStreamData()
        assertEquals(listOf("of", "filter", "count"), visualization.operationLanes.values.map { it.operation })
        assertEquals(listOf("Max", "Susi", "Maya"), visualization.marbles.filter { it.operation == "of" }.map { it.label })
        assertEquals(listOf("Max", "Susi", "Maya"), visualization.marbles.filter { it.operation == "filter" }.map { it.label })
        assertTrue(visualization.marbles.any { it.operation == "count" })
    }

    @Test
    fun testDirectStreamSourceParameterPipelineVisualization() {
        val source = """
            import java.util.stream.Stream;

            public class Main {
                public static void main(String[] args) {
                    consume(Stream.of("Max", "Susi", "Maya"));
                }

                static void consume(Stream<String> stream) {
                    long count = stream.filter(x -> x.charAt(0) == 'M').count();
                    System.out.println(count);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "2\n")
        val visualization = trace.last { it.streamVisualizationData.streams.any { stream -> stream.parentStreamId == null && stream.marbles.isNotEmpty() } }
            .latestTopLevelStreamData()
        assertEquals(listOf("of", "filter", "count"), visualization.operationLanes.values.map { it.operation })
        assertEquals(listOf("Max", "Susi", "Maya"), visualization.marbles.filter { it.operation == "of" }.map { it.label })
        assertTrue(visualization.marbles.any { it.operation == "count" })
    }

    @Test
    fun testEmptyTopLevelStreamCompletesWithoutStartEvent() {
        val source = """
            import java.util.stream.Stream;

            public class Main {
                public static void main(String[] args) {
                    long count = Stream.<String>empty().count();
                    System.out.println(count);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "0\n")
        val stream = trace.last().streamVisualizationData.streams.single { it.parentStreamId == null }
        assertEquals(listOf("count"), stream.operationLanes.values.map { it.operation })
        assertTrue(stream.marbles.any { it.operation == "count" && it.label == "0" })
    }

    @Test
    fun testPrimitiveFlatMapCreatesChildExecutions() {
        val source = """
            import java.util.stream.IntStream;

            public class Main {
                public static void main(String[] args) {
                    int result = IntStream.of(1, 2)
                            .flatMap(value -> IntStream.of(value, value + 10))
                            .sum();
                    System.out.println(result);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "26\n")
        val streams = trace.last().streamVisualizationData.streams
        val parent = streams.single { it.parentStreamId == null }
        val children = streams.filter { it.parentStreamId == parent.id }
        assertEquals(2, children.size)
        assertEquals(listOf("of", "flatMap", "sum"), parent.operationLanes.values.map { it.operation })
        children.forEach { child ->
            assertEquals(listOf("of"), child.operationLanes.values.map { it.operation })
        }
    }

    @Test
    fun testEmptyFlatMapChildrenRemainVisible() {
        val source = """
            import java.util.stream.Stream;

            public class Main {
                public static void main(String[] args) {
                    long result = Stream.of(1, 2).flatMap(value -> Stream.<String>empty()).count();
                    System.out.println(result);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "0\n")
        val streams = trace.last().streamVisualizationData.streams
        val parent = streams.single { it.parentStreamId == null }
        val children = streams.filter { it.parentStreamId == parent.id }
        assertEquals(2, children.size)
        children.forEach { child ->
            assertTrue(child.marbles.isEmpty())
            assertTrue(child.operationLanes.isEmpty())
        }
    }

    /**
     * Documents the missing generalized child boundary for streams created by callbacks.
     * This currently fails when enabled because the comparator stream is not reliably attached
     * to the enclosing sorted execution; future work must propagate an explicit callback-child
     * parent context and restore it when the callback's terminal operation completes.
     */
    @Disabled("Pending generalized callback-created stream execution nesting")
    @Test
    fun testStreamCreatedInsideSortedComparatorGetsChildExecution() {
        val source = """
            import java.util.stream.Stream;

            public class Main {
                public static void main(String[] args) {
                    String result = Stream.of("a", "bbb", "cc")
                            .sorted((left, right) -> Stream.of(left, right).count() == 2 ? 0 : 1)
                            .findFirst()
                            .orElse("empty");
                    System.out.println(result);
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())

        assertOutputEquals(trace, "a\n")
        val streams = trace.last().streamVisualizationData.streams
        val parent = streams.single { it.operationLanes.values.any { lane -> lane.operation == "findFirst" } }
        val child = streams.single { it.parentStreamId == parent.id }
        assertTrue(child.operationLanes.values.any { it.operation == "count" })
    }

    /** Verifies that terminal reduce results survive when no accumulator callback runs. */
    @ParameterizedTest(name = "{0}")
    @MethodSource("reduceCompletionCases")
    fun testReduceCompletionWithoutAccumulatorInvocation(context: String, testCase: ReduceCompletionCase) {
        val trace = fullTrace(listOf(FilepathAndContent("Main.java", testCase.source)), checkAst = false, testFlags = TestFlags())
        assertOutputEquals(trace, testCase.printedResult)
        assertErrorEquals(trace, "")

        val visualization = trace.last().latestTopLevelStreamData()
        assertEquals(testCase.operationLanes, visualization.operationLanes.values.map { it.operation }, context)
        val reduceMarbles = visualization.marbles.filter { it.operation == "reduce" }
        assertEquals(testCase.expectedReduceMarbles, reduceMarbles.size, context)
        assertEquals(testCase.visualizationResult, reduceMarbles.last().label, context)
        if (context == "all inputs filtered out" || context.startsWith("empty ")) {
            assertTrue(visualization.links.none { link -> link.target == reduceMarbles.single().marbleKey }, context)
        }
    }

    /** Constructor instrumentation is retained, while static-initializer events before main are ignored. */
    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testConstructorStreamsAreCapturedOnlyAfterMain(testFlags: TestFlags) {
        val source = """
            public class Main {
                static final Holder BEFORE_MAIN = new Holder();

                public static void main(String[] args) {
                    new Holder();
                }

                static class Holder {
                    Holder() {
                        java.util.stream.IntStream.of(1, 2).forEach(value -> { });
                    }
                }
            }
        """.trimIndent()

        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = testFlags)
        val streams = trace.last().streamVisualizationData.streams.filter { it.parentStreamId == null && it.marbles.isNotEmpty() }

        assertEquals(1, streams.size)
        assertEquals(listOf("of", "forEach"), streams.single().operationLanes.values.map { it.operation })
        assertEquals(listOf("1", "2"), streams.single().marbles.filter { it.operation == "of" }.map { it.label })
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("streamValueExpressionCases")
    fun testValueReturningStreamInExpressionContexts(context: String, source: String, expectedOutput: String) {
        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = TestFlags())
        assertOutputEquals(trace, expectedOutput)
        assertErrorEquals(trace, "")
        val visualization = trace.last { it.streamVisualizationData.streams.any { stream -> stream.parentStreamId == null && stream.marbles.isNotEmpty() } }
            .latestTopLevelStreamData()
        assertEquals(listOf("stream", "mapToInt", "reduce"), visualization.operationLanes.values.map { it.operation }, context)
        assertEquals("8", visualization.marbles.last { it.operation == "reduce" }.label, context)
    }

    /** A rebuilt diagram must reach the client even when main returns on the pipeline's line. */
    @ParameterizedTest
    @MethodSource("sameLineStreamCases")
    fun testSameLineStreamCompletion(compact: Boolean, sameLineBrace: Boolean, navigation: String, terminal: String) {
        val opening = if (compact) "void main() {" else "public class Main { public static void main(String[] args) {"
        val closing = if (compact) "}" else "} }"
        val terminalCall = if (terminal == "reduce") "reduce(0, Math::max)" else "sum()"
        val source = opening + "\n" +
                "var names = java.util.List.of(\"Anne\", \"Benjamin\", \"Cici\");\n" +
                "int result = names.stream().mapToInt(String::length).$terminalCall;" +
                (if (sameLineBrace) " " else "\n") + closing
        val compiled = requestCompile(listOf(FilepathAndContent("Main.java", source)))
        assertTrue(compiled is CompileSuccessResponse) { compiled.toString() }
        val initialStates = (compiled as CompileSuccessResponse).data.firstStepResult.traceStates
        val trace = initialStates.toMutableList()
        var running = true
        var requests = 0
        while (running && requests++ < 100) {
            val command = when (navigation) {
                "run" -> RunToEnd()
                "into" -> StepInto()
                else -> StepOver(1)
            }
            val response = request(command)
            assertTrue(response is StepResultResponse) { response.toString() }
            val result = (response as StepResultResponse).data
            assertFalse(result.isWaitingForInput)
            trace.addAll(result.traceStates)
            running = result.isVMRunning
        }
        assertFalse(running, "debuggee must terminate within the step bound")
        val visualization = trace.last().latestTopLevelStreamData()
        assertEquals(9, visualization.marbles.size)
        assertEquals(setOf("stream", "mapToInt", terminal), visualization.operationLanes.values.map { it.operation }.toSet())
        assertEquals(if (terminal == "reduce") "8" else "16", visualization.marbles.last { it.operation == terminal }.label)
        assertEquals(
            at.jku.ssw.wsdebug.debugger.recording.PrimitiveVal(if (terminal == "reduce") "8" else "16"),
            trace.last().stack.first().localVariables.single { it.name == "result" }.value,
            "the final diagram must accompany the live completed user frame"
        )
        assertEquals(1, trace.count { it.streamVisualizationData.streams.any { stream -> stream.marbles.isNotEmpty() } }, "do not duplicate the final snapshot")
        assertTrue(initialStates.all { it.streamVisualizationData.streams.all { stream -> stream.marbles.isEmpty() } }, "earlier snapshots must remain unchanged")
    }

    /** Other main overloads and recursive entries must not consume the entry invocation's exit capture. */
    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testSameLineStreamAfterOtherMainInvocations(testFlags: TestFlags) {
        val source = """
            public class Main {
                static boolean entered;
                public static void main(String[] args) {
                    if (!entered) {
                        entered = true;
                        main(args);
                        main(1);
                        entered = false;
                    }
                    int result = java.util.stream.IntStream.of(4, 8, entered ? 9 : 10).reduce(0, Math::max); }
                static void main(int ignored) { }
            }
        """.trimIndent()
        val trace = fullTrace(listOf(FilepathAndContent("Main.java", source)), checkAst = false, testFlags = testFlags)
        assertEquals("10", trace.last().latestTopLevelStreamData().marbles.last { it.operation == "reduce" }.label)
        assertEquals("([Ljava/lang/String;)V", trace.last().stack.first().signature)
        assertEquals(1, trace.last().stack.count { it.method == "main" })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testMultipleStreamVisualizationStatements(testFlags: TestFlags) {
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(
            "$STREAM_VISUALIZATION/MultipleStreamTest",
            listOf("MultipleStreamTest.java"),
            checkAst = false,
            testFlags = testFlags
        )

        val streamVisualizations = trace.last().streamVisualizationData.streams
            .filter { it.parentStreamId == null }

        assertEquals(6, streamVisualizations.size)
        assertTrue(streamVisualizations.isNotEmpty()) { "trace should contain stream visualization info" }
        streamVisualizations.forEach { visualization ->
            assertTrue(visualization.marbles.isNotEmpty()) { "stream visualization should contain marbles" }
            assertTrue(visualization.operationLanes.isNotEmpty()) { "stream visualization should contain operation lines" }
        }

        val operationNames = streamVisualizations.map { visualization ->
            visualization.operationLanes.values.map { it.operation }
        }.distinct()

        assertEquals(
            listOf(
                listOf("generate", "distinct", "limit", "forEach"),
                listOf("generate", "limit", "distinct", "forEach"),
                listOf("stream", "filter", "map", "forEach"),
                listOf("stream", "flatMap", "distinct", "count"),
                listOf("stream", "filter", "toList"),
                listOf("stream", "collect")
            ),
            operationNames
        )

        val flatMapStream = streamVisualizations.single { stream ->
            stream.operationLanes.values.any { it.operation == "flatMap" }
        }
        val childStreams = trace.last().streamVisualizationData.streams.filter { it.parentStreamId != null }
        assertEquals(4, childStreams.size)
        assertEquals(setOf(flatMapStream.id), childStreams.map { it.parentStreamId }.toSet())
        childStreams.forEach { child ->
            assertEquals(listOf("chars", "mapToObj"), child.operationLanes.values.map { it.operation })
            assertTrue(child.marbles.none { marble -> marble.operation in setOf("flatMap", "distinct", "count") })
        }
        assertTrue(flatMapStream.operationLanes.values.none { it.operation == "mapToObj" })
    }

    @Test
    fun testFullStreamExamplesRuntimeVisualizations() {
        val trace = fullTrace(
            listOf(
                FilepathAndContent("Main.java", "public class Main { public static void main(String[] args) { StreamExamples.main(args); } }") ,
                createFilePathAndContent("$STREAM_VISUALIZATION/StreamExamples", "StreamExamples.java")
            ),
            vscExtensionActive = true,
            checkAst = false,
            testFlags = TestFlags()
        )

        val streams = trace.last().streamVisualizationData.streams
        val topLevelStreams = streams.filter { it.parentStreamId == null }
        val childStreams = streams.filter { it.parentStreamId != null }

        assertEquals(9, topLevelStreams.size)
        assertEquals(5, childStreams.size)
        assertEquals(14, streams.size)
        assertTrue(topLevelStreams.all { it.marbles.isNotEmpty() && it.operationLanes.isNotEmpty() })

        val flatMapParents = topLevelStreams.filter { stream ->
            stream.operationLanes.values.any { it.operation == "flatMap" }
        }
        assertEquals(2, flatMapParents.size)
        assertEquals(listOf(2, 3), flatMapParents.map { parent ->
            val children = childStreams.filter { it.parentStreamId == parent.id }
            children.forEach { child ->
                assertEquals(listOf("chars", "mapToObj"), child.operationLanes.values.map { it.operation })
                assertTrue(child.marbles.isNotEmpty())
            }
            children.size
        })

        assertEquals(3, topLevelStreams.count { it.operationLanes.values.any { lane -> lane.operation == "count" } })
        assertEquals(6, topLevelStreams.count { it.operationLanes.values.any { lane -> lane.operation == "findFirst" } })
        assertTrue(topLevelStreams.any { stream -> stream.marbles.any { it.operation == "count" && it.label == "8" } })
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testStreamPipelinesInStaticInstanceAndSeparateFileHelpers(testFlags: TestFlags) {
        val main = FilepathAndContent(
            "Main.java",
            """
                import java.util.List;

                public class Main {
                    void main() {
                        var names = List.of("Anne", "Benjamin", "Cici");
                        System.out.println(staticMaximum(names));
                        System.out.println(instanceMaximum(names));
                        System.out.println(Helper.maximum(names));
                    }

                    static int staticMaximum(List<String> names) {
                        return names.stream().mapToInt(String::length).reduce(0, Math::max);
                    }

                    int instanceMaximum(List<String> names) {
                        return names.stream().mapToInt(String::length).reduce(0, Math::max);
                    }
                }
            """.trimIndent()
        )
        val helper = FilepathAndContent(
            "Helper.java",
            """
                import java.util.List;

                public class Helper {
                    static int maximum(List<String> names) {
                        return names.stream().mapToInt(String::length).reduce(0, Math::max);
                    }
                }
            """.trimIndent()
        )

        val trace = fullTrace(listOf(main, helper), checkAst = false, testFlags = testFlags)
        assertOutputEquals(trace, "8\n8\n8\n")
        val streams = trace.last().streamVisualizationData.streams.filter { it.parentStreamId == null }
        assertEquals(3, streams.size)
        streams.forEach { stream ->
            assertEquals(listOf("stream", "mapToInt", "reduce"), stream.operationLanes.values.map { it.operation })
            assertEquals("8", stream.marbles.last { it.operation == "reduce" }.label)
        }
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testOperationAfterCollect(testFlags: TestFlags) {
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(
            "$STREAM_VISUALIZATION/OperationAfterCollectTest",
            listOf("OperationAfterCollectTest.java"),
            checkAst = false,
            testFlags = testFlags
        )

        assertOutputEquals(trace, "The names of all persons are AnneBenCiciDon, that's all\n")
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testOperationAfterMin(testFlags: TestFlags) {
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(
            "$STREAM_VISUALIZATION/OperationAfterMin",
            listOf("OperationAfterMin.java"),
            checkAst = false,
            testFlags = testFlags
        )

        assertOutputEquals(trace, "Optional[Ben] is the shortest first name\n")
    }

    @ParameterizedTest
    @MethodSource("at.jku.ssw.wsdebug.communication.TestFlags#allTestFlagCombinations")
    fun testStreamFieldDeclarationIsNotInstrumented(testFlags: TestFlags) {
        val trace = callRunToEndAndCompareTestcaseMetadataFiles(
            "$STREAM_VISUALIZATION/StreamFieldDeclaration",
            listOf("StreamFieldDeclaration.java"),
            checkAst = false,
            testFlags = testFlags
        )

        assertOutputEquals(trace, "Optional[Ben]\n")
        assertTrue(trace.none { it.streamVisualizationData.streams.any { stream -> stream.operationLanes.isNotEmpty() } }) {
            "field declaration stream operations should not emit stream visualization info"
        }
    }
}

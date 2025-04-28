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
import at.jku.ssw.wsdebug.debugger.recording.TraceState
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import java.io.InputStreamReader
import java.net.InetSocketAddress


internal class DebugWebSocketServerTest {
    private lateinit var server: DebugWebSocketServer

    companion object {
        const val PORT = 50000 // does not matter, as we never connect to the server
        const val TEST_CASES = "/TestCases"
        const val BASIC_LANGUAGE_STRUCTURES = "$TEST_CASES/BasicLanguageStructures"
        const val MULTI_FILE_HANDLING = "$TEST_CASES/MultiFileHandling"
        const val ARRAY_ACCESS_TRACING = "$TEST_CASES/ArrayAccessTracing"
        const val MISC = "$TEST_CASES/Misc"
        const val AST = "$TEST_CASES/Ast"
        const val INPUT = "$TEST_CASES/Input"
        const val INVIZ = "$TEST_CASES/InViz"
    }

    @BeforeEach
    fun setUp() {
        server = DebugWebSocketServer(InetSocketAddress(PORT))
        server.start()
    }

    private fun request(req: Request): Response {
        return server.generateResponse(jacksonObjectMapper().writeValueAsString(req))
    }

    private fun requestCompile( // method for setting common default parameters
        classContents: List<FilepathAndContent>, vscExtensionActive: Boolean = false, internalClassPatterns: List<String>? = null,
        openEditorLocalUri: String? = null
    ): Response {
        return request(
            Compile(classContents, vscExtensionActive, internalClassPatterns, openEditorLocalUri )
        )
    }

    private fun fullTrace(
        classContents: List<FilepathAndContent>, vscExtensionActive: Boolean = false, checkAst: Boolean = true, internalClassPatterns: List<String>? = null,
        openEditorLocalUri: String? = null,
        testFlags: TestFlags
    ):
            List<TraceState> {
        val response = requestCompile(classContents, vscExtensionActive, internalClassPatterns, openEditorLocalUri)



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
        assert(result is StepResultResponse)

        return firstStates + (result as StepResultResponse).data.traceStates
    }

    private fun fullTrace(path: String, testFlags: TestFlags): List<TraceState> {
        val file = FilepathAndContent(
            path.split("Code/")[1], javaClass.getResourceAsStream(
                path
            )?.reader()?.readText() ?: error("file $path not found")
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
        assertEquals(traceError, error) { listOf("incorrect error:", traceError, "expected error:", error).joinToString("\n") }
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

        val trace = fullTrace(classContents, vscExtensionActive = vscExtensionActive, checkAst = checkAst, internalClassPatterns = internalClassPatterns, openEditorLocalUri, testFlags)

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
            ?.let { output -> assertErrorEquals(trace, output) }

        // Check if number of evaluated conditions is correct if numberOfEvaluatedConditionsInTopStackFrame.txt is present in directoryPath
        getResourceAsReader(directoryPath, "numberOfEvaluatedConditionsInTopStackFrame.txt")
            ?.readLines()
            ?.map { Integer.parseInt(it) }
            ?.let { nEvaluated -> assertNumberOfEvaluatedConditionsInTopStackFrameEquals(trace, nEvaluated) }

        return trace
    }

    private fun getResourceAsReader(directoryPath: String, resource: String): InputStreamReader? {
        return javaClass.getResourceAsStream("$directoryPath/$resource")?.reader()
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
    fun testNotCompilesMainDynamic(testFlags: TestFlags) {
        assertFalse(compiles("/TestCases/ShouldNotCompile/NoMainDynamic.java", "NoMainDynamic.java", testFlags = testFlags))
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
        assertTrue(outerClassMatchesOuterClassPattern("inout.In", internalClassPatterns = INTERNAL_CLASS_PATTERNS))
        assertTrue(outerClassMatchesOuterClassPattern("jdk.\$InternalDummyClassName1234", internalClassPatterns = INTERNAL_CLASS_PATTERNS))
        assertTrue(outerClassMatchesOuterClassPattern("dummy.packaage123.In", internalClassPatterns = INTERNAL_CLASS_PATTERNS))
        assertFalse(outerClassMatchesOuterClassPattern("SomethIn", internalClassPatterns = INTERNAL_CLASS_PATTERNS))
        assertFalse(outerClassMatchesOuterClassPattern("jdk", internalClassPatterns = INTERNAL_CLASS_PATTERNS))
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

        val evaluatedAssignmentTargetIDs = listOf(
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
            evaluatedAssignmentTargetIDs,
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

        val sep = System.lineSeparator()
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
        assertEquals(9, inputResponse1.data!!.traceStates[0].line)
        assertEquals(4, inputResponse1.data!!.traceStates[1].line)
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
            inputResponse1.data!!.traceStates, mutableListOf(
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
            inputResponse2.data!!.traceStates, mutableListOf(
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
            inputResponse3.data!!.traceStates, mutableListOf(
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
        assert(stepResponse.data.traceStates.last().error.contains("java.lang.OutOfMemoryError"))
    }

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

        assertIterableEquals(inputBufferInfo.map { it.past }, trace.map { it.inputBufferInfo.past })
        assertIterableEquals(inputBufferInfo.map { it.future }, trace.map { it.inputBufferInfo.future })
    }

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
            items.filterIsInstance<Conditional>().forEach {item -> addAll(item.methodCallExpressions)}
            items.filterIsInstance<Statement>().forEach {item -> addAll(item.methodCallExpressions)}
        }

        methodCallExpressions.forEach {expression ->
            if(expression.name == CONSTRUCTOR_NAME) {
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
                assert(listOf("SomethIn", "NoTraceIn").contains(cls.`class`))
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
    fun testInOutsideInout(testFlags: TestFlags) {
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
        while(true) {
            response = request(StepOver(1))
            if(response !is StepResultResponse || !response.data.isVMRunning) break
            sizes1.add(response.data.traceStates.size)
        }

        val response2 = requestCompile(
            listOf(
                createFilePathAndContent("$BASIC_LANGUAGE_STRUCTURES/SteppingLogic", "Sum2.java"),
            )
        )
        assertTrue(response2 is CompileSuccessResponse)
        val sizes2 = mutableListOf<Int>()
        while(true) {
            response = request(StepOver(1))
            if(response !is StepResultResponse || !response.data.isVMRunning) break
            sizes2.add(response.data.traceStates.size)
        }

        assertIterableEquals(sizes1, sizes2)
    }


    @AfterEach
    fun tearDown() {
        server.stop()
    }

}

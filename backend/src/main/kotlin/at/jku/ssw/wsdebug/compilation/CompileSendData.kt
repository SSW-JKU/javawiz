package at.jku.ssw.wsdebug.compilation

import at.jku.ssw.wsdebug.compilation.ast.AbstractSyntaxTree
import at.jku.ssw.wsdebug.debugger.recording.StepResult

data class CompileSendData(
    val success: Boolean,
    val compileOutput: String,
    val asts: List<AbstractSyntaxTree>,
    val firstStepResult: StepResult,
    val compiledClasses: List<String>,
    val featureWarnings: List<String>
) {
    constructor(compileResult: CompileResult, firstStepResult: StepResult, compiledClasses: List<String>, asts: List<AbstractSyntaxTree>, featureWarnings: List<String>) : this(
        compileResult.success,
        compileResult.compileOutput,
        asts,
        firstStepResult,
        compiledClasses,
        featureWarnings
    )
}

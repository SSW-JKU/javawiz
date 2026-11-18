package at.jku.ssw.wsdebug.compilation

import at.jku.ssw.wsdebug.communication.PetAnnotation
import at.jku.ssw.wsdebug.compilation.ast.AbstractSyntaxTree
import at.jku.ssw.wsdebug.debugger.recording.StepResult
import java.nio.file.Path

/**
 * Absolute path of the java program that runs this backend, for example
 * `/usr/lib/jvm/java-25-openjdk-amd64/bin/java`. The user's program is compiled and run by the same JDK,
 * so the frontend shows this path to tell users which Java JavaWiz uses.
 * `ProcessHandle.info().command()` asks the operating system for the path of the running program. If it
 * cannot tell, the path is derived from the `java.home` system property of this JVM instead.
 */
val JAVA_EXECUTABLE: String = ProcessHandle.current().info().command()
    .orElse(Path.of(System.getProperty("java.home"), "bin", "java").toString())

data class CompileSendData(
    val success: Boolean,
    val compileOutput: String,
    val asts: List<AbstractSyntaxTree>,
    val firstStepResult: StepResult,
    val compiledClasses: List<String>,
    val featureWarnings: List<String>,
    val pets: List<PetAnnotation>,
    val javaExecutable: String = JAVA_EXECUTABLE
) {
    constructor(compileResult: CompileResult, firstStepResult: StepResult, compiledClasses: List<String>, asts: List<AbstractSyntaxTree>, featureWarnings: List<String>, pets: List<PetAnnotation>) :
            this(
        compileResult.success,
        compileResult.compileOutput,
        asts,
        firstStepResult,
        compiledClasses,
        featureWarnings,
        pets
    )
}

package at.jku.ssw.wsdebug.compilation.ast
import at.jku.ssw.wsdebug.compilation.ast.lang.AstFile

data class AbstractSyntaxTree(
    val file: AstFile,
    val localFileUri: String
)

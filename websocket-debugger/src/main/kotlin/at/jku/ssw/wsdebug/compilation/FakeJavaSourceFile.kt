package at.jku.ssw.wsdebug.compilation

import at.jku.ssw.wsdebug.communication.FilepathAndContent
import java.io.IOException
import java.net.URI
import javax.tools.JavaFileObject
import javax.tools.SimpleJavaFileObject

class FakeJavaSourceFile(
    val contents: FilepathAndContent
) : SimpleJavaFileObject(
    URI(contents.localUri.replace(" ", "%20")),
    JavaFileObject.Kind.SOURCE
) {

    @Throws(IOException::class)
    override fun getCharContent(ignoreEncodingErrors: Boolean): CharSequence {
        return contents.content
    }
}

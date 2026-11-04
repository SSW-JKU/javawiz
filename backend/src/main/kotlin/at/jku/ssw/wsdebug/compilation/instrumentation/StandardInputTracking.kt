@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.tools.javac.code.Flags
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeInfo

/** Zero-based source position at which the main class's standard input tracking field is inserted. */
data class StandardInputTrackingSite(val line: Int, val column: Int)

/**
 * Finds the position directly before the first member in the body of [mainClass]. Instrumentation inserts a field
 * there that installs `$JavaWiz`'s standard input tracking:
 *
 * ```
 * public class Main { static Scanner sc = new Scanner(System.in); ... }
 * public class Main { static final boolean $javaWizStandardInput = jwdebug.$JavaWiz.trackStandardInput(); static Scanner sc = ... }
 * ```
 *
 * Static fields are initialized in source order when the class is initialized, so the input tracking is installed
 * before any user field or `main` can capture `System.in`. A field is used instead of a `static { }` block because
 * compact source files do not allow initializer blocks. Members that are not written in the class body are skipped:
 * enum constants (a field must follow them), record component fields (they belong to the record header), and members
 * that javac generated, such as default constructors. A main class always has at least its `main` method as a member.
 */
fun findStandardInputTrackingSite(mainClass: JCTree.JCClassDecl, positioning: Positioning): StandardInputTrackingSite? {
    // javac's internal modifier bits (Flags) mark these members: ENUM on enum constants, RECORD on record component
    // fields, and GENERATEDCONSTR/GENERATED_MEMBER on members that javac added to the attributed tree.
    val notInBody = Flags.ENUM.toLong() or Flags.RECORD or Flags.GENERATEDCONSTR or Flags.GENERATED_MEMBER.toLong()
    val firstBodyMember = mainClass.members
        .filter { member ->
            val flags = when (member) {
                is JCTree.JCVariableDecl -> member.mods.flags
                is JCTree.JCMethodDecl -> member.mods.flags
                else -> 0L
            }
            flags and notInBody == 0L && TreeInfo.getStartPos(member) >= 0
        }
        .minByOrNull { TreeInfo.getStartPos(it) }
        ?: return null
    return StandardInputTrackingSite(
        positioning.getBeginLine(firstBodyMember) - 1,
        positioning.getBeginColumn(firstBodyMember) - 1
    )
}

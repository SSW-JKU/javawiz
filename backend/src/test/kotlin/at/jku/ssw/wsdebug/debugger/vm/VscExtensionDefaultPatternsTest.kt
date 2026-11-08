package at.jku.ssw.wsdebug.debugger.vm

import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.DATA_STRUCTURE_CLASSES
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import java.io.File

/**
 * The VS Code extension ships copies of the backend's default pattern lists as its setting defaults,
 * so its settings page shows them. The browser and IntelliJ use the backend lists directly. This test
 * lives in the backend because the backend tests run in CI; it fails when a copy drifts.
 */
internal class VscExtensionDefaultPatternsTest {
    // Gradle runs the backend tests in the backend project directory.
    private val settings = jacksonObjectMapper()
        .readTree(File("../vsc-extension/package.json"))
        .path("contributes").path("configuration").path("properties")

    private fun defaultOf(setting: String): List<String> =
        settings.path("javawiz.$setting").path("default").map { it.asText() }

    @Test
    fun `dataStructurePatterns default equals DATA_STRUCTURE_CLASSES`() {
        assertEquals(DATA_STRUCTURE_CLASSES, defaultOf("dataStructurePatterns"))
    }

    @ParameterizedTest
    @ValueSource(strings = ["excludeFromSteppingPatterns", "heapTraversalStopPatterns"])
    fun `internal pattern defaults equal INTERNAL_CLASS_PATTERNS without the JavaWiz class`(setting: String) {
        // The backend adds its own helper class to every request, so the extension does not list it.
        assertEquals(INTERNAL_CLASS_PATTERNS - "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS", defaultOf(setting))
    }
}

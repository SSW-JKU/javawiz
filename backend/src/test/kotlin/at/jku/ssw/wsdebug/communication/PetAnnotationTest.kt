package at.jku.ssw.wsdebug.communication

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class PetAnnotationTest {
    @Test
    fun `JavaWiz targets default to JavaWiz view`() {
        assertEquals("JavaWizView", parsePetComment("// @PET Highlight at button StepInto")?.view)
        assertEquals("JavaWizView", parsePetComment("// @PET Highlight at input RunToLine")?.view)
        assertEquals("JavaWizView", parsePetComment("// @PET Highlight at ui Toolbar")?.view)
    }

    @Test
    fun `heap targets retain memory view default`() {
        assertEquals("MemoryView", parsePetComment("// @PET Highlight at local value")?.view)
        assertEquals("MemoryView", parsePetComment("// @PET Highlight at element values[2]")?.view)
    }

    @Test
    fun `explicit view overrides target default`() {
        assertEquals("MemoryView", parsePetComment("// @PET Highlight at button StepInto in MemoryView")?.view)
    }
}

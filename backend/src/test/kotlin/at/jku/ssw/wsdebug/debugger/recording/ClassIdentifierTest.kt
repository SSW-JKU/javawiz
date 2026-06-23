package at.jku.ssw.wsdebug.debugger.recording;

import at.jku.ssw.wsdebug.debugger.recording.identifiers.*
import org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class ClassIdentifierTest {

    @Test
    fun getClassName_ReturnsOuterClassWithPackage_IfLowercaseAndDot() {
        val result = getClassName("com.example.MyClass")
        assertTrue(result is OuterClassWithPackage)
    }

    @Test
    fun getClassName_ReturnsOuterClassWithoutPackage_IfNoDot() {
        val result = getClassName("MyClass")
        assertTrue(result is OuterClassWithoutPackage)
    }

    @Test
    fun getClassName_ReturnsInnerClassWithPackageAndDot_IfUppercaseAfterLastDot() {
        val result = getClassName("com.example.MyClass.Inner")
        assertTrue(result is InnerClassWithPackageAndDot)
    }

    @Test
    fun getClassName_ReturnsInnerClassWithPackageAndDollar_IfDollarAndDot() {
        val result = getClassName("com.example.MyClass\$Inner")
        assertTrue(result is InnerClassWithPackageAndDollar)
    }

    @Test
    fun getClassName_ReturnsInnerClassWithDollar_IfDollarAndNoDot() {
        val result = getClassName("MyClass\$Inner")
        assertTrue(result is InnerClassWithDollar)
    }

    @Test
    fun getClassName_ReturnsInnerClassWithDot_IfNoDollar() {
        val result = getClassName("MyClass.Inner")
        assertTrue(result is InnerClassWithDot)
    }

    @Test
    fun areEqualWrapperTypes_SameKind_ReturnsTrue() {
        val first = OuterClassWithoutPackage("Main")
        val second = OuterClassWithoutPackage("Main")

        assertTrue(areEqualWrapperTypes(first, second))
    }

    @Test
    fun areEqualWrapperTypes_DifferentKind_ReturnsFalse() {
        val first = OuterClassWithoutPackage("Main")
        val second = InnerClassWithDollar("Main\$Inner")

        assertFalse(areEqualWrapperTypes(first, second))
    }

    @Test
    fun areEqualClassNames_ExactMatch_ReturnsTrue() {
        val first = OuterClassWithoutPackage("Main")
        val second = OuterClassWithoutPackage("Main")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_DifferentNames_ReturnsFalse() {
        val first = OuterClassWithoutPackage("Main")
        val second = OuterClassWithoutPackage("Secondary")

        assertFalse(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_InnerClassWithDollar_ReturnsTrue() {
        val first = InnerClassWithDollar("Main\$Inner")
        val second = InnerClassWithDot("Main.Inner")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_InnerClassWithPackageAndDot1_ReturnsTrue() {
        var first = InnerClassWithDollar("Main\$Inner")
        val second = InnerClassWithPackageAndDot("package.Main.Inner")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_InnerClassWithPackageAndDollar1_ReturnsTrue() {
        var first = InnerClassWithDollar("Main\$Inner")
        val second = InnerClassWithPackageAndDollar("package.Main\$Inner")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_InnerClassWithPackageAndDot2_ReturnsTrue() {
        var first = InnerClassWithDot("Main.Inner")
        val second = InnerClassWithPackageAndDot("package.Main.Inner")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun areEqualClassNames_InnerClassWithPackageAndDollar2_ReturnsTrue() {
        var first = InnerClassWithDot("Main.Inner")
        val second = InnerClassWithPackageAndDollar("package.Main\$Inner")

        assertTrue(areEqualClassNames(first, second))
    }

    @Test
    fun getOuterClassWithoutPackage_InnerClass_ReturnsOuterClass() {
        val clazz = InnerClassWithDollar("package.Main\$Inner")
        val result = getOuterClassWithoutPackage(clazz)

        assertEquals("Main", result.className)
    }

    @Test
    fun getInnerClassWithDollar_InnerClassWithDot_ReturnsDollarNotation() {
        val clazz = InnerClassWithDot("Main.Inner")
        val result = getInnerClassWithDollar(clazz)

        assertNotNull(result)
        assertEquals("Main\$Inner", result!!.className)
    }

    @Test
    fun getInnerClassWithDot_InnerClassWithDollar_ReturnsDotNotation() {
        val clazz = InnerClassWithDollar("Main\$Inner")
        val result = getInnerClassWithDot(clazz)

        assertNotNull(result)
        assertEquals("Main.Inner", result!!.className)
    }
}
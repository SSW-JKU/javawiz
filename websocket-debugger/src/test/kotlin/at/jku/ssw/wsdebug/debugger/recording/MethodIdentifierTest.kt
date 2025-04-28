package at.jku.ssw.wsdebug.debugger.recording;

import at.jku.ssw.wsdebug.debugger.recording.identifiers.*
import org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class MethodIdentifierTest {

    @Test
    fun getMethodName_ReturnsMethodNameWithEmptyParamList_IfEmptyList() {
        val result = getMethodName("myMethod()")
        assertTrue(result is MethodNameWithEmptyParamList)
    }

    @Test
    fun getMethodName_ReturnsMethodNameWithParamList_IfContainsParameters() {
        val result = getMethodName("myMethod(String int, int i)")
        assertTrue(result is MethodNameWithParamList)
    }

    @Test
    fun getMethodName_ReturnsMethodNameWithoutParamList_IfNoParentheses() {
        val result = getMethodName("myMethod")
        assertTrue(result is MethodNameWithoutParamList)
    }

    @Test
    fun areEqualWrapperTypes_WithSameKind_ReturnsTrue() {
        val method1 = MethodNameWithEmptyParamList("testMethod()")
        val method2 = MethodNameWithEmptyParamList("testMethod()")

        assertTrue(areEqualWrapperTypes(method1, method2))
    }

    @Test
    fun areEqualWrapperTypes_WithDifferentKind_ReturnsFalse() {
        val method1 = MethodNameWithEmptyParamList("testMethod()")
        val method2 = MethodNameWithoutParamList("testMethod")

        assertFalse(areEqualWrapperTypes(method1, method2))
    }

    @Test
    fun areEqualMethods_WithSameKind_ReturnsTrue() {
        val method1 = MethodNameWithEmptyParamList("testMethod()")
        val method2 = MethodNameWithEmptyParamList("testMethod()")

        assertTrue(areEqualMethods(method1, method2))
    }

    @Test
    fun areEqualMethods_WithConvertibleMethods_ReturnsTrue() {
        val method1 = MethodNameWithoutParamList("testMethod")
        val method2 = MethodNameWithEmptyParamList("testMethod()")

        assertTrue(areEqualMethods(method1, method2))
    }

    @Test
    fun areEqualMethods_WithNonMatchingMethods_ReturnsFalse() {
        val method1 = MethodNameWithEmptyParamList("testMethod1")
        val method2 = MethodNameWithEmptyParamList("testMethod2")

        assertFalse(areEqualMethods(method1, method2))
    }

    @Test
    fun getMethodNameWithEmptyParamList() {
        val method = MethodNameWithoutParamList("testMethod")
        val expected = MethodNameWithEmptyParamList("testMethod()")

        assertEquals(expected, getMethodNameWithEmptyParamList(method))
    }

    @Test
    fun getMethodNameWithoutParamList() {
        val method = MethodNameWithEmptyParamList("testMethod()")
        val expected = MethodNameWithoutParamList("testMethod")

        assertEquals(expected, getMethodNameWithoutParamList(method))
    }
}
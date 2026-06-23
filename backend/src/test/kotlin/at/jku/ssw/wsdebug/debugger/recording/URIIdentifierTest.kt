package at.jku.ssw.wsdebug.debugger.recording;

import at.jku.ssw.wsdebug.debugger.recording.identifiers.*
import org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import java.nio.file.Paths

class URIIdentifierTest {

    @Test
    fun getURIName_ReturnsCompleteURI_http() {
        val uri = "http://example.com/path/to/resource"
        val result = getURIName(uri)
        assertTrue(result is CompleteURI)
        assertEquals(uri, result.uri)
    }

    @Test
    fun getURIName_ReturnsCompleteURI_C() {
        val uri = "C://example.com/path/to/resource"
        val result = getURIName(uri)
        assertTrue(result is CompleteURI)
        assertEquals(uri, result.uri)
    }

    @Test
    fun getURIName_ReturnsWorkspaceRelativeURI() {
        val uri = "workspace/path/to/file"
        // Assume workspace is the current working directory for testing
        val workspacePath = Paths.get("").toAbsolutePath().toString().replace("\\", "/")
        val result = getURIName(uri)
        assertTrue(result is WorkspaceRelativeURI)
    }

    @Test
    fun getURIName_ReturnsPackageRelativeURI() {
        val uri = "/package/path/to/file"
        val result = getURIName(uri)
        assertTrue(result is PackageRelativeURI)
        assertEquals(uri, result.uri)
    }

    @Test
    fun getURIName_ReturnsWorkspaceRelativeURI_SimpleFile() {
        val uri = "file.txt"
        val result = getURIName(uri)
        assertTrue(result is WorkspaceRelativeURI)
        assertEquals(uri, result.uri)
    }

    @Test
    fun areEqualWrapperTypes_ReturnsTrue() {
        val first = CompleteURI("http://example.com")
        val second = CompleteURI("http://example.com")

        assertTrue(areEqualWrapperTypes(first, second))  // Same kind
    }

    @Test
    fun areEqualWrapperTypes_ReturnsFalse() {
        val first = CompleteURI("http://example.com")
        val second = PackageRelativeURI("/package/example.com")
        val third = WorkspaceRelativeURI("workspace/path/to/file")

        assertFalse(areEqualWrapperTypes(first, second))
        assertFalse(areEqualWrapperTypes(first, third))
    }

    @Test
    fun areEqualURIs_ReturnsTrue_SameURITypes() {
        val first = CompleteURI("http://example.com")
        val second = CompleteURI("http://example.com")
        assertTrue(areEqualURIs(first, second)) // Same URI and kind
    }

    @Test
    fun convertToFileName() {
        val uri = "http://example.com/path/to/file.txt"
        val result = convertToFileName(uri)
        assertEquals("file.txt", result)  // Extracts file name
    }
}
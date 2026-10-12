package at.jku.ssw.wsdebug.debugger.recording

import at.jku.ssw.wsdebug.compilation.instrumentation.ArrayAccess
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class IdentifierSerializationTest {
    private val mapper = jacksonObjectMapper()

    @Test
    fun `serializes stream identifiers with Id casing`() {
        val streamEvent = StreamEvent(
            seq = 1,
            operation = "map",
            eventKind = StreamEventKind.OUT,
            operationId = 2,
            elementId = 3,
            parentIds = listOf(1),
            type = "int",
            observedValue = 4,
            operationParameter = ""
        )
        val json = mapper.readTree(mapper.writeValueAsString(streamEvent))

        assertEquals("map", json["operation"].textValue())
        assertEquals("int", json["type"].textValue())
        assertEquals("OUT", json["eventKind"].textValue())
        assertTrue(json.has("operationId"))
        assertTrue(json.has("elementId"))
        assertTrue(json.has("parentIds"))
        assertFalse(json.has("valuetype"))
        assertFalse(json.has("operationID"))
        assertFalse(json.has("elementID"))
        assertFalse(json.has("parentIDs"))
    }

    @Test
    fun `serializes an array reference as arrayObjectId`() {
        val arrayAccessValue = ArrayAccessValue(
            indexValues = listOf(0),
            evaluated = true,
            arrayObjectId = 42,
            arrayAccess = ArrayAccess(1, emptyList(), null, emptyList(), false)
        )
        val json = mapper.readTree(mapper.writeValueAsString(arrayAccessValue))

        assertEquals(42, json["arrayObjectId"].longValue())
        assertFalse(json.has("arrayObjectID"))
    }
}

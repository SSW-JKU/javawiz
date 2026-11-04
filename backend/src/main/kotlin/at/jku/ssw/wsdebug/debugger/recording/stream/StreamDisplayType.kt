package at.jku.ssw.wsdebug.debugger.recording.stream

/**
 * The display types that StreamViz assigns itself, as sent in `StreamEvent.type` and `MarbleDiagramMarble.type`.
 * Other types are Java type names such as `int` or `java.lang.String`. `TheStreamViz.vue` compares the same labels.
 */
enum class StreamDisplayType(val label: String) {
    LIST("List"), SET("Set"), ARRAY("Array"), MAP("Map"),
    /** Any other object, shown with its `toString()` text. */
    TEXT("Text"),
    OPTIONAL("Optional"), OPTIONAL_INT("OptionalInt"), OPTIONAL_LONG("OptionalLong"), OPTIONAL_DOUBLE("OptionalDouble");

    /** Drawn as a box with one item per value. */
    val isCollection: Boolean get() = this == LIST || this == SET || this == ARRAY

    companion object {
        /** The display type with this label, or `null` for a Java type name such as `int`. */
        fun of(label: String?): StreamDisplayType? = entries.firstOrNull { it.label == label }
    }
}

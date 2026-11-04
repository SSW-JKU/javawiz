package at.jku.ssw.wsdebug.debugger.recording.stream

/**
 * The state of a `collect` accumulator, or the result of `collect`, as read from the debugged program.
 * It is a plain snapshot of debuggee values; [MarbleDiagramGenerator] finds which element each value came from
 * when it draws the marble.
 *
 * Examples: `Collectors.toList()` gives [Items], `groupingBy(...)` gives [Entries], and `counting()` gives
 * `Single(CollectedValue("long", 3L))`.
 */
sealed interface CollectorState {
    /** The type shown on the collect marble, for example `List`, `Map`, `long`, or `Text`. */
    val displayType: String?

    /** A collection; [type] is [StreamDisplayType.SET] for sets and [StreamDisplayType.LIST] for every other collection. */
    data class Items(val type: StreamDisplayType, val values: List<CollectedValue>) : CollectorState {
        override val displayType: String get() = type.label
    }

    /** A map, with its entries in iteration order. */
    data class Entries(val entries: List<CollectedEntry>) : CollectorState {
        override val displayType: String get() = StreamDisplayType.MAP.label
    }

    /**
     * A single value: a number, a String, an Optional (type `Optional`, value = the inner value), or `Text`
     * for any other object, shown with its `toString()` text.
     */
    data class Single(val value: CollectedValue) : CollectorState {
        override val displayType: String? get() = value.type
    }

    companion object {
        /** Shown while the running value cannot be known without running user code, for example a `collectingAndThen` finisher. */
        val PENDING: CollectorState = Single(CollectedValue(StreamDisplayType.TEXT.label, "…"))
    }
}

/**
 * One collected value with the same type/value convention as element events: a primitive type name and its value,
 * `java.lang.String` and the text, or an object's simple class name and its unique object ID.
 */
data class CollectedValue(val type: String?, val value: Any)

/**
 * The elements of an array or a collection, such as a `List` or `Set` stream element, as the [CollectedValue.value] of
 * that value. StreamViz draws one small box per element. Its text is like `Arrays.toString`, for example `[1, 2]`, and is
 * used wherever the value is shown as text.
 */
data class CollectionElements(val elements: List<CollectedValue>) {
    override fun toString() = elements.joinToString(", ", "[", "]") { it.value.toString() }
}

/** One map entry: the key as text and its values. A value that is not a collection is a one-item list. */
data class CollectedEntry(val key: String, val values: List<CollectedValue>)

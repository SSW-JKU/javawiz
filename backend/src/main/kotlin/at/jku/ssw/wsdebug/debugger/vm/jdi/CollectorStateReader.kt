package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.debugger.recording.stream.CollectedEntry
import at.jku.ssw.wsdebug.debugger.recording.stream.CollectedValue
import at.jku.ssw.wsdebug.debugger.recording.stream.CollectionElements
import at.jku.ssw.wsdebug.debugger.recording.stream.CollectorState
import at.jku.ssw.wsdebug.debugger.recording.stream.StreamDisplayType
import at.jku.ssw.wsdebug.getEnabledRequests
import com.sun.jdi.*

/**
 * Converts a debuggee value into the type and value StreamViz uses for stream elements:
 * primitives and their wrappers become the primitive type name and value (`Integer 4` -> `int`, `4`),
 * Strings keep their text, arrays keep their element values, and any other object is identified by its unique ID.
 * `null` becomes the text `null` without a type.
 */
fun observedValueOf(value: Value?): CollectedValue = when (value) {
    null -> CollectedValue(null, "null")
    is StringReference -> CollectedValue(value.type().name(), value.value())
    is PrimitiveValue -> CollectedValue(value.type().name(), primitiveValueOf(value))
    is ArrayReference -> CollectedValue(value.type().name(), CollectionElements(value.values.map(::observedValueOf)))
    is ObjectReference -> {
        val typeName = value.type().name()
        val primitiveTypeName = primitiveTypeByWrapper[typeName]
        if (primitiveTypeName != null) {
            val fieldValue = value.getValue(value.referenceType().fieldByName("value")!!)
            CollectedValue(primitiveTypeName, primitiveValueOf(fieldValue as? PrimitiveValue ?: error("unknown value type for wrapper $typeName: ${fieldValue?.type()?.name()}")))
        } else {
            CollectedValue(typeName.drop(typeName.lastIndexOf('$') + 1), value.uniqueID())
        }
    }
    else -> error("unknown stream element type: ${value.type().name()}")
}

/**
 * Like [observedValueOf], but a collection, such as a `List` or `Set` stream element, also carries its elements, so
 * StreamViz can draw it like an array. Reading the elements calls `toArray()` in the debuggee on [thread], so this must
 * only be called while that thread is suspended at a debugger event. If that call throws, the collection is recorded
 * like any other object, as its class name and object ID.
 */
fun observedElementOf(value: Value?, thread: ThreadReference): CollectedValue {
    if (!value.isCollection()) return observedValueOf(value)
    return try {
        withEventRequestsDisabled(thread) { collectedElementOf(value, thread) }
    } catch (e: InvocationException) {
        observedValueOf(value)
    }
}

/** [observedElementOf] for code that already runs with event requests disabled, such as [readInDebuggee]. */
private fun collectedElementOf(value: Value?, thread: ThreadReference): CollectedValue {
    if (!value.isCollection()) return observedValueOf(value)
    // Elements of the collection are read without their own elements, so a collection that contains itself cannot loop.
    return observedValueOf(value).copy(value = CollectionElements(toArray(value as ObjectReference, thread).map(::observedValueOf)))
}

private fun Value?.isCollection() =
    this is ObjectReference && this !is ArrayReference && implements("java.util.Collection")

private val primitiveTypeByWrapper = mapOf(
    "java.lang.Integer" to "int",
    "java.lang.Double" to "double",
    "java.lang.Float" to "float",
    "java.lang.Long" to "long",
    "java.lang.Boolean" to "boolean",
    "java.lang.Character" to "char",
    "java.lang.Byte" to "byte",
    "java.lang.Short" to "short"
)

private fun primitiveValueOf(value: PrimitiveValue): Any = when (value) {
    is IntegerValue -> value.value()
    is DoubleValue -> value.value()
    is FloatValue -> value.value()
    is LongValue -> value.value()
    is BooleanValue -> value.value()
    is CharValue -> value.value()
    is ByteValue -> value.value()
    is ShortValue -> value.value()
    else -> error("unknown primitive type: ${value.type().name()}")
}

/**
 * Reads a `collect` accumulator after an element was added, or the value that `collect` returned, as a [CollectorState].
 *
 * [text] is the value's `toString()` text, computed by the debuggee. It is shown for objects that StreamViz cannot
 * draw otherwise, for example `IntSummaryStatistics`. Collections and maps are read by calling methods in the
 * debuggee on [thread], so this must only be called while that thread is suspended at a debugger event.
 */
fun readCollectorState(value: Value?, text: String?, thread: ThreadReference): CollectorState {
    if (value !is ObjectReference || value is StringReference || value.type().name() in primitiveTypeByWrapper) {
        return CollectorState.Single(observedValueOf(value))
    }
    if (value is ArrayReference) return accumulatorArrayValue(value)?.let { CollectorState.Single(it) } ?: textState(text)
    return when {
        value.referenceType().name() in optionalTypeNames -> CollectorState.Single(optionalValue(value, thread))
        value.implements("java.util.Map") -> readInDebuggee(thread, text) { readMap(value, thread) }
        value.implements("java.util.Collection") -> readInDebuggee(thread, text) {
            CollectorState.Items(if (value.implements("java.util.Set")) StreamDisplayType.SET else StreamDisplayType.LIST, toArray(value, thread).map { collectedElementOf(it, thread) })
        }
        // StringBuilder (joining() without a delimiter) and StringJoiner (with a delimiter) hold the joined text so far.
        value.implements("java.lang.CharSequence") || value.referenceType().name() == "java.util.StringJoiner" ->
            CollectorState.Single(CollectedValue("java.lang.String", text ?: ""))
        else -> textState(text)
    }
}

/** `Optional` is the result of minBy/maxBy, and `Collectors$1OptionalBox` their accumulator (also used by `reducing(op)`). */
private val optionalTypeNames = setOf("java.util.Optional", "java.util.stream.Collectors$1OptionalBox")

private fun textState(text: String?) = CollectorState.Single(CollectedValue(StreamDisplayType.TEXT.label, text ?: "null"))

private fun ObjectReference.implements(interfaceName: String) =
    (referenceType() as? ClassType)?.allInterfaces()?.any { it.name() == interfaceName } == true

/**
 * Computes the running value of the accumulator arrays that `java.util.stream.Collectors` uses (unchanged since Java 8):
 * - `long[1]`: counting() and summingLong(), the sum.
 * - `int[1]`: summingInt(), the sum.
 * - `long[2]`: averagingInt() and averagingLong(), sum and count.
 * - `double[3]`: summingDouble(), a compensated sum (`a[0] - a[1]`) and the simple sum.
 * - `double[4]`: averagingDouble(), the compensated sum, the count `a[2]`, and the simple sum.
 * - `Object[1]`: reducing(identity, op), the value so far.
 * The doubles are computed like the JDK finishers, so the text equals what `println` prints for the result.
 * Returns `null` for any other array; StreamViz then shows its text. If a JDK ever changes these layouts,
 * the running values no longer match the result of collect, and StreamViz replaces them (see `StreamOperationTracer`).
 */
private fun accumulatorArrayValue(array: ArrayReference): CollectedValue? {
    val values = array.values
    return when (array.type().name()) {
        "long[]" -> when (values.size) {
            1 -> CollectedValue("long", (values[0] as LongValue).value())
            2 -> CollectedValue("double", average((values[0] as LongValue).value().toDouble(), (values[1] as LongValue).value()))
            else -> null
        }
        "int[]" -> if (values.size == 1) CollectedValue("int", (values[0] as IntegerValue).value()) else null
        "double[]" -> {
            val doubles = values.map { (it as DoubleValue).value() }
            when (doubles.size) {
                3 -> CollectedValue("double", compensatedSum(doubles))
                4 -> CollectedValue("double", average(compensatedSum(doubles), doubles[2].toLong()))
                else -> null
            }
        }
        "java.lang.Object[]" -> if (values.size == 1) observedValueOf(values[0]) else null
        else -> null
    }
}

/** Mirrors `Collectors.computeFinalSum`: the compensation term is stored negated, and the simple sum is the last element. */
private fun compensatedSum(summands: List<Double>): Double {
    val sum = summands[0] - summands[1]
    val simpleSum = summands.last()
    return if (sum.isNaN() && simpleSum.isInfinite()) simpleSum else sum
}

private fun average(sum: Double, count: Long) = if (count == 0L) 0.0 else sum / count

/** Reads `Optional` or `OptionalBox` as type `Optional` with the inner value as text, like the reduce completion convention. */
private fun optionalValue(optional: ObjectReference, thread: ThreadReference): CollectedValue {
    val type = optional.referenceType()
    val inner = optional.getValue(type.fieldByName("value"))
    val present = type.fieldByName("present")?.let { (optional.getValue(it) as BooleanValue).value() } ?: (inner != null)
    if (!present) return CollectedValue(StreamDisplayType.OPTIONAL.label, "Optional.empty")
    val innerText = if (inner is ObjectReference && inner !is StringReference && inner.type().name() !in primitiveTypeByWrapper) {
        withEventRequestsDisabled(thread) { invokeToString(inner, thread) }
    } else {
        observedValueOf(inner).value.toString()
    }
    return CollectedValue(StreamDisplayType.OPTIONAL.label, innerText)
}

/**
 * Reads a map entry by entry. Keys are shown as their text. A collection value (for example from groupingBy)
 * is read as a list of values; any other value is read like a stream element, as a one-item list.
 */
private fun readMap(map: ObjectReference, thread: ThreadReference): CollectorState {
    val entrySet = map.invoke(thread, "entrySet", "()Ljava/util/Set;") as ObjectReference
    val entries = toArray(entrySet, thread).map { entry ->
        entry as ObjectReference
        val key = entry.invoke(thread, "getKey", "()Ljava/lang/Object;")
        val value = entry.invoke(thread, "getValue", "()Ljava/lang/Object;")
        val keyText = when (key) {
            null -> "null"
            is StringReference -> key.value()
            is ObjectReference -> invokeToString(key, thread)
            else -> observedValueOf(key).value.toString()
        }
        if (value is ObjectReference && value !is ArrayReference && value.implements("java.util.Collection")) {
            CollectedEntry(keyText, toArray(value, thread).map(::observedValueOf))
        } else {
            CollectedEntry(keyText, listOf(observedValueOf(value)))
        }
    }
    return CollectorState.Entries(entries)
}

private fun toArray(collection: ObjectReference, thread: ThreadReference): List<Value?> =
    (collection.invoke(thread, "toArray", "()[Ljava/lang/Object;") as ArrayReference).values

private fun invokeToString(value: ObjectReference, thread: ThreadReference): String =
    (value.invoke(thread, "toString", "()Ljava/lang/String;") as? StringReference)?.value() ?: "null"

private fun ObjectReference.invoke(thread: ThreadReference, name: String, signature: String): Value? {
    val method = (referenceType() as ClassType).concreteMethodByName(name, signature) ?: error("$name not found on ${referenceType().name()}")
    return invokeMethod(thread, method, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED)
}

/** Reads a collection or map in the debuggee. If its code throws (for example a broken user-defined `toArray`), its text is shown instead. */
private fun readInDebuggee(thread: ThreadReference, text: String?, read: () -> CollectorState): CollectorState =
    try {
        withEventRequestsDisabled(thread, read)
    } catch (e: InvocationException) {
        textState(text)
    }

/**
 * Runs [block], which calls methods in the debuggee. Event requests are disabled meanwhile, as the JDI documentation of
 * `invokeMethod` recommends: events raised by the invoked code could not be handled while the debugger waits for the call.
 */
private fun <T> withEventRequestsDisabled(thread: ThreadReference, block: () -> T): T {
    val enabledRequests = thread.virtualMachine().getEnabledRequests()
    enabledRequests.forEach { it.disable() }
    try {
        return block()
    } finally {
        enabledRequests.forEach { it.enable() }
    }
}

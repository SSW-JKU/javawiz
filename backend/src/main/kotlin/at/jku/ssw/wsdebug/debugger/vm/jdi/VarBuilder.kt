package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.debugger.recording.*
import com.sun.jdi.*

fun createVar(staticField: Field, heap: MutableMap<Long, HeapItem>, classesWithCollectedFields: Collection<ReferenceType>): Var {
    return Var(staticField.name(), staticField.typeName(), staticField.declaringType().getValue(staticField).traceValue(heap, classesWithCollectedFields))
}

fun createVar(field: Field, value: Value?, heap: MutableMap<Long, HeapItem>, classesWithCollectedFields: Collection<ReferenceType>): Var {
    return Var(field.name(), field.typeName(), value.traceValue(heap, classesWithCollectedFields))
}

fun createVar(
    frame: com.sun.jdi.StackFrame,
    variable: LocalVariable,
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): Var {
    return Var(variable.name(), variable.typeName(), frame.getValue(variable).traceValue(heap, classesWithCollectedFields))
}

fun createThisVar(
    typeName: String,
    thisObject: ObjectReference?,
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): Var {
    return Var("this", typeName, thisObject.traceValue(heap, classesWithCollectedFields))
}

/** Placed in [heap] before recursing into a heap object's fields to break reference cycles. */
private val CYCLE_GUARD = HeapObject(-1, "", true, listOf())

private fun Value?.traceValue(heap: MutableMap<Long, HeapItem>, classesWithCollectedFields: Collection<ReferenceType>): Val {
    return when (this) {
        null -> NullVal()
        is PrimitiveValue -> PrimitiveVal(toString())
        is ObjectReference -> {
            // If we have a reference to a heap object that we have not yet recorded, we record it.
            if (!heap.containsKey(uniqueID())) {
                heap[uniqueID()] = CYCLE_GUARD
                heap[uniqueID()] = when (this) {
                    is StringReference -> toHeapString(heap, classesWithCollectedFields)
                    is ArrayReference  -> toHeapArray(heap, classesWithCollectedFields)
                    else               -> toHeapObject(heap, classesWithCollectedFields)
                }
            }
            ReferenceVal(uniqueID())
        }
        // Value is sealed to PrimitiveValue | ObjectReference in the JDI spec; this branch is unreachable.
        else -> throw IllegalArgumentException("$this is neither a primitive value nor an object reference")
    }
}

private fun StringReference.toHeapString(
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): HeapString {
    val instanceFields = referenceType().allFields().filter { !it.isStatic && !it.isSynthetic }
    // index 0 is the internal `char[]` (or `byte[]` on JDK 9+) backing field of java.lang.String
    val charArrayField = getValues(instanceFields).entries.first()
    return HeapString(
        uniqueID(),
        referenceType().name(),
        false,
        value(),
        createVar(charArrayField.key, charArrayField.value, heap, classesWithCollectedFields)
    )
}

private fun ArrayReference.toHeapArray(
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): HeapArray {
    return HeapArray(
        uniqueID(),
        referenceType().name(),
        false,
        values.mapIndexed { index, value ->
            HeapArrayElementVar(
                uniqueID(),
                (referenceType() as ArrayType).componentType().name(),
                value.traceValue(heap, classesWithCollectedFields),
                index
            )
        }
    )
}

private fun ObjectReference.toHeapObject(
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): HeapObject {
    val fields = collectObjectFields(heap, classesWithCollectedFields)
    return HeapObject(uniqueID(), referenceType().name(), false, fields)
}

private fun ObjectReference.collectObjectFields(
    heap: MutableMap<Long, HeapItem>,
    classesWithCollectedFields: Collection<ReferenceType>
): List<Var> {
    val classType = referenceType() as ClassType
    return when {
        classType.extendsClass("java.lang.Throwable") -> {
            val msgField = referenceType().fieldByName("detailMessage")
            val msgValue = msgField?.let { getValue(it) }
            if (msgValue != null) listOf(createVar(msgField, msgValue, heap, classesWithCollectedFields))
            else listOf()
        }
        classesWithCollectedFields.contains(referenceType()) -> {
            // println("Tracing values for $clazzName with reference ID ${uniqueID()}")
            getValues(referenceType().allFields().filter { !it.isStatic && !it.isSynthetic })
                .map { (field, value) -> createVar(field, value, heap, classesWithCollectedFields) }
        }
        else -> {
            // println("Not tracing values for $clazzName with reference ID ${uniqueID()} since it is not in the set of relevant classes")

            emptyList()
        }
    }
}

fun ClassType.extendsClass(name: String): Boolean {
    return name() == name || (superclass()?.extendsClass(name) ?: false)
}

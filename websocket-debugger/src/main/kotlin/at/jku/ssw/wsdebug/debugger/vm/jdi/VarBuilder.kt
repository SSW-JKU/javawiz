package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.debugger.recording.*
import com.sun.jdi.*

fun createVar(staticField: Field, heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Var {
    return Var(staticField.name(), staticField.typeName(), staticField.declaringType().getValue(staticField).traceValue(heap, relevantClasses))
}

fun createVar(objectField: Map.Entry<Field, Value>, heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Var {
    return Var(objectField.key.name(), objectField.key.typeName(), objectField.value.traceValue(heap, relevantClasses))
}

fun createVar(field: Field, value: Value, heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Var {
    return Var(field.name(), field.typeName(), value.traceValue(heap, relevantClasses))
}

fun createVar(frame: com.sun.jdi.StackFrame, variable: LocalVariable, heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Var {
    return Var(variable.name(), variable.typeName(), frame.getValue(variable).traceValue(heap, relevantClasses))
}

fun createVar(frame: com.sun.jdi.StackFrame, thisObject: ObjectReference?, heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Var {
    return Var("this", frame.location().declaringType().name(), thisObject.traceValue(heap, relevantClasses))
}

private val DUMMY = HeapObject(-1, "", true, listOf())

private fun Value?.traceValue(heap: MutableMap<Long, HeapItem>, relevantClasses: List<ReferenceType>): Val {
    return when (this) {
        null -> NullVal()
        is PrimitiveValue -> PrimitiveVal(toString())
        is ObjectReference -> {
            // If we have a reference to a heap object that we have not yet recorded, we record it
            if (!heap.containsKey(uniqueID())) {
                heap[uniqueID()] = DUMMY // to prevent circles while traversing heap objects
                heap[uniqueID()] = when (this) {
                    is StringReference -> HeapString(
                        uniqueID(),
                        referenceType().name(),
                        false,
                        value(),
                        getValues(referenceType().allFields().filter { !it.isStatic && !it.isSynthetic }).map { createVar(it, heap, relevantClasses) }[0]
                    )
                    // Recursive call to traceValue ensures that heap objects are traversed
                    is ArrayReference -> HeapArray(
                        uniqueID(),
                        referenceType().name(),
                        false,
                        values.mapIndexed { index, value ->
                            HeapArrayElementVar(
                                uniqueID(), (referenceType() as ArrayType).componentType().name(), value.traceValue(heap, relevantClasses),
                                index
                            )
                        })

                    // Var construction ensures that heap objects are traversed
                    else -> {
                        val fields = if((referenceType() as ClassType).extendsClass("java.lang.Throwable")) {
                            val msg = referenceType().fieldByName("detailMessage")
                            val value = msg?.let { getValue(it) }
                            if (value != null) {
                                listOf(
                                    createVar(msg, value, heap, relevantClasses)
                                )
                            } else {
                                listOf()
                            }
                        } else if (relevantClasses.contains(referenceType())) {
                            getValues(referenceType().allFields().filter { !it.isStatic && !it.isSynthetic }).map { createVar(it, heap, relevantClasses) }
                        } else {
                            listOf(Var("fields hidden", "-", PrimitiveVal("")))
                        }
                        HeapObject(
                            uniqueID(),
                            referenceType().name(),
                            false,
                            fields
                        )
                    }
                }
            }
            ReferenceVal(uniqueID())
        }

        else -> throw IllegalArgumentException("$this is neither a primitive value nor an object reference... WHAT the heck is it? :D")
    }
}

fun ClassType.extendsClass(name: String): Boolean {
    return name() == name || (superclass()?.extendsClass(name) ?: false)
}
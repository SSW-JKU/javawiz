package at.jku.ssw.wsdebug.debugger.recording

open class Var(
    val name: String,
    val type: String,
    val value: Val
) : Recordable {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Var) return false

        if (name != other.name) return false
        if (type != other.type) return false
        if (value != other.value) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + type.hashCode()
        result = 31 * result + value.hashCode()
        return result
    }

    override fun toString(): String {
        return "Var(name='$name', type='$type', value=$value)"
    }
}

data class HeapArrayElementVar(
    val arrayId: Long,
    val type: String,
    val value: Val,
    val index: Int
) : Recordable

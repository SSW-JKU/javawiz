package at.jku.ssw.wsdebug.debugger.recording

//this interface is implemented by HeapArray, HeapString and HeapObject
//it is not supposed to be implemented anywhere else
interface HeapItem : Recordable {
    val id: Long
    val type: String
    val faked: Boolean

    fun copyAsFaked(): HeapItem
}

data class HeapArray(
    override val id: Long,
    override val type: String,
    override val faked: Boolean,
    val elements: List<HeapArrayElementVar>
) : HeapItem {
    override fun copyAsFaked(): HeapItem = copy(faked = true)
}

data class HeapString(
    override val id: Long,
    override val type: String,
    override val faked: Boolean,
    val string: String,
    val charArr: Var
) : HeapItem {
    override fun copyAsFaked(): HeapItem = copy(faked = true)
}

data class HeapObject(
    override val id: Long,
    override val type: String,
    override val faked: Boolean,
    val fields: List<Var> //does not include static fields
) : HeapItem {
    override fun copyAsFaked(): HeapItem = copy(faked = true)
}

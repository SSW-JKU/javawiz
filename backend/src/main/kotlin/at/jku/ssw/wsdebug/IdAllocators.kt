package at.jku.ssw.wsdebug

/** Allocates globally unique operation-site IDs across one compile request. */
class OperationIdAllocator(private var nextId: Int = -1) {
    fun next(): Int = ++nextId
}

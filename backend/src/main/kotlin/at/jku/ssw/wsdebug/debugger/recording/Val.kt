package at.jku.ssw.wsdebug.debugger.recording

//dummy interface for PrimitiveVal, ReferenceVal and NullVal
// this interface is not supposed to be implemented anywhere else
// there might be a better way of joining these three cases
interface Val : Recordable

data class PrimitiveVal(val primitiveValue: String) : Val

data class ReferenceVal(val reference: Long) : Val

//represents 'null'
//there is probably a better way of doing this
data class NullVal(val NULL: Unit? = null) : Val
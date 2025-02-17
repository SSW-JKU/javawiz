package at.jku.ssw.wsdebug.debugger.recording

/*
necessary for tracing multidimensional array accesses,
since these are comprised of multiple independent MethodExitEvents from $Javawiz.trace
when using an instrumentation strategy that turns
    a[i][j][k]
into something like
    a[trace(a, i,2,2354)][r(a, j, 1, 2354)][r(a, k, 0, 2354]
*/
data class PartialArrayAccessValue (
    val localUri: String,
    val accessID: Int, // uniquely identifies the [multidimensional] array access within a java file
    val index: Int,
    val dimension: Int,
    val arrayObjectID: Long
)
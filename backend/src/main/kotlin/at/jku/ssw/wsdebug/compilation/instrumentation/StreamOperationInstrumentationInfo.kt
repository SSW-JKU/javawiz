package at.jku.ssw.wsdebug.compilation.instrumentation

/** Describes one statically instrumented stream operation, independent of runtime execution. */
data class StreamOperationInstrumentationInfo(
    val startLine: Int,
    val startColumn: Int,
    val invocationBeginLine: Int,
    val invocationBeginColumn: Int,
    val invocationEndLine: Int,
    val invocationEndColumn: Int,
    val operationName: String,
    val operationId: Int,
    val hasParameter: Boolean = false,
    val parameter: String = "",
    val parameterBeginLine: Int? = null,
    val parameterBeginColumn: Int? = null,
    val parameterEndLine: Int? = null,
    val parameterEndColumn: Int? = null,
    val receiverStreamType: String?,
    val reductionCastType: String?,
    val reductionAccumulatorEndLine: Int? = null,
    val reductionAccumulatorEndColumn: Int? = null,
    val statementEndLine: Int,
    val statementEndColumn: Int,
    /** True when the operation creates or first exposes a stream source and emits START. */
    val isStreamSource: Boolean = false,
    /** True when the operation consumes the stream and must close its active execution. */
    val isTerminal: Boolean = false
)

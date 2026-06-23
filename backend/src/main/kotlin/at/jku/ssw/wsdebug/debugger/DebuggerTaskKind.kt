package at.jku.ssw.wsdebug.debugger

enum class DebuggerTaskKind {
    STEP_INTO,
    STEP_OVER,
    STEP_OUT,
    RUN_TO_LINE,
    RUN_TO_END,
    INPUT
}
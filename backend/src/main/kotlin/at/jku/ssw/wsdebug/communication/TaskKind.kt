package at.jku.ssw.wsdebug.communication

enum class TaskKind {
    COMPILE,
    INPUT,
    STEP_INTO,
    STEP_OVER,
    STEP_OUT,
    RUN_TO_LINE,
    RUN_TO_END,
}

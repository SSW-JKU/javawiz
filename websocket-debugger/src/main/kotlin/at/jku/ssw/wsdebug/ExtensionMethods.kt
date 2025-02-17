package at.jku.ssw.wsdebug

import com.sun.jdi.VirtualMachine

fun <A> A?.packIntoMutableList() = if (this == null) mutableListOf<A>() else mutableListOf(this)

fun String.identEachLine(amount: Int, shortenTo: Int = Integer.MAX_VALUE): String {
    return this.split("\n").map { line -> (" ".repeat(amount) + line).take(shortenTo) }.joinToString("\n")
}

fun Exception.asStringWithStackTrace() = this.toString() + "\nStack Trace: " + this.stackTrace.joinToString("\n") { it.toString() }

fun VirtualMachine.getEnabledRequests() = listOf(
    eventRequestManager().accessWatchpointRequests(),
    eventRequestManager().breakpointRequests(),
    eventRequestManager().classPrepareRequests(),
    eventRequestManager().classUnloadRequests(),
    eventRequestManager().exceptionRequests(),
    eventRequestManager().methodEntryRequests(),
    eventRequestManager().methodExitRequests(),
    eventRequestManager().modificationWatchpointRequests(),
    eventRequestManager().monitorContendedEnterRequests(),
    eventRequestManager().monitorWaitRequests(),
    eventRequestManager().monitorWaitedRequests(),
    eventRequestManager().stepRequests(),
    eventRequestManager().threadDeathRequests(),
    eventRequestManager().threadStartRequests(),
    eventRequestManager().vmDeathRequests()
).flatten().filter { it.isEnabled }

fun Exception.asSingleLineStringWithStackTrace() = asStringWithStackTrace().replace("\r\n", "\n").replace("\n", " ### ")
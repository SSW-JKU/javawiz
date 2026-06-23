package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.debugger.recording.InputBufferInfo
import at.jku.ssw.wsdebug.debugger.recording.InputBufferInfo.Companion.EMPTY
import at.jku.ssw.wsdebug.debugger.recording.InputBufferInfo.Companion.FAILED
import com.sun.jdi.BooleanValue
import at.jku.ssw.wsdebug.getEnabledRequests
import com.sun.jdi.ClassType
import com.sun.jdi.StringReference
import com.sun.jdi.ThreadReference

class InputBufferTracer {
    private val GET_PAST_METHOD_NAME = "getPast"
    private val GET_FUTURE_METHOD_NAME = "getFuture"

    var inClass: ClassType? = null
    fun getInputBufferInfo(threadReference: ThreadReference): InputBufferInfo {
        val inClazz = inClass ?: return EMPTY

        val doneField = inClazz.fieldByName("done")
        val latestValueField = inClazz.fieldByName("latestValue")
        val latestMethodField = inClazz.fieldByName("latestMethod")
        if(doneField == null || latestValueField == null || latestMethodField == null) {
            return FAILED
        }
        val done = inClazz.getValue(doneField)
        val latestValue = inClazz.getValue(latestValueField)
        val latestMethod = inClazz.getValue(latestMethodField)
        if(done !is BooleanValue) {
            return FAILED
        }
        if(latestValue !is StringReference) {
            return FAILED
        }
        if(latestMethod !is StringReference) {
            return FAILED
        }

        val past = getStringValueFromMethod(GET_PAST_METHOD_NAME, inClazz, threadReference)
        val future = getStringValueFromMethod(GET_FUTURE_METHOD_NAME, inClazz, threadReference)

        if(past == null || future == null) {
            return FAILED
        }

        return InputBufferInfo(
            past,
            future,
            done.value(),
            latestValue.value(),
            latestMethod.value(),
            traceSuccess = true
        )
    }


    private fun getStringValueFromMethod(methodName: String, inClazz: ClassType, threadReference: ThreadReference): String? {
        val method = inClazz.methodsByName(methodName).getOrNull(0) ?: return null

        /*
        NOTE: Disabling event requests before invokeMethod() and re-enabling them afterward is
        recommended by the docs of invokeMethod().
        It is meant to prevent a deadlock where the debuggee creates
        events which cannot be handled because the debugger is still waiting for invokeMethod() to
        return before processing further events.
        At the time of writing this, we do not actually have any debugger events that are generated
        by this call to invokeMethod. Therefore, this might be unnecessary. Better safe than sorry, though.
         */
        val enabledRequests = threadReference.virtualMachine().getEnabledRequests()
        enabledRequests.forEach {it.disable()}
        val value = inClazz.invokeMethod(threadReference, method, mutableListOf(), ClassType.INVOKE_SINGLE_THREADED)
        enabledRequests.forEach {it.enable()}
        if(value !is StringReference) {
            return null
        }
        return value.value()
    }
}
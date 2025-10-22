package at.jku.ssw.wsdebug.debugger.vm.jdi

import at.jku.ssw.wsdebug.compilation.JAVAWIZ_CLASS
import at.jku.ssw.wsdebug.compilation.JAVAWIZ_PACKAGE
import at.jku.ssw.wsdebug.compilation.ParseInfo
import at.jku.ssw.wsdebug.debugger.MAX_STACK_DEPTH
import at.jku.ssw.wsdebug.debugger.MAX_STACK_DEPTH_EXCEEDED_MESSAGE
import at.jku.ssw.wsdebug.debugger.recording.*
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.IN_CLASS_NAME
import at.jku.ssw.wsdebug.getEnabledRequests
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
import at.jku.ssw.wsdebug.packIntoMutableList
import com.sun.jdi.*
import com.sun.jdi.event.*
import com.sun.jdi.request.ClassPrepareRequest
import com.sun.jdi.request.MethodEntryRequest
import com.sun.jdi.request.StepRequest
import java.io.BufferedWriter
import java.io.InputStreamReader

class JDIVirtualMachine(
    override val fullyQualifiedMainClassName: String,
    override val cp: String,
    override val parseInfos: List<ParseInfo>,
    val internalClassPatterns: List<String>
) : VirtualMachine {
    private lateinit var nativeVM: com.sun.jdi.VirtualMachine

    private val relevantClasses: MutableList<ReferenceType> = mutableListOf()

    private lateinit var debuggeeInput: BufferedWriter
    private lateinit var debuggeeOutput: InputStreamReader
    private lateinit var debuggeeError: InputStreamReader

    private var inputSinceLastStep: String = ""

    lateinit var prevTraceState: TraceState
        private set
    private var latestSingleStepStartTime: Long = 0
    private var previousTraceStateTime: Long = 0

    // Stack depth -> Conditions declared in respective stack depth
    private val conditionTracer = ConditionTracer()
    private val arrayAccessTracer = newArrayAccessTracer(parseInfos)

    private val inputBufferTracer: InputBufferTracer = InputBufferTracer()

    private var isRunning = false

    // map to speed up lookup during debugging
    private val parseInfoByTypeNames = generateParseInfoByTypeNames()


    override fun launchAndSetup() {
        launchVM()
        installMainMethodEntryRequest()
        installClassPrepareRequest()
        installMethodExitRequest()
        installExceptionRequest()
        installVMDeathRequest()

        // Consume VMStartedEvent
        resumeAndSingleStep()
    }

    override fun resume() {
        nativeVM.resume()
    }

    override fun exit(exitCode: Int) {
        try {
            nativeVM.exit(1)
        } catch (e: Exception) {
            // Not a problem since we wanted to kill the VM anyway.
            println("Error shutting down the VM:\n$e")
        }
    }

    override fun isRunning(): Boolean {
        return isRunning
    }

    override fun input(input: String) {
        val ls = System.lineSeparator()
        val i = "$input$ls"
        inputSinceLastStep += i
        debuggeeInput.write(i)
        debuggeeInput.flush()
    }

    override fun getPreviousTraceState(): TraceState {
        return prevTraceState
    }

    override fun handleSingleStep(): StepResult? {
        latestSingleStepStartTime = System.currentTimeMillis()
        try {
            val eventSet: EventSet = nativeVM.eventQueue().remove(1000) ?: return StepResult(isWaitingForInput = true)

            if (eventSet.size > 1 && eventSet.any { it !is VMDeathEvent }) {
                // see JW-62
                // https://docs.oracle.com/javase/8/docs/jdk/api/jpda/jdi/com/sun/jdi/event/EventSet.html
                println("WARNING: EVENT SET CONTAINS ${eventSet.size} EVENTS! CURRENT DEBUGGER IMPLEMENTATION IS NOT ABLE TO HANDLE MULTIPLE EVENTS IN A SINGLE SET!")
            }
            val event = eventSet.eventIterator().nextEvent()
            if (event is LocatableEvent && event.thread().frameCount() > MAX_STACK_DEPTH) {
                exit(1)
                throw IllegalStateException(MAX_STACK_DEPTH_EXCEEDED_MESSAGE)
            }
            when (event) {
                // main() method entered
                is MethodEntryEvent -> {
                    if (!event.location().method().name().equals("main")) {
                        // We ignore static constructor calls that are executed before the main method
                        return null
                    }
                    // we don't need the request anymore
                    event.request().disable()

                    // Request for stepping through lines after this breakpoint
                    // only step into lines which are not excluded
                    installStepRequest(event.thread())

                    val traceState = generateTraceState(uri(event), event)
                    return StepResult(traceState)
                }
                // If this is StepEvent, then read & print variables.
                is StepEvent -> {
                    val className = event.location().declaringType().name()
                    if (!parseInfoByTypeNames.containsKey(className)) {
                        return null
                    }
                    if (outerClassMatchesOuterClassPattern(className, internalClassPatterns)) {
                        return null
                    }
                    val line = event.location().lineNumber()
                    if (line == prevTraceState.line
                        && className == prevTraceState.stack[0].`class`
                        && event.thread().frameCount() == prevTraceState.stack.size
                    ) {
                        return null // only use trace states if location has changed
                    }

                    val uri = parseInfoByTypeNames[className]!!.localUri

                    if (event.location().method().name().contains("<init>")) {
                        val methodLines = parseInfoByTypeNames[className]?.methodLines ?: setOf(line)
                        if (line !in methodLines) {
                            // [JW-27] do not add traceStates, which just contain the default constructor!
                            // But still create them (for example, to store "previousTraceState" to fake heap objects)
                            val _ignored = generateTraceState(uri, event)
                            return null
                        }
                    }
                    return StepResult(generateTraceState(uri, event))
                }
                // If this is ClassPrepareEvent, add the class to the list of relevant classes. The ClassExclusionFilter of the event ensures that this class is relevant
                is ClassPrepareEvent -> {
                    val clazz = event.referenceType()
                    if (clazz.name().split(".").last() == IN_CLASS_NAME && clazz is ClassType) {
                        inputBufferTracer.inClass = clazz
                    } else if (!outerClassMatchesOuterClassPattern(clazz.name(), internalClassPatterns)) {
                        relevantClasses.add(clazz)
                    }
                    // this was an internal event, continue with other stuff
                    return null
                }

                is VMDisconnectEvent -> {
                    println("  VM disconnected automatically at the end of the debuggee. (VMDisconnectEvent)")
                    isRunning = false
                    return StepResult(isVMRunning = false)
                }

                is VMDeathEvent -> {
                    println("  VM died. (VMDeathEvent)")
                    isRunning = false
                    return StepResult(isVMRunning = false)
                }

                is MethodExitEvent -> {
                    if (event.location().declaringType().name() != "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS") {
                        error("unexpected source of method exit event")
                    }
                    handleJavaWizTracing(event)
                    return null
                }

                is ExceptionEvent -> {
                    // if it is an uncaught exception, we forward the exception to the frontend to present the uncaught error message
                    val possibleUnhandledExceptionTraceState: TraceState? =
                        if (event.catchLocation() == null) {
                            processUncaughtExceptionEvent(event)
                        } else {
                            null
                        }
                    return StepResult(possibleUnhandledExceptionTraceState.packIntoMutableList()) merge resumeAndSingleStep()
                }
            }
            println("$event processed")
        } catch (e: VMDisconnectedException) {
            println("  VM disconnected automatically at the end of the debuggee. (VMDisconnectedException)")
            isRunning = false
            return StepResult(isVMRunning = false)
        }
        return StepResult()
    }

    private fun uri(event: LocatableEvent): String { // TODO: add test
        val className = event.location().declaringType().name()
        val info = parseInfoByTypeNames[className]
        if (info != null) {
            return info.localUri
        } else {
            println("WARNING: could not resolve uri of $className.")
            return event.location().sourcePath()
        }
    }

    private fun generateTraceState(
        sourceFileUri: String,
        event: LocatableEvent,
    ): TraceState {
        val stepDiffTime = System.currentTimeMillis() - latestSingleStepStartTime
        val traceStateDiffTime = System.currentTimeMillis() - previousTraceStateTime

        val inputBufferInfo = inputBufferTracer.getInputBufferInfo(event.thread())

        val traceState = buildTraceState(
            event,
            sourceFileUri,
            event.location().lineNumber(),
            conditionTracer.collectConditionValuesForStepEvent(event.thread().frameCount()),
            // create copy of conditions so that we serialize the current state of evaluated
            arrayAccessTracer.collectAccessValuesForStepEvent(event.thread().frameCount()),
            streamToString(debuggeeOutput),
            streamToString(debuggeeError),
            inputSinceLastStep,
            relevantClasses.toList(),
            inputBufferInfo,
            internalClassPatterns,
            traceStateDiffTime,
            stepDiffTime,
        )

        if (::prevTraceState.isInitialized) {
            addFakeObjects(traceState)
        }

        inputSinceLastStep = ""
        prevTraceState = traceState

        if (previousTraceStateTime == 0L) {
            previousTraceStateTime = System.currentTimeMillis()
        }
        println("Time since latest single step start time /\n'Time needed to build trace state': ${stepDiffTime}ms")
        println("Time since last trace state: ${traceStateDiffTime}ms")
        previousTraceStateTime = System.currentTimeMillis()

        return traceState
    }

    private fun handleJavaWizTracing(event: MethodExitEvent) {
        val callingMethodStackDepth = event.thread().frameCount() - 1 // don't count $JavaWiz - frame
        val callingFrame = event.thread().frame(1)
        val callingLocation = callingFrame.location()
        val parseInfo = parseInfoByTypeNames[callingLocation.declaringType().name()]!!

        val javaWizFrame = event.thread().frame(0)

        when (javaWizFrame.location().method().name()) {
            "recordCondition" -> {
                val conditionId = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("conditionId")!!) as IntegerValue).value()
                val conditionValue = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("value")!!) as BooleanValue).value()

                conditionTracer.addConditionValue(
                    callingMethodStackDepth,
                    ConditionValue(conditionId, parseInfo.conditions[conditionId], conditionValue, evaluated = true)
                )
            }

            "recordArrayAccess" -> {
                val arrayAccessID = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("arrayAccessId")!!) as IntegerValue).value()
                val index = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("index")!!) as IntegerValue).value()
                val arrayObjectID = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("array")!!) as ObjectReference).uniqueID()
                val dimension = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("dimension")!!) as IntegerValue).value()

                arrayAccessTracer.addPartialArrayAccess(
                    callingMethodStackDepth,
                    parseInfo.localUri,
                    arrayAccessID,
                    indexValue = index,
                    objectID = arrayObjectID,
                    dimension = dimension
                )
            }

            else -> error("unknown method type in class $JAVAWIZ_CLASS: ${javaWizFrame.location().method().name()}")
        }
    }

    private fun launchVM() {
        fun installStreamHandling() {
            val proc = nativeVM.process()

            val charset = Charsets.ISO_8859_1

            debuggeeOutput = proc.inputStream.reader(charset)
            debuggeeError = proc.errorStream.reader(charset)
            debuggeeInput = proc.outputStream.bufferedWriter(charset)
        }

        val launchingConnector = Bootstrap.virtualMachineManager().defaultConnector()
        val arguments = launchingConnector.defaultArguments()
        arguments["main"]!!.setValue(fullyQualifiedMainClassName)
        arguments["options"]!!.setValue(
            "-cp \"$cp\""
        )

        nativeVM = launchingConnector.launch(arguments)
        isRunning = true

        installStreamHandling()
        nativeVM.suspend()
    }

    private fun installMainMethodEntryRequest() {
        // Find main thread
        val mainThread = nativeVM.allThreads().find { it.name() == "main" } ?: error("could not find main thread")

        // Here we install a MethodEntryRequest that tells the JDI that
        // we're interested in the method entry event.
        val methodEntryRequest: MethodEntryRequest = nativeVM.eventRequestManager().createMethodEntryRequest()
        methodEntryRequest.addClassFilter(fullyQualifiedMainClassName)
        methodEntryRequest.addThreadFilter(mainThread)
        methodEntryRequest.enable()
    }

    private fun installMethodExitRequest() {
        val request = nativeVM.eventRequestManager().createMethodExitRequest()
        request.addClassFilter("$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS")
        request.enable()
    }

    private fun installClassPrepareRequest() {
        val classPrepareRequest: ClassPrepareRequest = nativeVM.eventRequestManager().createClassPrepareRequest()
        internalClassPatterns.forEach {
            if (it != "In" && !it.contains("In\$") && !it.endsWith(".In")) {
                classPrepareRequest.addClassExclusionFilter(it)
            }
        }
        classPrepareRequest.enable()
    }

    private fun installExceptionRequest() {
        val notifyCaught = true
        val notifyUncaught = true
        val exceptionRequest = nativeVM.eventRequestManager().createExceptionRequest(null, notifyCaught, notifyUncaught)
        exceptionRequest.enable()
    }

    private fun installVMDeathRequest() {
        try {
            nativeVM.eventRequestManager().createVMDeathRequest().enable()
        } catch (ex: UnsupportedOperationException) {
            println("Could not install VMDeathRequest because VM does not support this kind of event")
        }
    }

    private fun installStepRequest(thread: ThreadReference) {
        val stepRequest = nativeVM.eventRequestManager().createStepRequest(
            thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO
        )
        internalClassPatterns.forEach {
            stepRequest.addClassExclusionFilter(it)
        }
        stepRequest.addClassExclusionFilter(JAVAWIZ_CLASS)
        stepRequest.enable()
    }

    private fun streamToString(stream: InputStreamReader): String = buildString {
        while (stream.ready()) {
            append(stream.read().toChar())
        }
    }

    /**
     *  if the exception is uncaught, printStackTrace gets called
     */
    private fun processUncaughtExceptionEvent(event: ExceptionEvent): TraceState {

        // helper function to avoid redundancy
        fun ObjectReference.invoke(methodName: String): Value {
            val method = referenceType().methodsByName(methodName).getOrNull(0) ?: error("could not find method $methodName on reference type $this")
            return invokeMethod(event.thread(), method, listOf(), ObjectReference.INVOKE_SINGLE_THREADED)
        }

        /*
        * we need to disable all event requests and re-enable them afterwards,
        * otherwise we cannot call invokeMethod() without causing a deadlock,
        * because the debuggee creates step events upon method invocation which cannot be handled
        * because the event handler is still waiting for the debuggee to return.
        * See the docs of invokeMethod() for more info.
        *
        * most of these request types are not used by this debugger, but we want to be safe.
        * */
        val previouslyEnabledEventRequests = nativeVM.getEnabledRequests()

        previouslyEnabledEventRequests.forEach { it.disable() }

        event.exception().invoke("printStackTrace")

        /*
        * we only explicitly record uncaught exceptions, because uncaught exceptions
        * are the last recorded Event to happen in the debuggee and the printed stacktrace needs to be displayed.
        *
        * for caught exceptions, we do not record anything and merely adjust the lines in the stacktrace.
        * this is necessary because a user might call printStackTrace() on an exception they caught.
        *
        * we reuse most of the data (stack, heap, location) from the previous trace state
        * because the exception event does not give any useful info (its location might not be in user-written source code).
        * */
        val traceState: TraceState = generateTraceState(prevTraceState.sourceFileUri, event)
        // use the previous source code or any source code because it is hard to know
        // where the exception originated

        previouslyEnabledEventRequests.forEach { it.enable() } // re-enable all event requests since we are done with our method invocations

        return traceState
    }
}
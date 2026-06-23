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
    val excludeFromSteppingPatterns: List<String>,
    val excludeFieldsPatterns: List<String>,
    val detailedFieldsPatterns: List<String>
) : VirtualMachine {

    private lateinit var nativeVM: com.sun.jdi.VirtualMachine

    private val relevantClasses: MutableSet<ReferenceType> = linkedSetOf()

    /** Classes whose fields are collected but shown only in specialised visualisations, not in the Memory View. */
    private val detailedFieldsClasses: MutableSet<ReferenceType> = linkedSetOf()

    private lateinit var debuggeeInput: BufferedWriter
    private lateinit var debuggeeOutput: InputStreamReader
    private lateinit var debuggeeError: InputStreamReader

    private var inputSinceLastStep: String = ""

    lateinit var prevTraceState: TraceState
        private set
    private var latestSingleStepStartTime: Long = 0
    private var timeOfLastTraceStateGeneration: Long = 0

    // Stack depth -> Conditions declared in respective stack depth
    private val conditionTracer = ConditionTracer()
    private val arrayAccessTracer = newArrayAccessTracer(parseInfos)
    private val streamOperationTracer = StreamOperationTracer()

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
        try {
            val eventSet: EventSet = nativeVM.eventQueue().remove(1000) ?: return StepResult(isWaitingForInput = true)

            if (eventSet.size > 1 && eventSet.any { it !is VMDeathEvent }) {
                // see JW-62
                // https://docs.oracle.com/javase/8/docs/jdk/api/jpda/jdi/com/sun/jdi/event/EventSet.html
                println("WARNING: EVENT SET CONTAINS ${eventSet.size} EVENTS! CURRENT DEBUGGER IMPLEMENTATION IS NOT ABLE TO HANDLE MULTIPLE EVENTS IN A SINGLE SET!")
            }
            val event = eventSet.eventIterator().nextEvent()

            latestSingleStepStartTime = System.currentTimeMillis()
            println("[step timing - ${event.javaClass.simpleName}] started processing ${event.javaClass.simpleName}")

            if (event is LocatableEvent && event.thread().frameCount() > MAX_STACK_DEPTH) {
                exit(1)
                throw IllegalStateException(MAX_STACK_DEPTH_EXCEEDED_MESSAGE)
            }
            val result: StepResult? = when (event) {
                is MethodEntryEvent -> handleMethodEntryEvent(event)
                is StepEvent -> handleStepEvent(event)
                is ClassPrepareEvent -> handleClassPrepareEvent(event)
                is VMDisconnectEvent -> {
                    println("  VM disconnected automatically at the end of the debuggee. (VMDisconnectEvent)"); handleVMTermination()
                }

                is VMDeathEvent -> {
                    println("  VM died. (VMDeathEvent)"); handleVMTermination()
                }

                is MethodExitEvent -> handleMethodExitEvent(event)
                is ExceptionEvent -> handleExceptionEvent(event)
                else -> StepResult().also { println("$event processed") }
            }
            val stepProcessingTime = System.currentTimeMillis() - latestSingleStepStartTime
            println("[step timing] processed step in ${stepProcessingTime}ms")
            return result
        } catch (e: VMDisconnectedException) {
            println("  VM disconnected automatically at the end of the debuggee. (VMDisconnectedException)")
            isRunning = false
            return StepResult(isVMRunning = false)
        }
    }

    // main() method entered: disable the entry request, install a step request, and record the first trace state.
    private fun handleMethodEntryEvent(event: MethodEntryEvent): StepResult? {
        if (event.location().method().name() != "main") {
            // Ignore static constructor calls that are executed before the main method.
            return null
        }
        event.request().disable()
        installStepRequest(event.thread())
        return StepResult(generateTraceState(uri(event), event))
    }

    private fun handleStepEvent(event: StepEvent): StepResult? {
        val className = event.location().declaringType().name()
        if (!parseInfoByTypeNames.containsKey(className)) return null
        if (className.outerClassMatchesOuterClassPattern(excludeFromSteppingPatterns)) {
            println("Step Event sent for internal class! This should not happen!")
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
                // [JW-27] Do not expose trace states for the implicit default constructor (including record canonical constructors),
                // but still generate them so that prevTraceState is kept up-to-date for fake heap objects.
                // Yet, we may not consume the input, since otherwise it gets lost due to us never sending
                // a trace state containing the input to the frontend.
                generateTraceState(uri, event, false)
                return null
            }
        }
        return StepResult(generateTraceState(uri, event))
    }

    private fun handleClassPrepareEvent(event: ClassPrepareEvent): StepResult? {
        val clazz = event.referenceType()
        println("Preparing class ${clazz.name()}")
        if (clazz.name().split(".").last() == IN_CLASS_NAME && clazz is ClassType) {
            inputBufferTracer.inClass = clazz
        }
        val isExcludedFromFields = clazz.name().outerClassMatchesOuterClassPattern(excludeFieldsPatterns)
        val isDetailedFields = clazz.name().outerClassMatchesOuterClassPattern(detailedFieldsPatterns)
        if (!isExcludedFromFields || isDetailedFields) relevantClasses.add(clazz)
        if (isDetailedFields) detailedFieldsClasses.add(clazz)
        return null
    }

    private fun handleVMTermination(): StepResult {
        isRunning = false
        return StepResult(isVMRunning = false)
    }

    private fun handleMethodExitEvent(event: MethodExitEvent): StepResult? {
        if (event.location().declaringType().name() != "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS") {
            error("unexpected source of method exit event")
        }
        handleJavaWizTracing(event)
        return null
    }

    private fun handleExceptionEvent(event: ExceptionEvent): StepResult {
        // If it is an uncaught exception, forward it to the frontend to present the error message.
        val uncaughtExceptionTraceState: TraceState? =
            if (event.catchLocation() == null) processUncaughtExceptionEvent(event)
            else null
        return StepResult(uncaughtExceptionTraceState.packIntoMutableList()) merge resumeAndSingleStep()
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
        consumeInput: Boolean = true
    ): TraceState {
        val traceStateDiffTime =
            if (timeOfLastTraceStateGeneration == 0L) 0L
            else System.currentTimeMillis() - timeOfLastTraceStateGeneration

        val inputBufferInfo = inputBufferTracer.getInputBufferInfo(event.thread())

        val traceStateBuildStartTime = System.currentTimeMillis()

        val stepProcessingTime = System.currentTimeMillis() - latestSingleStepStartTime
        val traceState = buildTraceState(
            event,
            sourceFileUri,
            event.location().lineNumber(),
            conditionTracer.collectConditionValuesForStepEvent(event.thread().frameCount()),
            // create copy of conditions so that we serialize the current state of evaluated
            arrayAccessTracer.collectAccessValuesForStepEvent(event.thread().frameCount()),
            streamOperationTracer.visualizationObjects,
            streamToString(debuggeeOutput),
            streamToString(debuggeeError),
            inputSinceLastStep,
            relevantClasses,
            inputBufferInfo,
            excludeFromSteppingPatterns,
            detailedFieldsClasses,
            latestSingleStepStartTime,
            stepProcessingTime,
            traceStateDiffTime
        )
        if (::prevTraceState.isInitialized) {
            addFakeObjects(traceState)
        }
        val traceStateBuildTime = System.currentTimeMillis() - traceStateBuildStartTime

        if (inputSinceLastStep != "" && consumeInput) {
            println("[input] Input ${inputSinceLastStep.replace("\n", "")} stored in new trace state, resetting")
            inputSinceLastStep = ""
        }
        prevTraceState = traceState

        println("[state building timing] built trace state in ${traceStateBuildTime}ms")
        val traceStateDiffText =
            if (timeOfLastTraceStateGeneration == 0L) "n/a (first trace state)"
            else "${traceStateDiffTime}ms"
        println("[state interval] elapsed since previous emitted trace state: $traceStateDiffText")
        timeOfLastTraceStateGeneration = System.currentTimeMillis()

        return traceState
    }

    private fun handleJavaWizTracing(event: MethodExitEvent) {
        // don't count $JavaWiz - frames
        var callingUserMethodFrameIndex = 0
        while (event.thread().frame(callingUserMethodFrameIndex).location().declaringType().name() !in parseInfoByTypeNames.keys) {
            callingUserMethodFrameIndex++
        }
        val callingFrame = event.thread().frame(callingUserMethodFrameIndex)
        val callingLocation = callingFrame.location()
        val parseInfo = parseInfoByTypeNames[callingLocation.declaringType().name()]!!

        val javaWizFrame = event.thread().frame(0)

        when (javaWizFrame.location().method().name()) {
            "recordCondition" -> {
                val conditionId = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("conditionId")!!) as IntegerValue).value()
                val conditionValue = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("value")!!) as BooleanValue).value()

                conditionTracer.addConditionValue(
                    0, // do not use `callingUserMethodFrameIndex` here because later on in the trace state the user code method will be at index 0 (since JavaWiz-methods are
                    // excluded from the stack trace)
                    ConditionValue(conditionId, parseInfo.conditions[conditionId], conditionValue, evaluated = true)
                )
            }

            "recordArrayAccess" -> {
                val arrayAccessID = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("arrayAccessId")!!) as IntegerValue).value()
                val index = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("index")!!) as IntegerValue).value()
                val arrayObjectID = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("array")!!) as ObjectReference).uniqueID()
                val dimension = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("dimension")!!) as IntegerValue).value()

                arrayAccessTracer.addPartialArrayAccess(
                    0, // do not use `callingUserMethodFrameIndex` here because later on in the trace state the user code method will be at index 0 (since JavaWiz-methods are
                    // excluded from the stack trace)
                    parseInfo.localUri,
                    arrayAccessID,
                    indexValue = index,
                    objectID = arrayObjectID,
                    dimension = dimension
                )
            }

            "traceStream" -> {
                val direction = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("direction")!!) as StringReference).value()
                val elemUntyped = javaWizFrame.getValue(javaWizFrame.visibleVariableByName("elem")!!)
                var valuetype = elemUntyped.type().name()
                var isMap = false
                var value = when (elemUntyped) {
                    is StringReference -> elemUntyped.value()
                    is IntegerValue -> elemUntyped.value()
                    is DoubleValue -> elemUntyped.value()
                    is FloatValue -> elemUntyped.value()
                    is LongValue -> elemUntyped.value()
                    is BooleanValue -> elemUntyped.value()
                    is CharValue -> elemUntyped.value()
                    is ByteValue -> elemUntyped.value()
                    is ShortValue -> elemUntyped.value()
                    is ArrayReference -> elemUntyped.values
                    is ObjectReference -> {
                        val primitiveTypeName = when (valuetype) {
                            "java.lang.Integer" -> "int"
                            "java.lang.Double" -> "double"
                            "java.lang.Float" -> "float"
                            "java.lang.Long" -> "long"
                            "java.lang.Boolean" -> "boolean"
                            "java.lang.Character" -> "char"
                            "java.lang.Byte" -> "byte"
                            "java.lang.Short" -> "short"
                            else -> null
                        }

                        if (primitiveTypeName != null) {
                            valuetype = primitiveTypeName
                            val valueField = elemUntyped.referenceType().fieldByName("value")
                            val fieldValue = elemUntyped.getValue(valueField!!)
                            when (fieldValue) {
                                is IntegerValue -> fieldValue.value()
                                is DoubleValue -> fieldValue.value()
                                is FloatValue -> fieldValue.value()
                                is LongValue -> fieldValue.value()
                                is BooleanValue -> fieldValue.value()
                                is CharValue -> fieldValue.value()
                                is ByteValue -> fieldValue.value()
                                is ShortValue -> fieldValue.value()
                                else -> error("unknown value type for wrapper $valuetype: ${fieldValue?.type()?.name()}")
                            }
                        } else {
                            valuetype = valuetype.drop(valuetype.lastIndexOf('$') + 1)
                            elemUntyped.uniqueID()
                        }
                    }

                    else -> error("unknown stream element type: ${elemUntyped.type().name()}")
                }
                val operationName = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("name")!!) as StringReference).value()
                val operationId = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("id")!!) as IntegerValue).value()
                val streamId = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("streamId")!!) as IntegerValue).value()
                val param = (javaWizFrame.getValue(javaWizFrame.visibleVariableByName("param")!!) as StringReference).value()
                if (valuetype.contains("Map") && elemUntyped is ObjectReference) {
                    isMap = true
                    val previouslyEnabledEventRequests = nativeVM.getEnabledRequests()
                    previouslyEnabledEventRequests.forEach { it.disable() }

                    try {
                        val thread = event.thread()
                        val mapRef = elemUntyped

                        fun formatElement(elem: Value?): String {
                            return when (elem) {
                                is StringReference -> elem.toString().replace("\"", "")
                                is ObjectReference -> "${elem.uniqueID()}"
                                else -> elem?.toString() ?: "null"
                            }
                        }

                        fun formatValue(v: Value?): String {
                            if (v == null) return "null"
                            if (v is ArrayReference) {
                                return "${v.uniqueID()}"
                            }
                            if (v is ObjectReference) {
                                val type = v.referenceType()
                                val isList = (type as? ClassType)?.allInterfaces()?.any { it.name() == "java.util.List" } == true
                                if (isList) {
                                    val toArrayMethod = type.methodsByName("toArray").find { it.argumentTypeNames().isEmpty() }
                                    if (toArrayMethod != null) {
                                        val listAsArray = v.invokeMethod(thread, toArrayMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED) as? ArrayReference
                                        if (listAsArray != null) {
                                            return listAsArray.values.joinToString(prefix = "[", postfix = "]", transform = ::formatElement)
                                        }
                                    }
                                }
                                return formatElement(v)
                            }
                            return v.toString()
                        }

                        val entrySetMethod = mapRef.referenceType().methodsByName("entrySet").firstOrNull()
                        val entrySet = if (entrySetMethod != null) {
                            mapRef.invokeMethod(thread, entrySetMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED) as? ObjectReference
                        } else null

                        if (entrySet != null) {
                            val toArrayMethod = entrySet.referenceType().methodsByName("toArray").find { it.argumentTypeNames().isEmpty() }
                            if (toArrayMethod != null) {
                                val entriesArray = entrySet.invokeMethod(thread, toArrayMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED) as? ArrayReference
                                val mapBuilder = StringBuilder()
                                entriesArray?.values?.forEachIndexed { index, entryValue ->
                                    if (entryValue is ObjectReference) {
                                        val entryType = entryValue.referenceType()
                                        val getKeyMethod = entryType.methodsByName("getKey").first()
                                        val getValueMethod = entryType.methodsByName("getValue").first()
                                        val keyRef = entryValue.invokeMethod(thread, getKeyMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED)
                                        val valueRef = entryValue.invokeMethod(thread, getValueMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED)
                                        val keyStr = when (keyRef) {
                                            is StringReference -> "\"${keyRef.value()}\""
                                            is ObjectReference -> {
                                                val toStringMethod = keyRef.referenceType().methodsByName("toString").find { it.argumentTypeNames().isEmpty() }
                                                if (toStringMethod != null) {
                                                    (keyRef.invokeMethod(thread, toStringMethod, emptyList(), ObjectReference.INVOKE_SINGLE_THREADED) as? StringReference)?.value()
                                                        ?: keyRef.uniqueID().toString()
                                                } else {
                                                    keyRef.uniqueID().toString()
                                                }
                                            }

                                            else -> keyRef?.toString() ?: "null"
                                        }
                                        val valStr = formatValue(valueRef)
                                        if (index > 0) mapBuilder.append("; ")
                                        mapBuilder.append("$keyStr=$valStr")
                                    }
                                }
                                value = mapBuilder.toString()
                            }
                        }
                    } catch (e: Exception) {
                        value = "Map(Error: ${e.message})"
                    } finally {
                        previouslyEnabledEventRequests.forEach { it.enable() }
                    }
                }
                when (direction) {
                    "START" -> streamOperationTracer.traceStartStream(operationName, operationId, value, valuetype, streamId)
                    "IN" -> streamOperationTracer.traceInStream(operationName, operationId, value, valuetype, streamId, param)
                    "OUT" -> streamOperationTracer.traceOutStream(operationName, operationId, value, valuetype, streamId, param)
                    "END" -> streamOperationTracer.traceEndStream(operationName, operationId, streamId, param, value.toString())
                    "NOP" -> streamOperationTracer.traceNOPEndStream(operationId)
                    else -> error("unknown direction for stream element")
                }
            }

            "traceParam" -> {
                // Already handled in traceStream, as traceStream is called from within traceParam
            }

            "collectAndTransformStreamOperationValues" -> {
                streamOperationTracer.collectAndTransformStreamOperationValues()
            }

            // This would fire for lambdas within the JavaWiz class
            //else -> error("unknown method type in class $JAVAWIZ_CLASS: ${javaWizFrame.location().method().name()}")
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
        classPrepareRequest.enable()

        // Check for already-loaded classes that match detailedFieldsPatterns (standard-library classes loaded by
        // the bootstrap class loader do not fire ClassPrepareEvents, so we must check for them eagerly).
        for (clazz in nativeVM.allClasses()) {
            if (clazz.name().outerClassMatchesOuterClassPattern(detailedFieldsPatterns)) {
                println("Found already loaded detailed-fields class: ${clazz.name()} -> mark as relevant")
                relevantClasses.add(clazz)
                detailedFieldsClasses.add(clazz)
            }
        }
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
        excludeFromSteppingPatterns.forEach {
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
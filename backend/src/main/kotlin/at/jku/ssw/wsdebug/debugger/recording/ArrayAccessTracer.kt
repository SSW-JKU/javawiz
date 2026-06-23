package at.jku.ssw.wsdebug.debugger.recording

import at.jku.ssw.wsdebug.compilation.ParseInfo
import at.jku.ssw.wsdebug.compilation.instrumentation.ArrayAccess
import at.jku.ssw.wsdebug.compilation.instrumentation.VariableTarget

fun newArrayAccessTracer(parseInfos: List<ParseInfo>) = ArrayAccessTracer(
    buildMap {
        parseInfos.forEach { info ->
            info.arrayAccesses.forEach { access ->
                put(Pair(info.localUri, access.id), access)
            }
        }
    })

data class ArrayAccessTracer(val arrayAccesses: Map<Pair<String, Int>, ArrayAccess>) {
    // Stack depth -> most recent array accesses for array access id within stack depth
    private var arrayAccessValues: MutableMap<Int, MutableMap<Int, ArrayAccessValue>> = mutableMapOf()

    private val partialArrayAccessValues: MutableMap<Int, MutableList<PartialArrayAccessValue>> = mutableMapOf()

    private var relevantLocals: MutableMap<Int, MutableList<String>> = mutableMapOf()

    fun collectAccessValuesForStepEvent(maxStackDepth : Int): Map<Int, Set<ArrayAccessValue>> {
        mergePartial()
        arrayAccessValues = arrayAccessValues.filter { it.key <= maxStackDepth }.toMutableMap()
        relevantLocals = relevantLocals.filter { it.key <= maxStackDepth }.toMutableMap()
        val result = arrayAccessValues.mapValues { (_, arrayAccessMap) -> arrayAccessMap.values.map { it.copy() }.toSet() }
        resetEvaluatedFlags()

        return result
    }

    private fun resetEvaluatedFlags() {
        arrayAccessValues.forEach { (_, arrayAccesses) ->
            arrayAccesses.forEach { (_, arrayAccess) ->
                arrayAccess.evaluated = false
            }
        }
    }

    private fun mergePartial() {
        val merged = mutableListOf<PartialArrayAccessValue>()
        partialArrayAccessValues.forEach { (stackDepth, accesses) ->
            accesses.groupBy { Pair(it.localUri, it.accessID) }
                .forEach { (k, v) ->
                    val access = arrayAccesses[k]!!
                    val requiredDimension = access.indexExpressions.size
                    if (v.size == requiredDimension) {
                        merged.addAll(v)
                        val anyElement = v.first()
                        v.forEach{ partialArrayAccessValue ->
                            if(partialArrayAccessValue.arrayObjectID != anyElement.arrayObjectID) {
                                error("Partial Array access values in the same location (uri, token, stack-depth) have distinct array object id's")
                            }
                        }
                        arrayAccessValues.computeIfAbsent(stackDepth){ mutableMapOf() }
                        arrayAccessValues[stackDepth]!![anyElement.accessID] = ArrayAccessValue(
                            v.sortedBy { it.dimension }.map { it.index },
                            evaluated = true,
                            arrayObjectID = anyElement.arrayObjectID,
                            arrayAccess = access.copy(
                                assignmentSourceVariableNames = access.assignmentSourceVariableNames.filter {
                                    // only trace those variable sources that were written to previously
                                    relevantLocals[stackDepth]?.contains(it) ?: false
                                }
                            )
                        )

                        if(access.assignmentTarget is VariableTarget) {
                            relevantLocals.computeIfAbsent(stackDepth){ mutableListOf() }
                            relevantLocals[stackDepth]!!.add(access.assignmentTarget.name)
                        }

                    }
                }
        }
        partialArrayAccessValues.values.forEach { it.removeAll(merged) }
    }

    fun addPartialArrayAccess(stackDepth: Int, sourceFileUri: String, accessID: Int, indexValue: Int, objectID: Long, dimension: Int) {
        partialArrayAccessValues.computeIfAbsent(stackDepth) { mutableListOf() }
        partialArrayAccessValues[stackDepth]?.add(
            PartialArrayAccessValue(
                sourceFileUri,
                accessID = accessID,
                index = indexValue,
                arrayObjectID = objectID,
                dimension = dimension
            )
        )
    }
}
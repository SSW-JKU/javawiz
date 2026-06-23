package at.jku.ssw.wsdebug.debugger.recording

class ConditionTracer {
    var conditionValues = mutableMapOf<Int, MutableMap<Int, ConditionValue>>()

    fun addConditionValue(stackDepth: Int, conditionValue: ConditionValue) {
        conditionValues.computeIfAbsent(stackDepth) { mutableMapOf() }[conditionValue.id] = conditionValue
    }

    fun collectConditionValuesForStepEvent(stackDepth: Int): Map<Int, Set<ConditionValue>> {
        filterConditions(stackDepth)
        val result = conditionValues.mapValues { (_, conditionMap) -> conditionMap.values.map { it.copy() }.toSet() }
        resetEvaluatedFlags()

        return result
    }

    private fun resetEvaluatedFlags() {
        conditionValues.forEach { (_, conditions) ->
            conditions.forEach { (_, condition) ->
                condition.evaluated = false
            }
        }
    }

    private fun filterConditions(stackDepth: Int) {
        conditionValues = conditionValues.filterKeys { it <= stackDepth }.toMutableMap()
    }
}
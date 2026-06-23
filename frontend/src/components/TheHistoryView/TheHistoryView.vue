import { useGeneralStore } from '../../store/GeneralStore';
<template>
  <div id="history-wrapper">
    <NavigationBarWithSettings :viz-id="visualizationStore.HISTORY.id" />
    <b>The History View for {{ generalStore.debugger.fullTrace.traceLength }} trace states</b><br>
    <i>This view is work-in-progress -- Coming soon!</i><br>
    <ul>
      <li v-for="(state, index) in traceStates" :key="index" :class="classes(index)">
        State {{ index }}: {{ state.sourceFileUri }}, line {{ state.line }} ({{ state.stack[0].class }}#{{ state.stack[0].method }})
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useGeneralStore } from '@/store/GeneralStore';
import { computed } from 'vue';
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue';
import { useVisualizationStore } from '@/store/VisualizationStore';

const generalStore = useGeneralStore()
const visualizationStore = useVisualizationStore()

const traceStates = computed(() => Array.from({ length: generalStore.debugger.fullTrace.traceLength }, (_, i) => generalStore.debugger.fullTrace.getTraceState(i)!))
const currentStateIndex = computed(() => generalStore.currentTraceData?.stateIndex ?? -1)

function classes (index: number) {
  if (index < currentStateIndex.value) {
    return 'past-line'
  } else if (index > currentStateIndex.value) {
    return 'future-line'
  } else if (index === currentStateIndex.value) {
    return 'current-line'
  }
}
</script>

<style>
#history-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  padding-left: 36px;
}

.past-line {
  font-weight: bold;
}

.current-line {
  font-weight: bold;
  color: green;
}

.future-line {
  color: gray;
}
</style>
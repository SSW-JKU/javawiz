<template>
  <!-- background color is set here because class style is overruled by default splitpane theme -->
  <pane :style="style">
    <viz-chooser v-if="selectedPane === -1" @selected="id => selectViz(id)" />

    <before-compilation-text v-if="vizSelected" />
    <compilation-spinner v-if="vizSelected" />

    <the-flow-chart v-if="selectedPane === FLOWCHART && generalStore.debugger.compiled" />
    <the-heap-visualization v-if="selectedPane === HEAP && generalStore.debugger.compiled" />
    <the-desk-test v-if="selectedPane === DESKTEST && generalStore.debugger.compiled" />
    <the-array-visualization v-if="selectedPane === ARRAY && generalStore.debugger.compiled" />
    <the-list-visualization v-if="selectedPane === LINKEDLIST && generalStore.debugger.compiled" />
    <the-tree-visualization v-if="selectedPane === BINARYTREE && generalStore.debugger.compiled" />
    <the-sequence-diagram v-if="selectedPane === SEQUENCEDIAGRAM && generalStore.debugger.compiled" />
    <the-in-viz v-if="selectedPane === INVIZ && generalStore.debugger.compiled" />
  </pane>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'
import VizChooser from '@/components/VizLayouts/VizChooser.vue'
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import CompilationSpinner from '@/components/VizLayouts/CompilationSpinner.vue'
import BeforeCompilationText from '@/components/VizLayouts/BeforeCompilationText.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import TheFlowChart from '@/components/TheFlowChart/TheFlowChart.vue'
import TheHeapVisualization from '@/components/TheHeapVisualization/TheHeapVisualization.vue'
import TheDeskTest from '@/components/TheDeskTest/TheDeskTest.vue'
import TheArrayVisualization from '@/components/DataStructureVisualizations/TheArrayVisualization/TheArrayVisualization.vue'
import TheListVisualization from '@/components/DataStructureVisualizations/TheListVisualization/TheListVisualization.vue'
import TheTreeVisualization from '@/components/DataStructureVisualizations/TheTreeVisualization/TheTreeVisualization.vue'
import TheSequenceDiagram from '@/components/TheSequenceDiagram/TheSequenceDiagram.vue'
import TheInViz from '@/components/TheInViz.vue'
import { ARRAY, BINARYTREE, DESKTEST, FLOWCHART, HEAP, INVIZ, LINKEDLIST, SEQUENCEDIAGRAM, usePaneVisibilityStore } from '@/store/PaneVisibilityStore'

defineComponent({
  components: {
    TheInViz,
    TheSequenceDiagram,
    TheTreeVisualization,
    TheListVisualization,
    TheArrayVisualization,
    TheDeskTest,
    TheHeapVisualization,
    TheFlowChart,
    BeforeCompilationText,
    CompilationSpinner,
    VizChooser,
    Pane
  }
})
const { panelNr } = defineProps<{ panelNr: number }>()

const paneVisibilityStore = usePaneVisibilityStore()
const selectedPane = computed(() => paneVisibilityStore.panelToPane[panelNr])
const vizSelected = computed(() => selectedPane.value !== -1)
const style = computed(() => {
  return {
    'background-color': (selectedPane.value === -1 ? 'rgb(42,70,101)' : 'rgb(255, 255, 255)')
  }
})

const generalStore = useGeneralStore()

function selectViz (id: number) {
  paneVisibilityStore.showPane(id, panelNr)
}

</script>

<style scoped>
.pane-default-text {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Roboto", sans-serif;
  text-align: center;
}
</style>

<template>
  <!-- background color is set here because class style is overruled by default splitpane theme -->
  <pane :style="style">
    <viz-chooser v-if="!vizSelected" @selected="id => selectViz(id)" />

    <!-- internally hidden if already compiled -->
    <before-compilation-text v-if="vizSelected" />
    <compilation-spinner v-if="vizSelected" />

    <component :is="selectedViz.view" v-if="selectedViz && generalStore.debugger.compiled" />
  </pane>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VizChooser from '@/components/VizLayouts/VizChooser.vue'
import { Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import CompilationSpinner from '@/components/VizLayouts/CompilationSpinner.vue'
import BeforeCompilationText from '@/components/VizLayouts/BeforeCompilationText.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { UserLayoutPlacement, useVisualizationStore } from '@/store/VisualizationStore'

const { location } = defineProps<{ location: UserLayoutPlacement }>()

const visualizationStore = useVisualizationStore()
const selectedViz = computed(() => {
  const vizIdAtLocation = visualizationStore.visualizationIdsByPlacement[location]
  if (vizIdAtLocation >= 0) {
    return visualizationStore.visualizationsById[vizIdAtLocation]
  } else {
    return null
  }
})
const vizSelected = computed(() => selectedViz.value !== null)
const style = computed(() => {
  return {
    'background-color': (selectedViz.value === null ? 'rgb(42,70,101)' : 'rgb(255, 255, 255)')
  }
})

const generalStore = useGeneralStore()

function selectViz (id: number) {
  visualizationStore.show(id, location)
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

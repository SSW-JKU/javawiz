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

<script lang="ts">
import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import VizChooser from '@/components/VizLayouts/VizChooser.vue'
import Pane from 'splitpanes-raw/pane.vue'
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
import { ARRAY, BINARYTREE, CONSOLE, DESKTEST, EDITOR, FLOWCHART, HEAP, INVIZ, LINKEDLIST, SEQUENCEDIAGRAM, usePaneVisibilityStore } from '@/store/PaneVisibilityStore'

export default defineComponent({
  name: 'VisualizationPane',
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
  },
  props: {
    panelNr: {
      type: Number,
      required: true
    }
  },
  data: function () {
    return {
      EDITOR,
      CONSOLE,
      FLOWCHART,
      HEAP,
      ARRAY,
      LINKEDLIST,
      BINARYTREE,
      DESKTEST,
      SEQUENCEDIAGRAM,
      INVIZ
    }
  },
  computed: {
    selectedPane: function () {
      return this.paneVisibilityStore.panelToPane[this.panelNr]
    },
    vizSelected: function () {
      return this.selectedPane !== -1
    },
    style: function () {
      return {
        'background-color': this.selectedPane === -1 ? 'rgb(42,70,101)' : 'rgb(255, 255, 255)'
      }
    },
    ...mapStores(useGeneralStore, usePaneVisibilityStore)
  },
  methods: {
    selectViz (id: number) {
      this.paneVisibilityStore.showPane(id, this.panelNr)
    }
  }
})
</script>

<style>
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

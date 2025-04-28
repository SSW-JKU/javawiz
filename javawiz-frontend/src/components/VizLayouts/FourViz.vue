<template>
  <splitpanes vertical>
    <pane>
      <splitpanes horizontal>
        <visualization-pane :panel-nr="0" />
        <visualization-pane v-if="showPane2" :panel-nr="2" />
      </splitpanes>
    </pane>
    <pane v-if="showVerticalSplitter">
      <splitpanes horizontal>
        <visualization-pane v-if="showPane1" :panel-nr="1" />
        <visualization-pane v-if="showPane3" :panel-nr="3" />
      </splitpanes>
    </pane>
  </splitpanes>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import VisualizationPane from '@/components/VizLayouts/VisualizationPane.vue'
import {
  LAYOUT_FOUR,
  LAYOUT_THREE_LEFTSINGLE,
  LAYOUT_THREE_RIGHTSINGLE,
  LAYOUT_TWO_HORIZONTALSPLIT,
  LAYOUT_TWO_VERTICALSPLIT,
  usePaneVisibilityStore
} from '@/store/PaneVisibilityStore'

defineComponent({
  components: {
    VisualizationPane,
    Pane,
    Splitpanes
  }
})

const paneVisibilityStore = usePaneVisibilityStore()

const showPane1 = computed(() =>
  paneVisibilityStore.currentLayout === LAYOUT_TWO_VERTICALSPLIT ||
  paneVisibilityStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
  paneVisibilityStore.currentLayout === LAYOUT_THREE_LEFTSINGLE ||
  paneVisibilityStore.currentLayout === LAYOUT_FOUR
)

const showPane2 = computed(() =>
  paneVisibilityStore.currentLayout === LAYOUT_TWO_HORIZONTALSPLIT ||
  paneVisibilityStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
  paneVisibilityStore.currentLayout === LAYOUT_FOUR
)
const showPane3 = computed(() =>
  paneVisibilityStore.currentLayout === LAYOUT_THREE_LEFTSINGLE ||
  paneVisibilityStore.currentLayout === LAYOUT_FOUR
)

const showVerticalSplitter = showPane1
</script>

<style scoped>

</style>

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

<script lang="ts">
import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import Pane from 'splitpanes-raw/pane.vue'
import Splitpanes from 'splitpanes-raw/splitpanes.vue'
import VisualizationPane from '@/components/VizLayouts/VisualizationPane.vue'
import {
  LAYOUT_FOUR,
  LAYOUT_ONE,
  LAYOUT_THREE_LEFTSINGLE,
  LAYOUT_THREE_RIGHTSINGLE,
  LAYOUT_TWO_HORIZONTALSPLIT,
  LAYOUT_TWO_VERTICALSPLIT,
  usePaneVisibilityStore
} from '@/store/PaneVisibilityStore'

export default defineComponent({
  name: 'FourViz',
  components: {
    VisualizationPane,
    Pane,
    Splitpanes
  },
  data: function () {
    return {
      LAYOUT_ONE,
      LAYOUT_TWO_VERTICALSPLIT,
      LAYOUT_TWO_HORIZONTALSPLIT,
      LAYOUT_THREE_RIGHTSINGLE,
      LAYOUT_THREE_LEFTSINGLE,
      LAYOUT_FOUR
    }
  },
  computed: {
    showPane1 (): boolean {
      return this.paneVisibilityStore.currentLayout === LAYOUT_TWO_VERTICALSPLIT ||
        this.paneVisibilityStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
        this.paneVisibilityStore.currentLayout === LAYOUT_THREE_LEFTSINGLE ||
        this.paneVisibilityStore.currentLayout === LAYOUT_FOUR
    },
    showPane2 (): boolean {
      return this.paneVisibilityStore.currentLayout === LAYOUT_TWO_HORIZONTALSPLIT ||
        this.paneVisibilityStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
        this.paneVisibilityStore.currentLayout === LAYOUT_FOUR
    },
    showPane3 (): boolean {
      return this.paneVisibilityStore.currentLayout === LAYOUT_THREE_LEFTSINGLE ||
        this.paneVisibilityStore.currentLayout === LAYOUT_FOUR
    },
    showVerticalSplitter (): boolean {
      return this.showPane1
    },
    ...mapStores(usePaneVisibilityStore)
  },
  methods: {}

})
</script>

<style scoped>

</style>

<template>
  <splitpanes vertical>
    <pane>
      <splitpanes horizontal>
        <visualization-pane location="top-left" />
        <visualization-pane v-if="showPane2" location="bottom-left" />
      </splitpanes>
    </pane>
    <pane v-if="showVerticalSplitter">
      <splitpanes horizontal>
        <visualization-pane v-if="showPane1" location="top-right" />
        <visualization-pane v-if="showPane3" location="bottom-right" />
      </splitpanes>
    </pane>
  </splitpanes>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import VisualizationPane from '@/components/VizLayouts/VisualizationPane.vue';
import {
  LAYOUT_FOUR,
  LAYOUT_THREE_LEFTSINGLE,
  LAYOUT_THREE_RIGHTSINGLE,
  LAYOUT_TWO_HORIZONTALSPLIT,
  LAYOUT_TWO_VERTICALSPLIT,
  useVisualizationStore,
} from '@/store/VisualizationStore';

const visualizationStore= useVisualizationStore();

const showPane1 = computed(
  () =>
    visualizationStore.currentLayout === LAYOUT_TWO_VERTICALSPLIT ||
    visualizationStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
    visualizationStore.currentLayout === LAYOUT_THREE_LEFTSINGLE ||
    visualizationStore.currentLayout === LAYOUT_FOUR
);

const showPane2 = computed(
  () =>
    visualizationStore.currentLayout === LAYOUT_TWO_HORIZONTALSPLIT ||
    visualizationStore.currentLayout === LAYOUT_THREE_RIGHTSINGLE ||
    visualizationStore.currentLayout === LAYOUT_FOUR
);
const showPane3 = computed(() => visualizationStore.currentLayout === LAYOUT_THREE_LEFTSINGLE || visualizationStore.currentLayout === LAYOUT_FOUR);

const showVerticalSplitter = showPane1;
</script>

<style scoped></style>

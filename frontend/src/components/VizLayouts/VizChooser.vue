<template>
  <div style="width: 100%; height: 100%; display: flex;">
    <div style="display: flex; margin: auto; gap: 0.5em; flex-wrap: wrap; justify-content: space-evenly; max-width: 80%;">
      <IconWithTooltip
        v-for="viz in visualizationStore.visualizations.filter(v => v.userSelectable)"
        :key="viz.id"
        :tooltip="{ text: toTooltip(viz), arrow: 'left', placement: 'below' }"
        :icon="viz.icon"
        @action="() => { emit('selected', viz.id) }" />
    </div>
  </div>
</template>
<script setup lang="ts">
import IconWithTooltip from '../TheToolbar/IconWithTooltip.vue'
import { useVisualizationStore, VisualizationDescription } from '@/store/VisualizationStore'


const emit= defineEmits<{(e: 'selected', kind: number): void}>()

const visualizationStore = useVisualizationStore()

function toTooltip (viz : VisualizationDescription) {
  return visualizationStore.isShown(viz) ? `Move ${viz.shortName} here` : `Show ${viz.shortName}`
}
</script>

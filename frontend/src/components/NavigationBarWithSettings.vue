<template>
  <div ref="navigationBar" class="absolute-flex-container" data-export-ignore>
    <div class="settings" :class="{invisible: !settingsVisible}">
      <slot />
    </div>
    <button v-if="zoomIn" class="float-button" @click="_e => zoomIn()">
      ➕
    </button>
    <button v-if="zoomOut" class="float-button" @click="_e => zoomOut()">
      ➖
    </button>
    <button v-if="zoomReset" class="float-button" @click="_e => zoomReset()">
      🏠
    </button>
    <button v-if="hasDefaultSlot" class="float-button" @click="settingsVisible = !settingsVisible">
      ⚙
    </button>
    <div class="export-control">
      <button
        class="float-button"
        title="Export visualization"
        aria-label="Export visualization"
        :disabled="exporting"
        aria-haspopup="menu"
        :aria-expanded="exportMenuVisible"
        @click="toggleExportMenu">
        💾
      </button>
      <div v-if="exportMenuVisible" class="export-menu" role="menu">
        <button
          v-for="format in exportFormats"
          :key="format"
          type="button"
          role="menuitem"
          @click="exportAs(format)">
          {{ format.toUpperCase() }}
        </button>
      </div>
    </div>
    <button class="float-button" title="Close" @click="_e => removePane()">
      ❌
    </button>
  </div>
</template>

<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'
import { useVisualizationStore } from '@/store/VisualizationStore'
import {
  exportVisualization,
  type VisualizationExportFormat
} from '@/helpers/visualizationExport'

const settingsVisible= ref(false)
const exportMenuVisible = ref(false)
const exporting = ref(false)
const navigationBar = ref<HTMLElement | null>(null)
const visualizationStore = useVisualizationStore()

/**
 * This component uses absolute positioning and must be placed directly inside
 * a parent with `position: relative`.
 */
const {
  zoomIn = undefined,
  zoomOut = undefined,
  zoomReset = undefined,
  vizId
} = defineProps<{
  zoomIn?:(() => void),
  zoomOut?:(() => void),
  zoomReset?:(() => void),
  vizId: number
}>()

const slots = useSlots()

const exportFormats = ref<VisualizationExportFormat[]>(['png'])

const hasDefaultSlot = computed(() => {
  return !!slots.default
})

function fileName () {
  const visualizationName = visualizationStore.visualizationsById[vizId]?.shortName ?? 'visualization'
  const slug = visualizationName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `javawiz-${slug}`
}

function toggleExportMenu () {
  const target = navigationBar.value?.parentElement
  if (target) {
    exportFormats.value = [target.querySelector('svg') ? 'svg' : 'html', 'png']
  }
  exportMenuVisible.value = !exportMenuVisible.value
}

async function exportAs (format: VisualizationExportFormat) {
  const target = navigationBar.value?.parentElement
  if (!target) return

  exportMenuVisible.value = false
  exporting.value = true
  try {
    await exportVisualization(target, format, fileName())
  } catch (error) {
    console.error(`Could not export ${fileName()} as ${format}.`, error)
    window.alert(`The visualization could not be exported as ${format.toUpperCase()}.`)
  } finally {
    exporting.value = false
  }
}

function closeExportMenu (event: MouseEvent) {
  if (!navigationBar.value?.contains(event.target as Node)) {
    exportMenuVisible.value = false
  }
}

onMounted(() => {
  const parent = navigationBar.value?.parentElement
  if (parent && window.getComputedStyle(parent).position !== 'relative') {
    console.warn(
      'NavigationBarWithSettings must be placed directly inside an element with position: relative.',
      parent
    )
  }
  document.addEventListener('click', closeExportMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeExportMenu)
})

function removePane () {
  visualizationStore.hide(vizId)
}
</script>

<style scoped>
.absolute-flex-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: var(--visualization-buttons);
}

.float-button {
  font-size: 16px;
  padding: 0px;
  width: 25px;
  height: 25px;
  z-index: var(--visualization-buttons);
}

.export-control {
  position: relative;
  height: 25px;
}

.export-menu {
  display: flex;
  position: absolute;
  top: 0;
  left: 30px;
  padding: 3px;
  gap: 3px;
  border: 1px solid #555;
  border-radius: 4px;
  background: white;
  box-shadow: 0 2px 5px rgb(0 0 0 / 25%);
  z-index: var(--visualization-buttons);
}

.export-menu button {
  min-width: 48px;
  padding: 2px 6px;
  cursor: pointer;
}

.invisible {
  display: none;
}

.settings {
  position: absolute;
  border: black 1px solid;
  background: lightgray;
  padding: 0px 10px 5px 5px;
  height: 300px;
  left: 35px;
  border-radius: 5px;
  overflow-y: auto;
  z-index: var(--visualization-buttons);
}
</style>

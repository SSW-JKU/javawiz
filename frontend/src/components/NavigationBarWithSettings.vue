<template>
  <div ref="navigationBar" class="absolute-flex-container" data-export-ignore>
    <template v-if="!closeOnly">
      <div class="settings" :class="{invisible: !settingsVisible}">
        <slot />
      </div>
      <IconWithTooltip
        v-if="zoomIn"
        class="navigation-icon"
        :tooltip="{ text: 'Zoom in', placement: 'right' }"
        @action="() => zoomIn?.()">
        <template #icon>
          <span class="navigation-glyph">➕</span>
        </template>
      </IconWithTooltip>
      <IconWithTooltip
        v-if="zoomOut"
        class="navigation-icon"
        :tooltip="{ text: 'Zoom out', placement: 'right' }"
        @action="() => zoomOut?.()">
        <template #icon>
          <span class="navigation-glyph">➖</span>
        </template>
      </IconWithTooltip>
      <IconWithTooltip
        v-if="zoomReset"
        class="navigation-icon"
        :tooltip="{ text: 'Reset zoom', placement: 'right' }"
        @action="() => zoomReset?.()">
        <template #icon>
          <span class="navigation-glyph">🏠</span>
        </template>
      </IconWithTooltip>
      <IconWithTooltip
        v-if="hasDefaultSlot"
        class="navigation-icon"
        :tooltip="{ text: 'Settings', placement: 'right' }"
        @action="() => { settingsVisible = !settingsVisible }">
        <template #icon>
          <span class="navigation-glyph">⚙</span>
        </template>
      </IconWithTooltip>
      <div class="export-control">
        <IconWithTooltip
          class="navigation-icon"
          :enabled="!exporting"
          :tooltip="{ text: 'Export visualization', placement: 'right' }"
          aria-haspopup="menu"
          :aria-expanded="exportMenuVisible"
          @action="toggleExportMenu">
          <template #icon>
            <span class="navigation-glyph">💾</span>
          </template>
        </IconWithTooltip>
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
    </template>
    <IconWithTooltip
      class="navigation-icon"
      :tooltip="{ text: 'Close', placement: 'right' }"
      @action="removePane">
      <template #icon>
        <span class="navigation-glyph">❌</span>
      </template>
    </IconWithTooltip>
  </div>
</template>

<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'
import { useVisualizationStore } from '@/store/VisualizationStore'
import { useGeneralStore } from '@/store/GeneralStore'
import {
  exportVisualization,
  type VisualizationExportFormat
} from '@/helpers/visualizationExport'
import { createVisualizationExportFileName } from '@/helpers/visualizationFileName'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'

const settingsVisible= ref(false)
const exportMenuVisible = ref(false)
const exporting = ref(false)
const navigationBar = ref<HTMLElement | null>(null)
const visualizationStore = useVisualizationStore()
const generalStore = useGeneralStore()

/**
 * This component uses absolute positioning and must be placed directly inside
 * a parent with `position: relative`.
 */
const {
  zoomIn = undefined,
  zoomOut = undefined,
  zoomReset = undefined,
  closeOnly = false,
  vizId
} = defineProps<{
  zoomIn?:(() => void),
  zoomOut?:(() => void),
  zoomReset?:(() => void),
  /** Hides every control except Close when no visualization content exists yet. */
  closeOnly?: boolean,
  vizId: number
}>()

const slots = useSlots()

const exportFormats = ref<VisualizationExportFormat[]>(['png'])

const hasDefaultSlot = computed(() => {
  return !!slots.default
})

function fileName () {
  const visualizationName = visualizationStore.visualizationsById[vizId]?.shortName ?? 'visualization'
  return createVisualizationExportFileName(visualizationName)
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
    const downloadedFileName = await exportVisualization(target, format, fileName())
    generalStore.notifications.show({ kind: 'VisualizationExported', fileName: downloadedFileName })
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

.navigation-icon {
  width: 25px;
  height: 25px;
  margin: 0;
}

.navigation-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  font-size: 16px;
  cursor: pointer;
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

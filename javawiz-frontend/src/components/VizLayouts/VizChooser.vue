<template>
  <div style="width: 100%; height: 100%; display: flex">
    <div style="display: flex; margin: auto; flex-wrap: wrap;">
      <IconWithTooltip
        :tooltip="{ text: flowchartText, arrow: 'left', placement: 'below' }"
        :icon="flowchart"
        @action="() => { emit('selected', FLOWCHART) }" />
      <IconWithTooltip
        :tooltip="{ text: heapStackText, arrow: 'left', placement: 'below' }"
        :icon="stack"
        @action="() => { emit('selected', HEAP) }" />
      <IconWithTooltip
        :tooltip="{ text: deskTestText, arrow: 'left', placement: 'below' }"
        :icon="desktest"
        @action="() => { emit('selected', DESKTEST) }" />
      <IconWithTooltip
        :tooltip="{ text: arraysText, arrow: 'left', placement: 'below' }"
        :icon="array"
        @action="() => { emit('selected', ARRAY)}" />
      <IconWithTooltip
        :tooltip="{ text: linkedListText, arrow: 'left', placement: 'below' }"
        :icon="list"
        @action="() => { emit('selected', LINKEDLIST)}" />
      <IconWithTooltip
        :tooltip="{ text: binaryTreeText, arrow: 'left', placement: 'below' }"
        :icon="tree_"
        @action="() => { emit('selected', BINARYTREE)}" />
      <IconWithTooltip
        :tooltip="{ text: ioText, arrow: 'left', placement: 'below' }"
        :icon="console_"
        @action="() => { emit('selected', INVIZ) }" />
      <IconWithTooltip
        :tooltip="{ text: sequenceDiagramText, arrow: 'left', placement: 'below' }"
        :icon="sequencediagram"
        @action="() => { emit('selected', SEQUENCEDIAGRAM) }" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, defineComponent } from 'vue'
import IconWithTooltip from '../TheToolbar/IconWithTooltip.vue'
import { ARRAY, BINARYTREE, DESKTEST, FLOWCHART, HEAP, LINKEDLIST, INVIZ, SEQUENCEDIAGRAM, usePaneVisibilityStore } from '@/store/PaneVisibilityStore'
import flowchart from '../../assets/icons/hiding/flowchart.svg'
import stack from '../../assets/icons/hiding/stack.svg'
import desktest from '../../assets/icons/hiding/desktest.svg'
import array from '../../assets/icons/hiding/array.svg'
import list from '../../assets/icons/hiding/list.svg'
import tree_ from '../../assets/icons/hiding/tree.svg'
import console_ from '../../assets/icons/hiding/console.svg'
import sequencediagram from '../../assets/icons/hiding/sequencediagram.svg'


defineComponent({
  name: 'VizChooser',
  components: { IconWithTooltip }
})

const emit = defineEmits<{(e: 'selected', kind: number): void}>()

const paneVisibilityStore = usePaneVisibilityStore()
const flowchartText = computed(() => paneVisibilityStore.isFlowChartPaneHidden ? 'Show Flowchart' : 'Move Flowchart here')
const heapStackText = computed(() => paneVisibilityStore.isHeapPaneHidden ? 'Show Heap/Stack' : 'Move Heap/Stack here')
const deskTestText = computed(() => paneVisibilityStore.isDeskTestPaneHidden ? 'Show Desk Test' : 'Move Desk Test here')
const arraysText = computed(() => paneVisibilityStore.isArrayPaneHidden ? 'Show Arrays' : 'Move Arrays here')
const linkedListText = computed(() => paneVisibilityStore.isListPaneHidden ? 'Show Linked Lists' : 'Move Linked Lists here')
const binaryTreeText = computed(() => paneVisibilityStore.isTreePaneHidden ? 'Show Binary Trees' : 'Move Binary Trees here')
const ioText = computed(() => paneVisibilityStore.isInputOutputPaneHidden ? 'Show I/O' : 'Move I/O here')
const sequenceDiagramText = computed(() => paneVisibilityStore.isSequenceDiagramPaneHidden ? 'Show Sequence Diagram' : 'Move Sequence Diagram')
</script>

<template>
  <div style="width: 100%; height: 100%; display: flex">
    <div style="display: flex; margin: auto; flex-wrap: wrap;">
      <IconWithTooltip
        :action="() => { $emit('selected', FLOWCHART) }"
        :tooltip="{ text: flowchartText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/flowchart.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', HEAP) }"
        :tooltip="{ text: heapStackText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/stack.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', DESKTEST) }"
        :tooltip="{ text: deskTestText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/desktest.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', ARRAY)}"
        :tooltip="{ text: arraysText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/array.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', LINKEDLIST)}"
        :tooltip="{ text: linkedListText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/list.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', BINARYTREE)}"
        :tooltip="{ text: binaryTreeText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/tree.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', INVIZ) }"
        :tooltip="{ text: ioText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/console.svg')" />
      <IconWithTooltip
        :action="() => { $emit('selected', SEQUENCEDIAGRAM) }"
        :tooltip="{ text: sequenceDiagramText, arrow: 'left', placement: 'below' }"
        :icon="require('../../assets/icons/hiding/sequencediagram.svg')" />
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import IconWithTooltip from '../TheToolbar/IconWithTooltip.vue'
import { ARRAY, BINARYTREE, CONSOLE, DESKTEST, EDITOR, FLOWCHART, HEAP, INVIZ, LINKEDLIST, SEQUENCEDIAGRAM, usePaneVisibilityStore } from '@/store/PaneVisibilityStore'

export default defineComponent({
  name: 'VizChooser',
  components: { IconWithTooltip },
  emits: {
    selected (_kind: number) {
      return true
    }
  },
  data () {
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
    ...mapStores(usePaneVisibilityStore),
    flowchartText: function () {
      return this.paneVisibilityStore.isFlowChartPaneHidden ? 'Show Flowchart' : 'Move Flowchart here'
    },
    heapStackText: function () {
      return this.paneVisibilityStore.isHeapPaneHidden ? 'Show Heap/Stack' : 'Move Heap/Stack here'
    },
    deskTestText: function () {
      return this.paneVisibilityStore.isDeskTestPaneHidden ? 'Show Desk Test' : 'Move Desk Test here'
    },
    arraysText: function () {
      return this.paneVisibilityStore.isArrayPaneHidden ? 'Show Arrays' : 'Move Arrays here'
    },
    linkedListText: function () {
      return this.paneVisibilityStore.isListPaneHidden ? 'Show Linked Lists' : 'Move Linked Lists here'
    },
    binaryTreeText: function () {
      return this.paneVisibilityStore.isTreePaneHidden ? 'Show Binary Trees' : 'Move Binary Trees here'
    },
    ioText: function () {
      return this.paneVisibilityStore.isInputOutputPaneHidden ? 'Show I/O' : 'Move I/O here'
    },
    sequenceDiagramText: function () {
      return this.paneVisibilityStore.isSequenceDiagramPaneHidden ? 'Show Sequence Diagram' : 'Move Sequence Diagram'
    }
  }
})
</script>

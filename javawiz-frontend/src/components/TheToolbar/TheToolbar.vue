<template>
  <div class="toolbar float-container-center-aligned">
    <TheToolbarButtons
      :connect="connect"
      :start-compilation="startCompilation"
      :trigger-open-file="triggerOpenFile"
      :trigger-save="triggerSave" />
    <VerticalSpacer v-if="generalStore.debugger.compiled" />
    <TheStateArea />
    <VerticalSpacer />
    <TheLayoutSelector />
    <VerticalSpacer />
    <TheTitleArea />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TheLayoutSelector from '@/components/TheToolbar/TheLayoutSelector.vue'
import TheStateArea from '@/components/TheToolbar/TheStateArea.vue'
import TheToolbarButtons from '@/components/TheToolbar/TheToolbarButtons.vue'
import TheTitleArea from '@/components/TheToolbar/TheTitleArea.vue'
import VerticalSpacer from '@/components/TheToolbar/VerticalSpacer.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheToolbar',
  components: { VerticalSpacer, TheTitleArea, TheToolbarButtons, TheStateArea, TheLayoutSelector },
  props: {
    hideToggelsInTopToolbar: {
      type: Boolean,
      required: true
    },
    connect: {
      type: Function,
      required: true
    },
    triggerOpenFile: {
      type: Function,
      required: true
    },
    triggerSave: {
      type: Function,
      required: true
    },
    startCompilation: {
      type: Function,
      required: true
    }
  },
  data: function () {
    return { }
  },
  computed: {
    ...mapStores(useGeneralStore)
  }
})
</script>

<style>

.toolbar {
  box-sizing: border-box;
  padding: 4px 0px;
  background: #163150;
  /* box-shadow: 0.5px 0.5px 2px 0px rgba(0, 0, 0, 0.75); */ /* Removed due to general app border */
}

/* Set via code from Debugger.js using .classed('jiggle', true)
   -> MW 26.06.24: This comment seems to be outdated, cannot find 'jiggle' in the code, but I'm keeping the comment and the
    CSS class here for now */
.jiggle {
  animation: jiggle 0.2s 5 linear, zoomie 1s 1 linear;
}

@keyframes jiggle {
  0% {
    transform: rotate(-12deg);
  }
  50% {
    transform: rotate(12deg);
  }
}

@keyframes zoomie {
  50% {
    transform: scale(125%);
  }
}

</style>

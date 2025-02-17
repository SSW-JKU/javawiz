<template>
  <!-- If trace states are available/the program was compiled for the first time, display reset, back and next button -->
  <div class="float-container-center-aligned">
    <IconWithTooltip
      :action="startCompilation"
      :tooltip="{ text: 'Restart', arrow: 'middle', placement: 'below' }"
      :shortcut="{ firstKey: 'Alt', secondKey: 'C' }"
      :icon="require('../../assets/icons/controls/arrow_left_bar.svg')"
      :semitransparent="generalStore.debugger.compiling" />

    <TheStepButtons />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import TheStepButtons from '@/components/TheToolbar/TheStepButtons.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheDebuggerButtons',
  components: { TheStepButtons, IconWithTooltip },
  props: {
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

<style scoped>

</style>

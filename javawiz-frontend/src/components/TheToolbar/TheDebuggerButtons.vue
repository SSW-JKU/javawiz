<template>
  <!-- If trace states are available/the program was compiled for the first time, display reset, back and next button -->
  <div class="float-container-center-aligned">
    <IconWithTooltip
      :tooltip="{ text: 'Restart', arrow: 'middle', placement: 'below' }"
      :shortcut="{ firstKey: 'Alt', secondKey: 'C' }"
      :icon="arrow_left_bar"
      :semitransparent="generalStore.debugger.compiling"
      @action="() => { emit('startCompilation') }" />

    <TheStepButtons />
  </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import TheStepButtons from '@/components/TheToolbar/TheStepButtons.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import arrow_left_bar from '../../assets/icons/controls/arrow_left_bar.svg'

defineComponent({
  name: 'TheDebuggerButtons',
  components: { TheStepButtons, IconWithTooltip }
})

const emit = defineEmits<{ startCompilation: [] }>()
const generalStore = useGeneralStore()
</script>

<style scoped>

</style>

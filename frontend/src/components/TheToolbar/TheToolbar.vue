<template>
  <div class="toolbar float-container-center-aligned" data-pet-target="ui Toolbar">
    <TheToolbarButtons
      @connect="() => emit('connect')"
      @start-compilation="() => emit('startCompilation')"
      @open-file="() => emit('openFile')"
      @download="() => emit('download')" />
    <VerticalSpacer v-if="generalStore.debugger.compiled" />
    <TheStateArea />
    <VerticalSpacer />
    <TheLayoutSelector />
    <VerticalSpacer />
    <VerticalSpacer />
    <TheTitleArea />
  </div>
</template>

<script setup lang="ts">
import TheLayoutSelector from '@/components/TheToolbar/TheLayoutSelector.vue'
import TheStateArea from '@/components/TheToolbar/TheStateArea.vue'
import TheToolbarButtons from '@/components/TheToolbar/TheToolbarButtons.vue'
import TheTitleArea from '@/components/TheToolbar/TheTitleArea.vue'
import VerticalSpacer from '@/components/TheToolbar/VerticalSpacer.vue'
import { useGeneralStore } from '@/store/GeneralStore'

const emit= defineEmits<{ connect: [], openFile: [], download: [], startCompilation: []}>()
const generalStore = useGeneralStore()
</script>

<style>

.toolbar {
  box-sizing: border-box;
  padding: 4px 0px;
  background: #163150;
}

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

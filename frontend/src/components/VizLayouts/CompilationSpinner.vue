<template>
  <img
    v-if="generalStore.debugger.compiling"
    class="compilation-spinner"
    src="../../assets/icons/spinner.gif"
    alt="Spinner">
</template>

<script setup lang="ts">
import { useGeneralStore } from '@/store/GeneralStore'
const generalStore = useGeneralStore()
</script>

<style scoped>

.compilation-spinner {
  height: 60px;
  width: 60px;
  margin-left: auto;
  margin-right: auto;
}

</style>

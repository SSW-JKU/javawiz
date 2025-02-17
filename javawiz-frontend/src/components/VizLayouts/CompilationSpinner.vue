<template>
  <img
    v-if="generalStore.debugger.compiling"
    class="compilation-spinner"
    src="../../assets/icons/spinner.gif"
    alt="Spinner">
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import { useGeneralStore } from '@/store/GeneralStore'

export default defineComponent({
  name: 'CompilationSpinner',
  computed: {
    ...mapStores(useGeneralStore)
  }
})
</script>

<style scoped>

.compilation-spinner {
  height: 60px;
  width: 60px;
  margin-left: auto;
  margin-right: auto;
}

</style>

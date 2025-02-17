<template>
  <div v-if="!generalStore.debugger.compiled" class="pane-default-text">
    <p>
      After starting the program by clicking Start <img class="default-text-icon" src="../../assets/icons/controls/start.svg" alt="Start icon">,
      the selected visualization will be shown here.
    </p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'BeforeCompilationText',
  computed: {
    ...mapStores(useGeneralStore)
  }
})
</script>

<style scoped>

</style>

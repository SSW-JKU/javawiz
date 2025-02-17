<template>
  <!--      indicates the current status, "live" means the user didn't step back yet/"first execution" of the program -->
  <div
    v-if="generalStore.debugger.compiled"
    class="float-container-center-aligned state-container">
    <template v-if="generalStore.debugger.isLive && !generalStore.debugger.hasReachedEnd">
      <img class="state-icon" src="../../assets/icons/status/live.svg" alt="State icon">
      <span class="state-text">Live</span>
    </template>
    <template v-else>
      <img class="state-icon" src="../../assets/icons/status/replay.svg" alt="State icon">
      <span class="state-text">Replay</span>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheStateArea',
  computed: {
    ...mapStores(useGeneralStore)
  }
})
</script>

<style>

.state-container { }

.state-icon {
  width: 18px;
  height: 18px;
  margin-right: 5px;
  -webkit-user-select: none;
  user-select: none;
}

.state-text {
  font-size: 0.8rem;
  font-weight: bold;
  color: white;
  -webkit-user-select: none;
  user-select: none;
}

</style>

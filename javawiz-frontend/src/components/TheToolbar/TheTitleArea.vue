<template>
  <div class="title-area float-container-center-aligned">
    <img class="wizard-icon" src="../../assets/icons/wizard-hat.svg" alt="JavaWiz title icon">

    <span class="javawiz-title">
      JavaWiz <span class="version">&nbsp;V{{ version }} </span>
    </span>

    <div class="dev-container" @click="showAbout">
      <span class="dev-info">developed @ JKU </span>
      <span class="dev-info"> by the SSW team </span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { version } from '../../../package.json'
import { useOverlayStore } from '@/store/OverlayStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheTitleArea',
  data: function () {
    return {
      version
    }
  },
  computed: {
    ...mapStores(useOverlayStore)
  },
  methods: {
    showAbout: function () {
      this.overlayStore.toggleAboutState()
    }
  }
})
</script>

<style>

.title-area {
  color: white;
  -webkit-user-select: none;
  user-select: none;
}

.javawiz-title {
  font-family: 'Unica One', cursive;
  font-size: 1.5rem;
  white-space:nowrap;
}

.version {
  font-size: 0.65rem;
}

.dev-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0px 7px;
  font-size: 0.70rem;
}

.dev-container:hover {
  font-size: 0.75rem;
  padding: 0px 4px;
}

.dev-info {
  color: white;
  text-decoration: none;
  cursor: pointer;
  text-wrap: nowrap;
}

@media (max-width: 999px) {
  .dev-info {
    display: none;
  }
}

.wizard-icon {
  width: 28px;
  height: 28px;
  margin-right: 5px;
}

</style>

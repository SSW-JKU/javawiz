<template>
  <div class="title-area float-container-center-aligned">
    <img class="wizard-icon" src="../../assets/icons/wizard-hat.svg" alt="JavaWiz title icon">

    <span class="javawiz-title">
      JavaWiz <span class="version">&nbsp;V{{ package_.version }} </span>
    </span>

    <div class="dev-container" @click="showAbout">
      <span class="dev-info">developed @ JKU </span>
      <span class="dev-info"> by the SSW team </span>
    </div>
    <IconWithTooltip
      v-if="generalStore.debugger.connected"
      :tooltip="{ text: 'Bug? Feedback? Question? Contact us!', arrow: 'right', placement: 'below' }"
      :icon="bugreport"
      @action="() => overlayStore.toggleReportState()" />
    <IconWithTooltip
      v-if="generalStore.debugger.connected"
      :tooltip="{ text: 'Help', arrow: 'right', placement: 'below' }"
      :icon="help"
      @action="() => overlayStore.toggleHelpState()" />
  </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import help from '../../assets/icons/controls/help.svg'
import bugreport from '../../assets/icons/controls/bug-report.png'
import package_ from '../../../package.json'
import { useOverlayStore } from '@/store/OverlayStore'
import { useGeneralStore } from '@/store/GeneralStore'

defineComponent({
  name: 'TheTitleArea'
})
const generalStore = useGeneralStore()
const overlayStore = useOverlayStore()
function showAbout () {
  overlayStore.toggleAboutState()
}
function showReport () {
  overlayStore.toggleReportState()
}
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

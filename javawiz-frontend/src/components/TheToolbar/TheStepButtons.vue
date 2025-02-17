<template>
  <div id="step-buttons-container" class="float-container-start-aligned">
    <IconWithTooltip
      :action="() => generalStore.debugger.stepBack()"
      :enabled="generalStore.debugger.stepBackEnabled"
      :tooltip="{ text: 'Step back', arrow: 'middle' }"
      :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_left.svg') }"
      :icon="require('../../assets/icons/controls/arrow_left.svg')" />
    <div id="step-buttons-relative-stackcontainer-parent" class="show-on-narrow" style="position: relative; display: flex;">
      <!-- Hidden paragraph to reserve space -->
      <IconWithTooltip
        id="step-buttons-stackcontainer"
        :icon="require('../../assets/icons/controls/arc_right.svg')"
        style="visibility: hidden;" :action="() => {}" />
      <div
        :class="{'absolute-vertical-box': true, 'wide-expanded': showAllStepButtons}"
        @mouseenter="showAllStepButtons=true"
        @mouseleave="showAllStepButtons=false">
        <transition name="heightfade">
          <IconWithTooltip
            :action="() => generalStore.debugger.stepOver()"
            :enabled="generalStore.debugger.stepForwardEnabled"
            :tooltip="{ text: 'Step over', arrow: 'middle', placement: 'left' }"
            :icon="require('../../assets/icons/controls/arc_right.svg')"
            :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_right.svg') }" />
        </transition>
        <transition name="heightfade">
          <IconWithTooltip
            v-if="showAllStepButtons"
            :action="() => generalStore.debugger.stepInto()"
            :tooltip="{ text: 'Step into', arrow: 'middle', placement: 'left' }"
            :enabled="generalStore.debugger.stepForwardEnabled"
            :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_down.svg') }"
            :icon="require('../../assets/icons/controls/arrow_right_down.svg')" />
        </transition>
        <transition name="heightfade">
          <IconWithTooltip
            v-if="showAllStepButtons"
            :action="() => generalStore.debugger.stepOut()"
            :tooltip="{ text: 'Step out', arrow: 'middle', placement: 'left' }"
            :enabled="generalStore.debugger.stepForwardEnabled"
            :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_up.svg') }"
            :icon="require('../../assets/icons/controls/arrow_right_up.svg')" />
        </transition>
        <div class="float-container-start-aligned no-gap">
          <transition name="heightfade">
            <IconWithTooltip
              v-if="showAllStepButtons"
              :action="() => generalStore.debugger.runToLine(runToLineNumber ?? -1)"
              :tooltip="{ text: 'Run to line', arrow: 'middle', placement: 'left' }"
              :enabled="generalStore.debugger.stepForwardEnabled"
              :icon="require('../../assets/icons/controls/arrow_right_bar.svg')"
              class="run-to-line-arrow" />
          </transition>
          <input
            v-if="showAllStepButtons"
            v-model="runToLineNumber"
            class="line-number-input"
            type="number"
            min="1"
            max="2000000"
            height="25px"
            placeholder="Line"
            :disabled="!generalStore.debugger.stepForwardEnabled"
            @keyup.enter="generalStore.debugger.runToLine(runToLineNumber ?? -1)">
        </div>
      </div>
    </div>
    <div id="step-buttons-flowcontainer" class="hide-on-narrow float-container-center-aligned">
      <IconWithTooltip
        :action="() => generalStore.debugger.stepOver()"
        :enabled="generalStore.debugger.stepForwardEnabled"
        :tooltip="{ text: 'Step over', arrow: 'middle', placement: 'below' }"
        :icon="require('../../assets/icons/controls/arc_right.svg')"
        :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_right.svg') }" />
      <IconWithTooltip
        :action="() => generalStore.debugger.stepInto()"
        :tooltip="{ text: 'Step into', arrow: 'middle', placement: 'below' }"
        :enabled="generalStore.debugger.stepForwardEnabled"
        :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_down.svg') }"
        :icon="require('../../assets/icons/controls/arrow_right_down.svg')" />
      <IconWithTooltip
        :action="() => generalStore.debugger.stepOut()"
        :tooltip="{ text: 'Step out', arrow: 'middle', placement: 'below' }"
        :enabled="generalStore.debugger.stepForwardEnabled"
        :shortcut="{ iconPath: require('../../assets/icons/shortcuts/arrow_up.svg') }"
        :icon="require('../../assets/icons/controls/arrow_right_up.svg')" />
      <div class="float-container-start-aligned no-gap">
        <IconWithTooltip
          :action="() => generalStore.debugger.runToLine(runToLineNumber ?? -1)"
          :tooltip="{ text: 'Run to line', arrow: 'middle', placement: 'below' }"
          :enabled="generalStore.debugger.stepForwardEnabled"
          :icon="require('../../assets/icons/controls/arrow_right_bar.svg')"
          class="run-to-line-arrow" />
        <input
          v-model="runToLineNumber"
          class="line-number-input"
          type="number"
          min="1"
          max="2000000"
          height="25px"
          placeholder="Line"
          :disabled="!generalStore.debugger.stepForwardEnabled"
          @keyup.enter="generalStore.debugger.runToLine(runToLineNumber ?? -1)">
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'TheStepButtons',
  components: { IconWithTooltip },
  data: function () {
    return {
      runToLineNumber: null,
      showAllStepButtons: false
    }
  },
  computed: {
    ...mapStores(useGeneralStore)
  }
})
</script>

<style>

.absolute-vertical-box {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  position: absolute;
  background: #163150;
  z-index: var(--global-selector);
}

.absolute-vertical-box.wide-expanded {
  border:  1px solid rgba(0, 0, 0, 0.75);
  box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.75);
  top: -5px;
  left: -5px;
  padding: 5px 10px 10px 5px;
  align-items: flex-start;
}

.run-to-line-arrow {
  margin-right: 0;
  padding-right: 0;
}

.hide-on-narrow {
  display: flex !important;
}

.show-on-narrow {
  display: none !important;
}

@media (max-width: 820px) {
  .hide-on-narrow {
    display: none !important;
  }

  .show-on-narrow {
    display: flex !important;
  }
}

.line-number-input {
  width: 50px;
  height: 25px;
  font-size: 0.9rem;
  margin: 0px;
  padding: 2px;
  border: 0px;
}

.heightfade-enter-active, .heightfade-leave-active {
  transition: all 0.25s linear;
}

.heightfade-enter-from, .heightfade-leave-to {
  opacity: 0;
  height: 0px;
}

.heightfade-enter-to, .heightfade-leave-from {
  opacity: 1;
  height: 24px;
}
</style>

<template>
  <div id="step-buttons-container" class="float-container-start-aligned">
    <IconWithTooltip
      :enabled="generalStore.debugger.stepBackEnabled"
      :tooltip="{ text: 'Step back', arrow: 'middle' }"
      :shortcut="{ iconPath: shortcut_arrow_left }"
      :icon="arrow_left"
      @action="() => generalStore.debugger.stepBack()" />
    <div id="step-buttons-relative-stackcontainer-parent" class="show-on-narrow" style="position: relative; display: flex;">
      <!-- Hidden paragraph to reserve space -->
      <IconWithTooltip
        id="step-buttons-stackcontainer"
        :icon="arc_right"
        style="visibility: hidden;" @action="() => {}" />
      <div
        :class="{'absolute-vertical-box': true, 'wide-expanded': showAllStepButtons}"
        @mouseenter="showAllStepButtons=true"
        @mouseleave="showAllStepButtons=false">
        <transition name="heightfade">
          <IconWithTooltip
            :enabled="generalStore.debugger.stepForwardEnabled"
            :tooltip="{ text: 'Step over', arrow: 'middle', placement: 'left' }"
            :icon="arc_right"
            :shortcut="{ iconPath: arrow_right }"
            @action="() => generalStore.debugger.stepOver()" />
        </transition>
        <transition name="heightfade">
          <IconWithTooltip
            v-if="showAllStepButtons"
            :tooltip="{ text: 'Step into', arrow: 'middle', placement: 'left' }"
            :enabled="generalStore.debugger.stepForwardEnabled"
            :shortcut="{ iconPath: arrow_down }"
            :icon="arrow_right_down"
            @action="() => generalStore.debugger.stepInto()" />
        </transition>
        <transition name="heightfade">
          <IconWithTooltip
            v-if="showAllStepButtons"
            :tooltip="{ text: 'Step out', arrow: 'middle', placement: 'left' }"
            :enabled="generalStore.debugger.stepForwardEnabled"
            :shortcut="{ iconPath: arrow_up }"
            :icon="arrow_right_up"
            @action="() => generalStore.debugger.stepOut()" />
        </transition>
        <div class="float-container-start-aligned no-gap">
          <transition name="heightfade">
            <IconWithTooltip
              v-if="showAllStepButtons"
              :tooltip="{ text: 'Run to line', arrow: 'middle', placement: 'left' }"
              :enabled="generalStore.debugger.stepForwardEnabled"
              :icon="arrow_right_bar"
              class="run-to-line-arrow"
              @action="() => generalStore.debugger.runToLine(runToLineNumber ?? -1)" />
          </transition>
          <input
            v-if="showAllStepButtons"
            id="line-number-input-1"
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
        :enabled="generalStore.debugger.stepForwardEnabled"
        :tooltip="{ text: 'Step over', arrow: 'middle', placement: 'below' }"
        :icon="arc_right"
        :shortcut="{ iconPath: arrow_right }"
        @action="() => generalStore.debugger.stepOver()" />
      <IconWithTooltip
        :tooltip="{ text: 'Step into', arrow: 'middle', placement: 'below' }"
        :enabled="generalStore.debugger.stepForwardEnabled"
        :shortcut="{ iconPath: arrow_down }"
        :icon="arrow_right_down"
        @action="() => generalStore.debugger.stepInto()" />
      <IconWithTooltip
        :tooltip="{ text: 'Step out', arrow: 'middle', placement: 'below' }"
        :enabled="generalStore.debugger.stepForwardEnabled"
        :shortcut="{ iconPath: arrow_up }"
        :icon="arrow_right_up"
        @action="() => generalStore.debugger.stepOut()" />
      <div class="float-container-start-aligned no-gap">
        <IconWithTooltip
          :tooltip="{ text: 'Run to line', arrow: 'middle', placement: 'below' }"
          :enabled="generalStore.debugger.stepForwardEnabled"
          :icon="arrow_right_bar"
          class="run-to-line-arrow"
          @action="() => generalStore.debugger.runToLine(runToLineNumber ?? -1)" />
        <input
          id="line-number-input-2"
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

<script setup lang="ts">
import { defineComponent, ref } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import { useGeneralStore } from '@/store/GeneralStore'
import arrow_right_bar from '../../assets/icons/controls/arrow_right_bar.svg'
import arrow_right_up from '../../assets/icons/controls/arrow_right_up.svg'
import arrow_up from '../../assets/icons/shortcuts/arrow_up.svg'
import arrow_left from '../../assets/icons/controls/arrow_left.svg'
import arrow_right from '../../assets/icons/shortcuts/arrow_right.svg'
import arc_right from '../../assets/icons/controls/arc_right.svg'
import arrow_down from '../../assets/icons/shortcuts/arrow_down.svg'
import arrow_right_down from '../../assets/icons/controls/arrow_right_down.svg'
import shortcut_arrow_left from '../../assets/icons/shortcuts/arrow_left.svg'


defineComponent({
  name: 'TheStepButtons',
  components: { IconWithTooltip }
})

const runToLineNumber = ref<number | null>(null)
const showAllStepButtons = ref(false)
const generalStore = useGeneralStore()

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

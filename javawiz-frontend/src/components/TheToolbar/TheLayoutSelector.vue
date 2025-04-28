<template>
  <div
    class="float-container-center-aligned layout-container"
    @mouseenter="showAllLayouts = true"
    @mouseleave="showAllLayouts = false">
    <span
      style="align-content: center; font-size: 0.8rem; font-weight: bold;">Layout:</span>
      &nbsp;
    <img v-if="!showAllLayouts" :src="currentLayoutImageSource" width="24" height="24">
    <div v-show="showAllLayouts" style="position: relative; height: 24px; width: 24px;">
      <div :class="{'absolute-vertical-box': true, 'expanded': showAllLayouts}">
        <transition name="fullfade">
          <IconWithTooltip
            v-if="showAllLayouts"
            :tooltip="{ text: 'Single Pane', arrow: 'middle', placement: 'right' }"
            :icon="one"
            @action="() => paneVisibilityStore.changeLayout(LAYOUT_ONE)" />
        </transition>
        <div class="float-container-center-aligned">
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :tooltip="{ text: 'Two Panes (Horizontal Split)', arrow: 'middle', placement: 'left' }"
              :icon="two_horizontal"
              @action="() => paneVisibilityStore.changeLayout(LAYOUT_TWO_HORIZONTALSPLIT)" />
          </transition>
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :tooltip="{ text: 'Two Panes (Vertical Split)', arrow: 'middle', placement: 'right' }"
              :icon="two_vertical"
              @action="() => paneVisibilityStore.changeLayout(LAYOUT_TWO_VERTICALSPLIT)" />
          </transition>
        </div>
        <div class="float-container-center-aligned">
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :tooltip="{ text: 'Three Panes (Two Left, One Right)', arrow: 'middle', placement: 'left' }"
              :icon="three_rightsingle"
              @action="() => paneVisibilityStore.changeLayout(LAYOUT_THREE_RIGHTSINGLE)" />
          </transition>
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :tooltip="{ text: 'Three Panes (One Left, Two Right)', arrow: 'middle', placement: 'right' }"
              :icon="three_leftSingle"
              @action="() => paneVisibilityStore.changeLayout(LAYOUT_THREE_LEFTSINGLE)" />
          </transition>
        </div>
        <transition name="fullfade">
          <IconWithTooltip
            v-if="showAllLayouts"
            :tooltip="{ text: 'Four Panes', arrow: 'middle', placement: 'below' }"
            :icon="layout_four"
            @action="() => paneVisibilityStore.changeLayout(LAYOUT_FOUR)" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue'
import IconWithTooltip from '@/components/TheToolbar/IconWithTooltip.vue'
import {
  LAYOUT_FOUR,
  LAYOUT_ONE,
  LAYOUT_THREE_LEFTSINGLE,
  LAYOUT_THREE_RIGHTSINGLE,
  LAYOUT_TWO_HORIZONTALSPLIT,
  LAYOUT_TWO_VERTICALSPLIT,
  usePaneVisibilityStore
} from '@/store/PaneVisibilityStore'
import one from '../../assets/icons/layouts/one.png'
import two_horizontal from '../../assets/icons/layouts/two_horizontal.png'
import two_vertical from '../../assets/icons/layouts/two_vertical.png'
import three_leftSingle from '../../assets/icons/layouts/three_leftsingle.png'
import three_rightsingle from '../../assets/icons/layouts/three_rightsingle.png'
import layout_four from '../../assets/icons/layouts/four.png'

defineComponent({
  name: 'LayoutSelector',
  components: { IconWithTooltip }
})

// const runToLineNumber = ref<number | null>(null)
const showAllLayouts = ref(false)
const paneVisibilityStore = usePaneVisibilityStore()
const currentLayoutImageSource = computed(() => {
  switch (paneVisibilityStore.currentLayout) {
    case LAYOUT_ONE: return one
    case LAYOUT_TWO_HORIZONTALSPLIT: return two_horizontal
    case LAYOUT_TWO_VERTICALSPLIT: return two_vertical
    case LAYOUT_THREE_LEFTSINGLE: return three_leftSingle
    case LAYOUT_THREE_RIGHTSINGLE: return three_rightsingle
    case LAYOUT_FOUR: return layout_four
  }
  return ''
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

.absolute-vertical-box.expanded {
  border:  1px solid rgba(0, 0, 0, 0.75);
  box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.75);
  top: -5px;
  padding: 5px 4px 5px 4px;
  align-items: center;
}

.layout-container {
  color: white;
}

.fullfade-enter-active, .fullfade-leave-active {
  transition: all 0.25s linear;
}

.fullfade-enter-from, .fullfade-leave-to {
  opacity: 0;
  width: 0px;
  height: 0px;
}

.fullfade-enter-to, .fullfade-leave-from {
  opacity: 1;
  width: 32px;
  height: 24px;
}
</style>

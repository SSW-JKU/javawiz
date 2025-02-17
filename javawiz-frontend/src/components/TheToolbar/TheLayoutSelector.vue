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
            :action="() => paneVisibilityStore.changeLayout(LAYOUT_ONE)"
            :tooltip="{ text: 'Single Pane', arrow: 'middle', placement: 'right' }"
            :icon="require('../../assets/icons/layouts/one.png')" />
        </transition>
        <div class="float-container-center-aligned">
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :action="() => paneVisibilityStore.changeLayout(LAYOUT_TWO_HORIZONTALSPLIT)"
              :tooltip="{ text: 'Two Panes (Horizontal Split)', arrow: 'middle', placement: 'left' }"
              :icon="require('../../assets/icons/layouts/two_horizontal.png')" />
          </transition>
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :action="() => paneVisibilityStore.changeLayout(LAYOUT_TWO_VERTICALSPLIT)"
              :tooltip="{ text: 'Two Panes (Vertical Split)', arrow: 'middle', placement: 'right' }"
              :icon="require('../../assets/icons/layouts/two_vertical.png')" />
          </transition>
        </div>
        <div class="float-container-center-aligned">
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :action="() => paneVisibilityStore.changeLayout(LAYOUT_THREE_RIGHTSINGLE)"
              :tooltip="{ text: 'Three Panes (Two Left, One Right)', arrow: 'middle', placement: 'left' }"
              :icon="require('../../assets/icons/layouts/three_rightsingle.png')" />
          </transition>
          <transition name="fullfade">
            <IconWithTooltip
              v-if="showAllLayouts"
              :action="() => paneVisibilityStore.changeLayout(LAYOUT_THREE_LEFTSINGLE)"
              :tooltip="{ text: 'Three Panes (One Left, Two Right)', arrow: 'middle', placement: 'right' }"
              :icon="require('../../assets/icons/layouts/three_leftsingle.png')" />
          </transition>
        </div>
        <transition name="fullfade">
          <IconWithTooltip
            v-if="showAllLayouts"
            :action="() => paneVisibilityStore.changeLayout(LAYOUT_FOUR)"
            :tooltip="{ text: 'Four Panes', arrow: 'middle', placement: 'below' }"
            :icon="require('../../assets/icons/layouts/four.png')" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
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
import { mapStores } from 'pinia'

export default defineComponent({
  name: 'LayoutSelector',
  components: { IconWithTooltip },
  data: function () {
    return {
      runToLineNumber: null,
      LAYOUT_ONE,
      LAYOUT_TWO_VERTICALSPLIT,
      LAYOUT_TWO_HORIZONTALSPLIT,
      LAYOUT_THREE_RIGHTSINGLE,
      LAYOUT_THREE_LEFTSINGLE,
      LAYOUT_FOUR,
      showAllLayouts: false
    }
  },
  computed: {
    ...mapStores(usePaneVisibilityStore),
    currentLayoutImageSource: function () {
      switch (this.paneVisibilityStore.currentLayout) {
        case LAYOUT_ONE: return require('../../assets/icons/layouts/one.png')
        case LAYOUT_TWO_HORIZONTALSPLIT: return require('../../assets/icons/layouts/two_horizontal.png')
        case LAYOUT_TWO_VERTICALSPLIT: return require('../../assets/icons/layouts/two_vertical.png')
        case LAYOUT_THREE_LEFTSINGLE: return require('../../assets/icons/layouts/three_leftsingle.png')
        case LAYOUT_THREE_RIGHTSINGLE: return require('../../assets/icons/layouts/three_rightsingle.png')
        case LAYOUT_FOUR: return require('../../assets/icons/layouts/four.png')
      }
      return ''
    }
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

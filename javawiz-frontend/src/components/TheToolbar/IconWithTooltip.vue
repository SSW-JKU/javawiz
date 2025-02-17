<template>
  <!-- relative position needed to be able to place the tooltip absolutely relative to the icon */ -->
  <div class="icon-container">
    <a @click="{if (enabled) { action(); }}">
      <img
        class="toolbar-icon"
        :src="icon"
        alt="Toolbar icon"
        :style="{filter: filterVal}">
    </a>
    <div v-if="tooltip" :class="`tt ${cssClass}`">
      <div v-if="tooltip.text">
        {{ tooltip.text }}<br>
      </div>
      <slot />
      <div v-if="shortcut">
        <!-- Shortcut visualized as icon-->
        <div v-if="'iconPath' in shortcut">
          <img v-if="shortcut.iconPath" class="icon key-icon" :src="shortcut.iconPath" alt="Toolbar tooltip icon">
        </div>
        <!-- Shortcut visualized as text -->
        <div v-if="'firstKey' in shortcut">
          <span class="key-symbol">{{ shortcut.firstKey }}</span>
          <span>+</span>
          <span class="key-symbol">{{ shortcut.secondKey }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

/**
 * Component for icons with Tooltip. When the icon is clicked, the given action is executed.
 */
export default defineComponent({
  name: 'IconWithTooltip',
  props: {
    /**
     * The function which is executed when the icon is clicked.
     */
    action: {
      type: Function,
      required: true
    },
    enabled: {
      type: Boolean,
      required: false,
      default: true
    },
    icon: {
      type: String,
      required: true
    },
    semitransparent: {
      type: Boolean,
      required: false,
      default: false
    },
    /**
     *  Contains the tooltip text, its placement ('above' (or 'up' or 'north'), 'right' (or 'east'),
     *  'below' (or 'down' or 'south'), or 'left' (or 'west') of the icon), and the arrow
     *  location ('left', 'right', 'middle') along the tooltip.
     *  For right and left placements, only possible arrow location is 'middle'.
     *  Example: `{text: 'I'm a tooltip', placement: 'below', arrow: 'left'}`
     */
    tooltip: {
      type: Object as PropType<{
        text?: string,
        arrow?: 'left' | 'right' | 'middle',
        placement?: 'above' | 'up' | 'north' | 'right' | 'east' | 'below' | 'down' | 'south' | 'left' | 'west',
      }>,
      required: false,
      default: null
    },
    /**
     * Contains either the key string representations or the path to a key icon.<br>
     * Examples:<br>
     * `{ firstKey: "Alt", secondKey: "P" })`<br>
     * `{ iconPath: require(someURL) }`
     */
    shortcut: {
      type: Object as PropType<{ firstKey: string, secondKey: string } | { iconPath: string } | { kbdTag: string }>,
      required: false,
      default: function () {
        return {}
      }
    },
    width: {
      type: String,
      required: false,
      default: function () {
        return '120px'
      }
    }
  },
  computed: {
    filterVal: function (): string {
      const vm = this
      if (vm.semitransparent) {
        return 'opacity(.5)'
      }
      if (!vm.enabled) {
        return 'invert(.5)'
      }
      return 'invert(0)'
    },
    cleanedPlacement: function (): 'above' | 'below' | 'left' | 'right' {
      const vm = this
      switch (vm.tooltip?.placement) {
        case 'above':
          return 'above'
        case 'up':
          return 'above'
        case 'north':
          return 'above'
        case 'below':
          return 'below'
        case 'down':
          return 'below'
        case 'south':
          return 'below'
        case 'right':
          return 'right'
        case 'east':
          return 'right'
        case 'left':
          return 'left'
        case 'west':
          return 'left'
        default:
          return 'below'
      }
    },
    cleanedArrow: function (): 'left' | 'right' | 'middle' {
      const vm = this
      switch (vm.tooltip?.arrow) {
        case 'left':
          return 'left'
        case 'right':
          return 'right'
        case 'middle':
          return 'middle'
        default:
          return 'middle'
      }
    },
    cssClass: function (): string {
      const vm = this
      return `tt-${vm.cleanedPlacement}-${vm.cleanedArrow}arrow`
    }
  }
})
</script>

<style>

.icon-container {
  position: relative;
  margin-right: 6px;
  margin-left: 6px;
  /* this is set on icon-container on purpose, so that we can override if from the outside.
   For example, see TheArrayVisualization's settings control */
  font-size: 0.8rem;
}
.icon-container a {
  display: flex;
}

.tt {
  width: v-bind(width);
  padding: 2px;
  visibility: collapse;
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.95);
  background-color: rgba(102, 102, 102, 0.95);
  color: #fff;
  text-align: center;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: var(--global-tooltip);
  box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.75);
}

/* Because the content is empty, each border will form a triangle, becaues when borders meet at the corners, they create diagonal lines.
  Since there is no content, each border will be a triangle:
  +-------+
  |\     /|
  | \   / |
  |  \ /  |
  |   X   |
  |  / \  |
  | /   \ |
  |/     \|
  +-------+
 */
.tt::after {
  content: "";
  position: absolute;
  border-width: 7px;
  border-style: solid;
}

/* tt sibling of a:hover */
a:hover + .tt {
  visibility: visible;
  opacity: 1;
  transition-delay: 0.5s;
}

.tt-above-leftarrow {
  /* left end of tooltip starts at the left end of the icon */
  bottom: calc(100% + 12px);
  left: 0px;
  margin-top: 5px;
}

.tt-above-leftarrow::after {
  top: 100%;
  /* arrow head is moved 5% inwards from the left end of the tooltip */
  left: 5%;
  border-color: rgba(0, 0, 0, 0.95) transparent transparent transparent;
}

.tt-above-middlearrow {
  /* first, move the left end of the tooltip to the middle of the icon.
     Then, move the tooltip back left by half its width, so that the arrow head is in the middle of the tooltip. */
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  margin-top: 5px;
}

.tt-above-middlearrow::after {
  top: 100%;
  /* first, move the left end of the arrowhead to the middle of the tooltip.
     Then, move the arrowhead back left by half its width, so that the arrow head is in the middle of the tooltip. */
  left: 50%;
  transform: translateX(-50%);
  border-color: rgba(0, 0, 0, 0.95) transparent transparent transparent;
}

.tt-above-rightarrow {
  bottom: calc(100% + 12px);
  /* right end of tooltip starts at the right end of the icon */
  right: 0px;
  margin-top: 5px;
}

.tt-above-rightarrow::after {
  top: 100%;
  /* arrow head is moved 5% inwards from the right end of the tooltip */
  right: 5%;
  border-color: rgba(0, 0, 0, 0.95) transparent transparent transparent;
}

.tt-right-middlearrow {
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  margin-right: 5px;
}

.tt-right-middlearrow::after {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-color: transparent rgba(0, 0, 0, 0.95) transparent transparent;
}

.tt-below-leftarrow {
  top: calc(100% + 12px);
  left: 0px;
  margin-bottom: 5px;
}

.tt-below-leftarrow::after {
  bottom: 100%;
  /* arrow head is moved 5% inwards from the left end of the tooltip */
  left: 5%;
  border-color: transparent transparent rgba(0, 0, 0, 0.95) transparent;
}

.tt-below-middlearrow {
  top: calc(100% + 12px);
  /* first, move the left end of the tooltip to the middle of the icon.
     Then, move the tooltip back left by half its width, so that the arrow head is in the middle of the tooltip. */
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 5px;
}

.tt-below-middlearrow::after {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-color: transparent transparent rgba(0, 0, 0, 0.95) transparent;
}

.tt-below-rightarrow {
  top: calc(100% + 12px);
  right: 0px;
  margin-bottom: 5px;
}

.tt-below-rightarrow::after {
  bottom: 100%;
  right: 5%;
  border-color: transparent transparent rgba(0, 0, 0, 0.95) transparent;
}

.tt-left-middlearrow {
  right: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  margin-left: 5px;
}

.tt-left-middlearrow::after {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-color: transparent transparent transparent rgba(0, 0, 0, 0.95);
}

.key-icon {
  height: 10px;
  width: 10px;
  margin-bottom: 2px;
}

.key-symbol {
  background: #777777;
  padding: 2px 4px 2px 4px;
  border-radius: 3px;
  font-size: 10px;
}

.toolbar-icon {
  width: 24px;
  height: 24px;
  transition: 0.2s;
}

.toolbar-icon:hover {
  transform: scale(1.25);
  cursor: pointer;
}

</style>

<template>
  <defs>
    <marker
      id="arrow"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="7"
      orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
    <marker
      id="arrowRed"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="7"
      orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="red" />
    </marker>
    <marker
      id="arrowHighlighted"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="7"
      orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#eda167" />
    </marker>
    <polygon id="triangle" points="-3,-6 0,0 3,-6" style="stroke: none" />
    <marker
      id="dot"
      viewBox="0 0 9 9"
      refX="4.5"
      refY="4.5"
      markerWidth="4.5"
      markerHeight="4.5"
      orient="auto-start-reverse">
      <circle cx="4.5" cy="4.5" r="4.5" fill="black" />
    </marker>
    <marker
      id="dotRed"
      viewBox="0 0 9 9"
      refX="4.5"
      refY="4.5"
      markerWidth="4.5"
      markerHeight="4.5"
      orient="auto-start-reverse">
      <circle cx="4.5" cy="4.5" r="4.5" fill="red" />
    </marker>
    <marker
      id="arrowThin"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="9"
      orient="auto-start-reverse"
      stroke="black">
      <path d="M 0 0 L 10 5 L 0 10" fill-opacity="0" />
    </marker>
    <marker
      id="arrowThinHighlighted"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="9"
      orient="auto-start-reverse"
      stroke="#eda167">
      <path d="M 0 0 L 10 5 L 0 10" fill-opacity="0" />
    </marker>
    <marker
      id="arrowThinRefHighlighted"
      viewBox="0 0 10 10"
      refX="9.5"
      refY="5"
      markerWidth="9"
      markerHeight="9"
      orient="auto-start-reverse"
      stroke="#a1c79d">
      <path d="M 0 0 L 10 5 L 0 10" fill-opacity="0" />
    </marker>
    <marker
      id="dotHighlighted"
      viewBox="0 0 9 9"
      refX="4.5"
      refY="4.5"
      markerWidth="4.5"
      markerHeight="4.5"
      orient="auto-start-reverse">
      <circle cx="4.5" cy="4.5" r="4.5" fill="#eda167" />
    </marker>
  </defs>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export const DEFINITIONS = {
  urls: {
    dot: 'url(#dot)',
    redDot: 'url(#dotRed)',
    highlightedDot: 'url(#dotHighlighted)',
    arrow: 'url(#arrow)',
    redArrow: 'url(#arrowRed)',
    highlightedArrow: 'url(#arrowHighlighted)',
    thinArrow: 'url(#arrowThin)',
    thinHighlightedArrow: 'url(#arrowThinHighlighted)',
    thinHighlightedRefArrow: 'url(#arrowThinRefHighlighted)'
  },
  triangle: '#triangle'
}
export default defineComponent({
  name: 'SvgDefinitions'
})
</script>

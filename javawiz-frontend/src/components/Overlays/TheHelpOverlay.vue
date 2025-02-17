<template>
  <Overlay :show="show" title="Guide" :close-dialog="hide">
    <p class="help-title">
      Controls
    </p>
    Please note that shortcuts only work if the JavaWiz panel is focused (= you clicked somewhere on the panel).
    <ul>
      <li>
        Left arrow <kbd>←</kbd>: Go back a single step.
      </li>
      <li>
        Right arrow <kbd>→</kbd>: "Step Over" current statement.
      </li>
      <li>
        Down arrow <kbd>↓</kbd>: "Step Into". In comparison to "Step Over", "Step Into" enters methods written by the user, while "Step Over" executes the
        whole method at once.
      </li>
      <li>
        Up arrow <kbd>↑</kbd>: "Step Out" of current method. Continues the program until the current method is left.
      </li>
    </ul>

    <div class="divider" />

    <p class="help-title">
      Tools
    </p>
    The visualization tools (heap view, desk test, etc.) can be revealed using the selection buttons in the panels.<br>
    <!-- TODO Add screenshot here -->
    To close a tool, press ❌.<br>
    Some tools are customizable. Change their settings by pressing ⚙.

    <div class="divider" />

    <p class="help-title">
      Status view
    </p>
    The status view is revealed after the program starts.<br>
    <span class="state-text-help">
      <img class="state-icon" src="../../assets/icons/status/live.svg" alt="Live icon">
      Live
    </span>
    means that the program is currently running.<br>
    Moving backwards you switch into
    <span class="state-text-help">
      <img class="state-icon" src="../../assets/icons/status/replay.svg" alt="Replay icon">
      Replay
    </span>
    mode where you can re-visit all steps taken by the program.
    <div class="divider" />
  </Overlay>
</template>

<script>
import { defineComponent } from 'vue'
import Overlay from '@/components/Overlays/Overlay.vue'
import { useOverlayStore } from '@/store/OverlayStore'
import { mapStores } from 'pinia'

/**
 * Overlay containing descriptions of the JavaWiz functionality.
 * Hidden/shown via a flag in the store
 */
export default defineComponent({
  name: 'TheHelpOverlay',
  components: { Overlay },
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  computed: {
    ...mapStores(useOverlayStore)
  },
  methods: {
    hide () {
      this.overlayStore.showHelp = false
    }
  }
})
</script>

<style scoped>

.state-text-help {
  color: black;
  font-size: 0.8rem;
  font-weight: bold;
}

.help-title {
  font-weight: bold;
  font-size: 1rem;
  margin-top: 10px;
  margin-bottom: 5px;
}

kbd {
  color: black;
  padding: 1px 2px 0;
  border-radius: 3px;
  border: 1px solid black;
  background-color: white;
}
</style>

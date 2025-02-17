<template>
  <div class="flex-container">
    <div class="settings" :class="{invisible: !settingsVisible}">
      <slot />
    </div>
    <button v-if="zoomIn" class="float-button" @click="_e => zoomIn()">
      ➕
    </button>
    <button v-if="zoomOut" class="float-button" @click="_e => zoomOut()">
      ➖
    </button>
    <button v-if="zoomReset" class="float-button" @click="_e => zoomReset()">
      🏠
    </button>
    <button v-if="hasDefaultSlot" class="float-button" @click="settingsVisible = !settingsVisible">
      ⚙
    </button>
    <button v-if="paneKind" class="float-button" title="Close" @click="_e => removePane()">
      ❌
    </button>
  </div>
</template>

<script lang="ts">

import { defineComponent } from 'vue'
import { mapStores } from 'pinia'
import { usePaneVisibilityStore } from '@/store/PaneVisibilityStore'

export default defineComponent({
  name: 'NavigationBarWithSettings',
  props: {
    zoomIn: {
      type: Function,
      default: null,
      required: false
    },
    zoomOut: {
      type: Function,
      default: null,
      required: false
    },
    zoomReset: {
      type: Function,
      default: null,
      required: false
    },
    paneKind: {
      type: Number,
      required: true
    }
  },
  data () {
    return {
      settingsVisible: false
    }
  },
  computed: {
    hasDefaultSlot () {
      return !!this.$slots.default
    },
    ...mapStores(usePaneVisibilityStore)
  },
  methods: {
    removePane: function () {
      const vm = this
      vm.paneVisibilityStore.hidePane(vm.paneKind)
    }
  }
})
</script>

<style scoped>
.flex-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: absolute;
  top: 5px;
  left: 5px;
}

.float-button {
  font-size: 16px;
  padding: 0px;
  width: 25px;
  height: 25px;
  z-index: var(--visualization-buttons);
}

.invisible {
  display: none;
}

.settings {
  position: absolute;
  border: black 1px solid;
  background: lightgray;
  padding: 0px 10px 5px 5px;
  height: 300px;
  left: 35px;
  border-radius: 5px;
  overflow-y: scroll;
}

/*
Broken at the moment, but also not needed
.settings:before {
  content: "";
  width: 0;
  height: 0;
  position: absolute;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 10px solid lightgray;
  left: -9px;
}*/
</style>

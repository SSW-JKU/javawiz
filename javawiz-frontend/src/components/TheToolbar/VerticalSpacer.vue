<template>
  <div style="margin-left:auto; margin-right:auto;">
    <div class="spacer" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'VerticalSpacer'
})
</script>

<style scoped>
.spacer {
  margin-left: 8px;
  margin-right: 8px;
  width: 1px;
  height: 35px;
  background-color: rgba(200, 200, 200, 0.45);
  }
</style>

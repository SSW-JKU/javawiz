<template>
  <div>
    <div class="settings" min-width="400px">
      <p class="settings-header">
        Settings
      </p>
      <div style="display: flex; align-items: center;">
        <input
          id="show-internal-class-fields" 
          v-model="showInternalClassFieldsModel" 
          type="checkbox" 
          name="show-internal-class-fields"
          style="margin: 4px;">
        <label for="show-internal-class-fields" class="no-break">Show internal class fields</label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const showInternalClassFieldsModel = defineModel<boolean>('showInternalClassFields');
</script>

<style scoped>

.settings-header {
  font-weight: bold;
  font-size:small;
}
</style>

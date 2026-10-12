<template>
  <div>
    <div class="settings" min-width="400px">
      <p class="settings-header">
        Settings
      </p>
      <div style="display: flex; align-items: center;">
        <input
          id="show-data-structure-details"
          v-model="showDataStructureDetails"
          type="checkbox"
          name="show-data-structure-details"
          style="margin: 4px;">
        <label for="show-data-structure-details" class="no-break">Show Data Structure Details</label>
      </div>
      <div class="nested-setting">
        <input
          id="show-data-structure-statics"
          v-model="showDataStructureStatics"
          :disabled="!showDataStructureDetails"
          type="checkbox"
          name="show-data-structure-statics"
          style="margin: 4px;">
        <label for="show-data-structure-statics" class="no-break">Show Data Structure Statics</label>
      </div>
      <div class="nested-setting">
        <input
          id="show-data-structure-fields"
          v-model="showDataStructureFields"
          :disabled="!showDataStructureDetails"
          type="checkbox"
          name="show-data-structure-fields"
          style="margin: 4px;">
        <label for="show-data-structure-fields" class="no-break">Show Data Structure Fields</label>
      </div>
      <div style="display: flex; align-items: center;">
        <input
          id="show-memory"
          v-model="showMemory"
          type="checkbox"
          name="show-memory"
          style="margin: 4px;">
        <label for="show-memory" class="no-break">Show memory</label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const showDataStructureDetails = defineModel<boolean>('showDataStructureDetails', { required: true });
const showDataStructureStatics = defineModel<boolean>('showDataStructureStatics', { required: true });
const showDataStructureFields = defineModel<boolean>('showDataStructureFields', { required: true });
const showMemory = defineModel<boolean>('showMemory');

</script>

<style scoped>

.settings-header {
  font-weight: bold;
  font-size:small;
}

.nested-setting {
  display: flex;
  align-items: center;
  margin-left: 16px;
}
</style>

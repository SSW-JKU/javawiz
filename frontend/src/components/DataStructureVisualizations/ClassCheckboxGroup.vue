<template>
  <fieldset class="class-checkbox-group">
    <legend>{{ label }}</legend>
    <small v-if="classes.length === 0">No compiled classes available.</small>
    <label
      v-for="(compiledClass, index) in classes"
      v-else
      :key="compiledClass"
      :for="`${idPrefix}-${index}`"
      :title="compiledClass">
      <input
        :id="`${idPrefix}-${index}`"
        type="checkbox"
        :checked="modelValue.includes(compiledClass)"
        @change="updateSelection(compiledClass, $event)">
      <span>{{ compiledClass }}</span>
    </label>
  </fieldset>
</template>

<script setup lang="ts">
const props = defineProps<{
  classes: readonly string[]
  idPrefix: string
  label: string
  modelValue: readonly string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [selectedClasses: string[]]
}>()

/** Adds or removes one exact compiled class name from the checkbox model. */
function updateSelection (compiledClass: string, event: Event) {
  const checkbox = event.target as HTMLInputElement
  const selectedClasses = checkbox.checked
    ? [...props.modelValue, compiledClass]
    : props.modelValue.filter(selectedClass => selectedClass !== compiledClass)
  emit('update:modelValue', selectedClasses)
}
</script>

<style scoped>
.class-checkbox-group {
  border: 0;
  margin: 0;
  min-width: 0;
  padding: 0;
}

legend {
  padding: 0;
}

label {
  align-items: center;
  display: flex;
  gap: 0.25rem;
  min-width: 0;
}

span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

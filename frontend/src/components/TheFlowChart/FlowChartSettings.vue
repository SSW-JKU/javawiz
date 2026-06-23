<template>
  <div>
    <div class="settings" min-width="400px">
      <p class="settings-header">
        Methods
      </p>
      <input
        id="method-auto-inline"
        v-model="internalAutoInline"
        type="checkbox"
        name="method-auto-inline"
        style="margin: 4px;">
      <label for="method-auto-inline" class="no-break">Auto inline methods</label>

      <p class="settings-header">
        Statements
      </p>
      <input
        id="stmt-use-width-limit"
        :checked="statementCap !== Number.MAX_VALUE"
        type="checkbox"
        name="stmt-use-width-limit"
        style="margin: 4px;"
        @change="changeStatementCap">
      <label for="stmt-use-width-limit" class="no-break">Use width limit</label>
      <div v-if="statementCap < Number.MAX_VALUE">
        <input id="stmt-width-limit" v-model="statementCap" type="number">
        <label for="stmt-width-limit" />
      </div>

      <p class="settings-header">
        Focus
      </p>
      <p class="no-break">
        <input
          id="stmt-follow-active"
          v-model="internalFollowActive"
          type="checkbox"
          name="stmt-follow-active"
          style="margin: 4px;">
        <label for="stmt-follow-active" class="no-break">Follow active Statement</label>
      </p>

      <p class="settings-header">
        Values
      </p>
      <input
        id="show-values"
        v-model="internalShowValues"
        type="checkbox"
        name="show-values"
        style="margin: 4px;">
      <label for="show-values" class="no-break">Show variable values</label>

      <p class="settings-header">
        If statement
      </p>

      <div style="display: inline; justify-content: space-evenly;">
        <div class="if-statement-selection" :class="{active: !trueCaseLeft}" @click="trueCaseLeft = false">
          <div style="display: flex;">
            <div class="if-condition-left" />
            <div class="if-condition" />
            <div class="if-condition-right" />
          </div>
          <div style="display: flex; gap: 4px;">
            <div class="boolean">
              false
            </div>
            <div class="boolean">
              true
            </div>
          </div>
        </div>
        <div class="if-statement-selection" :class="{active: trueCaseLeft}" @click="trueCaseLeft = true">
          <div style="display: flex;">
            <div class="if-condition-left" />
            <div class="if-condition" />
            <div class="if-condition-right" />
          </div>
          <div style="display: flex; gap: 4px;">
            <div class="boolean">
              true
            </div>
            <div class="boolean">
              false
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ELEMENT } from './Element'

const props = defineProps<{
  autoInline: boolean
  showValues: boolean
  followActive: boolean
}>()
const emit = defineEmits<{
  'update:autoInline': [value: boolean]
  'update': []
  'update:showValues': [value: boolean]
  'update:followActive': [value: boolean]
}>()

const internalAutoInline = ref(props.autoInline)
const trueCaseLeft = ref(ELEMENT.IfStatement.trueCaseLeft)
const internalShowValues = ref(props.showValues)
const internalFollowActive = ref(props.followActive)

watch(trueCaseLeft, (cur) => {
  ELEMENT.IfStatement.trueCaseLeft = cur
  emit('update')
})

const statementCap = ref(ELEMENT.Statement.maxWidth)
watch(statementCap, (cur) => {
  ELEMENT.Statement.maxWidth = Math.max(cur, 10) // at least 10 pixels
  emit('update')
})

watch(internalAutoInline, (cur) => {
  emit('update:autoInline', cur)
  emit('update')
})

watch(internalShowValues, (cur) => {
  emit('update:showValues', cur)
  emit('update')
})

watch(internalFollowActive, (cur) => {
  emit('update:followActive', cur)
  emit('update')
})

/**
 * switches between infinite width or width limitation
 */
function changeStatementCap () {
  if (statementCap.value > 1000) {
    // now width width limit
    statementCap.value = 150
  } else {
    // no width limit
    statementCap.value = Number.MAX_VALUE
  }
}
</script>

<style scoped>

.if-statement-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 8px;
}

.if-statement-selection.active{
    border: 2px dashed black;
    border-radius: 4px;
}

.if-statement-selection:hover{
    box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
}

.if-statement-selection .boolean{
    border: 1px solid cornflowerblue;
    color: cornflowerblue;
    border-radius: 3px;
    height: 64px;
    width: 64px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.settings-header {
  font-weight: bold;
  font-size:small;
}
.if-condition{
    height: 20px;
    width: 20px;
    rotate: 45deg;
    border: 2px solid black;
}
.if-condition-left {
    border-left: 2px solid black;
    border-top: 2px solid black;
    height: 10px;
    width: 10px;
    margin-top: 10px;
}
.if-condition-right {
    border-right: 2px solid black;
    border-top: 2px solid black;
    height: 10px;
    width: 10px;
    margin-top: 10px;
}
</style>

<template>
  <div class="representation-box">
    <div v-if="value.isNull">
      null
    </div>
    <div v-if="value.error">
      error: {{ value.error }}
    </div>
    <div v-if="value.binary">
      <table>
        <tbody>
          <tr>
            <td v-for="(bit, bitIdx) in value.binary" :key="bitIdx">
              {{ bit }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="value.char">
      '{{ value.char }}'
    </div>
    <div v-else :title="value.title">
      <div class="overlay-wrapper">
        <div class="overlay-box">
          {{ value.primitive }}
          <table>
            <tbody>
              <tr>
                <td class="overlay-cell">
                  class
                </td>
                <td class="overlay-cell">
                  {{ variable.class }}
                </td>
              </tr>
              <tr>
                <td class="overlay-cell">
                  type
                </td>
                <td class="overlay-cell">
                  {{ variable.type }}
                </td>
              </tr>
              <tr>
                <td class="overlay-cell">
                  name
                </td>
                <td class="overlay-cell">
                  {{ variable.name }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div v-if="value.reference">
      {{ variable.type }}
    </div>
    <div v-if="value.string" class="string-cell truncated">
      "{{ value.string }}"
    </div>
    <div v-if="value.array && value.array !== 'empty'">
      <div class="overlay-wrapper">
        <div class="overlay-box">
          {{ variable.type ? shortTypeName(variable.type) : '' }}
          <table>
            <tbody>
              <tr v-for="(element, valueIdx) in value.array" :key="valueIdx">
                <td class="overlay-cell">
                  [{{ valueIdx }}]
                </td>
                <td class="overlay-cell" :title="element.title">
                  <template v-if="element.type">
                    {{ shortTypeName(element.type) }}
                  </template>
                  <template v-if="element.string">
                    "{{ element.string }}"
                  </template>
                  <template v-if="element.type === 'char'">
                    '{{ element.primitive }}'
                  </template>
                  <template v-else>
                    {{ element.primitive }}
                  </template>
                  <template v-if="element.isNull">
                    null
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div v-if="value.array === 'empty'">
      empty
    </div>
  </div>
</template>

<script lang="ts">
import { DeskTestStatic, DeskTestVal, DeskTestVar } from '@/components/TheDeskTest/types'
import { PropType } from 'vue'
import { shortTypeName } from '@/helpers/Common'

export default {
  name: 'DeskTestValue',
  props: {
    variable: {
      type: Object as PropType<DeskTestVar | DeskTestStatic>,
      required: true
    },
    value: {
      type: Object as PropType<DeskTestVal>,
      required: true
    }
  },
  data () {
    return {
      hovered: false
    }
  },
  methods: {
    shortTypeName: function (name: string): string {
      return shortTypeName(name)
    }
  }
}
</script>

<style>
.representation-box {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: 100%;
  position: relative;
}

.representation-box > * {
  padding-left: 2px;
  padding-right: 2px;
}

.overlay-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
  min-width: 75px;
  display: flex;
  justify-content: center;
}

.overlay-cell {
  font-family: Consolas, serif;
  font-size: 9pt;
  text-align: left;
  width: fit-content;
}

.overlay-box {
  text-align: center;
  border: 1px solid lightgrey;
  border-radius: 3px;
  font-family: Consolas, serif;
  font-size: 9pt;
  white-space: nowrap;
  position: absolute;
  top: -10px;
  background-color: white;
  width: fit-content;
  max-width: 100%;
  max-height: 250px;
  overflow-y: auto;
  z-index: var(--visualization-bottom);
}

.overlay-box text {
  display: contents;
}

.overlay-box table {
  display: none;
}

.overlay-box:hover table {
  display: contents;
}

.overlay-box:hover {
  z-index: var(--visualization-layer1);
}

.string-cell {
  max-width:max-content;
  position: sticky;
  z-index: var(--visualization-bottom);
}
</style>

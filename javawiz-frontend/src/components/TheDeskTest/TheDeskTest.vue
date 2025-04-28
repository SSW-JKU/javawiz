<template>
  <div v-if="(generalStore.currentTraceData?.deskTestLines?.length ?? 0) > 0" style="position: relative; height: 100%">
    <NavigationBarWithSettings :pane-kind="DESKTEST" />
    <div class="scrollable-container">
      <table id="fixed-column-table">
        <thead>
          <tr id="line-column-header-row">
            <th>
              Line
            </th>
            <th>
              Instruction
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(deskTestLine, lineIdx) in generalStore.currentTraceData?.deskTestLines"
            :key="lineIdx"
            :class="{highlighted: deskTestLine.line === hoverStore.hoveredLine && deskTestLine.localUri === hoverStore.hoveredLineUri }"
            @mouseover="() => {
              hover(deskTestLine)
              hoverStore.changeLine({ lineNr: deskTestLine.line, localUri: deskTestLine.localUri })
            }"
            @mouseout="() => {
              clearHover()
              hoverStore.changeLine({ lineNr: -1, localUri: deskTestLine.localUri })
            }">
            <td class="line-nr-cell">
              {{ deskTestLine.line }}
            </td>

            <td class="line-text-cell">
              <div
                :id="`line-text${lineIdx}`"
                class="line-text truncated"
                @mouseover="toggleOverflow(`#line-text${lineIdx}`, true)"
                @mouseout="toggleOverflow(`#line-text${lineIdx}`, false)">
                <text>{{ editorText(deskTestLine.line, deskTestLine.localUri) }}</text>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <table id="main-table">
        <thead class="main-table-header">
          <tr>
            <th v-if="totalNrOfLocals > 0" :colspan="totalNrOfLocals" class="header-cell location-header">
              Local
            </th>

            <th v-if="statics.length > 0" :colspan="statics.length" class="header-cell location-header">
              Static
            </th>
          </tr>
          <tr>
            <th
              v-for="(method, methodIdx) in methods?.filter(m => m.vars.length > 0 || m.conditions.length > 0)"
              :key="methodIdx"
              class="sub-header-cell"
              :class="{ 'highlighted-col': methodHighlighted(method) }"
              :colspan="method.vars.length + method.conditions.length"
              @mouseenter="() => {
                hover(method)
              }"
              @mouseleave="() => {
                clearHover()
              }">
              <text :title="method.displayText">
                {{ method.displayText }}()
              </text>
            </th>
            <th v-if="statics.length > 0" :colspan="statics.length" class="filler-cell" />
          </tr>

          <tr>
            <template v-for="(method, methodIdx) in methods">
              <th v-if="method.vars.length > 0" :key="methodIdx" :colspan="method.vars.length" class="sub-header-cell">
                variables
              </th>
              <th v-if="method.conditions.length > 0" :key="methodIdx" :colspan="method.conditions.length" class="sub-header-cell">
                conditions
              </th>
            </template>
            <th v-if="statics.length > 0" :colspan="statics.length" class="filler-cell" />
          </tr>

          <tr id="var-name-header">
            <template v-for="method in methods">
              <th
                v-for="(variable, variableIdx) in method.vars"
                :key="variableIdx"
                :class="{ 'last-header-child': isLastChild(variableIdx, method.vars.length), 'highlighted-col': localHighlighted(variable) }"
                @mouseenter="() => {
                  hover(variable)
                }"
                @mouseleave="() => {
                  clearHover()
                }">
                <text :title="variable.name">
                  {{ variable.name }}
                </text>
              </th>
              <th
                v-for="(condition, conditionIdx) in method.conditions"
                :key="conditionIdx"
                :class="{ 'last-header-child': isLastChild(conditionIdx, method.conditions.length), 'highlighted-col': conditionHighlighted(condition) }"
                @mouseenter="() => {
                  hover(condition)
                }"
                @mouseleave="() => {
                  clearHover()
                }">
                <text :title="condition.expression">
                  {{ condition.expression }}
                </text>
              </th>
            </template>

            <th
              v-for="(staticVar, staticVarIdx) in statics"
              :key="staticVarIdx"
              :class="{ 'last-header-child': isLastChild(staticVarIdx, statics.length), 'highlighted-col': staticHighlighted(staticVar) }"
              @mouseenter="() => {
                hover(staticVar)
              }"
              @mouseleave="() => {
                clearHover()
              }">
              <text :title="staticVar.class + '.' + staticVar.name">
                {{ staticVar.class + '.' + staticVar.name }}
              </text>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(deskTestLine, lineIdx) in generalStore.currentTraceData?.deskTestLines"
            :key="lineIdx"
            class="value-row"
            :class="{highlighted: deskTestLine.line === hoverStore.hoveredLine && deskTestLine.localUri === hoverStore.hoveredLineUri }"
            @mouseover="() => {
              hover(deskTestLine)
              hoverStore.changeLine({ lineNr: deskTestLine.line, localUri: deskTestLine.localUri })
            }"
            @mouseout="() => {
              clearHover()
              hoverStore.changeLine({ lineNr: -1, localUri: deskTestLine.localUri })
            }">
            <template v-for="method in methods">
              <td
                v-for="(variable, varIdx) in method.vars"
                :key="varIdx"
                class="value-cell"
                :class="{ 'last-header-child': isLastChild(varIdx, method.vars.length), 'highlighted-col': localHighlighted(variable) }">
                <DeskTestValue
                  v-if="deskTestLine.currentVars.has(JSON.stringify(variable))"
                  :variable="variable"
                  :value="deskTestLine.currentVars.get(JSON.stringify(variable))!!" />
              </td>
              <td
                v-for="(condition, condIdx) in method.conditions"
                :key="condIdx"
                class="value-cell truncated"
                :class="{ 'last-header-child': isLastChild(condIdx, method.conditions.length), 'highlighted-col': conditionHighlighted(condition) }">
                <div v-if="deskTestLine.currentConditions.get(JSON.stringify(condition))">
                  {{ deskTestLine.currentConditions.get(JSON.stringify(condition))?.primitive }}
                </div>
              </td>
            </template>
            <td
              v-for="(variable, varIdx) in statics"
              :key="varIdx"
              class="value-cell truncated"
              :class="{ 'last-header-child': isLastChild(varIdx, statics.length), 'highlighted-col': staticHighlighted(variable) }">
              <DeskTestValue
                v-if="deskTestLine.currentStatics.has(JSON.stringify(variable))!!"
                :variable="variable"
                :value="deskTestLine.currentStatics.get(JSON.stringify(variable))!!" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else id="default-text">
    <NavigationBarWithSettings :pane-kind="DESKTEST" />
    Use the buttons in the upper left or arrow keys to navigate through the program.
  </div>
</template>

<script setup lang = 'ts'>
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { DeskTestCondition, DeskTestMethod, DeskTestStatic, DeskTestVar, HoverTarget } from '@/components/TheDeskTest/types'
import DeskTestValue from './DeskTestValue.vue'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { DESKTEST } from '@/store/PaneVisibilityStore'
import { useHoverStore } from '@/store/HoverStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverInfo } from '@/hover/types'

defineComponent({
  name: 'TheDeskTest',
  components: {
    NavigationBarWithSettings,
    DeskTestValue
  }
})
const generalStore = useGeneralStore()
const hoverStore = useHoverStore()
const highlightedInfo = ref<HoverInfo[]>([])
const methods = computed(() => generalStore.currentTraceData?.deskTestLines.at(-1)?.methods ?? [])
const totalNrOfLocals = computed(() => methods.value.flatMap(m => m.vars).length + methods.value.flatMap(m => m.conditions).length)
const statics = computed(() => generalStore.currentTraceData?.deskTestLines.at(-1)?.statics ?? [])
const editorTextsAsArray = computed(() => {
  const result: {[key: string]: string[] } = {}
  for (const fileContent of generalStore.fileManager.fileContents.entries()) {
    result[fileContent[0]] = fileContent[1].split('\n')
  }
  return result
})
/*
watch(deskTestLines, () => { // TODO: remove?
  const vm = this
  const div = document.getElementById('desktest-pane')

  // we need to wait until the rendering has finished, otherwise the scrollbar will be "one line off"/not fully at the bottom
  vm.$nextTick(function () {
    if (div) {
      div.scrollTop = div.scrollHeight
    }
  })
})
  */

function onHover (hoverInfos: HoverInfo[]) {
  highlightedInfo.value = hoverInfos
}
function hover (element: HoverTarget) {
  HoverSynchronizer.hover(element.hoverInfos)
}
function toggleOverflow (selector: string, reveal: boolean) {
  const element = document.querySelector(selector) as HTMLElement
  if (!element) {
    return
  }
  if (!reveal) {
    element.classList.remove('reveal-hover')
  } else if (element.offsetWidth < element.scrollWidth) {
    element.classList.add('reveal-hover')
  }
}
function isLastChild (idx: number, len: number): string {
  return idx === len - 1 ? 'last-header-child' : ''
}

function editorText (line: number, uri: string): string {
  return editorTextsAsArray.value[uri][line - 1].replace(/\t/g, '  ')
}
function methodHighlighted (method: DeskTestMethod): boolean {
  for (const hoverInfo of highlightedInfo.value) {
    if (hoverInfo.kind === 'Method' && hoverInfo.class === method.class && hoverInfo.method === method.displayText) return true
  }
  return false
}
function localHighlighted (local: DeskTestVar): boolean {
  for (const hoverInfo of highlightedInfo.value) {
    if (hoverInfo.kind === 'Local' && hoverInfo.name === local.name && hoverInfo.class === local.class && hoverInfo.method === local.method) return true
  }
  return false
}
function staticHighlighted (staticVar: DeskTestStatic) {
  for (const hoverInfo of highlightedInfo.value) {
    if (hoverInfo.kind === 'Static' && hoverInfo.class === staticVar.class && hoverInfo.name === staticVar.name) return true
  }
  return false
}
function conditionHighlighted (condition: DeskTestCondition): boolean {
  for (const hoverInfo of highlightedInfo.value) {
    if (hoverInfo.kind === 'Condition' && hoverInfo.class === condition.class && hoverInfo.expression === condition.expression) return true
  }
  return false
}
function clearHover () {
  HoverSynchronizer.clear()
  highlightedInfo.value = []
}

onMounted(() => {
  const div = document.getElementById('desktest-pane')
  nextTick(function () {
    if (div) {
      div.scrollTop = div.scrollHeight
    }
  })

  HoverSynchronizer.onHover(onHover)
})
onUnmounted(() => {
  HoverSynchronizer.removeOnHover(onHover)
})
</script>

<style>
@font-face {
  font-family: "Roboto";
  src: url("../../assets/fonts/Roboto/Roboto-Light.ttf");
  font-weight: 300;
}

@font-face {
  font-family: "Roboto";
  src: url("../../assets/fonts/Roboto/Roboto-Medium.ttf");
  font-weight: 500;
}

/*** Desk Test container ***/
.scrollable-container {
  height: 100%;
  overflow: scroll;
  display: flex;
}

/* Scrollbar */
.scrollable-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.scrollable-container::-webkit-scrollbar-track {
  background-color: #f5f5f5;
}

.scrollable-container::-webkit-scrollbar-thumb {
  background-color: #888;
  border-radius: 4px;
}

.scrollable-container::-webkit-scrollbar-thumb:hover {
  background-color: #555;
}

/*** General table CSS ***/
.scrollable-container table {
  border-collapse:separate;
  font-size: 10pt;
  border-spacing: 0;
  font-family: 'Roboto-Light', sans-serif;
  white-space: nowrap;
  height: fit-content;
}

.scrollable-container #var-name-header th {
  border-bottom: 2px solid grey;
}

.scrollable-container th {
  padding-left: 5px;
  padding-right: 5px;
}

.scrollable-container thead {
  background-color: white;
  position:sticky;
  top:0;
  z-index: var(--visualization-layer2);
  border-bottom: 2px solid grey;
}

.scrollable-container tr {
  height: 25px;
}

.scrollable-container td {
  border-bottom: 1px dotted grey;
  animation: fadeIn 800ms;
}

.scrollable-container td:not(.last-header-child) {
  border-right: 1px dotted grey;
}

/*** Fixed table ***/
#fixed-column-table {
  position: sticky;
  left: 0;
  z-index: var(--visualization-layer3);
  background-color: #ffffff;
  max-width: fit-content;
  border: 1px solid grey;
}

#fixed-column-table tr:last-child > td {
  font-weight: bold;
  color: red;
}

#line-column-header-row {
  height: 100px; /* spanning over 4 rows -> 4x row height */
  vertical-align: bottom;
}

#line-column-header-row th {
  border-bottom: 2px solid grey;
  top:0;
}

.line-nr-cell {
  font-weight: 300;
  font-family: Consolas, serif;
  padding-left: 2px;
  height: 25px;
  text-align: center;
  border-right: none;
}

.line-text-cell {
  min-width: 150px;
  max-width: 150px;
  height: 25px;
  padding-left: 5px;
}

.line-text {
  font-family: Consolas, sans-serif;
  font-size: 0.8rem;
}

/*** Data table ***/
.main-table-header {
  text-align: center;
}

.header-cell {
  border-top: 1px solid grey;
  border-right: 1px solid grey;
}

.sub-header-cell, .filler-cell {
  border-top: 1px dotted grey;
  border-bottom: 1px dotted grey;
  border-right: 1px solid grey;
}

.location-header {
  font-style: italic;
}

#var-name-header th:not(.last-header-child) {
  border-right: 1px dotted grey;
}

.last-header-child {
  border-right: 1px solid grey;
}

.value-row:last-child > td {
  font-weight: bold;
  color: red;
}

.value-cell {
  max-width: 185px;
  min-width: 70px;
  text-align: center;
  align-content: end;
  padding-right: 3px;
  padding-left: 3px;
}

/* Line highlighting */
.highlighted td:not(.overlay-cell) {
  background-color: #ffe9d8;
}

.highlighted-col {
  background-color: #ffe9d8;
  width: 100%;
}

#default-text {
  font-family: Roboto, serif;
  font-weight: lighter;
  font-size: 11pt;
  text-align: center;
  padding-top: 10px;
  position: relative;
}

.truncated {
  overflow: hidden;
  text-overflow: ellipsis;
}

.reveal-hover {
  background-color: white;
  box-shadow: 0.5px 0.5px 2px 0px rgba(0, 0, 0, 0.75);
  width: fit-content;
  white-space: nowrap;
  padding-right: 5px;
  padding-left: 5px;
  position: relative;
  z-index: var(--visualization-layer1);
}
</style>

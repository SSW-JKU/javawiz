<template>
  <div ref="heapWrapper" class="heap-wrapper">
    <NavigationBarWithSettings :zoom-in="graph.zoomIn.bind(graph)" :zoom-out="graph.zoomOut.bind(graph)" :zoom-reset="graph.zoomReset.bind(graph)" :viz-id="graph.store.MEMORY.id">
      <HeapVisualizationSettings
        v-model:show-data-structure-details="showDataStructureDetails"
        v-model:show-data-structure-statics="showDataStructureStatics"
        v-model:show-data-structure-fields="showDataStructureFields"
        v-model:show-memory="showMemory" />
    </NavigationBarWithSettings>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { HeapVizChart } from './HeapVizChart'
import HeapVisualizationSettings from './HeapVisualizationSettings.vue'
import NavigationBarWithSettings from '../NavigationBarWithSettings.vue'
import { DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS } from './DataStructureVisibility'
import { HeapAnnotationManager, type HeapQuestionAnswer, type HeapQuestionOption } from './HeapAnnotations'
import { parsePetQuestionPayload } from '@/components/PetAnnotations'
import { usePetStore } from '@/store/PetStore'

const heapWrapper = ref<HTMLElement | null>(null)
function getHeapSvg (): SVGSVGElement | null {
  return heapWrapper.value?.querySelector(':scope > svg') ?? null
}
function getHeapRootG (): SVGGElement | null {
  return getHeapSvg()?.querySelector('g') ?? null
}

const annotationManager = new HeapAnnotationManager({
  getSvg: getHeapSvg,
  getRootG: getHeapRootG,
  getLookupRoot: () => heapWrapper.value
})
const graph = new HeapVizChart(() => annotationManager.redraw())
graph.init()

defineExpose({
  addSpeechBubble: annotationManager.addSpeechBubble.bind(annotationManager),
  addHighlight: annotationManager.addHighlight.bind(annotationManager),
  addQuestion: annotationManager.addQuestion.bind(annotationManager) as (
    target: Parameters<HeapAnnotationManager['addQuestion']>[0],
    traceState: Parameters<HeapAnnotationManager['addQuestion']>[1],
    text: string,
    options: HeapQuestionOption[],
    onAnswer?: (answer: HeapQuestionAnswer) => void
  ) => number,
  removeAnnotationById: annotationManager.removeAnnotationById.bind(annotationManager),
  removeAnnotations: annotationManager.removeAnnotations.bind(annotationManager),
  clearAnnotations: annotationManager.clearAnnotations.bind(annotationManager),
  setAnnotationCollapsed: annotationManager.setCollapsed.bind(annotationManager),
  getAnnotationCalloutState: annotationManager.getCalloutState.bind(annotationManager),
  getQuestionAnswer: annotationManager.getQuestionAnswer.bind(annotationManager),
  redrawAnnotations: annotationManager.redraw.bind(annotationManager)
})

const { memoryPets } = storeToRefs(usePetStore())
let annotationIds: number[] = []

function removePetAnnotations (): void {
  annotationIds.forEach(id => annotationManager.removeAnnotationById(id))
  annotationIds = []
}

function installPetAnnotations (): void {
  removePetAnnotations()
  for (const pet of memoryPets.value) {
    switch (pet.pet.action) {
      case 'Say':
        annotationIds.push(annotationManager.addSpeechBubble(pet.translated, pet.traceState, pet.pet.payload))
        break
      case 'Highlight':
        annotationIds.push(annotationManager.addHighlight(pet.translated, pet.traceState))
        break
      case 'AskSingle':
      case 'AskMultiple': {
        const question = parsePetQuestionPayload(pet.pet.payload)
        if (question)
          annotationIds.push(annotationManager.addQuestion(pet.translated, pet.traceState, question.text, question.options))
        break
      }
    }
  }
}

watch(memoryPets, installPetAnnotations, { immediate: true, flush: 'post' })

const showDataStructureDetails = ref(DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS.showDataStructureDetails)
const showDataStructureStatics = ref(DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS.showDataStructureStatics)
const showDataStructureFields = ref(DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS.showDataStructureFields)
const showMemory = ref(false)

watch(
  [showDataStructureDetails, showDataStructureStatics, showDataStructureFields],
  ([details, statics, fields]) => graph.setDataStructureVisibilitySettings({
    showDataStructureDetails: details,
    showDataStructureStatics: statics,
    showDataStructureFields: fields
  }),
  { immediate: true }
)

watch(showMemory, value => graph.setShowMemory(value), { immediate: true })

onMounted(() => {
  if (heapWrapper.value !== null)
    graph.onMounted(heapWrapper.value)
})
onUnmounted(() => {
  annotationManager.destroy()
  graph.close()
})

</script>

<style>
.heap-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.heap-wrapper>svg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.heap-wrapper g[id^="roots:"],
.heap-wrapper g[id^="o_"][id*=":"],
.heap-wrapper g[id$=":moreless"] {
  cursor: pointer;
}

.heap-wrapper g[id$=":header"],
.heap-wrapper g[id$=":method"],
.heap-wrapper g[id$=":empty"] {
  cursor: default;
}
</style>

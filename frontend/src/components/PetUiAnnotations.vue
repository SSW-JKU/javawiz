<template>
  <span hidden />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePetStore } from '@/store/PetStore'
import {
  PetAnnotationManager,
  parsePetQuestionPayload,
  type HtmlAnnotationTargetDescriptor
} from '@/components/PetAnnotations'
import { findPetUiTargetElements } from '@/components/PetUiTargets'

const { uiPets } = storeToRefs(usePetStore())
const annotationManager = new PetAnnotationManager()
let toolbarObserver: MutationObserver | null = null

watch(uiPets, async () => {
  await nextTick()
  installAnnotations()
}, { immediate: true, flush: 'post' })

onMounted(() => {
  const toolbar = document.querySelector('.toolbar')
  if (toolbar) {
    toolbarObserver = new MutationObserver(() => annotationManager.redraw())
    toolbarObserver.observe(toolbar, { childList: true, subtree: true })
  }
})

onUnmounted(() => {
  toolbarObserver?.disconnect()
  annotationManager.destroy()
})

function installAnnotations (): void {
  annotationManager.clearAnnotations()

  for (const pet of uiPets.value) {
    if (!pet.target) continue
    const target = uiTarget(pet.target)

    switch (pet.action) {
      case 'Say':
        annotationManager.addSpeechBubble(target, pet.payload)
        break
      case 'Highlight':
        annotationManager.addHighlight(target)
        break
      case 'AskSingle':
      case 'AskMultiple': {
        const question = parsePetQuestionPayload(pet.payload)
        if (question) {
          annotationManager.addQuestion(target, question.text, question.options)
        }
        break
      }
    }
  }
}

function uiTarget (target: string): HtmlAnnotationTargetDescriptor {
  return {
    kind: 'html',
    resolve: () => findPetUiTargetElements(target)
  }
}
</script>

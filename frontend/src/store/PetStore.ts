import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PetAnnotation } from '@/dto/DebuggerProtocol'
import type { TraceState } from '@/dto/TraceState'
import { useGeneralStore } from '@/store/GeneralStore'
import { isPetUiTarget } from '@/components/PetUiTargets'
import {
  translatePetTarget,
  type TranslatedPetTarget
} from '@/components/TheHeapVisualization/petTargetTranslation'

const JAVAWIZ_VIEW = 'JavaWizView'
const MEMORY_VIEW = 'MemoryView'

export type MemoryPet = {
  readonly pet: PetAnnotation
  readonly traceState: TraceState
  readonly translated: TranslatedPetTarget
}

export const usePetStore = defineStore('pet', () => {
  const generalStore = useGeneralStore()
  const pets = ref<PetAnnotation[]>([])

  const currentTraceState = computed(() => generalStore.debugger.latestTraceState)

  const currentPets = computed(() => {
    const traceState = currentTraceState.value
    if (!traceState) return []

    return pets.value.filter(pet =>
      pet.uri === traceState.sourceFileUri &&
      pet.lineNr === traceState.line
    )
  })

  const uiPets = computed(() =>
    currentPets.value.filter(pet =>
      isPetUiTarget(pet.target) &&
      (pet.view === JAVAWIZ_VIEW || pet.view == null)
    )
  )

  const memoryPets = computed<MemoryPet[]>(() => {
    const traceState = currentTraceState.value
    if (!traceState) return []

    return currentPets.value.flatMap(pet => {
      if (
        !pet.target ||
        (pet.view !== MEMORY_VIEW && pet.view != null)
      ) {
        return []
      }

      const translated = translatePetTarget(pet.target, traceState)
      return translated ? [{ pet, traceState, translated }] : []
    })
  })

  function setPets (newPets: PetAnnotation[]): void {
    pets.value = newPets
  }

  return {
    pets,
    currentPets,
    uiPets,
    memoryPets,
    setPets
  }
})

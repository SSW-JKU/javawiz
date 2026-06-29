const PET_TARGET_ATTRIBUTE = 'data-pet-target'
const PET_TARGET_FALLBACK_ATTRIBUTE = 'data-pet-target-fallbacks'
const UI_TARGET_KINDS = new Set(['button', 'input', 'ui'])

export function isPetUiTarget (target: string | undefined): target is string {
  if (!target) return false
  return UI_TARGET_KINDS.has(target.trim().split(/\s+/, 1)[0].toLowerCase())
}

export function findPetUiTargetElements (target: string, root: ParentNode = document): HTMLElement[] {
  const exactTargets = Array.from(root.querySelectorAll<HTMLElement>(`[${PET_TARGET_ATTRIBUTE}]`))
    .filter(element => element.getAttribute(PET_TARGET_ATTRIBUTE) === target)
  if (exactTargets.some(hasSize)) return exactTargets

  return Array.from(root.querySelectorAll<HTMLElement>(`[${PET_TARGET_FALLBACK_ATTRIBUTE}]`))
    .filter(element => element.getAttribute(PET_TARGET_FALLBACK_ATTRIBUTE)
      ?.split('|')
      .includes(target))
}

function hasSize (element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0
}

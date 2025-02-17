import { Method } from '@/dto/AbstractSyntaxTree'
import { InlineFn } from './render'
import { InlinedFnMap } from './types'

/**
 * Creates a toggle function for inlined methods.
 * @param methodMap inlined methods map
 * @param createFn method to create all methods compatible with this method- and class name, as well as number of arguments
 * @param createFunctionSelect callback to activate a function selector if there is ambiguity about which function to activate.
 * The callback returns a promise which resolves to the index of the user-selected function
 * @returns function to toggle a inline method
 */
export function createInlineMethodToggle (
  methodMap: InlinedFnMap,
  createFn: (uuids: string[]) => Method[],
  createFunctionSelect: (options: string[]) => Promise<number>): InlineFn {
  return async (uuid: string, candidateUUIDs: string[]) => {
    if (methodMap.delete(uuid)) return
    let methods = candidateUUIDs.map(candidate => methodMap.get(candidate)).filter((m): m is Method => !!m)
    if (methods.length === 0) {
      methods = createFn(candidateUUIDs)
    }
    if (methods.length === 0) return

    let method = methods[0]
    if (methods.length > 1) {
      const selected = await createFunctionSelect(methods.map(m => m.className + ':' + m.signature))
      if (selected < 0) return
      method = methods[selected]
    }
    methodMap.set(uuid, method)
  }
}

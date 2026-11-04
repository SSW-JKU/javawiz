import { HoverHandler, HoverInfo } from './types'

export class HoverSynchronizer {
  private static listeners: Set<HoverHandler> = new Set()
  private static currentlyHovered: HoverInfo[] = []

  /**
   * Sends the hovered items to every listener at once. A mouse move inside the same cell sends
   * the same list again, so an unchanged list is ignored instead of making every view update.
   */
  public static hover (infos: HoverInfo[]) {
    // Hover lists hold a few small plain objects, so comparing their JSON is cheap and exact.
    if (JSON.stringify(infos) === JSON.stringify(HoverSynchronizer.currentlyHovered))
      return
    HoverSynchronizer.currentlyHovered = [...infos]
    for (const handler of HoverSynchronizer.listeners) {
      handler(HoverSynchronizer.currentlyHovered)
    }
  }

  public static onHover (handler: HoverHandler) {
    HoverSynchronizer.listeners.add(handler)
  }

  public static removeOnHover (handler: HoverHandler) {
    HoverSynchronizer.listeners.delete(handler)
  }

  public static clear () {
    this.hover([])
  }
}

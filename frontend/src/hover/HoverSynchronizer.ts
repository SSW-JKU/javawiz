import { HoverHandler, HoverInfo } from './types'

export class HoverSynchronizer {
  private static listeners: Set<HoverHandler> = new Set()
  private static currentlyHovered: HoverInfo[] = []

  private static previousTimeMilliseconds = Date.now()
  private static readonly THROTTLE_TIME_MILLISECONDS = 40 // minimum time between handler calls
  private static throttle_cancel: null | ReturnType<typeof setTimeout> = null

  public static hover (infos: HoverInfo[]) {
    HoverSynchronizer.currentlyHovered = infos

    const offset = Date.now() - this.previousTimeMilliseconds
    if (offset < this.THROTTLE_TIME_MILLISECONDS) {
      if (this.throttle_cancel !== null) { // already scheduled handler call, no need to schedule another one
        return
      }
      this.throttle_cancel = setTimeout(() => {
        this.throttle_cancel = null
        HoverSynchronizer.callHandlers()
      }, offset)
      return
    }
    if (this.throttle_cancel !== null) { // we no longer need the scheduled handlers call since we are about to call handlers anyways
      clearTimeout(this.throttle_cancel)
      this.throttle_cancel = null
    }
    HoverSynchronizer.callHandlers()
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

  private static callHandlers () {
    HoverSynchronizer.previousTimeMilliseconds = Date.now()
    for (const handler of HoverSynchronizer.listeners) {
      handler(HoverSynchronizer.currentlyHovered)
    }
  }
}

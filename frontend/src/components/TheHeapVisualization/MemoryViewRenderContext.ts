import type { HoverInfo } from '@/hover/types'
import {
  DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS,
  type DataStructureVisibilitySettings
} from './DataStructureVisibility'

/** Mutable rendering inputs that belong to exactly one Memory View chart. */
export class MemoryViewRenderContext {
  private _dataStructureVisibilitySettings: DataStructureVisibilitySettings = {
    ...DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS
  }
  private _showMemory = false
  private _hoverInfos: readonly HoverInfo[] = []

  public get dataStructureVisibilitySettings (): Readonly<DataStructureVisibilitySettings> {
    return this._dataStructureVisibilitySettings
  }

  public setDataStructureVisibilitySettings (settings: DataStructureVisibilitySettings): void {
    this._dataStructureVisibilitySettings = { ...settings }
  }

  public get showMemory (): boolean {
    return this._showMemory
  }

  public setShowMemory (showMemory: boolean): void {
    this._showMemory = showMemory
  }

  public hoverInfos (): readonly HoverInfo[] {
    return this._hoverInfos
  }

  public setHoverInfos (hoverInfos: readonly HoverInfo[]): void {
    this._hoverInfos = [...hoverInfos]
  }
}

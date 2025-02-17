import { defineStore } from 'pinia'

// order of indices according to JW-149

export const EDITOR = 0

export const CONSOLE = 1

export const FLOWCHART = 2

export const HEAP = 3

export const DESKTEST = 4

export const ARRAY = 5

export const LINKEDLIST = 6

export const BINARYTREE = 7

export const SEQUENCEDIAGRAM = 8

export const INVIZ = 9

export const FEATURE_FLAGS = {
  EDITOR,
  CONSOLE,
  FLOWCHART,
  HEAP,
  DESKTEST,
  ARRAY,
  LINKEDLIST,
  BINARYTREE,
  SEQUENCEDIAGRAM,
  INVIZ
}

// 0 visible = Editor (in web mode)
// 1 visible = Console (in web mode)
// 2 visible = Flow chart
// 3 visible = Heap+Stack
// rest hidden = see above
export const DEFAULT_PANE_VISIBILITY = [true, true, true, true, false, false, false, false, false, false]

export const LAYOUT_ONE = 0
export const LAYOUT_TWO_VERTICALSPLIT = 1
export const LAYOUT_TWO_HORIZONTALSPLIT = 2
export const LAYOUT_THREE_RIGHTSINGLE = 3
export const LAYOUT_THREE_LEFTSINGLE = 4
export const LAYOUT_FOUR = 5

export const DEFAULT_LAYOUT = LAYOUT_TWO_VERTICALSPLIT

export const DEFAULT_CHOSEN_PANES = [2, 3, -1, -1]

const LAYOUT = 'layout'
const PANE_VISIBILITY = 'shownPanes'
const CHOSEN_PANES = 'chosenPanelsToPanes'

// This unique name, also referred to as id, is necessary and is used by Pinia to connect the store to the devtools.
// Naming the returned function useNAMEStore is a convention across composables to make its usage idiomatic.
export const usePaneVisibilityStore = defineStore('paneVisibility', {
  state: () => {
    // load pane visibility stored in local storage if available
    let paneVisibility = DEFAULT_PANE_VISIBILITY
    const lsPaneVisibilityString = localStorage.getItem(PANE_VISIBILITY)
    if (lsPaneVisibilityString) {
      const parsedLSPaneVisibility = JSON.parse(lsPaneVisibilityString)
      if (
        Array.isArray(parsedLSPaneVisibility) &&
        parsedLSPaneVisibility.every(entry => typeof entry === 'boolean') &&
        parsedLSPaneVisibility.length === DEFAULT_PANE_VISIBILITY.length
      ) {
        paneVisibility = parsedLSPaneVisibility
      }
    }

    // load selected layout stored in local storage if available
    let currentLayout = DEFAULT_LAYOUT
    const lsLayoutString = localStorage.getItem(LAYOUT)
    if (lsLayoutString) {
      currentLayout = +lsLayoutString
    }

    // load chosen panes stored in local storage if available
    let panelToPane = DEFAULT_CHOSEN_PANES
    const lsChosenPanesString = localStorage.getItem(CHOSEN_PANES)
    if (lsChosenPanesString) {
      const parsedLSChosenPanes = JSON.parse(lsChosenPanesString)
      if (
        Array.isArray(parsedLSChosenPanes) &&
        parsedLSChosenPanes.every(entry => typeof entry === 'number') &&
        parsedLSChosenPanes.length === DEFAULT_CHOSEN_PANES.length
      ) {
        panelToPane = parsedLSChosenPanes
      }
    }

    const paneToPanel: { [key: number]: number } = {
      2: -1,
      3: -1,
      4: -1,
      5: -1,
      6: -1,
      7: -1,
      8: -1,
      9: -1
    }

    for (let i = 0; i < panelToPane.length; i++) {
      if (panelToPane[i] > -1) {
        const pane = panelToPane[i]
        paneToPanel[pane] = i
      }
    }

    return {
      paneVisibility,
      currentLayout,
      panelToPane,
      paneToPanel
    }
  },
  getters: {
    // SHOWN
    isPaneShown: function () {
      return (paneIndex: number) => this.paneVisibility[paneIndex]
    },
    isEditorPaneShown: function (): boolean {
      return this.isPaneShown(EDITOR)
    },
    isConsolePaneShown: function (): boolean {
      return this.isPaneShown(CONSOLE)
    },
    isFlowChartPaneShown: function (): boolean {
      return this.isPaneShown(FLOWCHART)
    },
    isHeapPaneShown: function (): boolean {
      return this.isPaneShown(HEAP)
    },
    isDeskTestPaneShown: function (): boolean {
      return this.isPaneShown(DESKTEST)
    },
    isArrayPaneShown: function (): boolean {
      return this.isPaneShown(ARRAY)
    },
    isListPaneShown: function (): boolean {
      return this.isPaneShown(LINKEDLIST)
    },
    isTreePaneShown: function (): boolean {
      return this.isPaneShown(BINARYTREE)
    },
    isSequenceDiagramPaneShown: function (): boolean {
      return this.isPaneShown(SEQUENCEDIAGRAM)
    },
    isInputOutputPaneShown: function (): boolean {
      return this.isPaneShown(INVIZ)
    },
    // HIDDEN
    isPaneHidden: function () {
      return (paneIndex: number) => !this.isPaneShown(paneIndex)
    },
    isEditorPaneHidden: function (): boolean {
      return this.isPaneHidden(EDITOR)
    },
    isConsolePaneHidden: function (): boolean {
      return this.isPaneHidden(CONSOLE)
    },
    isFlowChartPaneHidden: function (): boolean {
      return this.isPaneHidden(FLOWCHART)
    },
    isHeapPaneHidden: function (): boolean {
      return this.isPaneHidden(HEAP)
    },
    isDeskTestPaneHidden: function (): boolean {
      return this.isPaneHidden(DESKTEST)
    },
    isArrayPaneHidden: function (): boolean {
      return this.isPaneHidden(ARRAY)
    },
    isListPaneHidden: function (): boolean {
      return this.isPaneHidden(LINKEDLIST)
    },
    isTreePaneHidden: function (): boolean {
      return this.isPaneHidden(BINARYTREE)
    },
    isSequenceDiagramPaneHidden: function (): boolean {
      return this.isPaneHidden(SEQUENCEDIAGRAM)
    },
    isInputOutputPaneHidden: function (): boolean {
      return this.isPaneHidden(INVIZ)
    }
  },
  actions: {
    // SHOW
    showEditorPane: function () {
      this.showPane(EDITOR)
    },
    showConsolePane: function () {
      this.showPane(CONSOLE)
    },
    showFlowChartPane: function () {
      this.showPane(FLOWCHART)
    },
    showHeapPane: function () {
      this.showPane(HEAP)
    },
    showDeskTestPane: function () {
      this.showPane(DESKTEST)
    },
    showArrayPane: function () {
      this.showPane(ARRAY)
    },
    showListPane: function () {
      this.showPane(LINKEDLIST)
    },
    showTreePane: function () {
      this.showPane(BINARYTREE)
    },
    showSequenceDiagramPane: function () {
      this.showPane(SEQUENCEDIAGRAM)
    },
    showInputOutputPane: function () {
      this.showPane(CONSOLE)
    },
    // HIDE
    hideEditorPane: function () {
      this.hidePane(EDITOR)
    },
    hideConsolePane: function () {
      this.hidePane(CONSOLE)
    },
    hideFlowChartPane: function () {
      this.hidePane(FLOWCHART)
    },
    hideHeapPane: function () {
      this.hidePane(HEAP)
    },
    hideDeskTestPane: function () {
      this.hidePane(DESKTEST)
    },
    hideArrayPane: function () {
      this.hidePane(ARRAY)
    },
    hideListPane: function () {
      this.hidePane(LINKEDLIST)
    },
    hideTreePane: function () {
      this.hidePane(BINARYTREE)
    },
    hideSequenceDiagramPane: function () {
      this.hidePane(SEQUENCEDIAGRAM)
    },
    hideInputOutputPane: function () {
      this.hidePane(INVIZ)
    },
    // GENERAL
    showPane (pane: number, showOnPanel: number = -1) {
      // Hide if already shown somewhere ...
      this.hidePane(pane)

      // ... then show on new panel
      this.paneVisibility[pane] = true
      if (showOnPanel >= 0) {
        this.panelToPane[showOnPanel] = pane
        this.paneToPanel[pane] = showOnPanel
      }
      localStorage.setItem(PANE_VISIBILITY, JSON.stringify(this.paneVisibility))
      localStorage.setItem(CHOSEN_PANES, JSON.stringify(this.panelToPane))
    },
    hidePane (pane: number) {
      this.paneVisibility[pane] = false
      if (this.paneToPanel[pane] >= 0) {
        const containingPanel = this.paneToPanel[pane]
        this.panelToPane[containingPanel] = -1
        this.paneToPanel[pane] = -1
      }
      localStorage.setItem(PANE_VISIBILITY, JSON.stringify(this.paneVisibility))
      localStorage.setItem(CHOSEN_PANES, JSON.stringify(this.panelToPane))
    },
    changeLayout (newLayout: number) {
      this.currentLayout = newLayout
      localStorage.setItem(LAYOUT, JSON.stringify(this.currentLayout))
    }
  }
})

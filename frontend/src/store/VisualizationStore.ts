import { defineStore } from 'pinia'
import { defineAsyncComponent, markRaw } from 'vue'
import flowchartIcon from '../assets/icons/hiding/flowchart.svg'
import stackIcon from '../assets/icons/hiding/stack.svg'
import desktestIcon from '../assets/icons/hiding/desktest.svg'
import arrayIcon from '../assets/icons/hiding/array.svg'
import listIcon from '../assets/icons/hiding/list.svg'
import treeIcon from '../assets/icons/hiding/tree.svg'
import inputOutputIcon from '../assets/icons/hiding/console.svg'
import sequenceDiagramIcon from '../assets/icons/hiding/sequencediagram.svg'
import historyIcon from '../assets/icons/hiding/history.svg'
import marbleDiagramIcon from '../assets/icons/hiding/marblediagram.svg'
import TheCodeEditor from '@/components/TheCodeEditor.vue'
import TheConsole from '@/components/TheConsole.vue'

const TheFlowChart = defineAsyncComponent(() => import('@/components/TheFlowChart/TheFlowChart.vue'))
const TheHeapVisualization = defineAsyncComponent(() => import('@/components/TheHeapVisualization/TheHeapVisualization.vue'))
const TheDeskTest = defineAsyncComponent(() => import('@/components/TheDeskTest/TheDeskTest.vue'))
const TheArrayVisualization = defineAsyncComponent(() => import('@/components/DataStructureVisualizations/TheArrayVisualization/TheArrayVisualization.vue'))
const TheListVisualization = defineAsyncComponent(() => import('@/components/DataStructureVisualizations/TheListVisualization/TheListVisualization.vue'))
const TheTreeVisualization = defineAsyncComponent(() => import('@/components/DataStructureVisualizations/TheTreeVisualization/TheTreeVisualization.vue'))
const TheSequenceDiagram = defineAsyncComponent(() => import('@/components/TheSequenceDiagram/TheSequenceDiagram.vue'))
const TheInViz = defineAsyncComponent(() => import('@/components/TheInViz.vue'))
const TheStreamViz = defineAsyncComponent(() => import('@/components/TheStreamViz.vue'))
const TheHistoryView = defineAsyncComponent(() => import('@/components/TheHistoryView/TheHistoryView.vue'))

// top-left | top-right | bottom-left | bottom-right = selected by user at given location
// hidden = not selected by user
// built-in = fixed shown in JavaWiz (for example code editor in web mode)
export type UserLayoutPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type LayoutPlacement = UserLayoutPlacement | 'hidden' | 'built-in'

export type LayoutState = {
  'top-left': number;
  'top-right': number;
  'bottom-left': number;
  'bottom-right': number;
}

export type VisualizationDescription = {
  id: number,
  name: string,
  shortName: string,
  userSelectable: boolean,
  icon: string,
  currentlyShownAt: LayoutPlacement
  view: any
}

// TODO: Type layout kinds
export const LAYOUT_ONE = 0
export const LAYOUT_TWO_VERTICALSPLIT = 1
export const LAYOUT_TWO_HORIZONTALSPLIT = 2
export const LAYOUT_THREE_RIGHTSINGLE = 3
export const LAYOUT_THREE_LEFTSINGLE = 4
export const LAYOUT_FOUR = 5

export const DEFAULT_LAYOUT = LAYOUT_TWO_VERTICALSPLIT

const LOCALSTORAGE_LAYOUT = 'layout'
// "shownPanes" and "chosenPanelsToPanes" were used in the past, do not reuse these names as localStorage property name
const LOCALSTORAGE_VIZ_IDS_BY_PLACEMENT = 'visualizationIdsByPlacement'

// This unique name, also referred to as id, is necessary and is used by Pinia to connect the store to the devtools.
// Naming the returned function useNAMEStore is a convention across composables to make its usage idiomatic.
export const useVisualizationStore = defineStore('visualization', {
  state:() => {
    // order of indices according to JW-149

    const EDITOR: VisualizationDescription = {
      id: 0,
      name: 'Editor',
      shortName: 'Editor',
      userSelectable: false,
      icon: '', // no icon for editor
      currentlyShownAt: 'built-in', // default value for web version, changed in extension mode
      view: markRaw(TheCodeEditor)
    }

    const CONSOLE: VisualizationDescription = {
      id: 1,
      name: 'Console',
      shortName: 'Console',
      userSelectable: false,
      icon: '', // no icon for console
      currentlyShownAt: 'built-in', // default value for web version, changed in extension mode
      view: markRaw(TheConsole)
    }

    const FLOWCHART: VisualizationDescription = {
      id: 2,
      name: 'Flow Chart',
      shortName: 'Flow Chart',
      userSelectable: true,
      icon: flowchartIcon,
      currentlyShownAt: 'top-left', // default value, might be overwritten by localStorage
      view: markRaw(TheFlowChart)
    }

    const MEMORY: VisualizationDescription = {
      id: 3,
      name: 'Memory (Heap/Stack)',
      shortName: 'Memory',
      userSelectable: true,
      icon: stackIcon,
      currentlyShownAt: 'top-right', // default value, might be overwritten by localStorage
      view: markRaw(TheHeapVisualization)
    }

    const DESKTEST: VisualizationDescription = {
      id: 4,
      name: 'Tabular View (DeskTest)',
      shortName: 'Tabular View',
      userSelectable: true,
      icon: desktestIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheDeskTest)
    }

    const ARRAY: VisualizationDescription = {
      id: 5,
      name: 'Array Visualization',
      shortName: 'Arrays',
      userSelectable: true,
      icon: arrayIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheArrayVisualization)
    }

    const LINKEDLIST: VisualizationDescription = {
      id: 6,
      name: 'Linked List Visualization',
      shortName: 'Linked Lists',
      userSelectable: true,
      icon: listIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheListVisualization)
    }

    const BINARYTREE: VisualizationDescription = {
      id: 7,
      name: 'Binary Tree Visualization',
      shortName: 'Binary Trees',
      userSelectable: true,
      icon: treeIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheTreeVisualization)
    }

    const SEQUENCEDIAGRAM: VisualizationDescription = {
      id: 8,
      name: 'Sequence Diagrams',
      shortName: 'Sequence Diagrams',
      userSelectable: true,
      icon: sequenceDiagramIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheSequenceDiagram)
    }

    const INVIZ: VisualizationDescription = {
      id: 9,
      name: 'Input/Output Visualization',
      shortName: 'I/O',
      userSelectable: true,
      icon: inputOutputIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheInViz)
    }

    const STREAMVIZ: VisualizationDescription = {
      id: 10,
      name: 'Stream Visualization',
      shortName: 'Streams',
      userSelectable: true,
      icon: marbleDiagramIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheStreamViz)
    }

    const HISTORY: VisualizationDescription = {
      id: 11,
      name: 'History View',
      shortName: 'History',
      userSelectable: true,
      icon: historyIcon,
      currentlyShownAt: 'hidden', // default value, might be overwritten by localStorage
      view: markRaw(TheHistoryView)
    }

    const visualizations = [
      EDITOR,
      CONSOLE,
      FLOWCHART,
      MEMORY,
      DESKTEST,
      ARRAY,
      LINKEDLIST,
      BINARYTREE,
      SEQUENCEDIAGRAM,
      INVIZ,
      STREAMVIZ,
      HISTORY
    ]

    const visualizationsById: { [key: number]: VisualizationDescription } = {}
    visualizations.forEach(x => {
      visualizationsById[x.id] = x
    })

    // load selected layout stored in local storage if available
    let currentLayout = DEFAULT_LAYOUT
    const lsLayoutString = localStorage.getItem(LOCALSTORAGE_LAYOUT)
    if (lsLayoutString) {
      currentLayout = +lsLayoutString
    }

    // load chosen panes stored in local storage if available
    const lsVizByPlacement = localStorage.getItem(LOCALSTORAGE_VIZ_IDS_BY_PLACEMENT)
    if (lsVizByPlacement) {
      const vizByPlacement: LayoutState = JSON.parse(lsVizByPlacement)

      // reset default values
      visualizations
        .filter((x: VisualizationDescription) => x.currentlyShownAt !== 'built-in')
        .forEach((viz: VisualizationDescription) => viz.currentlyShownAt = 'hidden')

      // apply layout from local storage
      for (const [position, paneId] of Object.entries(vizByPlacement)) {
        const viz = visualizationsById[paneId]
        if (viz) {
          viz.currentlyShownAt = position as LayoutPlacement
        }
      }
    }

    return {
      EDITOR,
      CONSOLE,
      FLOWCHART,
      MEMORY,
      DESKTEST,
      ARRAY,
      LINKEDLIST,
      BINARYTREE,
      SEQUENCEDIAGRAM,
      INVIZ,
      STREAMVIZ,
      HISTORY,
      visualizations,
      visualizationsById,
      currentLayout
    }
  },
  getters: {
    visualizationIdsByPlacement (): { [key in UserLayoutPlacement]: number } {
      const visualizations = this.visualizations;
      return {
        'top-left': visualizations.find((v: VisualizationDescription) => v.currentlyShownAt === 'top-left')?.id ?? -1,
        'top-right': visualizations.find((v: VisualizationDescription) => v.currentlyShownAt === 'top-right')?.id ?? -1,
        'bottom-left': visualizations.find((v: VisualizationDescription) => v.currentlyShownAt === 'bottom-left')?.id ?? -1,
        'bottom-right': visualizations.find((v: VisualizationDescription) => v.currentlyShownAt === 'bottom-right')?.id ?? -1

      }
    },
    // SHOWN
    isShown: function() {
      return (viz: number | VisualizationDescription) => {
        if (typeof viz !== 'number') {
          viz = viz.id
        }
        const visualization = this.visualizationsById[viz];
        return visualization ? visualization.currentlyShownAt !== 'hidden' : false;
      }
    },
    isEditorShown: function(): boolean {
      return this.isShown(this.EDITOR)
    },
    isConsoleShown: function(): boolean {
      return this.isShown(this.CONSOLE)
    },
    isFlowChartShown: function(): boolean {
      return this.isShown(this.FLOWCHART)
    },
    isMemoryVizShown: function(): boolean {
      return this.isShown(this.MEMORY)
    },
    isTabularViewShown: function(): boolean {
      return this.isShown(this.DESKTEST)
    },
    isArrayVizShown: function(): boolean {
      return this.isShown(this.ARRAY)
    },
    isListVizShown: function(): boolean {
      return this.isShown(this.LINKEDLIST)
    },
    isTreeVizShown: function(): boolean {
      return this.isShown(this.BINARYTREE)
    },
    isSequenceDiagramVizShown: function(): boolean {
      return this.isShown(this.SEQUENCEDIAGRAM)
    },
    isInputOutputVizShown: function(): boolean {
      return this.isShown(this.INVIZ)
    },
    isStreamVizShown: function(): boolean {
      return this.isShown(this.STREAMVIZ)
    },
    isHistoryViewShown: function(): boolean {
      return this.isShown(this.HISTORY)
    },
    // HIDDEN
    isHidden: function() {
      return (viz: number | VisualizationDescription) => {
        if (typeof viz !== 'number') {
          viz = viz.id
        }
        const visualization = this.visualizationsById[viz];
        return visualization ? visualization.currentlyShownAt === 'hidden' : false;
      }
    },
    isEditorHidden: function(): boolean {
      return this.isHidden(this.EDITOR)
    },
    isConsoleHidden: function(): boolean {
      return this.isHidden(this.CONSOLE)
    },
    isFlowChartHidden: function(): boolean {
      return this.isHidden(this.FLOWCHART)
    },
    isMemoryVizHidden: function(): boolean {
      return this.isHidden(this.MEMORY)
    },
    isTabularViewHidden: function(): boolean {
      return this.isHidden(this.DESKTEST)
    },
    isArrayVizHidden: function(): boolean {
      return this.isHidden(this.ARRAY)
    },
    isListVizHidden: function(): boolean {
      return this.isHidden(this.LINKEDLIST)
    },
    isTreeVizHidden: function(): boolean {
      return this.isHidden(this.BINARYTREE)
    },
    isSequenceDiagramVizHidden: function(): boolean {
      return this.isHidden(this.SEQUENCEDIAGRAM)
    },
    isInputOutputVizHidden: function(): boolean {
      return this.isHidden(this.INVIZ)
    },
    isStreamVizHidden: function(): boolean {
      return this.isHidden(this.STREAMVIZ)
    },
    isHistoryViewHidden: function(): boolean {
      return this.isHidden(this.HISTORY)
    }

  },
  actions: {
    // SHOW
    showEditor: function() {
      this.show(this.EDITOR)
    },
    showConsole: function() {
      this.show(this.CONSOLE)
    },
    showFlowChart: function(showAt: UserLayoutPlacement) {
      this.show(this.FLOWCHART, showAt)
    },
    showMemoryViz: function(showAt: UserLayoutPlacement) {
      this.show(this.MEMORY, showAt)
    },
    showTabularView: function(showAt: UserLayoutPlacement) {
      this.show(this.DESKTEST, showAt)
    },
    showArrayViz: function(showAt: UserLayoutPlacement) {
      this.show(this.ARRAY, showAt)
    },
    showListViz: function(showAt: UserLayoutPlacement) {
      this.show(this.LINKEDLIST, showAt)
    },
    showTreeViz: function(showAt: UserLayoutPlacement) {
      this.show(this.BINARYTREE, showAt)
    },
    showSequenceDiagramViz: function(showAt: UserLayoutPlacement) {
      this.show(this.SEQUENCEDIAGRAM, showAt)
    },
    showInputOutputViz: function(showAt: UserLayoutPlacement) {
      this.show(this.INVIZ, showAt)
    },
    showStreamViz: function(showAt: UserLayoutPlacement) {
      this.show(this.STREAMVIZ, showAt)
    },
    showHistoryView: function(showAt: UserLayoutPlacement) {
      this.show(this.HISTORY, showAt)
    },
    // HIDE
    hideEditor: function() {
      this.hide(this.EDITOR)
    },
    hideConsole: function() {
      this.hide(this.CONSOLE)
    },
    hideFlowChart: function() {
      this.hide(this.FLOWCHART)
    },
    hideMemoryViz: function() {
      this.hide(this.MEMORY)
    },
    hideTabularView: function() {
      this.hide(this.DESKTEST)
    },
    hideArrayViz: function() {
      this.hide(this.ARRAY)
    },
    hideListViz: function() {
      this.hide(this.LINKEDLIST)
    },
    hideTreeViz: function() {
      this.hide(this.BINARYTREE)
    },
    hideSequenceDiagramViz: function() {
      this.hide(this.SEQUENCEDIAGRAM)
    },
    hideInputOutputViz: function() {
      this.hide(this.INVIZ)
    },
    hideStreamViz: function() {
      this.hide(this.STREAMVIZ)
    },
    hideHistoryView: function() {
      this.hide(this.HISTORY)
    },
    // GENERAL
    show (viz: number | VisualizationDescription, showAt: LayoutPlacement = 'built-in') {
      // Hide if already shown somewhere ...
      this.hide(viz)

      // ... then show on new panel
      this.visualizationsById[typeof viz === 'number' ? viz : viz.id]!.currentlyShownAt = showAt

      localStorage.setItem(LOCALSTORAGE_VIZ_IDS_BY_PLACEMENT, JSON.stringify(this.visualizationIdsByPlacement))
    },
    hide (viz: number | VisualizationDescription) {
      this.visualizationsById[typeof viz === 'number' ? viz : viz.id]!.currentlyShownAt = 'hidden'

      localStorage.setItem(LOCALSTORAGE_VIZ_IDS_BY_PLACEMENT, JSON.stringify(this.visualizationIdsByPlacement))
    },
    changeLayout (newLayout: number) {
      this.currentLayout = newLayout
      localStorage.setItem(LOCALSTORAGE_LAYOUT, JSON.stringify(this.currentLayout))
    }
  }
})

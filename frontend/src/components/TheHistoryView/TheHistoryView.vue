<template>
  <div id="history-wrapper">
    <NavigationBarWithSettings :viz-id="visualizationStore.HISTORY.id" />
    <div class="history-header">
      <strong>The History View for {{ generalStore.debugger.fullTrace.traceLength }} trace states</strong>
      <div class="history-controls">
        <label class="history-option">
          <input v-model="showFieldAssignments" type="checkbox"> Show Field Assignments
        </label>
        <label class="history-option">
          <input v-model="showArrayInitialization" type="checkbox"> Show Array Init Steps
        </label>
        <div class="dropdown">
          <div class="dropdown-trigger">
            <button
              type="button"
              class="dropdown-btn"
              aria-controls="history-shown-method-filters"
              :aria-expanded="isDropdownOpen"
              @click="toggleDropdown">
              Shown Methods
              <span class="arrow" :class="{ 'arrow-up': isDropdownOpen }" />
            </button>
            <span
              class="shown-method-filter-info"
              role="img"
              aria-label="Shows or hides history entries happening inside individual methods."
              title="Shows or hides history entries happening inside individual methods.">ⓘ</span>
          </div>
          <div v-if="isDropdownOpen" id="history-shown-method-filters" class="dropdown-content">
            <div v-for="shownMethodFilter in shownMethodFilters" :key="shownMethodFilter.key">
              <label>
                <input v-model="shownMethodFilter.shown" type="checkbox"> {{ shownMethodFilter.label }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div ref="historyListContainer" class="history-list-container" @scroll="updateStickToBottom">
      <div class="history-list">
        <div
          v-for="historyState in filteredHistoryStates"
          :key="historyState.state.stateIndex"
          :class="classes(historyState.traceIndex)">
          <div
            v-for="entry in historyState.entries"
            :key="entry.key"
            class="history-item"
            :class="{
              'highlight-match': highlightedEntries.has(entry),
              'current-match-highlight': currentHighlightedEntry === entry
            }"
            :data-history-entry-key="entry.key"
            :style="getIndentStyle(historyState.state.stackAfterExecution, entry.isCall, entry.extraIndent)"
            @click="jumpToState(historyState.state.stateIndex)"
            @mouseover="hoverStore.changeLine({ lineNr: historyState.state.line, localUri: historyState.state.localUri })"
            @mouseout="hoverStore.changeLine({ lineNr: -1, localUri: historyState.state.localUri })">
            <img
              :src="historyEntryIcons[entry.icon]"
              alt=""
              aria-hidden="true"
              class="history-icon">
            <div class="line-number">
              {{ historyState.state.line }}
            </div>
            <div class="history-content">
              {{ entry.text }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="search-bar">
      <input
        v-model="searchQuery" type="text" placeholder="Filter history (e.g. counter = 12 or call sort) ..." @keydown.stop
        @keyup.stop>
      <div class="search-actions">
        <button
          type="button"
          class="nav-btn info-btn"
          title="Show available history filters"
          aria-label="Show available history filters"
          aria-haspopup="dialog"
          :aria-expanded="overlayStore.showHistoryDSLInfo"
          @click="overlayStore.openHistoryDSLInfo()">
          <img :src="infoIcon" alt="" class="nav-icon">
        </button>
        <button class="nav-btn" title="Previous match" :disabled="highlightedEntriesInOrder.length === 0" @click="jumpToMatch('prev')">
          <img :src="arrowUpIcon" alt="Previous" class="nav-icon">
        </button>
        <button class="nav-btn" title="Next match" :disabled="highlightedEntriesInOrder.length === 0" @click="jumpToMatch('next')">
          <img :src="arrowDownIcon" alt="Next" class="nav-icon">
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGeneralStore } from '@/store/GeneralStore';
import { useHoverStore } from '@/store/HoverStore';
import { computed, ref, watch, nextTick } from 'vue';
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue';
import { useVisualizationStore } from '@/store/VisualizationStore';
import { StackFrame } from '@/dto/TraceState';
import arrowUpIcon from '@/assets/icons/controls/arrow-small-up.svg';
import arrowDownIcon from '@/assets/icons/controls/arrow-small-down.svg';
import globeIcon from '@/assets/icons/history-view/globe.svg';
import markerIcon from '@/assets/icons/history-view/marker.svg';
import constructorIcon from '@/assets/icons/history-view/constructor.svg';
import functionCall from '@/assets/icons/history-view/function-square.svg';
import layoutFluidIcon from '@/assets/icons/history-view/cubes.svg';
import staticInitIcon from '@/assets/icons/history-view/static-init.svg';
import infoIcon from '@/assets/icons/info.png';
import { useOverlayStore } from '@/store/OverlayStore';
import {
  buildFilteredHistoryStates,
  buildShownMethodFilters,
  createHistoryLookup,
  findHighlightedHistoryEntries,
  shownMethodFilterKey,
  parseDslFilter
} from './historyFiltering';
import type { FilteredHistoryEntry, HistoryEntryIcon, ShownMethodFilter } from './historyFiltering';
import { createHistoryFormatter } from './historyFormatting';

const historyEntryIcons = {
  'array-element': markerIcon,
  call: functionCall,
  constructor: constructorIcon,
  local: markerIcon,
  'object-field': layoutFluidIcon,
  'static-field': globeIcon,
  'static-initializer': staticInitIcon
} satisfies Record<HistoryEntryIcon, string>;

const shownMethodFilters = ref<ShownMethodFilter[]>([]);
const shownMethodFilterByKey = computed(() => new Map(
  shownMethodFilters.value.map(shownMethodFilter => [shownMethodFilter.key, shownMethodFilter.shown])
));
const isDropdownOpen = ref(false);

const generalStore = useGeneralStore()
const visualizationStore = useVisualizationStore()
const hoverStore = useHoverStore()
const overlayStore = useOverlayStore()

const showFieldAssignments = ref(true)
const showArrayInitialization = ref(false)
const historyListContainer = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const currentMatchIndex = ref(-1);
const stickToBottom = ref(true);
const historyLookup = createHistoryLookup();


const dslFilter = computed(() => parseDslFilter(searchQuery.value));
const filteredHistoryStates = computed(() => {
  const trace = generalStore.debugger.fullTrace.processedTrace;
  const formatter = createHistoryFormatter(trace);
  return buildFilteredHistoryStates({
    trace,
    showFieldAssignments: showFieldAssignments.value,
    showArrayInitialization: showArrayInitialization.value,
    isShownMethod,
    formatter,
    lookup: historyLookup
  });
});
const highlightedEntries = computed(() => findHighlightedHistoryEntries(filteredHistoryStates.value, dslFilter.value));
const highlightedEntriesInOrder = computed(() => filteredHistoryStates.value
  .flatMap(historyState => historyState.entries)
  .filter(entry => highlightedEntries.value.has(entry)));
const currentHighlightedEntry = computed<FilteredHistoryEntry | null>(
  () => highlightedEntriesInOrder.value[currentMatchIndex.value] ?? null
);
const currentStateIndex = computed(() => (generalStore.currentTraceData?.stateIndex ?? 0) - 1)

watch(() => highlightedEntries.value, () => {
  currentMatchIndex.value = -1;
});

/**
 * Selects and scrolls to the adjacent filtered history entry, wrapping at
 * either end of the match list.
 *
 * @param direction - Direction in which to move through the matching entries.
 */
function jumpToMatch (direction: 'next' | 'prev') {
  const matches = highlightedEntriesInOrder.value;
  if (matches.length === 0) return;

  if (direction === 'next') {
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.length;
  } else {
    if (currentMatchIndex.value === -1 || currentMatchIndex.value === 0) {
      currentMatchIndex.value = matches.length - 1;
    } else {
      currentMatchIndex.value = (currentMatchIndex.value - 1);
    }
  }
    
  const entry = matches[currentMatchIndex.value];
  nextTick(() => {
    const element = historyListContainer.value?.querySelector<HTMLElement>(
      `[data-history-entry-key="${entry.key}"]`
    );
    element?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  });
}

/**
 * Navigates the debugger to the post-execution state represented by a history
 * entry.
 *
 * @param processedStateIndex - Zero-based index in the processed trace.
 */
function jumpToState (processedStateIndex: number) {
  generalStore.debugger.jumpToState(processedStateIndex + 1);
}

/**
 * Toggles visibility of the method-filter dropdown.
 */
function toggleDropdown () {
  isDropdownOpen.value = !isDropdownOpen.value;
}

watch(() => generalStore.debugger.fullTrace.processedTrace.length, () => {
  nextTick(() => {
    if (historyListContainer.value && stickToBottom.value) {
      historyListContainer.value.scrollTop = historyListContainer.value.scrollHeight;
    }
  });
}, { immediate: true });

/**
 * Tracks whether automatic scrolling should follow newly appended trace
 * entries without pulling users away from older history they are inspecting.
 */
function updateStickToBottom () {
  const container = historyListContainer.value;
  if (!container) return;
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  stickToBottom.value = distanceFromBottom <= 24;
}

watch(() => generalStore.debugger.fullTrace, () => {
  historyLookup.clear();
}, { flush: 'sync' });

watch(() => generalStore.asts, (asts) => {
  if (!asts) return;
  shownMethodFilters.value = buildShownMethodFilters(asts, shownMethodFilters.value);
}, { immediate: true });

/**
 * Checks whether a class method is enabled by the method-filter controls.
 *
 * Methods absent from the controls remain enabled.
 *
 * @param className - Class that declares the method.
 * @param methodSignature - Complete runtime display signature of the method.
 * @returns `true` when the method's history entries should be displayed.
 */
function isShownMethod (className: string, methodSignature: string): boolean {
  return shownMethodFilterByKey.value.get(shownMethodFilterKey(className, methodSignature)) ?? true;
}

/**
 * Classifies a history entry relative to the debugger's current state.
 *
 * @param index - Zero-based processed-trace index of the history entry.
 * @returns The CSS class for a past, current, or future entry.
 */
function classes (index: number) {
  if (index < currentStateIndex.value) {
    return 'past-line'
  } else if (index > currentStateIndex.value) {
    return 'future-line'
  } else if (index === currentStateIndex.value) {
    return 'current-line'
  }
}

/**
 * Calculates horizontal indentation from call-stack depth.
 *
 * @param stack - Stack whose depth determines indentation.
 * @param isCall - Whether the entry represents a call and needs call-specific depth adjustment.
 * @param extraLevel - Additional logical indentation levels.
 * @returns An inline style object containing the left margin, or an empty object when no stack is available.
 */
function getIndentStyle (stack: StackFrame[], isCall: boolean = false, extraLevel: number = 0) {
  if (!stack) return {};
  const depth = stack.length;
  const logicalDepth = isCall ? depth - 2 : depth - 1;
  const indent = Math.max(0, logicalDepth + extraLevel) * 40;
  return { marginLeft: `${indent}px` };
}

</script>

<style scoped>
#history-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  padding-left: 36px;
  display: flex;
  flex-direction: column;
  padding-bottom: 20px;
}

.history-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.history-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
}

.history-option input {
  cursor: pointer;
}

.search-bar {
  padding: 10px;
  background-color: #f8f9fa;
  border-top: 1px solid #ccc;
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-bar input {
  flex-grow: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.search-actions {
  display: flex;
  gap: 4px;
}

.info-btn {
  padding: 4px;
}

.nav-btn {
  padding: 6px 10px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
}

.nav-btn:hover:not(:disabled) {
  background-color: #e9ecef;
}

.nav-icon {
  width: 20px;
  height: 20px;
  opacity: 0.7;
}

.history-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  opacity: 0.8;
}


.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.history-list-container {
  overflow-y: auto;
  flex: 1;
  padding: 10px;
  scroll-behavior: smooth;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #fff;
  border: 1px solid #eee;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
  cursor: pointer;
}

.history-item:hover {
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transform: translateX(2px);
}

.line-number {
  min-width: 3ch;
  margin-right: 12px;
  padding-right: 12px;
  border-right: 1px solid #ddd;
  text-align: right;
  font-weight: bold;
  opacity: 0.7;
  flex-shrink: 0;
}

.history-content {
  flex-grow: 1;
  word-break: break-word;
}


.past-line .history-item {
  color: #555;
  border-color: #e0e0e0;
}

.current-line .history-item {
  background-color: #e8f5e9;
  border-color: #4caf50;
  color: #1b5e20;
  font-weight: bold;
  border-left-width: 4px;
}

.future-line .history-item {
  color: #999;
  background-color: #fafafa;
  font-style: italic;
}

.dropdown-btn:hover {
  background-color: #e9ecef;
}

.arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  display: inline-block;
  transition: transform 0.2s ease;
}

.arrow-up {
  transform: rotate(180deg);
}

.dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
}

.shown-method-filter-info {
  color: #555;
  font-size: 14px;
  line-height: 1;
  cursor: help;
}

.dropdown-content {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background-color: #f9f9f9;
  width: max-content;
  min-width: 200px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 8px 16px rgb(0 0 0 / 20%);
  padding: 12px 16px;
  z-index: var(--visualization-buttons);
  max-height: 300px;
  overflow: auto;
  border: 1px solid #ccc;
}

.dropdown-content label {
  display: block;
  margin-bottom: 5px;
  white-space: nowrap;
  cursor: pointer;
}

.highlight-match {
  background-color: #fffde7 !important;
  border-color: #fdd835 !important;
  color: #000 !important;
}

.current-match-highlight {
  outline: 2px solid #ef6c00;
  box-shadow: 0 0 8px rgba(239, 108, 0, 0.5);
  position: relative;
  z-index: 1;
}
</style>

<template>
  <div id="stream-viz-wrapper">
    <VizSetting
      :zoom-reset="zoomAndCenter"
      :viz-id="STREAMVIZ_ID" />
    <div v-if="allMarbles.length > 0" id="stream-viz">
      <div class="controls">
        <div class="stepControls">
          <button id="prevBtn" class="myButton" title="Step back" @click="stepBackward">
            &laquo;
          </button>
          <div style="user-select: none; cursor: pointer;" @click="editMode = true">
            <span v-if="!editMode">{{ currentStep }}</span>
            <span v-else>
              <input
                ref="stepInput"
                v-model.number="inputStep"
                class="inputField"
                type="number"
                min="0"
                :max="allMarbles.length"
                autofocus
                @keyup.esc="cancelEdit"
                @keyup.enter="applyStep"
                @blur="applyStep">
            </span>
            <span style="font-weight: bolder; font-size: 1.2rem;">/{{ allMarbles.length }}</span>
          </div>
          <button id="nextBtn" class="myButton" title="Step forward" @click="stepForward">
            &raquo;
          </button>
        </div>
        <div v-if="!isPlaying" class="playControls">
          <button
            v-if="currentStep > 0 && currentStep < allMarbles.length" id="resumeBtn" class="playButton" title="Resume animation from current step"
            @click="resumePlayback">
            Resume animation from current step
          </button>
          <button id="startBtn" class="playButton" title="Play animation from the beginning" @click="playToStep">
            Play from start
          </button>
        </div>
        <div v-else class="playControls">
          <button id="pauseBtn" class="stopButton" title="Pause animation" @click="pausePlayback">
            Pause
          </button>
          <button
            id="stopBtn" class="stopButton" style="font-size: 1.4rem;" title="Stop and reset animation"
            @click="stopAndResetPlayback">
            Stop
          </button>
        </div>
      </div>
      <svg id="stream-viz-svg" width="100%" height="100%" />
    </div>
    <div v-else class="stream-viz-hint">
      Execute some stream operations to enable this view.
    </div>
  </div>
</template>

<script setup lang = 'ts'>
import {computed, defineComponent, nextTick, onUnmounted, ref, watch} from 'vue'
import VizSetting from '@/components/VizSetting.vue'
import { useVisualizationStore } from '@/store/VisualizationStore'
import {useGeneralStore} from '@/store/GeneralStore'
import {collectionDirection, latestTopLevelStream, placeTracks} from '@/debugger/streamVisualization'
import * as d3 from 'd3'
import { colors } from '@/helpers/colors'
import { NAVIGATION_CONTENT_INSET } from '@/helpers/constants'
import type {HeapObject, Val, MarbleDiagramMarble, MarbleDiagramItem, MarbleDiagramLink, MarbleDiagramLane} from '@/dto/TraceState';

defineComponent({
  name: 'TheStreamViz',
  components: { VizSetting }
})
const generalStore = useGeneralStore()
const visualizationStore = useVisualizationStore()
const STREAMVIZ_ID = visualizationStore.STREAMVIZ.id
const streamVisualizationData = computed(() => latestTopLevelStream(generalStore.currentTraceData?.streamVisualizationData.streams ?? []))
const allMarbles = computed(() => streamVisualizationData.value?.marbles ?? [])
const allLinks = computed(() => streamVisualizationData.value?.links ?? [])
const operationLanes = computed(() => streamVisualizationData.value?.operationLanes ?? {})
// The stream runs during the current debugger step, so the objects it shows exist only in the heap after that step.
const heap = computed(() => generalStore.currentTraceData?.processedTraceState?.heapAfterExecution)
const MARBLE_RADIUS = 15;
/** Outline and cross of the circle that marks where a marble enters a lane. */
const EVENT_MARKER_COLOR = colors.darkGray
/** Background of marbles and of text labels drawn over the diagram. */
const LIGHT_FILL_COLOR = colors.lightGray
const HALFWIDTH = 75;
const MARBLE_WIDTH = 150;
const LAYOUT_MARGIN = 10;
const MAPKEYX = -145;
const MAPKEYBOXWIDTH = 60;
const PARAMX = 200;
const PARAMSTARTX = 175;
/** Horizontal space between two columns of marbles. */
const COLUMN_GAP = 30;
const PARAMY = 25;
/** Vertical space between two lanes. */
const LANE_GAP = 30;
/** Space above a lane line for the operation name. */
const LANE_LABEL_SPACE = 30;
const TRANSITION_DURATION_MS = 500;
const isPlaying = ref(false);
const currentStep = ref(0);
const editMode = ref(false);
const inputStep = ref(0);
const stepInput = ref<HTMLInputElement | null>(null);
const circleFontSize = new Map<number, string>([
  [1, '21px'],
  [2, '21px'],
  [3, '21px'],
  [4, '17px'],
  [5, '14px'],
  [6, '12px'],
  [7, '10px'],
  [8, '9px'],
  [9, '8px'],
  [10, '7px']
]);

const miniCircleFontSize = new Map<number, string>([
  [1, '16px'],
  [2, '16px'],
  [3, '14px'],
  [4, '12px'],
  [5, '10px'],
  [6, '8px'],
  [7, '7px'],
  [8, '6px'],
  [9, '5px'],
  [10, '5px']
]);

const miniStringLength = new Map<number, number>([
  [1, 15],
  [2, 7],
  [3, 5],
  [4, 4]
]);

const stringFontSize = new Map<number, string>([
  [1, '16px'],
  [2, '16px'],
  [3, '16px'],
  [4, '16px'],
  [5, '16px'],
  [6, '16px'],
  [7, '16px'],
  [8, '15px'],
  [9, '15px'],
  [10, '14px'],
  [11, '14px'],
  [12, '13px'],
  [13, '13px']
])

const optionalTypes = new Set(['Optional', 'OptionalInt', 'OptionalLong', 'OptionalDouble'])

type MarbleGroup = d3.Selection<SVGGElement, MarbleDiagramMarble, null, undefined>;
type ContainerGroup = d3.Selection<SVGGElement, unknown, null, undefined>;
type DisplayValue = Val | { kind: 'Ellipsis'; value: string };
type DisplayField = { name: string; value: DisplayValue };

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined;
let container: ContainerGroup | undefined;
let linkGroup: ContainerGroup | undefined;
let nodeGroup: ContainerGroup | undefined;
let zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 10])
  .on('zoom', zoomed);
let intervalId: ReturnType<typeof setInterval> | null = null;
let animationSpeed = 800;
let visibleMarblesForCount: MarbleDiagramMarble[] = [];
/** Center and width of each column on screen, keyed by the column's x from the backend (see `layoutDiagram`). */
let columns = new Map<number, { center: number, width: number }>();
/** The y of each lane line on screen, keyed by the lane's y from the backend (see `layoutDiagram`). */
let lanes = new Map<number, number>();
/**
 * Drawn size of each marble, keyed by its playback step and measured once per stream (see `layoutDiagram`).
 * `top` is how far the marble reaches above its lane line, `bottom` how far below it.
 */
let marbleSizes = new Map<number, { width: number, top: number, bottom: number }>();

// Hilfsfunktion: F├╝r jede ID nur den neuesten Knoten (max step <= currentStep) ausw├ñhlen
function getVisibleMarblesAtStep (marbles: MarbleDiagramMarble[], step: number) {
  const grouped = d3.group(
    marbles.filter((n) => n.playbackStep <= step),
    (d) => d.marbleKey
  );
  return Array.from(grouped, ([_, group]) =>
    group.reduce((latestMarble, currentMarble) => currentMarble.playbackStep > latestMarble.playbackStep ? currentMarble : latestMarble)
  );
}

function isCompactType (type: string | null | undefined) {
  return ['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short'].includes(type ?? '');
}

/** Identifies optionals whose value is represented by a label instead of a heap object. */
function isOptionalType (type: string | null | undefined) {
  return optionalTypes.has(type ?? '')
}

function applyStep () {
  if (inputStep.value == null || isNaN(inputStep.value)) {
    currentStep.value = 0;
  } else {
    if (inputStep.value < 0) {
      currentStep.value = 0;
    } else if (inputStep.value > allMarbles.value.reduce((max, n) => Math.max(max, n.playbackStep), 0)) {
      currentStep.value = allMarbles.value.reduce((max, n) => Math.max(max, n.playbackStep), 0);
    } else {
      currentStep.value = inputStep.value;
    }
  }
  editMode.value = false;
}

function cancelEdit () {
  inputStep.value = currentStep.value;
  editMode.value = false;
}

function render () {
  if (!container || !nodeGroup || !linkGroup) return;
  const visibleMarbles = getVisibleMarblesAtStep(allMarbles.value, currentStep.value);
  layoutDiagram(nodeGroup, visibleMarbles);
  var lastVisibleMarble = visibleMarbles[visibleMarbles.length - 1];
  const lastColumn = lastVisibleMarble ? columns.get(lastVisibleMarble.x) : undefined;
  // Lane names and parameters follow the right edge of the last visible column.
  var newX = lastColumn ? lastColumn.center + lastColumn.width / 2 + PARAMX - HALFWIDTH : PARAMSTARTX;
  container.selectAll<SVGLineElement, MarbleDiagramLane>('.opline')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('x2', newX + LAYOUT_MARGIN)
    .attr('y1', d => laneY(d.y))
    .attr('y2', d => laneY(d.y));
  container.selectAll<SVGTextElement, MarbleDiagramLane>('.oplabel')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('x', newX)
    .attr('y', d => laneY(d.y) - 5);
  container.selectAll<SVGGElement, MarbleDiagramLane>('.param-label-group')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('transform', function(d) {
      return `translate(${newX}, ${laneY(d.y) + PARAMY})`;
    });

  // update param-label with new label
  container.selectAll<SVGGElement, MarbleDiagramLane>('.param-label-group')
    .each(function(d) {
      const textElement = d3.select<SVGGElement, MarbleDiagramLane>(this)
        .select<SVGTextElement>('.param-label');

      if (!['limit', 'skip'].includes(d.operation)) {
        return;
      }

      visibleMarblesForCount = visibleMarbles.filter((n) =>
        n.operation === d.operation
      );

      const target = Number(String(d.parameter).match(/\d+/)?.[0]);
      const current = Math.min(
        visibleMarblesForCount.length,
        target
      );


      textElement.selectAll('tspan').remove();

      textElement.append('tspan')
        .attr('x', 0)
        .attr('dy', 0)
        .text(`${current}/${target}`);
    });

  const visibleMarbleKeys = new Set(visibleMarbles.map(n => n.marbleKey));
  const visibleLinks = Array.from(d3.group(
    allLinks.value.filter((l) =>
      l.visibleFromStep <= currentStep.value &&
      visibleMarbleKeys.has(l.source) &&
      visibleMarbleKeys.has(l.target)
    ),
    (d) => d.source + '-' + d.target
  ), ([_, group]) =>
    group.reduce((maxLink, current) => current.visibleFromStep > maxLink.visibleFromStep ? current : maxLink)
  );
  const marbles = nodeGroup.selectAll<SVGGElement, MarbleDiagramMarble>('.node')
    .data(visibleMarbles, (d) => d.playbackStep)
    .join(
      enter => {
        // Add a renderer group keyed by the marble's marble key.
        const g = enter.append('g')
          .attr('class', 'node')
          .attr('id', (d) => `node-${d.marbleKey}`)
          .style('opacity', 0)
        g.each(function(d) {
          const group = d3.select<SVGGElement, MarbleDiagramMarble>(this);
          group.selectAll('*').remove();
          if (d.eventKind === 'IN') {
            const size = MARBLE_RADIUS + 5;

            group.append('circle')
              .attr('r', size)
              .attr('stroke', EVENT_MARKER_COLOR)
              .attr('stroke-width', 2)
              .attr('fill', 'white');

            const crossSize = size * 0.7;
            group.append('line')
              .attr('x1', -crossSize)
              .attr('y1', -crossSize)
              .attr('x2', crossSize)
              .attr('y2', crossSize)
              .attr('stroke', EVENT_MARKER_COLOR)
              .attr('stroke-width', 2)
              .attr('stroke-linecap', 'round');

            group.append('line')
              .attr('x1', -crossSize)
              .attr('y1', crossSize)
              .attr('x2', crossSize)
              .attr('y2', -crossSize)
              .attr('stroke', EVENT_MARKER_COLOR)
              .attr('stroke-width', 2)
              .attr('stroke-linecap', 'round');
          } else {
            renderMarbleByType(group, d);
          }
        });
        g.attr('transform', function(d) { return marbleTransform(this, d); });

        return g;
      },
      update => update,
      exit => exit.transition()
        .duration(300)
        .style('opacity', 0)
        .remove()
    );
  marbles.transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('transform', function(d) { return marbleTransform(this, d); })
    .style('opacity', 1);
  // Links start below their source and end above their target, so they need the drawn box of each marble.
  const drawnBoxByMarbleKey = new Map<string, DOMRect>();
  marbles.each(function(d) { drawnBoxByMarbleKey.set(d.marbleKey, this.getBBox()); });

  const linksByMarbleKey = new Map(visibleMarbles.map(marble => [marble.marbleKey, marble]));
  const links = linkGroup.selectAll<SVGLineElement, MarbleDiagramLink>('line')
    .data(visibleLinks, (d) => d.source + '-' + d.target)
    .join(
      enter => {
        const g = enter.append('line')
          .attr('stroke', colors.mediumGray)
          .attr('stroke-width', 2)
          .attr('fill', 'none')
          .attr('marker-end', 'url(#arrow)')
          .style('opacity', 0)
          .attr('x1', (d) => {
            const src = linksByMarbleKey.get(d.source);
            return src ? columnX(src) : 0;
          })
          .attr('y1', (d) => {
            const src = linksByMarbleKey.get(d.source);
            return src ? laneY(src.y) : 0;
          })
          .attr('x2', (d) => { // Start the line collapsed at the source
            const src = linksByMarbleKey.get(d.source);
            return src ? columnX(src) : 0;
          })
          .attr('y2', (d) => { // Start the line collapsed at the source
            const src = linksByMarbleKey.get(d.source);
            return src ? laneY(src.y) : 0;
          });
        return g;
      },
      update => update,
      exit => exit
        .transition()
        .duration(300) // Use a slightly faster exit duration
        .style('opacity', 0)
        .remove()
    );

  links.transition()
    .duration(TRANSITION_DURATION_MS)
    .style('opacity', 1) // Fades in new links
    .attr('x1', (d) => {
      const src = linksByMarbleKey.get(d.source);
      return src ? columnX(src) : 0;
    })
    .attr('y1', (d) => {
      const src = linksByMarbleKey.get(d.source);
      if (!src) return 0;
      const box = drawnBoxByMarbleKey.get(src.marbleKey);
      return laneY(src.y) + (box ? box.y + box.height : MARBLE_RADIUS + 5);
    })
    .attr('x2', (d) => {
      // const src = linksByMarbleKey.get(d.source);
      const tgt = linksByMarbleKey.get(d.target);
      // return edgePoint(tgt, src).x;
      return tgt ? columnX(tgt) : 0;
    })
    .attr('y2', (d) => {
      // const src = linksByMarbleKey.get(d.source);
      const tgt = linksByMarbleKey.get(d.target);
      if (!tgt) return 0;
      return laneY(tgt.y) + (drawnBoxByMarbleKey.get(tgt.marbleKey)?.y ?? -MARBLE_RADIUS - 5);
    });
}

/**
 * Places the columns and lanes of the visible marbles. The backend gives all marbles of one stream element the same x
 * and all marbles of one operation the same y, but cannot know how large they are drawn. So each marble is drawn once,
 * invisibly, to measure it.
 * - Each column is as wide as its widest visible marble; columns are `COLUMN_GAP` apart.
 * - Each lane is as tall as its tallest visible marble, with room for the operation name above its line and the
 *   parameter label below it; lanes are `LANE_GAP` apart.
 * Columns and lanes keep the backend's order. When a step shows a larger marble, for example a list that grew, the
 * columns and lanes move apart with the step's transition.
 */
function layoutDiagram (measureParent: ContainerGroup, visibleMarbles: MarbleDiagramMarble[]) {
  const widths = new Map<number, number>();
  const tops = new Map<number, number>();
  const bottoms = new Map<number, number>();
  const measureGroup = measureParent.append('g').style('visibility', 'hidden');
  for (const marble of visibleMarbles) {
    let size = marbleSizes.get(marble.playbackStep);
    if (size === undefined) {
      size = { width: (MARBLE_RADIUS + 5) * 2, top: MARBLE_RADIUS + 5, bottom: MARBLE_RADIUS + 5 };
      if (marble.eventKind !== 'IN') {
        const group = measureGroup.append('g').datum(marble);
        renderMarbleByType(group, marble);
        const bbox = group.node()?.getBBox();
        if (bbox) size = { width: bbox.width, top: -bbox.y, bottom: bbox.y + bbox.height };
      }
      marbleSizes.set(marble.playbackStep, size);
    }
    widths.set(marble.x, Math.max(widths.get(marble.x) ?? 0, size.width));
    tops.set(marble.y, Math.max(tops.get(marble.y) ?? 0, size.top));
    bottoms.set(marble.y, Math.max(bottoms.get(marble.y) ?? 0, size.bottom));
  }
  measureGroup.remove();

  const xs = [...widths.keys()].sort((a, b) => a - b);
  const columnStarts = placeTracks(widths, xs.length > 0 ? xs[0] - widths.get(xs[0])! / 2 : 0, COLUMN_GAP);
  columns = new Map(xs.map(x => [x, { center: columnStarts.get(x)! + widths.get(x)! / 2, width: widths.get(x)! }]));

  // Lanes without visible marbles still need room for their line, name, and parameter label.
  const aboveLine = new Map<number, number>();
  const heights = new Map<number, number>();
  container?.selectAll<SVGGElement, MarbleDiagramLane>('.param-label-group').each(function(lane) {
    const label = this.getBBox();
    const above = Math.max(LANE_LABEL_SPACE, tops.get(lane.y) ?? MARBLE_RADIUS + 5);
    const below = Math.max(PARAMY + label.y + label.height, bottoms.get(lane.y) ?? MARBLE_RADIUS + 5);
    aboveLine.set(lane.y, above);
    heights.set(lane.y, above + below);
  });
  const ys = [...heights.keys()].sort((a, b) => a - b);
  const laneStarts = placeTracks(heights, ys.length > 0 ? ys[0] - aboveLine.get(ys[0])! : 0, LANE_GAP);
  lanes = new Map(ys.map(y => [y, laneStarts.get(y)! + aboveLine.get(y)!]));
}

/** The x of the center of the column that shows this marble. Links start and end there. */
function columnX (marble: MarbleDiagramMarble) {
  return columns.get(marble.x)?.center ?? marble.x;
}

/** The y of the line of the lane that shows marbles or lane labels with this backend y. */
function laneY (backendY: number) {
  return lanes.get(backendY) ?? backendY;
}

/** Moves a drawn marble so that the middle of what was drawn is at the center of its column, on its lane line. */
function marbleTransform (node: SVGGElement, marble: MarbleDiagramMarble) {
  const bbox = node.getBBox();
  const drawnCenter = bbox.width > 0 ? bbox.x + bbox.width / 2 : 0;
  return `translate(${columnX(marble) - drawnCenter},${laneY(marble.y)})`;
}

/**
 * The fields an object box shows: all fields of an object with at most three, otherwise its ID and name fields (if
 * any) filled up to three fields, followed by `...`.
 */
function shownFields (object: HeapObject): DisplayField[] {
  const fields = object.fields;
  if (fields.length <= 3) return fields;
  const idField = fields.find(f => ['id', 'Id', 'ID'].includes(f.name));
  const nameField = fields.find(f => ['name', 'Name', 'title', 'Title'].includes(f.name));
  const preferred: DisplayField[] = [idField, nameField].filter(f => f !== undefined);
  const others = fields.filter(f => f !== idField && f !== nameField).slice(0, 3 - preferred.length);
  return [...preferred, ...others, { name: '...', value: { kind: 'Ellipsis', value: '...' } }];
}

/** Draws a marble in the shape that matches its type, for example a circle for an int or a box for a String. */
function renderMarbleByType (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const direction = collectionDirection(marble);
  if (direction === 'vertical') {
    renderVerticalListMarble(group, marble);
  } else if (direction === 'horizontal') {
    renderArrayMarble(group, marble, 5);
  } else if (marble.type === 'java.lang.String') {
    renderStringMarble(group, marble);
  } else if (isCompactType(marble.type)) {
    renderSmallTypeMarble(group, marble);
  } else if (marble.type === 'void') {
    renderVoidMarble(group, marble);
  } else if (isOptionalType(marble.type) || marble.type === 'Text') {
    renderTextBoxMarble(group, marble);
  } else if (['List', 'Array', 'Set'].includes(marble.type ?? '')) {
    renderVerticalListMarble(group, marble);
  } else if (marble.type === 'Map') {
    renderMapMarble(group, marble);
  } else if (marble.type?.includes('[]')) {
    renderArrayMarble(group, marble, 5);
  } else {
    renderObjectMarble(group, marble);
  }
}

/**
 * Turns a plain value inside a list or map marble into a marble of its own type, so it is drawn like a stream element.
 * A value without a type (null) is drawn as text.
 */
function plainItemMarble (marble: MarbleDiagramMarble, item: MarbleDiagramItem): MarbleDiagramMarble {
  return { ...marble, type: item.type ?? 'Text', label: item.value ?? 'null', items: null, entries: null };
}

/** Find a processed heap item using a numeric reference or a serialized label. */
function findHeapItem (id: string | number | undefined) {
  return id === undefined ? undefined : heap.value?.find(item => item.id.toString() === String(id));
}

/** Preserve the renderer's primitive text and shortened reference labels. */
function displayValue (value: DisplayValue): string {
  if (value.kind === 'Ellipsis') return value.value;
  if (value.kind === 'PrimitiveVal') return value.primitiveValue;
  if (value.kind === 'NullVal') return '';
  const item = findHeapItem(value.reference);
  if (!item) return '';
  const text = (item.kind === 'HeapString' && item.string) || item.type.substring(item.type.lastIndexOf('.') + 1);
  return text.length > 10 ? text.substring(0, 10) + '...' : text;
}

function renderStringMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  group.append('rect')
    .attr('x', -HALFWIDTH)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', MARBLE_WIDTH)
    .attr('height', (MARBLE_RADIUS + 5) * 2)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color || colors.paleBlue);

  group.append('text')
    .text(() => {
      const str = marble.label;
      if (str.length > 15) {
        return `"${str.substring(0, 15)}..."`;
      } else {
        return `"${str}"`;
      }
    })
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '16px');
}

function renderSmallTypeMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const labelLength = marble.label.toString().length;
  group.append('circle')
    .attr('r', MARBLE_RADIUS + 5)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);
  group.append('text')
    .text(marble.label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', circleFontSize.get(labelLength) || '7px');
}

function renderObjectMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const labelKey = typeof marble.label === 'string' ? marble.label.replace(/\..*$/, '') : marble.label;
  const object = heap.value?.find(obj => obj.id.toString() === labelKey);
  const result = object?.kind === 'HeapObject' ? shownFields(object) : [];

  group.append('rect')
    .attr('x', -HALFWIDTH)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', MARBLE_WIDTH)
    .attr('height', (MARBLE_RADIUS) * 2)
    .attr('rx', 0)
    .attr('ry', 0)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);

  group.append('text')
    .text(marble.type)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle');

  for (let i = 0; i < result.length; i++) {
    const isEllipsis = result[i].name === '...';
    const height = isEllipsis ? MARBLE_RADIUS : (MARBLE_RADIUS + 5) + 10;
    group.append('rect')
      .attr('x', -HALFWIDTH)
      .attr('y', 10 * (i + 1) + i * (MARBLE_RADIUS + 5))
      .attr('width', (MARBLE_RADIUS) * 5)
      .attr('height', height)
      .attr('rx', 0)
      .attr('ry', 0)
      .attr('stroke', colors.darkGray)
      .attr('stroke-width', 1.5)
      .attr('fill', d3.color(marble.color)?.copy({opacity: 0.2})
        ?.toString() || marble.color);

    const fieldName = result[i].name;
    let fieldTextLength = fieldName.length;
    group.append('text')
      .text(fieldName)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', isEllipsis ? height * 7 : height * (i + 1))
      .attr('x', -HALFWIDTH / 2)
      .attr('font-size', stringFontSize.get(fieldTextLength) || '12px');

    group.append('rect')
      .attr('x', 0)
      .attr('y', 10 * (i + 1) + i * (MARBLE_RADIUS + 5))
      .attr('width', HALFWIDTH)
      .attr('height', height)
      .attr('rx', 0)
      .attr('ry', 0)
      .attr('stroke', colors.darkGray)
      .attr('stroke-width', 1.5)
      .attr('fill', d3.color(marble.color)?.copy({opacity: 0.2})
        ?.toString() || marble.color);

    group.append('text')
      .text(() => {
        const text = displayValue(result[i].value);
        if (text) fieldTextLength = text.length;
        return text;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', isEllipsis ? height * 7 : height * (i + 1))
      .attr('x', HALFWIDTH / 2)
      .attr('font-size', stringFontSize.get(fieldTextLength) || '12px');
  }
}

function renderVoidMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  group.append('ellipse')
    .attr('rx', HALFWIDTH / 2)
    .attr('ry', MARBLE_RADIUS + 5)
    .attr('stroke', '#000')
    .attr('stroke-width', 3)
    .attr('fill', '#FFF');

  group.append('text')
    .text(marble.label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '16px');
}

/**
 * Renders a value as text in a box. This is used for optionals, because empty optionals have no heap object to
 * inspect, and for `Text` marbles, such as `IntSummaryStatistics{count=4, ...}` from summarizingInt or `…` while
 * a collect result is not known yet. Long text is shortened; hovering shows the full text.
 */
function renderTextBoxMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const maxLength = 20;
  group.append('rect')
    .attr('x', -HALFWIDTH)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', MARBLE_WIDTH)
    .attr('height', (MARBLE_RADIUS + 5) * 2)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);

  group.append('text')
    .text(marble.label.length > maxLength ? `${marble.label.substring(0, maxLength)}…` : marble.label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', marble.label.length > 15 ? '12px' : '16px');
  // An SVG <title> child is shown by the browser as a tooltip for its parent group.
  group.append('title')
    .text(marble.label);
}


function renderMiniCircleNode (
  group: MarbleGroup,
  fontsize: string,
  label: string,
  circlewidth: number
) {
  group.append('circle')
    .attr('cx', circlewidth)
    .attr('r', MARBLE_RADIUS - 1)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', LIGHT_FILL_COLOR);
  group.append('text')
    .text(label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('x', circlewidth)
    .attr('font-size', fontsize);
}

/** Font size of the text in the small boxes and circles of a list or array marble. */
const MINI_FONT_SIZE = '9px';
/** Height of one field row in a small object box. */
const MINI_FIELD_HEIGHT = 18;

/** Measures how wide [text] is drawn in [fontSize] by drawing it invisibly in [group]. */
function textWidth (group: MarbleGroup, text: string, fontSize: string) {
  const tempText = group.append('text')
    .text(text)
    .attr('font-size', fontSize)
    .attr('visibility', 'hidden');
  const width = tempText.node()?.getBBox().width ?? 0;
  tempText.remove();
  return width;
}

/** Width of a small object box: its widest text, its class name or a field value, plus padding. */
function miniObjectWidth (group: MarbleGroup, element: ObjectElement) {
  const texts = [element.label, ...element.fields.map(field => displayValue(field.value))];
  return Math.max(...texts.map(text => textWidth(group, text, MINI_FONT_SIZE))) + LAYOUT_MARGIN;
}

/**
 * Draws a small object box for an object inside a list or array marble: its class name, then one row per shown
 * field value. Objects have sharp corners, so they differ from Strings, which have rounded ones. An object that is
 * not in the heap shows only its class name.
 */
function renderMiniObjectNode (group: MarbleGroup, element: ObjectElement, xPos: number, width: number) {
  const headerHeight = (MARBLE_RADIUS - 1) * 2;
  group.append('rect')
    .attr('x', xPos)
    .attr('y', -MARBLE_RADIUS)
    .attr('width', width)
    .attr('height', headerHeight)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', LIGHT_FILL_COLOR);
  group.append('text')
    .text(element.label)
    .attr('x', xPos + width / 2)
    .attr('y', -MARBLE_RADIUS + headerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', MINI_FONT_SIZE);

  element.fields.forEach((field, i) => {
    const y = -MARBLE_RADIUS + headerHeight + i * MINI_FIELD_HEIGHT;
    group.append('rect')
      .attr('x', xPos)
      .attr('y', y)
      .attr('width', width)
      .attr('height', MINI_FIELD_HEIGHT)
      .attr('stroke', colors.darkGray)
      .attr('stroke-width', 1.5)
      .attr('fill', LIGHT_FILL_COLOR);
    group.append('text')
      .text(displayValue(field.value))
      .attr('x', xPos + width / 2)
      .attr('y', y + MINI_FIELD_HEIGHT / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', MINI_FONT_SIZE);
  });
}

/**
 * Renders a List, Set, or Array marble as a box with its items below each other. An item that equals the element it
 * came from is drawn like that element's marble; any other item is drawn as a value of its own type, in the color of
 * its element if known (for example 16 from element 4 in `toMap(n -> n, n -> n * n)`).
 */
function renderVerticalListMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const items = marble.items ?? [];
  const length = items.length;
  const itemMarbles = items.map(item => {
    const origin = allMarbles.value.find((n) => n.marbleKey === item.marbleKey);
    if (origin && origin.label === item.value && origin.type === item.type) return { marble: origin, isElement: true };
    return { marble: { ...plainItemMarble(marble, item), color: origin?.color ?? marble.color }, isElement: false };
  });
  const subGroup = group.append('g');
  // Each item starts below the previous one, so items of different heights (such as arrays of objects) do not overlap.
  let itemY = LAYOUT_MARGIN;

  for (let i = 0; i < length; i++) {
    const childMarble = itemMarbles[i].marble;
    const elementGroup = subGroup.append('g')
      .attr('transform', `translate(0, ${itemY})`);
    const elementType = childMarble.type || 'Unknown';
    if (!itemMarbles[i].isElement) {
      renderMarbleByType(elementGroup, childMarble);
    } else if (elementType === 'java.lang.String') {
      renderStringMarble(elementGroup, childMarble);
    } else if (isCompactType(elementType)) {
      renderSmallTypeMarble(elementGroup, childMarble);
    } else if (childMarble.items) {
      // A list or array inside a list shows all of its elements in one row.
      renderArrayMarble(elementGroup, childMarble);
    }  else {
      renderObjectMarble(elementGroup, childMarble);
    }
    itemY += (elementGroup.node()?.getBBox().height ?? (MARBLE_RADIUS + 5) * 2) + LAYOUT_MARGIN;
  }

  // The box covers at least one marble width and grows to the left and right with wider items, such as long arrays.
  const bbox = subGroup.node()?.getBBox();
  const left = Math.min(bbox?.x ?? -HALFWIDTH, -HALFWIDTH) - LAYOUT_MARGIN;
  const right = Math.max(bbox ? bbox.x + bbox.width : HALFWIDTH, HALFWIDTH) + LAYOUT_MARGIN;
  const width = right - left;
  const height = bbox ? bbox.height + LAYOUT_MARGIN * 2 : (MARBLE_RADIUS + 5) * 2 * length + LAYOUT_MARGIN;

  group.insert('rect', ':first-child')
    .attr('id', 'list-node')
    .attr('x', left)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', width)
    .attr('height',  height)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);
}

/** An object inside a list or array marble: its class name and the fields to show (none if it is not in the heap). */
type ObjectElement = { kind: 'object', label: string, fields: DisplayField[] };

/**
 * How one element of a list or array marble is drawn: a small circle for a primitive, `null`, or `...`; a small box
 * with rounded corners for a String (quoted) or a nested list or array (its text); or a small object box.
 */
type ArrayElement =
  | { kind: 'circle', text: string }
  | { kind: 'box', text: string, quoted: boolean }
  | ObjectElement;

/**
 * Decides how an element of a list or array marble is drawn. The backend sends an object element as its simple class
 * name and unique ID, for example type `Person` and value `463`, and a nested list or array as its text, such as `[1, 2]`.
 */
function arrayElement (item: MarbleDiagramItem): ArrayElement {
  const text = item.value ?? 'null';
  // Elements without a type are null values or the `...` placeholder of a shortened array.
  if (item.type === null || isCompactType(item.type)) return { kind: 'circle', text };
  if (item.type === 'java.lang.String') return { kind: 'box', text, quoted: true };
  if (!/^\d+$/.test(text)) return { kind: 'box', text, quoted: false };
  const heapObject = findHeapItem(text);
  return { kind: 'object', label: item.type, fields: heapObject?.kind === 'HeapObject' ? shownFields(heapObject) : [] };
}

/** The text of a box element. Strings are quoted and shortened to [maxLength] characters; class names stay whole. */
function arrayBoxText (element: { text: string, quoted: boolean }, maxLength: number) {
  if (!element.quoted) return element.text;
  const text = element.text.length > maxLength ? `${element.text.substring(0, maxLength)}...` : element.text;
  return `"${text}"`;
}

/**
 * Renders a list or array that is drawn as one row, such as an `int[]` or `List` stream element, as a row of its
 * elements (see [arrayElement]) on a box that fits them. The row is centered, so links meet the middle of the marble.
 * With [maxElements], a longer array shows its first two elements, `...`, and its last two, and Strings are shortened;
 * this keeps marbles in a lane about as wide as other marbles. An array without items, such as an array inside a
 * collect result, is shown as its text.
 */
function renderArrayMarble (group: MarbleGroup, marble: MarbleDiagramMarble, maxElements = Infinity) {
  if (!marble.items) {
    renderTextBoxMarble(group, marble);
    return;
  }
  let items = marble.items;
  if (items.length > maxElements) {
    const ellipsis: MarbleDiagramItem = { kind: 'MarbleDiagramItem', marbleKey: null, type: null, value: '...' };
    items = [items[0], items[1], ellipsis, items[items.length - 2], items[items.length - 1]];
  }
  const elements = items.map(arrayElement);
  const maxTextLength = maxElements === Infinity ? Infinity : miniStringLength.get(elements.length) || 3;
  const gap = 4;

  // First measure every element, so the row can be centered before it is drawn.
  const widths = elements.map(element => {
    if (element.kind === 'circle') return MARBLE_RADIUS * 2;
    if (element.kind === 'object') return miniObjectWidth(group, element);
    return textWidth(group, arrayBoxText(element, maxTextLength), MINI_FONT_SIZE) + LAYOUT_MARGIN;
  });
  const rowWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (elements.length - 1);
  let x = -rowWidth / 2;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.kind === 'circle') {
      const fontsize = miniCircleFontSize.get(element.text.length) || '10px';
      renderMiniCircleNode(group, fontsize, element.text, x + MARBLE_RADIUS);
    } else if (element.kind === 'box') {
      group.append('rect')
        .attr('x', x)
        .attr('y', -MARBLE_RADIUS)
        .attr('width', widths[i])
        .attr('height', (MARBLE_RADIUS - 1) * 2)
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('stroke', colors.darkGray)
        .attr('stroke-width', 1.5)
        .attr('fill', LIGHT_FILL_COLOR);
      group.append('text')
        .text(arrayBoxText(element, maxTextLength))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('x', x + widths[i] / 2)
        .attr('font-size', MINI_FONT_SIZE);
    } else {
      renderMiniObjectNode(group, element, x, widths[i]);
    }
    x += widths[i] + gap;
  }

  const bbox = group.node()?.getBBox();
  const padding = 5;
  group.insert('rect', ':first-child')
    .attr('x', (bbox?.x ?? -rowWidth / 2) - padding)
    .attr('y', -MARBLE_RADIUS - padding)
    .attr('width', (bbox?.width ?? rowWidth) + padding * 2)
    .attr('height', (bbox ? bbox.y + bbox.height + MARBLE_RADIUS : MARBLE_RADIUS * 2) + padding * 2)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', colors.darkGray)
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);
}

/**
 * Renders a Map marble as one row per entry: the key in a box on the left and the value as a list on the right.
 * A single value arrives as a list with one item, so all rows look alike.
 */
function renderMapMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  const entries = marble.entries ?? [];
  const subGroup = group.append('g');

  let heightOffset = 0;
  let maxWidth = 0;

  for (const entry of entries) {
    const items = entry.items;

    const elementGroup = subGroup.append('g')
      .attr('transform', `translate(0, ${heightOffset})`);
    renderVerticalListMarble(elementGroup, { ...marble, label: '', items, entries: null });

    const bbox = subGroup.node()?.getBBox();
    if (bbox) {
      maxWidth = Math.max(maxWidth, bbox.width);
      heightOffset = bbox.height;
    }
    const elementBounds = elementGroup.node()?.getBBox();
    let elementHeight = elementBounds ? elementBounds.height : 0;
    // ToDo: set rect with key in front of elementGroup
    elementGroup.append('rect')
      .attr('height', elementHeight)
      .attr('width', MAPKEYBOXWIDTH)
      .attr('fill', marble.color)
      .attr('x', MAPKEYX)
      .attr('y', -MARBLE_RADIUS - 5)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('stroke', colors.darkGray)
      .attr('stroke-width', 1.5);
    elementGroup.append('text')
      .text(entry.key)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('x', MAPKEYX + MAPKEYBOXWIDTH / 2)
      .attr('y', elementHeight / 2 - MARBLE_RADIUS - 5)
      .attr('font-size', '16px');
  }
  subGroup.selectAll('#list-node')
    .attr('width', maxWidth);
}

function stepForward () {
  if (currentStep.value < allMarbles.value.reduce((max, n) => Math.max(max, n.playbackStep), 0)) {
    currentStep.value++;
  }
}

function stepBackward () {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function playToStep () {
  if (isPlaying.value) {
    return;
  }
  currentStep.value = 0;
  render();
  startPlayback();
}

function resumePlayback () {
  if (isPlaying.value) {
    return;
  }
  startPlayback();
}

function startPlayback () {
  isPlaying.value = true;
  intervalId = setInterval(() => {
    if (isPlaying.value && currentStep.value < allMarbles.value.reduce((max, n) => Math.max(max, n.playbackStep), 0)) {
      currentStep.value++;
    } else {
      pausePlayback()
    }
  }, animationSpeed);
}

function stopAndResetPlayback () {
  currentStep.value = 0;
  pausePlayback();
}

function pausePlayback () {
  isPlaying.value = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function zoomed (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
  container?.attr('transform', event.transform.toString());
}

function zoomAndCenter () {
  if (!svg || !container) return;

  const svgElement = svg.node();
  if (!svgElement) return;
  const { width: svgWidth, height: svgHeight } = svgElement.getBoundingClientRect();

  const bounds = container.node()?.getBBox() as DOMRect;
  const fullWidth = bounds.width || 0;
  const fullHeight = bounds.height || 0;

  const midX = bounds.x + fullWidth / 2;
  const midY = bounds.y + fullHeight / 2;

  if (fullWidth === 0 || fullHeight === 0) return;

  const scale = Math.min(svgWidth / fullWidth, svgHeight / fullHeight) * 0.8;

  const translateX = svgWidth / 2 - scale * midX;
  const translateY = svgHeight / 2 - scale * midY;

  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(scale);

  svg.call(zoom.transform, transform);
}

watch(streamVisualizationData, (newVal, oldVal) => {
  pausePlayback();
  if ((newVal?.marbles.length ?? 0) > 0 && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
    currentStep.value = 0;
    nextTick(() => {
      const svgElement = document.querySelector<SVGSVGElement>('#stream-viz-svg');
      if (!svgElement) return;
      svg = d3.select<SVGSVGElement, unknown>(svgElement);
      svg.selectAll('*').remove();

      svg.append('rect')
        .attr('class', 'zoom-bg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'transparent')
        .style('pointer-events', 'all');

      container = svg.append('g').attr('class', 'container');

      svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 10)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', colors.mediumGray);

      container.selectAll<SVGLineElement, MarbleDiagramLane>('.opline')
        .data(Object.values({ ...operationLanes.value }))
        .join('line')
        .attr('class', 'opline')
        .attr('x1', 0)
        .attr('y1', (d) => d.y)
        .attr('x2', 10 + 210)
        .attr('y2', (d) => d.y)
        .attr('stroke', colors.mediumGray)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '8 4');

      container.selectAll<SVGTextElement, MarbleDiagramLane>('.oplabel')
        .data(Object.values({ ...operationLanes.value }))
        .join('text')
        .attr('class', 'oplabel')
        .attr('x', PARAMSTARTX)
        .attr('y', (d) => d.y - 5)
        .attr('text-anchor', 'end')
        .text((d) => d.operation)
        .attr('fill', colors.darkGray)
        .attr('font-size', '24px');

      const paramLabelGroups = container.selectAll<SVGGElement, MarbleDiagramLane>('.param-label-group')
        .data(Object.values({ ...operationLanes.value }))
        .join(
          enter => {
            const g = enter.append('g')
              .attr('class', 'param-label-group')
              .attr('transform', (d) => `translate(${10 + 150}, ${d.y + 25})`);

            // Füge ein leeres Text-Element hinzu, um die tspan-Elemente aufzunehmen
            g.append('text')
              .attr('class', 'param-label')
              .attr('text-anchor', 'start')
              .attr('fill', colors.darkGray) // Content text: the smaller monospace font already sets it apart from the operation name
              .attr('font-size', '16px')
              .style('font-family', 'Monospace, Courier New, monospace')
              .attr('xml:space', 'preserve')
              .style('pointer-events', 'none'); // Text selbst ignoriert Events

            return g;
          },
          update => {
            update.attr('transform', (d) => `translate(${10 + 10}, ${d.y + 25})`);
            return update;
          },
          exit => exit.remove()
        );


      paramLabelGroups.each(function(d) {
        const group = d3.select<SVGGElement, MarbleDiagramLane>(this);
        const textElement = group.select<SVGTextElement>('.param-label');
        textElement.selectAll('tspan').remove();

        //const lines = d.parameter.replace(/\\n/g, '\n').split('\n');

        visibleMarblesForCount = [];

        const lines = (
          ['limit', 'skip'].includes(d.operation)
            ? `${Math.min(
              visibleMarblesForCount.length,
              Number(String(d.parameter).match(/\d+/)?.[0])
            )}/${Number(String(d.parameter).match(/\d+/)?.[0])}`
            : d.parameter ?? ''
        ).replace(/\\n/g, '\n').split('\n');

        lines.forEach((line: string, i: number) => {
          textElement.append('tspan')
            .attr('x', 0)
            .attr('dy', i === 0 ? 0 : '1.2em')
            .text(line);
        });

        const bbox = textElement.node()?.getBBox();

        if (bbox && bbox.width > 0 && bbox.height > 0) {
          group.select('.param-bg-rect').remove(); // Altes Rechteck entfernen, falls vorhanden

          group.insert('rect', '.param-label') // F├╝gt das Rechteck VOR dem Text ein
            .attr('class', 'param-bg-rect')
            .attr('x', bbox.x - 5) // Etwas Polsterung links
            .attr('y', bbox.y - 3) // Etwas Polsterung oben
            .attr('width', bbox.width + 10) // Polsterung links+rechts
            .attr('height', bbox.height + 6) // Polsterung oben+unten
            .attr('rx', 4) // Abgerundete Ecken
            .attr('ry', 4)
            .attr('fill', LIGHT_FILL_COLOR) // Hellgrau
            .attr('opacity', 0.8) // Leicht transparent
            .style('pointer-events', 'none'); // Ignoriert Mausereignisse
        } else {
          // Falls bbox leer ist (z.B. d.parameter ist leer), das Rechteck entfernen
          group.select('.param-bg-rect').remove();
        }
      });

      linkGroup = container.append('g').attr('class', 'links');
      nodeGroup = container.append('g').attr('class', 'nodes');
      marbleSizes = new Map();

      svg.call(zoom);
      render();
      zoomAndCenter();
    });
  }
}, { immediate: true });

watch(currentStep, () => {
  render();
});

watch(editMode, (val) => {
  if (val) {
    inputStep.value = currentStep.value;
  }
  nextTick(() => {
    stepInput.value?.focus();
    stepInput.value?.select();
  })
});

onUnmounted(() => {
  pausePlayback();
})
</script>

<style>
#stream-viz-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

#stream-viz {
  width: 100%;
  height: 100%;
}

/* Start the hint to the right of the navigation icons, which overlay the pane's top-left corner. */
.stream-viz-hint {
  padding-left: v-bind('NAVIGATION_CONTENT_INSET + "px"');
}

.node circle {
  stroke-width: 1.5px;
  padding: 5px;
}
text {
  user-select: none;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  box-sizing: border-box;
  /* Top padding instead of a top margin: the margin would collapse through #stream-viz
     and push the whole wrapper, including the navigation bar, down from the pane's top.
     The left padding is the 33px-wide navigation bar plus the same 12px gap as at the top. */
  padding: 12px 25px 0 45px;
  width: 100%;
}

.stepControls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

button {
  user-select: none;
}

.myButton {
  font-size: 1.5rem;
  font-weight: bold;
  border-radius: 15px;
  border: 2px solid black;
  background-color: var(--jw-light-gray);
  padding: 5px 15px 5px 15px;
  cursor: pointer;
}

.myButton:hover {
  background-color: var(--jw-light-medium-gray);
  box-shadow: 0px 0px 15px var(--jw-light-medium-gray);
}

.playControls {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  flex: 1 1 0;
  min-width: min-content;
  margin-left: auto;
}

.playControls button {
  font-size: 1.2rem;
  padding: 5px 13px 5px 12px;
  border-radius: 15px;
  border: 2px solid black;
  background-color: var(--jw-light-gray);
  cursor: pointer;
  white-space: normal;
}

.playButton {
  color: green;
}

.playButton:hover {
  background-color: lightgreen;
  color: black;
}

.stopButton {
  color: red;
}

.stopButton:hover {
  background-color: lightcoral;
  color: black;
}

.inputField {
  width: 3.5rem;
  font-size: 1.2rem;
  text-align: center;
  border: 2px solid var(--jw-medium-gray);
  border-radius: 5px;
  padding: 5px 0px;
}

.inputField:focus {
  outline: none;
  border-color: var(--jw-action-blue);
  box-shadow: 0 0 5px var(--jw-action-blue);
}

</style>

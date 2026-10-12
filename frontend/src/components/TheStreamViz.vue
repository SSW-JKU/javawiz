<template>
  <div v-if="streamVisualizationData" id="stream-viz-wrapper">
    <NavigationBarWithSettings
      :zoom-reset="zoomAndCenter"
      :viz-id="STREAMVIZ_ID" />
    <div v-if="streamVisualizationData.marbles.length > 0" id="stream-viz">
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
    <div v-else>
      <div>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Execute some stream operations to enable this view.
      </div>
    </div>
  </div>
</template>

<script setup lang = 'ts'>
import {computed, defineComponent, nextTick, onUnmounted, ref, watch} from 'vue'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { useVisualizationStore } from '@/store/VisualizationStore'
import {useGeneralStore} from '@/store/GeneralStore'
import {latestTopLevelStream} from '@/debugger/streamVisualization'
import * as d3 from 'd3'
import type {HeapItem, Val, MarbleDiagramMarble, MarbleDiagramLink, MarbleDiagramLane} from '@/dto/TraceState';

defineComponent({
  name: 'TheStreamViz',
  components: { NavigationBarWithSettings }
})
const generalStore = useGeneralStore()
const visualizationStore = useVisualizationStore()
const STREAMVIZ_ID = visualizationStore.STREAMVIZ.id
const streamVisualizationData = computed(() => latestTopLevelStream(generalStore.currentTraceData?.streamVisualizationData.streams ?? []))
const allMarbles = computed(() => streamVisualizationData.value?.marbles ?? [])
const allLinks = computed(() => streamVisualizationData.value?.links ?? [])
const operationLanes = computed(() => streamVisualizationData.value?.operationLanes ?? {})
const heap = computed(() => generalStore.currentTraceData?.processedTraceState?.heapBeforeExecution)
const MARBLE_RADIUS = 15;
const HALFWIDTH = 75;
const MARBLE_WIDTH = 150;
const LAYOUT_MARGIN = 10;
const MAPKEYX = -145;
const MAPKEYBOXWIDTH = 60;
const PARAMX = 200;
const PARAMSTARTX = 175;
const PARAMY = 25;
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

// Keep parsed map labels outside the backend payload; entries expire with their marbles.
const mapEntries = new WeakMap<MarbleDiagramMarble, { keys: string[]; values: string[] }>();
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
  return ['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'Average'].includes(type ?? '');
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
  const usesCompactMarbleRendering = visibleMarbles.length > 0 && !visibleMarbles.some(marble => !isCompactType(marble.type));
  var lastVisibleMarble = visibleMarbles[visibleMarbles.length - 1];
  var newX = lastVisibleMarble ? lastVisibleMarble.x + PARAMX : PARAMSTARTX;
  if (usesCompactMarbleRendering) {
    newX -= HALFWIDTH;
  }
  container.selectAll<SVGLineElement, MarbleDiagramLane>('.opline')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('x2', newX + LAYOUT_MARGIN);
  container.selectAll<SVGTextElement, MarbleDiagramLane>('.oplabel')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('x', newX);
  container.selectAll<SVGGElement, MarbleDiagramLane>('.param-label-group')
    .transition()
    .duration(TRANSITION_DURATION_MS)
    .attr('transform', function(d) {
      return `translate(${newX}, ${d.y + PARAMY})`;
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
          .attr('transform', d => `translate(${d.x},${d.y})`)
          .style('opacity', 0)
        g.each(function(d) {
          const group = d3.select<SVGGElement, MarbleDiagramMarble>(this);
          group.selectAll('*').remove();
          if (d.eventKind === 'IN') {
            const size = MARBLE_RADIUS + 5;

            group.append('circle')
              .attr('r', size)
              .attr('stroke', '#303030')
              .attr('stroke-width', 2)
              .attr('fill', 'white');

            const crossSize = size * 0.7;
            group.append('line')
              .attr('x1', -crossSize)
              .attr('y1', -crossSize)
              .attr('x2', crossSize)
              .attr('y2', crossSize)
              .attr('stroke', '#303030')
              .attr('stroke-width', 2)
              .attr('stroke-linecap', 'round');

            group.append('line')
              .attr('x1', -crossSize)
              .attr('y1', crossSize)
              .attr('x2', crossSize)
              .attr('y2', -crossSize)
              .attr('stroke', '#303030')
              .attr('stroke-width', 2)
              .attr('stroke-linecap', 'round');
          } else {
            if (d.type === 'java.lang.String') {
              renderStringMarble(group, d);
            } else if (isCompactType(d.type)) {
              renderSmallTypeMarble(group, d);
            } else if (d.type === 'void') {
              renderVoidMarble(group, d);
            } else if (isOptionalType(d.type)) {
              renderOptionalMarble(group, d);
            } else if (['List', 'Array', 'Set'].includes(d.type ?? '')) {
              renderVerticalListMarble(group, d);
            } else if (d.type === 'Map') {
              renderMapMarble(group, d);
            } else if (d.type?.includes('[]')) {
              renderHorizontalListMarble(group, d);
            } else {
              renderObjectMarble(group, d);
            }
          }
        });

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
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('opacity', 1);

  const linksByMarbleKey = new Map(visibleMarbles.map(marble => [marble.marbleKey, marble]));
  const links = linkGroup.selectAll<SVGLineElement, MarbleDiagramLink>('line')
    .data(visibleLinks, (d) => d.source + '-' + d.target)
    .join(
      enter => {
        const g = enter.append('line')
          .attr('stroke', '#999')
          .attr('stroke-width', 2)
          .attr('fill', 'none')
          .attr('marker-end', 'url(#arrow)')
          .style('opacity', 0)
          .attr('x1', (d) => {
            const src = linksByMarbleKey.get(d.source);
            return src ? src.x : 0;
          })
          .attr('y1', (d) => {
            const src = linksByMarbleKey.get(d.source);
            return src ? src.y : 0;
          })
          .attr('x2', (d) => { // Start the line collapsed at the source
            const src = linksByMarbleKey.get(d.source);
            return src ? src.x : 0;
          })
          .attr('y2', (d) => { // Start the line collapsed at the source
            const src = linksByMarbleKey.get(d.source);
            return src ? src.y : 0;
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
      return src ? src.x : 0;
    })
    .attr('y1', (d) => {
      const src = linksByMarbleKey.get(d.source);
      if (!src) return 0;
      if (src.type === 'java.lang.String' || isCompactType(src.type) || src.type?.includes('[]')) {
        const type = src.operation.endsWith('[]') ?
          src.type?.substring(0, src.type.length - 2) :
          src.type;
        if (!isCompactType(type) && type !== 'java.lang.String') {
          const safeId = CSS.escape(`node-${src.marbleKey}`);
          const node = d3.select<SVGGElement, MarbleDiagramMarble>(`#${safeId}`);
          const bbox = node.node()?.getBBox();
          const height = bbox ? bbox.height : 0;
          return src.y + height - 20;
        }
        return src.y + 20;
      } else if (['List', 'Array', 'Set'].includes(src.type ?? '')) {
        return src.y + 30;
      }
      const object = findHeapItem(src.label);
      const objectFieldCount = object?.kind === 'HeapObject' ? object.fields.length : 0;
      const fieldOffset = (objectFieldCount > 3 ? 3.5 : objectFieldCount);
      return src.y + fieldOffset * 30 + 10;
    })
    .attr('x2', (d) => {
      // const src = linksByMarbleKey.get(d.source);
      const tgt = linksByMarbleKey.get(d.target);
      // return edgePoint(tgt, src).x;
      return tgt ? tgt.x : 0;
    })
    .attr('y2', (d) => {
      // const src = linksByMarbleKey.get(d.source);
      const tgt = linksByMarbleKey.get(d.target);
      // return edgePoint(tgt, src).y;
      return tgt ? tgt.y - 20 : 0;
    });
}

/** Find a processed heap item using a numeric reference or a serialized label. */
function findHeapItem (id: string | number | undefined) {
  return id === undefined ? undefined : heap.value?.find(item => item.id.toString() === String(id));
}

/** Only reference values identify heap items; primitives and ellipses do not. */
function referenceId (value: DisplayValue | undefined) {
  return value?.kind === 'ReferenceVal' ? value.reference : undefined;
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
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color || '#cceeff');

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
    .attr('stroke', '#333')
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
  var fields = object?.kind === 'HeapObject' ? object.fields : [];
  var result: DisplayField[] = fields;
  if (fields.length > 3) {
    // search for field with name "name", "Name", "title" or "Title"
    const idField = fields.find(f => ['id', 'Id', 'ID'].includes(f.name));
    const nameField = fields.find(f => ['name', 'Name', 'title', 'Title'].includes(f.name));

    result = [idField, nameField].filter(f => f !== undefined);
    fields = fields.filter(f => f !== idField && f !== nameField);
    fields = fields.slice(0, 3 - result.length);
    result = result.concat(fields);
    result.push({name: '...', value: {kind: 'Ellipsis', value: '...'}});
  }

  group.append('rect')
    .attr('x', -HALFWIDTH)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', MARBLE_WIDTH)
    .attr('height', (MARBLE_RADIUS) * 2)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('stroke', '#333')
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
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('stroke', '#333')
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
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('stroke', '#333')
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

/** Renders an optional result directly because empty optionals have no heap object to inspect. */
function renderOptionalMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  group.append('rect')
    .attr('x', -HALFWIDTH)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', MARBLE_WIDTH)
    .attr('height', (MARBLE_RADIUS + 5) * 2)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);

  group.append('text')
    .text(marble.label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', marble.label.length > 15 ? '12px' : '16px');
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
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', '#f0f0f0');
  group.append('text')
    .text(label)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('x', circlewidth)
    .attr('font-size', fontsize);
}

function renderMiniObjectNode (
  group: MarbleGroup,
  heapElement: HeapItem,
  marble: MarbleDiagramMarble,
  rectWidth: number,
  xPos: number
) {
  let fields = heapElement.kind === 'HeapObject' ? heapElement.fields : [];
  let result: DisplayField[] = fields;

  if (fields.length > 3) {
    const idField = fields.find(f => ['id', 'Id', 'ID'].includes(f.name));
    const nameField = fields.find(f => ['name', 'Name', 'title', 'Title'].includes(f.name));

    result = [idField, nameField].filter(f => f !== undefined);
    fields = fields.filter(f => f !== idField && f !== nameField);
    fields = fields.slice(0, 3 - result.length);
    result = result.concat(fields);
    result.push({ name: '...', value: { kind: 'Ellipsis', value: '...' }});
  }

  group.append('rect')
    .attr('x', xPos)
    .attr('y', -MARBLE_RADIUS)
    .attr('width', rectWidth)
    .attr('height', MARBLE_RADIUS * 2 - 5)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', '#d0d0d0');

  group.append('text')
    .text(marble.type!.substring(0, marble.type!.length - 2))
    .attr('x', xPos + rectWidth / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', '12px');

  for (let i = 0; i < result.length; i++) {
    const field = result[i];
    const isEllipsis = field.name === '...';
    const height = isEllipsis ? MARBLE_RADIUS : (MARBLE_RADIUS + 5) + 10;

    group.append('rect')
      .attr('x', xPos)
      .attr('y', 10 * (i + 1) + i * (MARBLE_RADIUS + 5))
      .attr('width', rectWidth)
      .attr('height', height)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .attr('fill', '#f9f9f9');

    group.append('text')
      .text(() => {
        return displayValue(field.value);
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', isEllipsis ? height * 7 : height * (i + 1))
      .attr('x', xPos + rectWidth / 2)
      .attr('font-size', '12px');
  }
}

function renderVerticalListMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  let labelAsList = marble.label.split(',');
  let length = labelAsList.length;
  let firstMarble = allMarbles.value?.find((n) => n.marbleKey.toString() === labelAsList[0]);
  let typeOfElements = firstMarble?.type || 'Unknown';
  if (typeOfElements.endsWith('[]')) {
    typeOfElements = typeOfElements.substring(0, typeOfElements.length - 2);
  }
  let elementHeight = (MARBLE_RADIUS + 5) * 2 + LAYOUT_MARGIN;
  if (!isCompactType(typeOfElements) && typeOfElements !== 'java.lang.String') {
    let element = findHeapItem(firstMarble?.label);
    if (element?.kind === 'HeapArray') {
      element = findHeapItem(referenceId(element.elements[0]?.value));
    }
    if (element?.kind === 'HeapObject') {
      const fieldsLength = element.fields.length;
      elementHeight = Math.min(fieldsLength, 3) * (MARBLE_RADIUS + 5) * 2 + LAYOUT_MARGIN * 2;
    }
  }

  const subGroup = group.append('g');

  for (let i = 0; i < length; i++) {
    const childMarble = allMarbles.value!.find((n) => n.marbleKey.toString() === labelAsList[i].trim());
    if (!childMarble) continue;
    const elementGroup = subGroup.append('g')
      .attr('transform', `translate(0, ${LAYOUT_MARGIN + i * elementHeight})`);
    const elementType = childMarble!.type || 'Unknown';
    if (elementType === 'java.lang.String') {
      renderStringMarble(elementGroup, childMarble);
    } else if (isCompactType(elementType)) {
      renderSmallTypeMarble(elementGroup, childMarble);
    } else if (elementType.includes('[]')) {
      renderHorizontalListTerminalNode(elementGroup, childMarble);
    }  else {
      renderObjectMarble(elementGroup, childMarble);
    }
  }

  const bbox = subGroup.node()?.getBBox();
  let width = MARBLE_WIDTH + LAYOUT_MARGIN * 2, height = elementHeight * length + LAYOUT_MARGIN;
  if (bbox) {
    width = Math.max(bbox.width + LAYOUT_MARGIN * 2, MARBLE_WIDTH + LAYOUT_MARGIN * 2);
    height = bbox.height + LAYOUT_MARGIN * 2;
  }

  group.insert('rect', ':first-child')
    .attr('id', 'list-node')
    .attr('x', -HALFWIDTH - LAYOUT_MARGIN)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', width)
    .attr('height',  height)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);
}

function renderHorizontalListMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  let labelAsList = marble.label.split(',');
  const arrayElement = findHeapItem(labelAsList[0]);
  if (arrayElement?.kind !== 'HeapArray') return;
  let elements: { value: DisplayValue }[] = arrayElement.elements;
  let length = elements.length;
  if (length > 5) {
    length = 5;
    elements = [
      arrayElement.elements[0],
      arrayElement.elements[1],
      { value: { kind: 'Ellipsis', value: '...' } },
      arrayElement.elements[arrayElement.elements.length - 2],
      arrayElement.elements[arrayElement.elements.length - 1]
    ];
  }
  let height = (MARBLE_RADIUS + 5) * 2;
  let width = MARBLE_WIDTH;
  const type = arrayElement.type.endsWith('[]') ?
    arrayElement.type.substring(0, arrayElement.type.length - 2) :
    arrayElement.type;
  if (!isCompactType(type) && type !== 'java.lang.String') {
    // find or null
    const firstHeapObject = findHeapItem(referenceId(elements[0]?.value));
    if (firstHeapObject?.kind === 'HeapObject') {
      const fieldsLength = firstHeapObject.fields.length;
      height = Math.min(fieldsLength, 3) * (MARBLE_RADIUS + 5) * 2 + LAYOUT_MARGIN * 2;
    }
    width = MARBLE_WIDTH * 2 - LAYOUT_MARGIN;
  }

  group.append('rect')
    .attr('x', -HALFWIDTH - 2)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', width + 4)
    .attr('height', height)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);

  for (let i = 0; i < length; i++) {
    let heapElement = findHeapItem(referenceId(elements[i].value));
    if (!heapElement) {
      let circlewidth = -HALFWIDTH + i * (width / length) + (width / length) / 2;
      let fontsize = miniCircleFontSize.get(displayValue(elements[i].value).length) || '10px';
      let label = displayValue(elements[i].value);
      renderMiniCircleNode(group, fontsize, label, circlewidth);
    } else {
      if (heapElement.kind === 'HeapString') {
        group.append('rect')
          .attr('x', -HALFWIDTH + i * (MARBLE_WIDTH / length) + (MARBLE_WIDTH / length) / 2 - HALFWIDTH / length)
          .attr('y', -MARBLE_RADIUS)
          .attr('width', MARBLE_WIDTH/length)
          .attr('height', (MARBLE_RADIUS - 1) * 2)
          .attr('rx', 5)
          .attr('ry', 5)
          .attr('stroke', '#333')
          .attr('stroke-width', 1.5)
          .attr('fill', '#f0f0f0');
        group.append('text')
          .text(() => {
            const str = heapElement.string;
            let maxLength = miniStringLength.get(length) || 3;
            if (str.length > maxLength) {
              return `"${str.substring(0, maxLength)}..."`;
            } else {
              return `"${str}"`;
            }
          })
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('x', -HALFWIDTH + i * (MARBLE_WIDTH / length) + (MARBLE_WIDTH / length) / 2)
          .attr('font-size', '9px');
      } else {
        const rectWidth = HALFWIDTH - LAYOUT_MARGIN * 2;
        const minGap = 2;
        const gap = (width - 2 * minGap - length * rectWidth) / (length + 1);
        const xPos = -HALFWIDTH + minGap + gap + i * (rectWidth + gap);
        renderMiniObjectNode(group, heapElement, marble, rectWidth, xPos);
      }
    }
  }
}

function renderHorizontalListTerminalNode (group: MarbleGroup, marble: MarbleDiagramMarble) {
  let labelAsList = marble.label.split(',');
  const arrayElement = findHeapItem(labelAsList[0]);
  if (arrayElement?.kind !== 'HeapArray') return;
  let elements: { value: DisplayValue }[] = arrayElement.elements;
  let length = elements.length;
  let stringlength = 0;

  for (let i = 0; i < length; i++) {
    let heapElement = findHeapItem(referenceId(elements[i].value));
    if (!heapElement) {
      const cx = -HALFWIDTH + (i + 1) * MARBLE_RADIUS * 2 - MARBLE_RADIUS;
      let fontsize = miniCircleFontSize.get(displayValue(elements[i].value).length) || '10px';
      let label = displayValue(elements[i].value);
      renderMiniCircleNode(group, fontsize, label, cx);
    } else {
      if (heapElement.kind === 'HeapString') {
        const label = heapElement.string;
        const textValue = '"' + label + '"';

        const tempText = group.append('text')
          .text(textValue)
          .attr('font-size', '9px')
          .attr('visibility', 'hidden');

        const textWidth = tempText.node()?.getBBox().width || 0;

        const x = -HALFWIDTH + stringlength + LAYOUT_MARGIN / 2;
        const rectWidth = textWidth + LAYOUT_MARGIN;

        group.append('rect')
          .attr('x', x)
          .attr('y', -MARBLE_RADIUS)
          .attr('width', rectWidth)
          .attr('height', (MARBLE_RADIUS - 1) * 2)
          .attr('rx', 5)
          .attr('ry', 5)
          .attr('stroke', '#333')
          .attr('stroke-width', 1.5)
          .attr('fill', '#f0f0f0');

        group.append('text')
          .text(textValue)
          .attr('text-anchor', 'left')
          .attr('dominant-baseline', 'middle')
          .attr('x', x + LAYOUT_MARGIN / 2)
          .attr('font-size', '9px');

        tempText.remove();
        stringlength += rectWidth;
      } else {
        const rectWidth = HALFWIDTH - LAYOUT_MARGIN * 2;
        const xPos = -HALFWIDTH + rectWidth * i + LAYOUT_MARGIN/2;
        renderMiniObjectNode(group, heapElement, marble, rectWidth, xPos);
      }
    }
  }

  const bbox = group.node()?.getBBox();
  const width = bbox ? Math.max(bbox.width + LAYOUT_MARGIN * 1.5, MARBLE_WIDTH) : MARBLE_WIDTH;
  const height = bbox ? bbox.height + LAYOUT_MARGIN : (MARBLE_RADIUS + 5) * 2;

  group.insert('rect', ':first-child')
    .attr('x', -HALFWIDTH - 2)
    .attr('y', -MARBLE_RADIUS - 5)
    .attr('width', width)
    .attr('height', height)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('stroke', '#333')
    .attr('stroke-width', 1.5)
    .attr('fill', marble.color);

}

function renderMapMarble (group: MarbleGroup, marble: MarbleDiagramMarble) {
  let length = 0;
  let keys: string[] = [];
  let values: string[] = [];
  const cached = mapEntries.get(marble);
  if (cached) {
    keys = cached.keys;
    values = cached.values;
    length = keys.length;
  }
  if (length === 0) {
    let referencePairs = marble.label.substring(2, marble.label.length - 2).split('), (');
    length = referencePairs.length;
    let isList = referencePairs[0].includes('[') && referencePairs[0].includes(']');
    for (let i = 0; i < length; i++) {
      let pair = referencePairs[i];
      if (isList) {
        pair = pair.replace('[', '').replace(']', '');
      }
      const idx = pair.indexOf(', ');
      if (idx >= 0) {
        keys.push(pair.substring(0, idx));
        values.push(pair.substring(idx + 2));
      } else {
        keys.push(pair);
        values.push('');
      }
    }
  }

  const subGroup = group.append('g');

  let heightOffset = 0;
  let maxWidth = 0;

  for (let i = 0; i < length; i++) {
    let valueParts = values[i].split(',');
    const label = valueParts.map((v: string) => {
      let foundMarble = allMarbles.value.find((n) => n.label.toString() === v.trim());
      return foundMarble ? foundMarble.marbleKey.toString() : '';
    }).join(', ');

    const elementGroup = subGroup.append('g')
      .attr('transform', `translate(0, ${heightOffset})`);
    renderVerticalListMarble(elementGroup, { ...marble, label });

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
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5);
    elementGroup.append('text')
      .text(keys[i])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('x', MAPKEYX + MAPKEYBOXWIDTH / 2)
      .attr('y', elementHeight / 2 - MARBLE_RADIUS - 5)
      .attr('font-size', '16px');
  }
  subGroup.selectAll('#list-node')
    .attr('width', maxWidth);
  mapEntries.set(marble, { keys, values });
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
        .attr('fill', '#999');

      container.selectAll<SVGLineElement, MarbleDiagramLane>('.opline')
        .data(Object.values({ ...operationLanes.value }))
        .join('line')
        .attr('class', 'opline')
        .attr('x1', 0)
        .attr('y1', (d) => d.y)
        .attr('x2', 10 + 210)
        .attr('y2', (d) => d.y)
        .attr('stroke', '#999')
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
        .attr('fill', '#555')
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
              .attr('fill', '#666') // Etwas dunkler als #888, aber heller als der Op-Name
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
            .attr('fill', '#f0f0f0') // Hellgrau
            .attr('opacity', 0.8) // Leicht transparent
            .style('pointer-events', 'none'); // Ignoriert Mausereignisse
        } else {
          // Falls bbox leer ist (z.B. d.parameter ist leer), das Rechteck entfernen
          group.select('.param-bg-rect').remove();
        }
      });

      linkGroup = container.append('g').attr('class', 'links');
      nodeGroup = container.append('g').attr('class', 'nodes');

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

.node circle {
  stroke-width: 1.5px;
  padding: 5px;
}
text {
  user-select: none;
}
.controls {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  box-sizing: border-box;
  padding: 0 25px 0 35px;
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
  background-color: #efefef;
  padding: 5px 15px 5px 15px;
  cursor: pointer;
}

.myButton:hover {
  background-color: grey;
  box-shadow: 0px 0px 15px grey;
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
  background-color: #efefef;
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
  border: 2px solid grey;
  border-radius: 5px;
  padding: 5px 0px;
}

.inputField:focus {
  outline: none;
  border-color: grey;
  box-shadow: 0 0 5px grey;
}

</style>

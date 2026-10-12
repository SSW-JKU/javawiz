import { createPinia, setActivePinia } from 'pinia'
import type { LoadedClass, ProcessedHeapArray, ProcessedHeapObject, ProcessedHeapString, StackFrame, StaticVar } from '@/dto/TraceState'
import { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'
import { HeapVizHeapArray } from '@/components/TheHeapVisualization/Types/HeapVizHeapArray'
import { HeapVizHeapObject } from '@/components/TheHeapVisualization/Types/HeapVizHeapObject'
import { HeapVizHeapString } from '@/components/TheHeapVisualization/Types/HeapVizHeapString'
import { HeapVizLoadedClass } from '@/components/TheHeapVisualization/Types/HeapVizLoadedClass'
import { HeapVizNullVal } from '@/components/TheHeapVisualization/Types/HeapVizNullVal'
import { HeapVizPrimitiveVal } from '@/components/TheHeapVisualization/Types/HeapVizPrimitiveVal'
import { HeapVizReferenceVal } from '@/components/TheHeapVisualization/Types/HeapVizReferenceVal'
import { HeapVizStackFrame } from '@/components/TheHeapVisualization/Types/HeapVizStackFrame'
import { HeapVizVar } from '@/components/TheHeapVisualization/Types/HeapVizVar'
import { renderRootsNode } from '@/components/TheHeapVisualization/RootsNodeRenderer'

export interface MemoryViewDotCase {
  name: string
  actual: string
  expected: string
  graphviz: 'rows' | 'node' | false
}

/** Removes indentation between tags without weakening comparisons of tags, attributes, or values. */
export function normalizeDotHtml (value: string): string {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/>\s+</g, '><')
}

const ordinaryClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'Example',
  staticFields: [],
  isHeapTraversalStop: false,
  isJavaDataStructure: false,
  hasCollectedFields: true
}

const intValue = {
  kind: 'PrimitiveVal' as const,
  primitiveValue: '7',
  vizValue: '7',
  title: undefined
}

const intVariable: StaticVar = {
  kind: 'Var',
  name: 'count',
  type: 'int',
  value: intValue,
  changed: false,
  class: 'Example'
}

/** Handwritten full-row contract shared by primitive-size cases. */
function expectedMemoryVariableRow (
  identifier: string,
  name: string,
  type: string,
  bytes: number,
  value: string
): string {
  return `<tr>
    <td width="30" align="right"  bgcolor="#ffffff" >
      <b>${bytes}</b>
    </td>
    <td colspan="2" width="30" align="right" title="id=&quot;${identifier}:typeandname&quot;" bgcolor="#ffffff">
      <font color="#0000ff">
        <b>&nbsp;${type}</b>
      </font>
      <font color="#000000">${name}</font>
    </td>
    <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;${identifier}:pseudo&quot;" port="${identifier.split(':')[1]}" sides="LTB" bgcolor="#ffffff">
      <font color="#ffffff">xx</font>
    </td>
    <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;${identifier}:value&quot;" sides="RTB" bgcolor="#ffffff">
      <b><font color="#000000" face="Arial">&nbsp;${value}&nbsp;</font></b>
    </td>
  </tr>`
}

/** Handwritten complete heap-node wrapper; subtype bodies remain explicit literals below. */
function expectedHeapNode (identifier: string, type: string, cssClass: string, body: string): string {
  return `${identifier}[label=<<font face="Courier" point-size="9">
    <table border="0" cellborder="1" cellspacing="0"><tr>
      <td align="center" colspan="5" title="id=&quot;${identifier}:header&quot;" bgcolor="#A3C2DB" port="heap_object_header">
        <b>${type}</b>
      </td>
    </tr>
    ${body}
    </table>  </font>> , class="${cssClass}"];`
}

function expectedRootsNode (stackRows: string): string {
  return `subgraph cluster_roots {
    shape="box";
    style="invis";
    roots[shape="plaintext";
      label=<
        <font face="Courier" point-size="9">
          <table border="0" cellborder="1" cellspacing="0" id="rootsTable">
            <tr><td colspan="5" bgcolor="#A3C2DB" id="staticsHeader"><font face="Arial" point-size="12"><b>Statics</b></font></td></tr>
            <tr><td colspan="5" border="0" height="15"></td></tr>
            <tr><td colspan="5" bgcolor="#A3C2DB" id="stackHeader"><font face="Arial" point-size="12"><b>Stack</b></font></td></tr>
            ${stackRows}
          </table></font>
      >
    ]
  }`
}

/** Returns the same memory object before and after a hover-only background-color change. */
export function createHoverStableObjectNodes (): { normal: string, hovered: string } {
  setActivePinia(createPinia())

  const normalContext = new MemoryViewRenderContext()
  normalContext.setShowMemory(true)
  const hoveredContext = new MemoryViewRenderContext()
  hoveredContext.setShowMemory(true)
  hoveredContext.setHoverInfos([{ kind: 'Field', objId: 1, name: 'count', reference: -1 }])

  const model: ProcessedHeapObject = {
    kind: 'HeapObject',
    id: 1,
    type: 'Example',
    faked: false,
    loadedClass: ordinaryClass,
    fields: [{ ...intVariable, heapObjectId: 1 }]
  }

  return {
    normal: new HeapVizHeapObject(model, normalContext).renderNode(),
    hovered: new HeapVizHeapObject(model, hoveredContext).renderNode()
  }
}

/** Builds deterministic renderer fixtures and their handwritten complete output contracts. */
export function createMemoryViewDotCases (): MemoryViewDotCase[] {
  setActivePinia(createPinia())

  const compactContext = new MemoryViewRenderContext()
  const memoryContext = new MemoryViewRenderContext()
  memoryContext.setShowMemory(true)
  const detailedMemoryContext = new MemoryViewRenderContext()
  detailedMemoryContext.setShowMemory(true)
  detailedMemoryContext.setDataStructureVisibilitySettings({
    showDataStructureDetails: true,
    showDataStructureStatics: false,
    showDataStructureFields: true
  })

  const primitive = new HeapVizPrimitiveVal(intValue, 'primitive_count', 'int', memoryContext)
  const nullValue = new HeapVizNullVal({ kind: 'NullVal' }, 'null_item', memoryContext)
  const reference = new HeapVizReferenceVal({ kind: 'ReferenceVal', reference: 2 }, 'reference_item', memoryContext)
  const memoryVariable = new HeapVizVar(intVariable, 'roots:l_0_count', memoryContext)
  const additionalPrimitiveVariables = [
    ['boolean', 'flag', 'true', 1],
    ['byte', 'small', '1', 1],
    ['short', 'shortNumber', '2', 2],
    ['char', 'letter', 'A', 2],
    ['long', 'largeNumber', '9', 8],
    ['double', 'ratio', '1.5', 8]
  ].map(([type, name, value, bytes]) => {
    const identifier = `roots:l_0_${name}`
    const variable = new HeapVizVar({
      ...intVariable,
      name: name as string,
      type: type as string,
      value: {
        kind: 'PrimitiveVal' as const,
        primitiveValue: value as string,
        vizValue: value as string,
        title: undefined
      }
    }, identifier, memoryContext)
    return {
      name: `memory ${type} variable row`,
      actual: variable.render(),
      expected: expectedMemoryVariableRow(identifier, name as string, type as string, bytes as number, value as string),
      graphviz: 'rows' as const
    }
  })
  const compactNullVariable = new HeapVizVar({
    kind: 'Var',
    name: 'item',
    type: 'java.lang.Object',
    value: { kind: 'NullVal' },
    changed: false,
    class: 'Example'
  }, 'roots:l_0_item', compactContext)

  const stackFrame = new HeapVizStackFrame({
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method: 'main',
    signature: '()',
    displaySignature: '()',
    localVariables: [{ ...intVariable, method: 'main()' }],
    conditionValues: [],
    arrayAccessValues: [],
    displayText: 'Example.main()',
    internal: false
  } satisfies StackFrame, 0, memoryContext)
  const emptyStackFrame = new HeapVizStackFrame({
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method: 'empty',
    signature: '()',
    displaySignature: '()',
    localVariables: [],
    conditionValues: [],
    arrayAccessValues: [],
    displayText: 'Example.empty()',
    internal: false
  } satisfies StackFrame, 1, memoryContext)
  const mixedStackFrame = new HeapVizStackFrame({
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method: 'mixed',
    signature: '()',
    displaySignature: '()',
    localVariables: [
      { ...intVariable, method: 'mixed()' },
      {
        ...intVariable,
        name: 'flag',
        type: 'boolean',
        method: 'mixed()',
        value: { kind: 'PrimitiveVal', primitiveValue: 'true', vizValue: 'true', title: undefined }
      }
    ],
    conditionValues: [],
    arrayAccessValues: [],
    displayText: 'Example.mixed()',
    internal: false
  } satisfies StackFrame, 2, memoryContext)

  const loadedClass = new HeapVizLoadedClass({
    ...ordinaryClass,
    staticFields: [intVariable]
  }, memoryContext)

  const objectModel: ProcessedHeapObject = {
    kind: 'HeapObject',
    id: 1,
    type: 'Example',
    faked: false,
    loadedClass: ordinaryClass,
    fields: [intVariable]
  }
  const memoryObject = new HeapVizHeapObject(objectModel, memoryContext)
  const emptyObject = new HeapVizHeapObject({ ...objectModel, id: 2, fields: [] }, memoryContext)

  const primitiveArrayModel: ProcessedHeapArray = {
    kind: 'HeapArray',
    id: 3,
    type: 'int[]',
    faked: false,
    loadedClass: undefined,
    elements: [{
      kind: 'HeapArrayElementVar',
      arrayId: 3,
      index: 0,
      type: 'int',
      value: intValue,
      changed: false
    }]
  }
  const primitiveArray = new HeapVizHeapArray(primitiveArrayModel, memoryContext)
  const referenceArray = new HeapVizHeapArray({
    kind: 'HeapArray',
    id: 4,
    type: 'java.lang.Object[]',
    faked: false,
    loadedClass: undefined,
    elements: [{
      kind: 'HeapArrayElementVar',
      arrayId: 4,
      index: 0,
      type: 'java.lang.Object',
      value: { kind: 'ReferenceVal', reference: 1 },
      changed: false
    }]
  }, memoryContext)
  const emptyArray = new HeapVizHeapArray({ ...primitiveArrayModel, id: 5, elements: [] }, memoryContext)
  const multiPrimitiveArray = new HeapVizHeapArray({
    ...primitiveArrayModel,
    id: 9,
    elements: [
      { ...primitiveArrayModel.elements[0], arrayId: 9, index: 0 },
      {
        ...primitiveArrayModel.elements[0],
        arrayId: 9,
        index: 1,
        value: { ...intValue, primitiveValue: '8', vizValue: '8' }
      }
    ]
  }, memoryContext)
  const multiReferenceArray = new HeapVizHeapArray({
    kind: 'HeapArray',
    id: 10,
    type: 'java.lang.Object[]',
    faked: false,
    loadedClass: undefined,
    elements: [1, 2].map((reference, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: 10,
      index,
      type: 'java.lang.Object',
      value: { kind: 'ReferenceVal' as const, reference },
      changed: false
    }))
  }, memoryContext)
  const fourBooleanArray = new HeapVizHeapArray({
    kind: 'HeapArray',
    id: 12,
    type: 'boolean[]',
    faked: false,
    loadedClass: undefined,
    elements: Array.from({ length: 4 }, (_, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: 12,
      index,
      type: 'boolean',
      value: { kind: 'PrimitiveVal' as const, primitiveValue: 'true', vizValue: 'true', title: undefined },
      changed: false
    }))
  }, memoryContext)

  const stringModel: ProcessedHeapString = {
    kind: 'HeapString',
    id: 6,
    type: 'java.lang.String',
    faked: false,
    loadedClass: undefined,
    string: 'Tony',
    vizString: 'Tony',
    charArr: {
      kind: 'Var',
      name: 'value',
      type: 'byte[]',
      value: { kind: 'ReferenceVal', reference: 7 },
      changed: false,
      class: 'java.lang.String'
    }
  }
  const heapString = new HeapVizHeapString(stringModel, memoryContext)
  const longHeapString = new HeapVizHeapString({ ...stringModel, id: 13, string: 'Main Street 7', vizString: 'Main Street 7' }, memoryContext)
  const detailedHeapString = new HeapVizHeapString({ ...stringModel, id: 11 }, detailedMemoryContext)
  const compactEmptyNode = new HeapVizHeapObject({ ...objectModel, id: 8, fields: [] }, compactContext)

  const rootsNode = (stackAfterExecution: HeapVizStackFrame[]): string => {
    return renderRootsNode({ loadedClassesAfterExecution: [], stackAfterExecution })
  }

  const cases: MemoryViewDotCase[] = [
    {
      name: 'primitive int value',
      actual: primitive.render(),
      expected: '<font color="#000000" face="Arial">&nbsp;7&nbsp;</font>',
      graphviz: false
    },
    {
      name: 'null value',
      actual: nullValue.render(),
      expected: '<i>null</i>',
      graphviz: false
    },
    {
      name: 'expanded reference value',
      actual: reference.render(),
      expected: '<font color="white">xx</font>',
      graphviz: false
    },
    {
      name: 'memory primitive variable row',
      actual: memoryVariable.render(),
      expected: `<tr>
        <td width="30" align="right"  bgcolor="#ffffff" >
          <b>4</b>
        </td>
        <td colspan="2" width="30" align="right" title="id=&quot;roots:l_0_count:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff">
            <b>&nbsp;int</b>
          </font>
          <font color="#000000">count</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_count:pseudo&quot;" port="l_0_count" sides="LTB" bgcolor="#ffffff">
          <font color="#ffffff">xx</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_count:value&quot;" sides="RTB" bgcolor="#ffffff">
          <b><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></b>
        </td>
      </tr>`,
      graphviz: 'rows'
    },
    ...additionalPrimitiveVariables,
    {
      name: 'compact null variable row',
      actual: compactNullVariable.render(),
      expected: `<tr>
        <td colspan="3" width="30" align="right" title="id=&quot;roots:l_0_item:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff">
            <b>&nbsp;Object</b>
          </font>
          <font color="#000000">item</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_item:pseudo&quot;" port="l_0_item" sides="LTB" bgcolor="#ffffff">
          <font color="#ffffff">xx</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_item:value&quot;" sides="RTB" bgcolor="#ffffff">
          <b><i>null</i></b>
        </td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory stack frame with primitive local',
      actual: stackFrame.render(),
      expected: `<tr>
        <td bgcolor="#e3ecf4" colspan="5" title="id=&quot;stackframe_0:method&quot;">
          <font face="Arial">
            <b>Example.main()</b>
          </font>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"  bgcolor="#ffffff" >
          <b>4</b>
        </td>
        <td colspan="2" width="30" align="right" title="id=&quot;roots:l_0_count:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff">
            <b>&nbsp;int</b>
          </font>
          <font color="#000000">count</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_count:pseudo&quot;" port="l_0_count" sides="LTB" bgcolor="#ffffff">
          <font color="#ffffff">xx</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;roots:l_0_count:value&quot;" sides="RTB" bgcolor="#ffffff">
          <b><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></b>
        </td>
      </tr>
      <tr><td sides="BL" align="right"><font><b align="right">8</b></font></td><td sides="BR" colspan="4"></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory empty stack frame',
      actual: emptyStackFrame.render(),
      expected: `<tr>
        <td bgcolor="#e3ecf4" colspan="5" title="id=&quot;stackframe_1:method&quot;">
          <font face="Arial"><b>Example.empty()</b></font>
        </td>
      </tr>
      <tr><td sides="BL" align="right"><font><b align="right">0</b></font></td><td sides="BR" colspan="4"></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory stack frame with mixed locals',
      actual: mixedStackFrame.render(),
      expected: `<tr>
        <td bgcolor="#e3ecf4" colspan="5" title="id=&quot;stackframe_2:method&quot;">
          <font face="Arial"><b>Example.mixed()</b></font>
        </td>
      </tr>
      ${expectedMemoryVariableRow('roots:l_2_count', 'count', 'int', 4, '7')}
      ${expectedMemoryVariableRow('roots:l_2_flag', 'flag', 'boolean', 1, 'true')}
      <tr><td sides="BL" align="right"><font><b align="right">8</b></font></td><td sides="BR" colspan="4"></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory loaded class with static primitive',
      actual: loadedClass.render(),
      expected: `<tr><td bgcolor="#e3ecf4" colspan="5"><font face="Arial"><b>Example </b></font></td></tr>
      <tr>
        <td width="30" align="right"  bgcolor="#ffffff" >
          <b>4</b>
        </td>
        <td colspan="2" width="30" align="right" title="id=&quot;roots:s_Example_count:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff">
            <b>&nbsp;int</b>
          </font>
          <font color="#000000">count</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;roots:s_Example_count:pseudo&quot;" port="s_Example_count" sides="LTB" bgcolor="#ffffff">
          <font color="#ffffff">xx</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;roots:s_Example_count:value&quot;" sides="RTB" bgcolor="#ffffff">
          <b><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></b>
        </td>
      </tr>
      <tr><td align="right"><font><b align="right">28</b></font></td><td colspan="4"></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory object with primitive field',
      actual: memoryObject.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td>
        <td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right"  bgcolor="#ffffff" >
          <b>4</b>
        </td>
        <td colspan="2" width="30" align="right" title="id=&quot;o_1:count:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff">
            <b>&nbsp;int</b>
          </font>
          <font color="#000000">count</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;o_1:count:pseudo&quot;" port="count" sides="LTB" bgcolor="#ffffff">
          <font color="#ffffff">xx</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;o_1:count:value&quot;" sides="RTB" bgcolor="#ffffff">
          <b><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></b>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"><b>20</b>&nbsp;(+4)</td>
        <td colspan="4" width="30" align="right"><b>24</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory empty object',
      actual: emptyObject.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td>
        <td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right"><b>16</b>&nbsp;(+0)</td>
        <td colspan="4" width="30" align="right"><b>16</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory primitive array',
      actual: primitiveArray.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td>
      </tr>
      <tr>
        <td colspan="5" border="0" cellpadding="0" cellspacing="0">
          <table border="0" cellborder="1" cellspacing="0">
            <tr><td width="30" title="id=&quot;o_3:i_0:index&quot;" bgcolor="#ffffff"><font color="#000000">[0]</font></td></tr>
            <tr><td width="30" title="id=&quot;o_3:i_0:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></font></td></tr>
            <tr><td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>4</b></font></td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"><b>24</b>&nbsp;(+0)</td>
        <td colspan="4" width="30" align="right"><b>24</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory reference array',
      actual: referenceArray.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr><tr>
        <td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td>
      </tr><tr>
        <td width="30" align="right" bgcolor="#ffffff"><b>8</b></td>
        <td colspan="2" width="30" title="id=&quot;o_4:i_0:index&quot;" bgcolor="#e3ecf4">
          <font color="#000000">
            <font>[0]</font>
          </font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;o_4:i_0:pseudo&quot;" port="i_0" sides="LTB" bgcolor="#ffffff">
          <font color="white">&nbsp;</font>
        </td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;o_4:i_0:value&quot;" sides="RTB" bgcolor="#ffffff">
          <font><font color="white">xx</font></font>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"><b>28</b>&nbsp;(+4)</td>
        <td colspan="4" width="30" align="right"><b>32</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory primitive array with two elements',
      actual: multiPrimitiveArray.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr><tr>
        <td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td>
      </tr>
      <tr>
        <td colspan="5" border="0" cellpadding="0" cellspacing="0">
          <table border="0" cellborder="1" cellspacing="0">
            <tr>
              <td width="30" title="id=&quot;o_9:i_0:index&quot;" bgcolor="#ffffff"><font color="#000000">[0]</font></td>
              <td width="30" title="id=&quot;o_9:i_1:index&quot;" bgcolor="#ffffff"><font color="#000000">[1]</font></td>
            </tr>
            <tr>
              <td width="30" title="id=&quot;o_9:i_0:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;7&nbsp;</font></font></td>
              <td width="30" title="id=&quot;o_9:i_1:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;8&nbsp;</font></font></td>
            </tr>
            <tr>
              <td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>4</b></font></td>
              <td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>4</b></font></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"><b>28</b>&nbsp;(+4)</td>
        <td colspan="4" width="30" align="right"><b>32</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory reference array with two elements',
      actual: multiReferenceArray.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr><tr>
        <td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td>
      </tr><tr>
        <td width="30" align="right" bgcolor="#ffffff"><b>8</b></td>
        <td colspan="2" width="30" title="id=&quot;o_10:i_0:index&quot;" bgcolor="#e3ecf4"><font color="#000000"><font>[0]</font></font></td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;o_10:i_0:pseudo&quot;" port="i_0" sides="LTB" bgcolor="#ffffff"><font color="white">&nbsp;</font></td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;o_10:i_0:value&quot;" sides="RTB" bgcolor="#ffffff"><font><font color="white">xx</font></font></td>
      </tr>
      <tr>
        <td width="30" align="right" bgcolor="#ffffff"><b>8</b></td>
        <td colspan="2" width="30" title="id=&quot;o_10:i_1:index&quot;" bgcolor="#e3ecf4"><font color="#000000"><font>[1]</font></font></td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;o_10:i_1:pseudo&quot;" port="i_1" sides="LTB" bgcolor="#ffffff"><font color="white">&nbsp;</font></td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;o_10:i_1:value&quot;" sides="RTB" bgcolor="#ffffff"><font><font color="white">xx</font></font></td>
      </tr>
      <tr>
        <td width="30" align="right"><b>36</b>&nbsp;(+4)</td>
        <td colspan="4" width="30" align="right"><b>40</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory empty array',
      actual: emptyArray.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td>
      </tr>
      <tr>
        <td width="30" align="right"><b>20</b>&nbsp;(+4)</td>
        <td colspan="4" width="30" align="right"><b>24</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory array with four booleans',
      actual: fourBooleanArray.render(),
      expected: `<tr><td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td></tr>
      <tr><td width="30" align="right"><b>4</b></td><td colspan="4" width="30">Length</td></tr>
      <tr><td colspan="5" border="0" cellpadding="0" cellspacing="0"><table border="0" cellborder="1" cellspacing="0">
        <tr>
          <td width="30" title="id=&quot;o_12:i_0:index&quot;" bgcolor="#ffffff"><font color="#000000">[0]</font></td>
          <td width="30" title="id=&quot;o_12:i_1:index&quot;" bgcolor="#ffffff"><font color="#000000">[1]</font></td>
          <td width="30" title="id=&quot;o_12:i_2:index&quot;" bgcolor="#ffffff"><font color="#000000">[2]</font></td>
          <td width="30" title="id=&quot;o_12:i_3:index&quot;" bgcolor="#ffffff"><font color="#000000">[3]</font></td>
        </tr><tr>
          <td width="30" title="id=&quot;o_12:i_0:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;true&nbsp;</font></font></td>
          <td width="30" title="id=&quot;o_12:i_1:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;true&nbsp;</font></font></td>
          <td width="30" title="id=&quot;o_12:i_2:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;true&nbsp;</font></font></td>
          <td width="30" title="id=&quot;o_12:i_3:value&quot; data-tooltip=&quot;HeapVizHeapArray&quot;" pointer-events="none" bgcolor="#ffffff"><font color="#ffffff"><font color="#000000" face="Arial">&nbsp;true&nbsp;</font></font></td>
        </tr><tr>
          <td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>1</b></font></td><td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>1</b></font></td>
          <td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>1</b></font></td><td width="30" align="right" bgcolor="#ffffff"><font color="#000000"><b>1</b></font></td>
        </tr>
      </table></td></tr>
      <tr><td width="30" align="right"><b>24</b>&nbsp;(+0)</td><td colspan="4" width="30" align="right"><b>24</b></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory compact string body',
      actual: heapString.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td>
        <td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right" bgcolor="#ffffff">32</td>
        <td width="30" colspan="4" title="id=&quot;o_6:value&quot;" bgcolor="#e3ecf4">
          <font color="#000000" face="Arial">
            <font>"Tony"</font>
          </font>
        </td>
      </tr>
      <tr>
        <td width="30" align="right"><b>48</b>&nbsp;(+0)</td>
        <td colspan="4" width="30" align="right"><b>48</b></td>
      </tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory compact long string',
      actual: longHeapString.render(),
      expected: `<tr><td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td></tr>
      <tr><td width="30" align="right" bgcolor="#ffffff">48</td><td width="30" colspan="4" title="id=&quot;o_13:value&quot;" bgcolor="#e3ecf4">
        <font color="#000000" face="Arial"><font>"Main Street 7"</font></font>
      </td></tr>
      <tr><td width="30" align="right"><b>64</b>&nbsp;(+0)</td><td colspan="4" width="30" align="right"><b>64</b></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'memory detailed string',
      actual: detailedHeapString.render(),
      expected: `<tr>
        <td width="30" align="right"><b>16</b></td><td colspan="4" width="30">Header</td>
      </tr>
      <tr>
        <td width="30" align="right"  bgcolor="#ffffff" ><b>8</b></td>
        <td colspan="2" width="30" align="right" title="id=&quot;o_11:value:typeandname&quot;" bgcolor="#ffffff">
          <font color="#0000ff"><b>&nbsp;byte[]</b></font><font color="#000000">value</font>
        </td>
        <td align="right" cellpadding="0" cellspacing="0" title="id=&quot;o_11:value:pseudo&quot;" port="value" sides="LTB" bgcolor="#ffffff"><font color="#ffffff">xx</font></td>
        <td align="left" cellpadding="0" cellspacing="0" title="id=&quot;o_11:value:value&quot;" sides="RTB" bgcolor="#ffffff"><b><font color="white">xx</font></b></td>
      </tr>
      <tr><td width="30" align="right"><b>24</b>&nbsp;(+0)</td><td colspan="4" width="30" align="right"><b>24</b></td></tr>`,
      graphviz: 'rows'
    },
    {
      name: 'complete roots table without stack frames',
      actual: rootsNode([]),
      expected: expectedRootsNode(''),
      graphviz: false
    },
    {
      name: 'complete roots table with empty stack frame',
      actual: rootsNode([emptyStackFrame]),
      expected: expectedRootsNode(`<tr><td bgcolor="#e3ecf4" colspan="5" title="id=&quot;stackframe_1:method&quot;"><font face="Arial"><b>Example.empty()</b></font></td></tr>
        <tr><td sides="BL" align="right"><font><b align="right">0</b></font></td><td sides="BR" colspan="4"></td></tr>`),
      graphviz: false
    },
    {
      name: 'complete roots table with mixed stack frame',
      actual: rootsNode([mixedStackFrame]),
      expected: expectedRootsNode(`<tr><td bgcolor="#e3ecf4" colspan="5" title="id=&quot;stackframe_2:method&quot;"><font face="Arial"><b>Example.mixed()</b></font></td></tr>
        ${expectedMemoryVariableRow('roots:l_2_count', 'count', 'int', 4, '7')}
        ${expectedMemoryVariableRow('roots:l_2_flag', 'flag', 'boolean', 1, 'true')}
        <tr><td sides="BL" align="right"><font><b align="right">8</b></font></td><td sides="BR" colspan="4"></td></tr>`),
      graphviz: false
    },
    {
      name: 'complete compact empty-object node',
      actual: compactEmptyNode.renderNode(),
      expected: `o_8[label=<<font face="Courier" point-size="9">
        <table border="0" cellborder="1" cellspacing="0"><tr>
          <td align="center" colspan="5" title="id=&quot;o_8:header&quot;" bgcolor="#A3C2DB" port="heap_object_header">
            <b>Example</b>
          </td>
        </tr>
        </table>  </font>> , class="heapvizheapobject"];`,
      graphviz: 'node'
    }
  ]

  const completeHeapNodes = new Map<string, [HeapVizHeapObject | HeapVizHeapArray | HeapVizHeapString, string, string, string]>([
    ['memory object with primitive field', [memoryObject, 'o_1', 'Example', 'heapvizheapobject']],
    ['memory empty object', [emptyObject, 'o_2', 'Example', 'heapvizheapobject']],
    ['memory primitive array', [primitiveArray, 'o_3', 'int[]', 'heapvizheaparray']],
    ['memory reference array', [referenceArray, 'o_4', 'Object[]', 'heapvizheaparray']],
    ['memory primitive array with two elements', [multiPrimitiveArray, 'o_9', 'int[]', 'heapvizheaparray']],
    ['memory reference array with two elements', [multiReferenceArray, 'o_10', 'Object[]', 'heapvizheaparray']],
    ['memory empty array', [emptyArray, 'o_5', 'int[]', 'heapvizheaparray']],
    ['memory array with four booleans', [fourBooleanArray, 'o_12', 'boolean[]', 'heapvizheaparray']],
    ['memory compact string body', [heapString, 'o_6', 'String', 'heapvizheapstring']],
    ['memory compact long string', [longHeapString, 'o_13', 'String', 'heapvizheapstring']],
    ['memory detailed string', [detailedHeapString, 'o_11', 'String', 'heapvizheapstring']]
  ])

  for (const dotCase of cases) {
    const node = completeHeapNodes.get(dotCase.name)
    if (!node)
      continue
    const [item, identifier, type, cssClass] = node
    dotCase.actual = item.renderNode()
    dotCase.expected = expectedHeapNode(identifier, type, cssClass, dotCase.expected)
    dotCase.graphviz = 'node'
  }

  return cases
}

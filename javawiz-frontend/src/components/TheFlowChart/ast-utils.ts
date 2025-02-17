import * as d3 from 'd3'
import { AstElement, Class, Conditional, IfStatement, Method, MethodCallExpr, Statement } from '@/dto/AbstractSyntaxTree'
import { InlinedFnMap, CallSite } from './types'

/**
 * Create a shadow of an AstElement, all uuids will be changed (deep recursively)
 * @param m element to shadow
 * @param idExtender this will be concatinated - for method call uuids etc.
 * @returns shadow of element
 */
export function shadow<T extends AstElement> (m: T, idExtender: string): T {
  if (typeof m !== 'object') return m
  return Object.fromEntries(Object.entries(m).map(([k, v]) => {
    if (k === 'uuid') {
      return [k, v + '@' + idExtender]
    } else if (Array.isArray(v)) {
      return [k, v.map(i => shadow(i, idExtender))]
    } else if (typeof v === 'object' && !!v) {
      return [k, shadow(v, idExtender)]
    }
    return [k, v]
  })) as T
}

/**
 * Create a inlined method shadow by using a method call expression
 * @param methodCallExprUuid UUID of the method call expression
 * @param name method name
 * @param inlined inlined methods
 * @returns Inlined method
 */
export function getInlineMethod (methodCallExprUuid: string, _name: string, inlined: InlinedFnMap): Method | undefined {
  const item = inlined.get(methodCallExprUuid)
  if (item) return shadow(item, methodCallExprUuid)
  return undefined
}

/**
 * Filter the inlined methods and return a list of methods for all provided method call expressions
 * @param methodCallExpressions list of method call expressions
 * @param inlined inline method map
 * @returns list of Method AstElements for a list of method call expressions
 */
function filterMethodCallExpressions (methodCallExpressions: MethodCallExpr[], inlined?: InlinedFnMap): Method[] {
  if (!inlined) return []
  return methodCallExpressions.map(expr => getInlineMethod(expr.uuid, expr.name, inlined))
    .filter((x): x is Method => x !== undefined)
}

/**
 * Create a d3.js hierachy for the given backend AST root node
 * @param root Root backend AST node
 * @param collapsed set of collapsed elements
 * @param inlined map of inlined methods
 * @returns d3.js hierachy
 */
export function createD3Hierarchy (root: AstElement, collapsed?: Set<string>, inlined?: InlinedFnMap): d3.HierarchyNode<AstElement> {
  return d3.hierarchy<AstElement>(
    root,
    (d: AstElement) => {
      if (!d || (collapsed && collapsed.has(d.uuid))) {
        return []
      }
      switch (d.kind) {
        case 'Block':
          return d.statements
        case 'Method':
          return [d.body]
        case 'IfStatement': {
          const stmt = d
          if (stmt.falseCase) {
            return [stmt.trueCase, stmt.falseCase, ...filterMethodCallExpressions(d.methodCallExpressions, inlined)]
          }
          return [stmt.trueCase, ...filterMethodCallExpressions(d.methodCallExpressions, inlined)]
        }
        case 'Conditional':
          return [d.trueCase, ...filterMethodCallExpressions(d.methodCallExpressions, inlined)]
        case 'Switch':
          if (d.defaultEntry) {
            return [...d.entries, d.defaultEntry]
          } else {
            return d.entries
          }
        case 'SwitchEntry':
          return [d.block]
        case 'Class':
          return d.methods
        case 'AstFile':
          return d.classes
        case 'Statement': {
          return filterMethodCallExpressions(d.methodCallExpressions, inlined)
        }
        case 'TryCatchFinally': {
          if (d.finallyBlock) return [d.tryBlock, ...d.catchClauses, d.finallyBlock]
          return [d.tryBlock, ...d.catchClauses]
        }
        case 'CatchClause': {
          return [d.body]
        }
      }
    }
  )
}

/**
 * Create a d3.js hierarchy AST for a given backend AST with a specified method name
 * @param root Root node of an AST
 * @param methodName Name of the method that starts the chart
 * @param className Class of the method that starts the chart
 * @param collapsed collapsed elements
 * @param inlined inlined methods
 * @returns d3.js Hierarchy
 */
export function createD3HierarchyByMethod (root: AstElement, methodName: string, className: string, collapsed?: Set<string>, inlined?: InlinedFnMap): d3.HierarchyNode<AstElement> {
  const hierarchy = createD3Hierarchy(root, collapsed, inlined)

  let methodNode = hierarchy.find(
    (n: d3.HierarchyNode<AstElement>) => n.data &&
    n.data.kind === 'Method' &&
      (n.data.name === methodName && n.data.className === className))?.copy()
  if (methodNode) {
    return methodNode
  }

  // fallback if class name was not found for some reason
  methodNode = hierarchy.find(
    (n: d3.HierarchyNode<AstElement>) => n.data &&
    n.data.kind === 'Method' &&
      n.data.name === methodName)?.copy()
  if (methodNode) {
    return methodNode
  }
  throw new Error(`method not found: ${methodName} at ${className}`)
}

/**
 * Convert a UUIDv4 to an ID that can be used in the DOM
 * @param uuid UUID v4
 * @returns ID usable in the DOM
 */
export function uuidToDomId (uuid: string): string {
  return 'uuid-' + uuid.replace(/-|@/g, '')
}

/**
 * create an inlined Function map containing all methods on the current stack
 * @param methods the global set of classes (i.e. all defined classes)
 * @param stackFrameMethods the call sites (method name + class name + line number) on the current stack
 * @returns the inlined Function map
 */
export function createTempInlinedFnMap (classes: Class[], stackFrameMethods: CallSite[]): InlinedFnMap {
  const tempInlined: InlinedFnMap = new Map()
  let current = classes.filter(c => c.name === stackFrameMethods.at(-1)!.class)
    .flatMap(c => c.methods)
    .find(m => m.name === 'main')
  if (!current) {
    console.warn('Could not find main method in flowchart AST.')
    return tempInlined
  }
  let idExt: string[] = [] // uuid of inlined methods gets extended by uuids of method call expressions
  for (let i = stackFrameMethods.length - 1; i > 0; i--) {
    const callSites = descendentsWithMethodCalls(current)
      .filter(n => {
        const doWhileConditionCall = n.kind === 'Conditional' && n.type === 'DO_WHILE' && n.end === stackFrameMethods[i].line
        const callInLine = n.begin === stackFrameMethods[i].line
        return callInLine || doWhileConditionCall
      })
    /*
    currently, we just use the first method call expression with the correct method name.
    This is wrong in situations where multiple methods with a certain name are called in one line
    In such situations, we would need additional info from the backend or remember how often
    the method has been called within this line.
    */

    const callSite = stackFrameMethods[i - 1]
    const mce = callSites.flatMap(cs => cs.methodCallExpressions)
      .find(mc => mc.name === callSite.method)
    if (!mce) {
      console.error('MethodCallExpression not found')
      break
    }
    const uuid = idExt.length > 0 ? ([mce.uuid, ...idExt].join('@')) : mce.uuid

    const clazz = classes.find(c => c.name === callSite.class)
    if (!clazz) {
      console.error(`class ${callSite.class} not found`)
      break
    }
    current = clazz.methods
      .find(m => m.name === callSite.method && m.begin <= callSite.line && callSite.line <= m.end)!
    idExt = [mce.uuid, ...idExt]

    tempInlined.set(uuid, current)
  }
  return tempInlined
}

/**
 * get all descendents that might contain method calls
 * @param element the AST element to start from
 * @returns a list of all descendents in the same method which contain method call expressions
 */
function descendentsWithMethodCalls (element: AstElement): (IfStatement | Conditional | Statement)[] {
  switch (element.kind) {
    case 'Block': return element.statements.flatMap(e => descendentsWithMethodCalls(e))
    case 'CatchClause': case 'Method':
      return descendentsWithMethodCalls(element.body)
    case 'Statement': return [element]
    case 'IfStatement':
      if (element.falseCase) {
        return [element, ...descendentsWithMethodCalls(element.trueCase), ...descendentsWithMethodCalls(element.falseCase)]
      } else {
        return [element, ...descendentsWithMethodCalls(element.trueCase)]
      }
    case 'Conditional':
      return [element, ...descendentsWithMethodCalls(element.trueCase)]
    case 'Class': case 'AstFile': {
      return [] // no relevant method call expression inside class definitions inside methods
    }
    case 'Switch': {
      if (element.defaultEntry) {
        return [...descendentsWithMethodCalls(element.defaultEntry), ...element.entries.flatMap(e => descendentsWithMethodCalls(e))]
      } else {
        return element.entries.flatMap(e => descendentsWithMethodCalls(e))
      }
    }
    case 'SwitchEntry': {
      return descendentsWithMethodCalls(element.block)
    }
    case 'TryCatchFinally': {
      const blocks = [element.tryBlock, ...element.catchClauses]
      if (element.finallyBlock) {
        blocks.push(element.finallyBlock)
      }
      return blocks.flatMap(descendentsWithMethodCalls)
    }
  }
}

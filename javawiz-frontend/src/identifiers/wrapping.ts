import { ClassName } from '@/identifiers/classname-types'
import { URI } from '@/identifiers/uri-types'
import { MethodName } from '@/identifiers/methname-types'
import * as path from 'node:path'

function getClassName (className: string): ClassName {
  const flag = className.length > 0 && className[0] === className[0].toLowerCase()
  const idx = className.lastIndexOf('.')

  if (idx !== -1) {
    const substring = className.substring(0, idx)
    const lastDotIndex = substring.lastIndexOf('.')
    const nextChar = className[lastDotIndex + 1]

    if (!className.includes('$') && nextChar === nextChar.toLowerCase()) {
      return flag ? {kind: 'OuterClassWithPackage', className} : {kind: 'OuterClassWithoutPackage', className}
    } else if (!className.includes('$') && nextChar === nextChar.toUpperCase()) {
      return flag ? {kind: 'InnerClassWithPackageAndDot', className} : {kind: 'InnerClassWithDot', className}
    } else {
      return flag ? {kind: 'InnerClassWithPackageAndDollar', className} : {kind: 'InnerClassWithDollar', className}
    }
  }

  return !flag && className.includes('$')
    ? {kind: 'InnerClassWithDollar', className}
    : {kind: 'OuterClassWithoutPackage', className}
}

function getURIName (uri: string): URI {
  const normalizedPath = uri.replace(/\\/g, '/')
  try {
    const path = new URL(normalizedPath)
    if (path.origin !== 'null') {
      return {kind: 'CompleteURI', uri: normalizedPath}
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.log('invalid uri')
  }

  const workspaceRelativeURI = path.resolve('')
  const filePath = path.resolve(normalizedPath)

  if (path.isAbsolute(filePath) && filePath.startsWith(workspaceRelativeURI)) {
    return {kind: 'WorkspaceRelativeURI', uri: workspaceRelativeURI}
  }

  if (normalizedPath.startsWith('/')) {
    return {kind: 'PackageRelativeURI', uri: normalizedPath}
  }

  return {kind: 'FileName', uri: normalizedPath}
}

export function getMethodName (s: string): MethodName {
  const paramListKind = (s.includes('()') ? 'MethodNameWithEmptyParamList' : 'MethodNameWithParamList')
  const kind = s.includes('(') ? paramListKind : 'MethodNameWithoutParamList'  
  return {
    kind,
    name: s  
  }
}
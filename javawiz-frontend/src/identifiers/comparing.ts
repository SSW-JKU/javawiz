import { ClassName } from '@/identifiers/classname-types'
import { URI } from '@/identifiers/uri-types'
import { MethodName } from '@/identifiers/methname-types'
/* import * as path from 'path'
import * as fs from 'fs'
import { URL } from 'url' */

export function areEqualWrapperTypes (firstName: ClassName | MethodName | URI, secondName: ClassName | MethodName | URI): boolean {
  return firstName.kind === secondName.kind
}

/* function getURIName(uri: string): URI {
  const normalizedPath = uri.replace('\\', '/');
  try {
    const pathObj = new URL(normalizedPath)  // Using the URL constructor for URI parsing
    if (pathObj.protocol) {
      return {
        kind: 'CompleteURI',
        uri: normalizedPath
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.log('invalid uri');
  }
  const workspaceRelativeURI = path.resolve('');
  const filePath = path.resolve(normalizedPath);
  if (path.isAbsolute(filePath) && filePath.startsWith(workspaceRelativeURI)) {
    return {
      kind: 'WorkspaceRelativeURI',
      uri: normalizedPath
    }
  }
  if (normalizedPath.startsWith('/')) {
    return {
      kind: 'PackageRelativeURI',
      uri: normalizedPath
    }
  }
  return {
    kind: 'FileName',
    uri: normalizedPath
  }
}

function areEqualURIs(firstPath: URI, secondPath: URI): boolean {
  console.log('first uri name:', firstPath);
  console.log('second uri name:', secondPath);

  if (areEqualWrapperTypes(firstPath, secondPath)) {
    return firstPath.uri === secondPath.uri;
  } else {
    if (firstPath.kind === 'CompleteURI') {
      return firstPath.uri === convertPath(secondPath, 'CompleteURI').uri;
    } else if (secondPath.kind === 'CompleteURI') {
      return secondPath.uri === convertPath(secondPath, 'CompleteURI').uri;
    } else if (firstPath.kind === 'WorkspaceRelativeURI') {
      return firstPath.uri === convertPath(secondPath, 'WorkspaceRelativeURI').uri;
    } else if (secondPath.kind === 'WorkspaceRelativeURI') {
      return secondPath.uri === convertPath(firstPath, 'WorkspaceRelativeURI').uri;
    } else if (firstPath.kind === 'FileName') {
      return firstPath.uri === convertPath(secondPath, 'FileName').uri;
    } else if (secondPath.kind === 'FileName') {
      return secondPath.uri === convertPath(firstPath, 'FileName').uri;
    } else {
      return firstPath.uri === secondPath.uri;
    }
  }
}

function convertPath(uri: URI, kind: string): URI {
  switch (kind) {
    case 'CompleteURI':
      return {
        kind: 'CompleteURI',
        uri: convertToComplete(uri, path.resolve(''))
      }
    case 'WorkspaceRelativeURI':
      return {
        kind: 'WorkspaceRelativeURI',
        uri: convertToWorkspaceRelative(uri, path.resolve(''))
      }
    case 'FileName':
      return {
        kind: 'FileName',
        uri: convertToFileName(uri.uri)
      }
    default:
      return uri;
  }
}

// Convert Complete URI to Workspace-Relative URI
function convertToWorkspaceRelative(completeUri: URI, baseDir: string): string {
  switch (completeUri.kind) {
    case 'CompleteURI': {
      const basePath = path.resolve(baseDir);
      return path.relative(basePath, path.resolve(completeUri.uri))
    }
    case 'WorkspaceRelativeURI': {
      return completeUri.uri
    }
    default: {
      const completePath = convertToComplete(completeUri, baseDir)
      const basePathDefault = path.resolve(baseDir)
      return path.relative(basePathDefault, path.resolve(completePath))
    }
  }
}

// Convert to Complete URI
function convertToComplete(relativePath: URI, baseDir: string): string {
  switch (relativePath.kind) {
    case 'CompleteURI': {
      return relativePath.uri
    }
    case 'WorkspaceRelativeURI': {
      const basePath = path.resolve(baseDir)
      const fullPath = path.resolve(basePath, relativePath.uri)
      return new URL('file://' + fullPath).toString()
    }
    case 'PackageRelativeURI': {
      const normalizedUri = relativePath.uri.startsWith('/') ? relativePath.uri.substring(1) : relativePath.uri
      const resourcePath = path.resolve(normalizedUri)
      if (fs.existsSync(resourcePath)) {
        return new URL('file://' + resourcePath).toString()
      }
      return normalizedUri
    }
    default: {
      const filePath = baseDir ? path.resolve(baseDir, relativePath.uri) : path.resolve(relativePath.uri)
      return new URL('file://' + filePath).toString()
    }
  }
}

function convertToFileName(uri: string): string {
  return uri.substring(uri.lastIndexOf('/') + 1)
} */

export function areEqualMethods (firstMeth: MethodName, secondMeth: MethodName): boolean {
  console.log('first method name:')
  console.log(firstMeth)
  console.log('second method name:')
  console.log(secondMeth)
  if (areEqualWrapperTypes(firstMeth, secondMeth)) {
    return firstMeth.name === secondMeth.name  
  } else {
    if (firstMeth.kind === 'MethodNameWithEmptyParamList') {
      return firstMeth.name === getMethodNameWithEmptyParamList(secondMeth).name      
    } else if (firstMeth.kind === 'MethodNameWithoutParamList') {
      return firstMeth.name === getMethodNameWithoutParamList(secondMeth).name      
    } else {
      return secondMeth.name === getMethodNameWithEmptyParamList(firstMeth).name || secondMeth.name === getMethodNameWithoutParamList(firstMeth).name  
    }
  }
}

export function getMethodNameWithEmptyParamList (meth: MethodName): MethodName {
  if (meth.kind === 'MethodNameWithEmptyParamList') {
    return meth
  } else if (meth.kind === 'MethodNameWithoutParamList') {
    return {
      kind: 'MethodNameWithEmptyParamList',
      name: meth.name + '()'
    }  
  } else {
    return {
      kind: 'MethodNameWithEmptyParamList',
      name: meth.name.substring(0, meth.name.indexOf('(')) + '()'
    }  
  }
}

export function getMethodNameWithoutParamList (meth: MethodName): MethodName {
  if (meth.kind === 'MethodNameWithoutParamList') {
    return meth
  } else {
    return {
      kind: 'MethodNameWithoutParamList',
      name: meth.name.substring(0, meth.name.indexOf('('))
    }
  }
}

export function areEqualClassNames (firstClass: ClassName, secondClass: ClassName): boolean {
  console.log('first class name:')
  console.log(firstClass)
  console.log('second class name:')
  console.log(secondClass)
  if (areEqualWrapperTypes(firstClass, secondClass)) {
    return firstClass.className === secondClass.className
  } else {
    // OuterClassWithoutPackage: Main
    // OuterClassWithPackage: package.Main
    // InnerClassWithDollar: Main$Inner
    // InnerClassWithPackageAndDollar: package.Main$Inner
    // InnerClassWithPackageAndDot: package.Main.Inner
    // InnerClassWithDot: Main.Inner
    if (firstClass.kind === 'OuterClassWithoutPackage') {
      return firstClass.className === getOuterClassWithoutPackage(secondClass).className
    } else if (firstClass.kind === 'InnerClassWithDollar') {
      const name = getInnerClassWithDollar(secondClass)
      return name !== undefined && firstClass.className === name.className
    } else if (firstClass.kind === 'InnerClassWithDot') {
      const name = getInnerClassWithDot(secondClass)
      return name !== undefined && firstClass.className === name.className
    } else { // firstClassName with package
      return secondClass.className === getOuterClassWithoutPackage(firstClass).className ||
          getInnerClassWithDollar(firstClass) !== undefined && secondClass.className === getInnerClassWithDollar(firstClass)!.className ||
          getInnerClassWithDot(firstClass) !== undefined && secondClass.className === getInnerClassWithDot(firstClass)!.className
    }
  }
}

export function getOuterClassWithoutPackage (clazz: ClassName): ClassName {
  if (clazz.kind === 'OuterClassWithoutPackage') {
    return clazz
  } else {
    if (clazz.kind === 'OuterClassWithPackage') {
      return {
        kind: 'OuterClassWithoutPackage',
        className: clazz.className.substring(clazz.className.lastIndexOf('.') + 1, clazz.className.length)
      }
    } else { // inner class
      let name: string
      if (clazz.kind.includes('Dollar')) {
        name = clazz.className.substring(clazz.className.lastIndexOf('.') + 1, clazz.className.lastIndexOf('$'))
      } else {
        name = clazz.className.substring(clazz.className.substring(0, clazz.className.lastIndexOf('.')).lastIndexOf('.') + 1, clazz.className.lastIndexOf('.'))
      }
      return {
        kind: 'OuterClassWithoutPackage',
        className: name
      }
    }
  }
}

export function getInnerClassWithDollar (clazz: ClassName): ClassName | undefined {
  if (clazz.kind === 'InnerClassWithDollar') {
    return clazz
  } else {
    if (clazz.kind === 'InnerClassWithDot') {
      return {
        kind: 'InnerClassWithDollar',
        className: clazz.className.replace('.', '$')
      }
    } else { // InnerClassWithPackageAndDollar || InnerClassWithPackageAndDot
      for (let i = 0; i < clazz.className.length; i++) {
        if (clazz.className.charAt(i) === '.' && i + 1 < clazz.className.length && clazz.className.charAt(i + 1).toUpperCase() === clazz.className.charAt(i + 1)) {
          const name = clazz.className.substring(i + 1, clazz.className.length) // InnerClassWithDollar || InnerClassWithDot
          return {
            kind: 'InnerClassWithDollar',
            className: name.includes('$') ? name : name.replace('.', '$')
          }
        }
      }
    }
  }
}

export function getInnerClassWithDot (clazz: ClassName): ClassName | undefined {
  if (clazz.kind === 'InnerClassWithDot') {
    return clazz
  } else {
    if (clazz.kind === 'InnerClassWithDollar') {
      return {
        kind: 'InnerClassWithDot',
        className: clazz.className.replace('$', '.')
      }
    } else { // InnerClassWithPackageAndDollar || InnerClassWithPackageAndDot
      for (let i = 0; i < clazz.className.length; i++) {
        if (clazz.className.charAt(i) === '.' && i + 1 < clazz.className.length && clazz.className.charAt(i + 1).toUpperCase() === clazz.className.charAt(i + 1)) {
          const name = clazz.className.substring(i + 1, clazz.className.length) // InnerClassWithDollar || InnerClassWithDot
          return {
            kind: 'InnerClassWithDot',
            className: name.includes('$') ? name.replace('$', '.') : name
          }
        }
      }
    }
  }
}
import { MethodName } from '@/identifiers/methname-types'

export function getMethodName (s: string): MethodName {
  const paramListKind = (s.includes('()') ? 'MethodNameWithEmptyParamList' : 'MethodNameWithParamList')
  const kind = s.includes('(') ? paramListKind : 'MethodNameWithoutParamList'  
  return {
    kind,
    name: s  
  }
}
export interface MethodNameWithoutParamList {
    readonly kind: 'MethodNameWithoutParamList'
    readonly name: string
}

export interface MethodNameWithEmptyParamList {
    readonly kind: 'MethodNameWithEmptyParamList'
    readonly name: string
}

export interface MethodNameWithParamList {
    readonly kind: 'MethodNameWithParamList'
    readonly name: string
}

export type MethodName = MethodNameWithoutParamList | MethodNameWithEmptyParamList | MethodNameWithParamList
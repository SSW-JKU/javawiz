export interface CompleteURI {
    readonly kind: 'CompleteURI'
    readonly uri: string
}

export interface PackageRelativeURI {
    readonly kind: 'PackageRelativeURI'
    readonly uri: string
}

export interface WorkspaceRelativeURI {
    readonly kind: 'WorkspaceRelativeURI'
    readonly uri: string
}

export interface FileName {
    readonly kind: 'FileName'
    readonly uri: string
}

export type URI = CompleteURI | PackageRelativeURI | WorkspaceRelativeURI | FileName
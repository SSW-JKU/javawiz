export interface OuterClassWithoutPackage {
    readonly kind: 'OuterClassWithoutPackage'
    readonly className: string
}

export interface OuterClassWithPackage {
    readonly kind: 'OuterClassWithPackage'
    readonly className: string
}

export interface InnerClassWithPackageAndDollar {
    readonly kind: 'InnerClassWithPackageAndDollar'
    readonly className: string
}

export interface InnerClassWithDollar {
    readonly kind: 'InnerClassWithDollar'
    readonly className: string
}

export interface InnerClassWithPackageAndDot {
    readonly kind: 'InnerClassWithPackageAndDot'
    readonly className: string
}

export interface InnerClassWithDot {
    readonly kind: 'InnerClassWithDot'
    readonly className: string
}

export type ClassName = OuterClassWithoutPackage | OuterClassWithPackage |
                        InnerClassWithDollar | InnerClassWithPackageAndDollar |
                        InnerClassWithPackageAndDot | InnerClassWithDot
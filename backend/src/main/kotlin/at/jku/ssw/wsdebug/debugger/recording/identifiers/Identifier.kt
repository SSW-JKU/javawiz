package at.jku.ssw.wsdebug.debugger.recording.identifiers

data class OuterClassWithoutPackage(override val className: String): ClassName

data class OuterClassWithPackage(override val className: String): ClassName

data class InnerClassWithPackageAndDollar(override val className: String): ClassName

data class InnerClassWithDollar(override val className: String): ClassName

data class InnerClassWithPackageAndDot(override val className: String): ClassName

data class InnerClassWithDot(override val className: String): ClassName

data class MethodNameWithoutParamList(override val name: String): MethodName

data class MethodNameWithEmptyParamList(override val name: String): MethodName

data class MethodNameWithParamList(override val name: String): MethodName

data class CompleteURI(override val uri: String): URIName

data class PackageRelativeURI(override val uri: String): URIName

data class WorkspaceRelativeURI(override val uri: String): URIName

data class FileName(override val uri: String): URIName
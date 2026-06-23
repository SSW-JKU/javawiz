package at.jku.ssw.wsdebug.debugger.recording.identifiers

fun getMethodName (name: String): MethodName {
    if (name.contains("(")) {
        if (name.contains("()")) {
            return MethodNameWithEmptyParamList(name)
        } else {
            return MethodNameWithParamList(name)
        }
    } else {
        return MethodNameWithoutParamList(name)
    }
}

fun areEqualWrapperTypes (firstName: MethodName, secondName: MethodName): Boolean {
    return firstName.kind == secondName.kind
}

fun areEqualMethods (firstMeth: MethodName, secondMeth: MethodName): Boolean {
    return if (areEqualWrapperTypes(firstMeth, secondMeth)) {
        firstMeth.name == secondMeth.name
    } else {
        when (firstMeth.kind) {
            "MethodNameWithEmptyParamList" -> firstMeth.name == getMethodNameWithEmptyParamList(secondMeth).name
            "MethodNameWithoutParamList" -> firstMeth.name == getMethodNameWithoutParamList(secondMeth).name
            else -> secondMeth.name == getMethodNameWithEmptyParamList(firstMeth).name || secondMeth.name == getMethodNameWithoutParamList(firstMeth).name
        }
    }
}

fun getMethodNameWithEmptyParamList (meth: MethodName): MethodName {
    return when (meth.kind) {
        "MethodNameWithEmptyParamList" -> meth
        "MethodNameWithoutParamList" -> MethodNameWithEmptyParamList(meth.name + "()")
        else -> MethodNameWithEmptyParamList(meth.name.substring(0, meth.name.indexOf("(")) + "()")
    }
}

fun getMethodNameWithoutParamList (meth: MethodName): MethodName {
    return when (meth.kind) {
        "MethodNameWithoutParamList" -> meth
        else -> MethodNameWithoutParamList(meth.name.substring(0, meth.name.indexOf("(")))
    }
}

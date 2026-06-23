package at.jku.ssw.wsdebug.debugger.recording.identifiers

fun getClassName (className: String): ClassName {
    val flag = className.length > 0 && className.get(0).isLowerCase()
    val idx = className.lastIndexOf(".")
    if (idx != -1) {
        val substring = className.substring(0, idx)
        if (!className.contains("$") && className.get(substring.lastIndexOf(".") + 1).isLowerCase()) {
            return if (flag) OuterClassWithPackage(className) else OuterClassWithoutPackage(className)
        } else if (!className.contains("$") && className.get(substring.lastIndexOf(".") + 1).isUpperCase()) {
            return if (flag) InnerClassWithPackageAndDot(className) else InnerClassWithDot(className)
        } else {
            return if (flag) InnerClassWithPackageAndDollar(className) else InnerClassWithDollar(className)
        }
    }
    return if (!flag && className.contains("$")) InnerClassWithDollar(className) else OuterClassWithoutPackage(className)
}

fun areEqualWrapperTypes (firstName: ClassName, secondName: ClassName): Boolean {
    return firstName.kind == secondName.kind
}

fun areEqualClassNames (firstClass: ClassName, secondClass: ClassName): Boolean {
    return if (areEqualWrapperTypes(firstClass, secondClass)) {
        firstClass.className == secondClass.className
    } else {
        when (firstClass.kind) {
            "OuterClassWithoutPackage" -> firstClass.className == getOuterClassWithoutPackage(secondClass).className
            "InnerClassWithDollar" -> getInnerClassWithDollar(secondClass)?.className == firstClass.className
            "InnerClassWithDot" -> getInnerClassWithDot(secondClass)?.className == firstClass.className
            else -> secondClass.className == getOuterClassWithoutPackage(firstClass).className ||
                    getInnerClassWithDollar(firstClass)?.className == secondClass.className ||
                    getInnerClassWithDot(firstClass)?.className == secondClass.className
        }
    }
}

fun getOuterClassWithoutPackage (clazz: ClassName): ClassName {
    return when (clazz.kind) {
        "OuterClassWithoutPackage" -> clazz
        "OuterClassWithPackage" -> OuterClassWithoutPackage(clazz.className.substringAfterLast('.'))
        else -> {
            val name = if (clazz.kind!!.contains("Dollar")) {
                clazz.className.substringAfterLast('.').substringBefore('$')
            } else {
                clazz.className.substringBeforeLast('.').substringAfterLast('.')
            }
            OuterClassWithoutPackage(name)
        }
    }
}

fun getInnerClassWithDollar (clazz: ClassName): ClassName? {
    return when (clazz.kind) {
        "InnerClassWithDollar" -> clazz
        "InnerClassWithDot" -> InnerClassWithDollar(clazz.className.replace('.', '$'))
        else -> {
            for (i in clazz.className.indices) {
                if (clazz.className[i] == '.' && i + 1 < clazz.className.length && clazz.className[i + 1].isUpperCase()) {
                    val name = clazz.className.substring(i + 1)
                    return InnerClassWithDollar(if (name.contains('$')) name else name.replace('.', '$'))
                }
            }
            null
        }
    }
}

fun getInnerClassWithDot (clazz: ClassName): ClassName? {
    return when (clazz.kind) {
        "InnerClassWithDot" -> clazz
        "InnerClassWithDollar" -> InnerClassWithDot(clazz.className.replace('$', '.'))
        else -> {
            for (i in clazz.className.indices) {
                if (clazz.className[i] == '.' && i + 1 < clazz.className.length && clazz.className[i + 1].isUpperCase()) {
                    val name = clazz.className.substring(i + 1)
                    return InnerClassWithDot(if (name.contains('$')) name.replace('$', '.') else name)
                }
            }
            null
        }
    }
}
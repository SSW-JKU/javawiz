package at.jku.ssw.wsdebug

fun outerClassMatchesOuterClassPattern(s: String, internalClassPatterns: List<String>): Boolean {
    return internalClassPatterns.any { pattern ->
        val outerClass = s.split("$").first()
        val outerClassPattern = pattern.split("$").first()
        when (val i = outerClassPattern.indexOf('*')) {
            -1 -> outerClass == outerClassPattern
            0 -> outerClass.endsWith(outerClassPattern.substring(1))
            else -> if (i == outerClassPattern.length - 1) outerClass.startsWith(outerClassPattern.substring(0, outerClassPattern.length - 1)) else error("glob at " +
                    "beginning or end " +
                    "expected")
        }
    }
}

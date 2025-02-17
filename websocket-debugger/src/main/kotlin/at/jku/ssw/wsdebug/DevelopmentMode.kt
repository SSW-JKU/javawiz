package at.jku.ssw.wsdebug

const val DEVELOPMENT_MODE = false

fun printlnDev(s : String) {
    if(DEVELOPMENT_MODE) {
        println(s)
    }
}

fun printDev(s : String) {
    if(DEVELOPMENT_MODE) {
        print(s)
    }
}
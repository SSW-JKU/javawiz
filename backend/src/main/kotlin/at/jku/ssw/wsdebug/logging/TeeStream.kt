package at.jku.ssw.wsdebug.logging

import java.io.PrintStream

class TeeStream(mainOut: PrintStream, val teeOut: PrintStream) : PrintStream(mainOut) {
    override fun write(buf: ByteArray, off: Int, len: Int) {
        try {
            super.write(buf, off, len)
            teeOut.write(buf, off, len)
        } catch (e: Exception) {
        }
    }

    override fun flush() {
        super.flush()
        teeOut.flush()
    }
}
package at.jku.ssw.wsdebug.compilation.ast;

import java.util.UUID

interface Unique {
        val uuid: UUID get() = UUID.randomUUID()
}
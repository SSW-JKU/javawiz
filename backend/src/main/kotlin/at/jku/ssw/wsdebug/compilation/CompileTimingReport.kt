package at.jku.ssw.wsdebug.compilation

class CompileTimingReport {
    private sealed interface TimingEntry {
        fun render(indent: Int): List<String>
    }

    private data class TimingLine(val message: String) : TimingEntry {
        override fun render(indent: Int): List<String> = listOf("${" ".repeat(indent * 2)}$message")
    }

    private data class TimingBlock(val summary: String, val children: List<TimingEntry>) : TimingEntry {
        override fun render(indent: Int): List<String> =
            listOf("${" ".repeat(indent * 2)}$summary") + children.flatMap { it.render(indent + 1) }
    }

    private data class OpenTimingBlock(
        val title: String,
        val startedAt: Long,
        val children: MutableList<TimingEntry> = mutableListOf()
    )

    private val start = System.currentTimeMillis()
    private val entries = mutableListOf<TimingEntry>()
    private val openBlocks = mutableListOf<OpenTimingBlock>()

    fun elapsed(from: Long): Long = System.currentTimeMillis() - from

    fun now(): Long = System.currentTimeMillis()

    fun add(message: String) {
        addEntry(TimingLine(message))
    }

    fun openBlock(title: String) {
        openBlocks.add(OpenTimingBlock(title, now()))
    }

    fun closeBlock(details: String = "") {
        val block = openBlocks.removeLast()
        val suffix = details.takeIf { it.isNotBlank() }?.let { " $it" } ?: ""
        addEntry(TimingBlock("${block.title}: ${elapsed(block.startedAt)}ms$suffix", block.children.toList()))
    }

    fun printWithTotal() {
        while (openBlocks.isNotEmpty()) {
            closeBlock("(incomplete)")
        }
        val lines = listOf(
            "[compile timing] Analysis of time spent in compilation phases:",
            "[compile timing] total: ${elapsed(start)}ms"
        ) + entries.flatMap { entry ->
            entry.render(0).map { "[compile timing] $it" }
        }
        println(lines.joinToString(System.lineSeparator()))
    }

    private fun addEntry(entry: TimingEntry) {
        if (openBlocks.isEmpty()) {
            entries.add(entry)
        } else {
            openBlocks.last().children.add(entry)
        }
    }
}

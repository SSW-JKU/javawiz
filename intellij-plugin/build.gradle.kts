import java.util.Properties
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.3.0"
    id("org.jetbrains.intellij.platform") version "2.18.1"
    kotlin("plugin.serialization") version "2.3.0"
}

group = "at.jku.ssw"
version = "2.2.0"

fun htmlEscape(value: String): String =
    value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")
        .replace("$", "&#36;")

fun renderIntellijChangeNotes(): String {
    val notesFile = rootProject.file("CHANGELOG.md")
    val links = """
        <p>
            <a href="https://github.com/SSW-JKU/javawiz/releases">GitHub releases</a>
            &middot;
            <a href="https://javawiz.net/">JavaWiz website</a>
        </p>
    """.trimIndent()

    if (!notesFile.isFile) {
        return links
    }

    val issueLine = Regex("""^\*\s+(JW-\d+):\s*(.+)$""")
    val versionLine = Regex("""^\[([^]]+)]\s+\((.+)\)$""")
    val changelog = buildString {
        var listOpen = false

        fun closeList() {
            if (listOpen) {
                appendLine("</ul>")
                listOpen = false
            }
        }

        notesFile.forEachLine { rawLine ->
            val line = rawLine.trim()
            when {
                line.isEmpty() || line == "# CHANGELOG.md" -> closeList()

                versionLine.matches(line) -> {
                    closeList()
                    val match = versionLine.matchEntire(line)!!
                    appendLine("<h2>${htmlEscape(match.groupValues[1])}</h2>")
                    appendLine("<p>${htmlEscape(match.groupValues[2])}</p>")
                }

                issueLine.matches(line) -> {
                    if (!listOpen) {
                        appendLine("<ul>")
                        listOpen = true
                    }
                    val match = issueLine.matchEntire(line)!!
                    val issueId = match.groupValues[1]
                    val summary = htmlEscape(match.groupValues[2])
                    appendLine("""<li><a href="https://javawiz.youtrack.cloud/issue/$issueId">$issueId</a>: $summary</li>""")
                }

                else -> {
                    closeList()
                    appendLine("<p>${htmlEscape(line)}</p>")
                }
            }
        }

        closeList()
    }

    return "$links\n$changelog"
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    val junitVersion = "6.1.3"

    // Ktor embedded HTTP + WebSocket server
    implementation("io.ktor:ktor-server-core:2.3.4")
    implementation("io.ktor:ktor-server-netty:2.3.4")
    implementation("io.ktor:ktor-server-host-common:2.3.4")
    implementation("io.ktor:ktor-server-websockets:2.3.4")

    // Kotlin stdlib + serialization
    implementation(kotlin("stdlib"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // SLF4J binding (suppresses "No SLF4J providers found" at runtime)
    implementation("org.slf4j:slf4j-simple:2.0.9")

    // Keep Jupiter and its Platform launcher aligned as one explicit, reviewable JUnit release.
    testImplementation(platform("org.junit:junit-bom:$junitVersion"))
    testImplementation(kotlin("test-junit5"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // IntelliJ's JUnit 5 listener still loads JUnit 4 TestCase/TestRule types at runtime:
    // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-faq.html#junit5-test-framework-refers-to-junit4
    // https://youtrack.jetbrains.com/issue/IJPL-159134/JUnit5-Test-Framework-refers-to-JUnit4-java.lang.NoClassDefFoundError-junit-framework-TestCase
    // https://github.com/JetBrains/intellij-platform-gradle-plugin/issues/1711
    // BasePlatformTestCase also exposes TestCase at compile time, so this must be testImplementation:
    // https://github.com/JetBrains/intellij-platform-gradle-plugin/issues/1976
    testImplementation("junit:junit:4.13.2")

    // IntelliJ Platform
    intellijPlatform {
        // Target IntelliJ IDEA 2026.2.1 (unified distribution — IC no longer exists for 2025.3+)
        intellijIdea("2026.2.1")

        // Use the actual bundled plugin ID, not its legacy `java` directory name:
        // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-faq.html#migrateToPluginId
        bundledPlugin("com.intellij.java")

        // IntelliJ 2026.2 isolates JCEF into content modules that must be declared explicitly.
        bundledModule("intellij.platform.ui.jcef")
        bundledModule("intellij.libraries.jcef")

        // Declare every framework used by the headless model-level tests explicitly:
        // https://plugins.jetbrains.com/docs/intellij/tests-and-fixtures.html
        pluginVerifier()
        zipSigner()
        testFramework(TestFrameworkType.Platform)
        testFramework(TestFrameworkType.JUnit5)
        // Java PSI fixtures require the Java plugin's dedicated test framework:
        // https://plugins.jetbrains.com/docs/intellij/light-and-heavy-tests.html#plugins-using-java-psi
        testFramework(TestFrameworkType.Plugin.Java)
    }
}

// IDEA's test framework supplies a JetBrains-patched coroutine core. Avoid shadowing it with
// Ktor's ordinary Maven variant while leaving the plugin's production runtime unchanged.
configurations.testRuntimeClasspath {
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-coroutines-core-jvm")
    // IntelliJ 2026.2's bundled plugins use newer serialization APIs. Keep the test JVM on
    // the platform-provided serialization implementation instead of the plugin's runtime copy.
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-serialization-core-jvm")
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-serialization-json-jvm")
}

intellijPlatform {
    pluginConfiguration {
        name = "JavaWiz"
        version = project.version.toString()

        ideaVersion {
            sinceBuild = "262"
            // untilBuild is intentionally left unset — the plugin supports all future builds
        }

        changeNotes = renderIntellijChangeNotes()
    }

    signing {
        certificateChain.set(providers.environmentVariable("CERTIFICATE_CHAIN"))
        privateKey.set(providers.environmentVariable("PRIVATE_KEY"))
        password.set(providers.environmentVariable("PRIVATE_KEY_PASSWORD"))
    }

    publishing {
        token.set(providers.environmentVariable("PUBLISH_TOKEN"))
    }

    pluginVerification {
        ides {
            create(IntelliJPlatformType.IntellijIdeaUltimate, "2026.2.1")
        }
    }
}

// ---------------------------------------------------------------------------
// Build-time resource injection (mirrors vsc-extension/build.gradle)
// ---------------------------------------------------------------------------

val copyBackendToIntellijPlugin by tasks.registering(Copy::class) {
    // Use :backend:assemble instead of :backend:build to avoid running backend tests during runIde.
    // assemble produces the JAR and runtime libs without invoking check/test.
    // Tests still run when buildPlugin or :backend:build is invoked directly.
    dependsOn(":backend:assemble")
    from("${rootDir}/backend/build/") {
        include("libs/**/*")
        include("resources/main/additionalclasses/*.java")
    }
    into("${projectDir}/src/main/resources/Backend")
    doLast {
        println("Copied backend artefacts to ${destinationDir}")
    }
}

val copyFrontendToIntellijPlugin by tasks.registering(Copy::class) {
    dependsOn(":frontend:build")
    from("${rootDir}/frontend/dist/")
    into("${projectDir}/src/main/resources/Frontend")
    doLast {
        println("Copied frontend artefacts to ${destinationDir}")
    }
}

tasks {
    processTestResources {
        // Light fixture tests reuse one application and do not exercise the execution UI.
        // Loading JWExecutor there registers its global context action twice, which Jupiter's
        // uncaught-exception extension correctly reports. Keep every other plugin extension.
        val testPluginDescriptor = layout.buildDirectory.file("resources/test/META-INF/plugin.xml")
        doLast {
            val descriptor = testPluginDescriptor.get().asFile
            val retainedLines = descriptor.readLines().filterNot {
                "at.jku.ssw.javawiz.intellij.action.JWExecutor" in it
            }
            descriptor.writeText(retainedLines.joinToString(System.lineSeparator(), postfix = System.lineSeparator()))
        }
    }

    test {
        useJUnitPlatform()
    }

    // Disable buildSearchableOptions — the plugin adds no settings entries, and the task
    // is incompatible with the coroutines-javaagent on IntelliJ 2026+ classloaders.
    named("buildSearchableOptions") { enabled = false }

    // `processResources` is Gradle's standard task for copying files from `src/main/resources`
    // into `build/resources/main`, from where they are later included in the plugin JAR.
    //
    // In addition to copying the files, this task performs three build-time transformations:
    // 1. Copy the JavaWiz logo into the location and filenames expected by JetBrains.
    // 2. Write the actual backend JAR filename into the copied config.properties.
    // 3. Replace `${placeholder}` tokens in the copied plugin.xml with values from
    //    config.properties.
    //
    // These transformations affect only generated files below `build/`; the source files in
    // `src/main/resources` remain unchanged.
    processResources {
        // Read the shared release version once while Gradle configures the task. The copy filters
        // below receive this plain String instead of retaining a reference to the Gradle project,
        // which allows the configured task graph to be stored and reused.
        val resourceVersion = project.version.toString()

        // The frontend and backend must be built and copied into src/main/resources before
        // Gradle processes that directory. `dependsOn` establishes this task ordering.
        dependsOn(copyBackendToIntellijPlugin, copyFrontendToIntellijPlugin)

        // `from` adds an extra file to the resources copied by this task. JetBrains discovers
        // plugin logos only when they are stored in META-INF with these exact filenames.
        //
        // The black logo is used on light backgrounds. `into` selects its directory inside the
        // generated resources tree, while `rename` changes only the copied file's name.
        from(rootProject.file("docs/img/wizard-hat-black.svg")) {
            into("META-INF")
            rename { "pluginIcon.svg" }

            // `filter` is called once for every line copied from the SVG. The source artwork uses
            // 512pt dimensions; JetBrains requires plugin logos to declare a size of 40 × 40.
            filter { line ->
                line.replace("height=\"512pt\"", "height=\"40\"")
                    .replace("width=\"512pt\"", "width=\"40\"")
            }
        }

        // The white variant is packaged under JetBrains' conventional dark-theme filename.
        from(rootProject.file("docs/img/wizard-hat.svg")) {
            into("META-INF")
            rename { "pluginIcon_dark.svg" }
            filter { line ->
                line.replace("height=\"512pt\"", "height=\"40\"")
                    .replace("width=\"512pt\"", "width=\"40\"")
            }
        }

        // `filesMatching` applies the enclosed transformation only to copied files whose relative
        // path matches this glob. As above, `filter` examines the file line by line.
        //
        // Replace version-dependent configuration values with the common JavaWiz suite version.
        // This keeps the generated configuration synchronized without modifying the source file.
        filesMatching("**/Config/config.properties") {
            filter { line ->
                when {
                    line.startsWith("backendJarName=") ->
                        "backendJarName=libs/backend-$resourceVersion.jar"
                    line.startsWith("pluginVersion=") ->
                        "pluginVersion=$resourceVersion"
                    else -> line
                }
            }
        }

        // plugin.xml contains `${placeholder}` entries whose values live in config.properties.
        // `fileContents` tells Gradle that the properties file is an input to task configuration,
        // so changing it invalidates the configuration cache. Java Properties uses generic key
        // and value types; the final conversion produces the String-keyed map expected by expand.
        val propertiesMap = providers.fileContents(
            layout.projectDirectory.file("src/main/resources/Config/config.properties")
        ).asText.map { contents ->
            Properties().apply {
                contents.reader().use { load(it) }
            }.map { it.key.toString() to it.value }.toMap()
        }.get()

        // Apply that map only to the generated plugin.xml copy. Source resources are unchanged.
        filesMatching("**/plugin.xml") {
            expand(propertiesMap)
        }
    }

    withType<JavaCompile> {
        sourceCompatibility = "21"
        targetCompatibility = "21"
    }
}

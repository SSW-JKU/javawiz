import java.util.Properties
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.3.0"
    id("org.jetbrains.intellij.platform") version "2.19.0"
    kotlin("plugin.serialization") version "2.3.0"
}

group = "at.jku.ssw"
version = "2.4.2"

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
            <a href="https://javawiz.net/changelog.html">Full changelog</a>
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

        // Marketplace descriptors cap change-notes at 65,535 characters. Include the
        // newest release here and link to the complete history instead of growing forever.
        var releaseStarted = false
        for (rawLine in notesFile.readLines()) {
            val line = rawLine.trim()
            if (versionLine.matches(line)) {
                if (releaseStarted) break
                releaseStarted = true
            }
            if (!releaseStarted) continue
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
    // The plugin runs on the kotlinx-coroutines that ship with the IDE. Use a Ktor release built
    // against the coroutines version of the oldest supported IDE (IDEA 2026.2: coroutines 1.10.2).
    // A Ktor built against newer coroutines may call methods that the IDE's copy does not have.
    val ktorVersion = "3.4.3"

    // Ktor embedded HTTP + WebSocket server
    implementation("io.ktor:ktor-server-core:$ktorVersion")
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-host-common:$ktorVersion")
    implementation("io.ktor:ktor-server-websockets:$ktorVersion")

    // Kotlin stdlib + serialization
    implementation(kotlin("stdlib"))
    // Matches the version that Ktor 3.4.3 requires; Gradle would otherwise resolve to it silently.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

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

        // Without a version, Gradle downloads the newest published Plugin Verifier. New Verifier
        // releases add compatibility checks for new IDEs, so this is intentionally not pinned.
        // The selected version is printed at the start of verifyPlugin.
        pluginVerifier()
        zipSigner()
        // Declare every framework used by the headless model-level tests explicitly:
        // https://plugins.jetbrains.com/docs/intellij/tests-and-fixtures.html
        testFramework(TestFrameworkType.Platform)
        testFramework(TestFrameworkType.JUnit5)
        // Java PSI fixtures require the Java plugin's dedicated test framework:
        // https://plugins.jetbrains.com/docs/intellij/light-and-heavy-tests.html#plugins-using-java-psi
        testFramework(TestFrameworkType.Plugin.Java)
    }
}

// These exclusions affect only the test JVM. The sandbox and the plugin ZIP are packaged from the
// runtime classpath and are not changed by them.
//
// IDEA's test framework supplies a JetBrains-patched coroutine core. Avoid shadowing it with
// Ktor's ordinary Maven variant while leaving the plugin's production runtime unchanged.
configurations.testRuntimeClasspath {
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-coroutines-core-jvm")
    // IntelliJ 2026.2's bundled plugins use newer serialization APIs. Keep the test JVM on
    // the platform-provided serialization implementation instead of the plugin's runtime copy.
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-serialization-core-jvm")
    exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-serialization-json-jvm")
}

// printProductsReleases lists IDE releases from JetBrains' online release list, which Gradle caches
// for one day. Limit it to stable IntelliJ IDEA releases from the minimum supported build (262) on.
// EAP and RC builds are left out on purpose: they are not finished releases and change often.
tasks.printProductsReleases {
    channels = listOf(ProductRelease.Channel.RELEASE)
    types = listOf(IntelliJPlatformType.IntellijIdeaUltimate)
}

// The newest stable IntelliJ IDEA version, for example "2026.3". The task property used here is
// the list the task would print, such as ["IU-2026.3", "IU-2026.2.5"]. Versions are compared
// number by number, so that "2026.10" counts as newer than "2026.9".
val latestStableIdea = tasks.printProductsReleases.flatMap { it.productsReleases }.map { releases ->
    releases.map { it.substringAfter('-') }.maxBy { version ->
        version.split('.').map(String::toInt).plus(listOf(0, 0, 0)).take(3)
            .fold(0L) { combined, part -> combined * 10_000 + part }
    }
}

// Testing and verification check the plugin in two different ways. Both run against the oldest
// supported and the newest stable IntelliJ IDEA:
//
// - Testing (`test`, `testLatestStableIde`) runs the plugin's JUnit tests in src/test. The tests
//   start a real IntelliJ IDEA without a window and execute plugin code in it, so they check what
//   the plugin does, for example which line gets highlighted. They only find problems in code
//   that a test executes.
// - Verification (`verifyPluginStructure`, `verifyPlugin`, configured in `pluginVerification`
//   below) executes no plugin code. `verifyPluginStructure` checks plugin.xml and the layout of the
//   plugin ZIP. `verifyPlugin` runs JetBrains' Plugin Verifier, which reads the compiled classes and
//   checks every IntelliJ API they use against each IDE: whether it still exists, and whether it is
//   internal or deprecated. It covers all plugin code, including code no test executes, but it
//   cannot tell whether the plugin behaves correctly.
//
// `testLatestStableIde` runs the same tests as `test`, but against the newest stable IntelliJ IDEA
// instead of the version the plugin is compiled against. This shows early when a new IDE release
// breaks the plugin. Test frameworks and bundled plugins must be declared again here: JetBrains
// matches their versions to this IDE, not to the one used for compiling.
intellijPlatformTesting {
    testIde {
        register("testLatestStableIde") {
            type = IntelliJPlatformType.IntellijIdeaUltimate
            version = latestStableIdea
            plugins {
                bundledPlugin("com.intellij.java")
                bundledModule("intellij.platform.ui.jcef")
                bundledModule("intellij.libraries.jcef")
            }
            testFrameworks(
                TestFrameworkType.Platform,
                TestFrameworkType.JUnit5,
                TestFrameworkType.Plugin.Java,
            )
        }
    }
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
        token.set(providers.environmentVariable("INTELLIJ_PUBLISH_TOKEN"))
    }

    // Configures `verifyPlugin`; see the comparison of testing and verification above
    // `intellijPlatformTesting`. With the default failure levels, compatibility problems and use of
    // internal or override-only APIs fail the build. Deprecated API use is only reported.
    pluginVerification {
        ides {
            // The minimum supported version, which the plugin is compiled against
            create(IntelliJPlatformType.IntellijIdeaUltimate, "2026.2.1")
            // The newest stable version, to find problems with new IDE releases early
            create(IntelliJPlatformType.IntellijIdeaUltimate, latestStableIdea)
        }
    }
}

// ---------------------------------------------------------------------------
// Build-time resource injection (mirrors vsc-extension/build.gradle)
// ---------------------------------------------------------------------------

// These directories contain only generated assets. Sync removes old versioned JARs and
// hashed frontend files, which Copy retains even after the root clean task.
val copyBackendToIntellijPlugin by tasks.registering(Sync::class) {
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

val copyFrontendToIntellijPlugin by tasks.registering(Sync::class) {
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
        //
        // The tests load this copy of plugin.xml in addition to the main one. An action with a fixed
        // ID would be registered twice and fail every test, so drop ThrowTestException here too.
        // (DebugWithJavaWiz is not affected: its ID is a placeholder that this copy leaves unreplaced.)
        val testPluginDescriptor = layout.buildDirectory.file("resources/test/META-INF/plugin.xml")
        doLast {
            val descriptor = testPluginDescriptor.get().asFile
            val retainedLines = descriptor.readLines().filterNot { line ->
                "at.jku.ssw.javawiz.intellij.action.JWExecutor" in line ||
                    "at.jku.ssw.javawiz.intellij.action.ThrowTestException" in line
            }
            descriptor.writeText(retainedLines.joinToString(System.lineSeparator(), postfix = System.lineSeparator()))
        }
    }

    // Applies to `test` and to `testLatestStableIde`, which run the same tests against different IDEs.
    withType<Test>().configureEach {
        // Model-level tests need no display. Force headless AWT even on desktop Linux:
        // otherwise Wayland starts a persistent keyboard timer that fails thread-leak checks.
        systemProperty("java.awt.headless", "true")
        // JavaWiz services extract files into ~/javawiz-intellij/<version> and delete other version
        // folders there. Give the test JVM its own home directory under build/ so tests never touch
        // a developer's installed plugin files.
        systemProperty("user.home", layout.buildDirectory.dir("test-home").get().asFile.absolutePath)
        // IntelliJ tests may only read files below known folders, among them `<user.home>/.gradle`.
        // After moving user.home, add the real Gradle user home back so the test project can still
        // read libraries from the Gradle cache. Several folders would be joined with the path separator.
        systemProperty("vfs.additional-allowed-roots", gradle.gradleUserHomeDir.absolutePath)
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
        // and value types; convert both to strings for literal placeholder substitution.
        val propertiesMap = providers.fileContents(
            layout.projectDirectory.file("src/main/resources/Config/config.properties")
        ).asText.map { contents ->
            Properties().apply {
                contents.reader().use { load(it) }
            }.map { it.key.toString() to it.value.toString() }.toMap()
        }.get()

        // Apply that map only to the generated plugin.xml copy. Source resources are unchanged.
        filesMatching("**/plugin.xml") {
            // expand() compiles the entire descriptor as one Groovy template. A growing
            // changelog can exceed the JVM's 65,535-byte string constant limit. Filtering
            // lines substitutes our simple placeholders without compiling release notes.
            filter { line ->
                Regex("""\$\{([^}]+)}""").replace(line) { match ->
                    propertiesMap[match.groupValues[1]] ?: match.value
                }
            }
        }
    }

    withType<JavaCompile> {
        sourceCompatibility = "21"
        targetCompatibility = "21"
    }
}

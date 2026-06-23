import java.util.Properties
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.3.0"
    id("org.jetbrains.intellij.platform") version "2.16.0"
    kotlin("plugin.serialization") version "2.3.0"
}

group = "at.jku.ssw"
version = "2.0.0"

fun htmlEscape(value: String): String =
    value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

fun renderIntellijChangeNotes(): String {
    val notesFile = rootProject.file("NEWLY_RESOLVED_ISSUES.md")
    if (!notesFile.isFile) {
        return "<p>See CHANGELOG.md for release notes.</p>"
    }

    val issueLine = Regex("""^\*\s+(JW-\d+):\s*(.+)$""")
    val items = notesFile.readLines()
        .mapNotNull { line -> issueLine.matchEntire(line.trim()) }
        .map { match ->
            val issueId = match.groupValues[1]
            val summary = htmlEscape(match.groupValues[2])
            """<li><a href="https://javawiz.youtrack.cloud/issue/$issueId">$issueId</a>: $summary</li>"""
        }

    return if (items.isEmpty()) {
        "<p>See CHANGELOG.md for release notes.</p>"
    } else {
        items.joinToString(separator = "\n", prefix = "<ul>\n", postfix = "\n</ul>")
    }
}

kotlin {
    jvmToolchain(21)
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
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

    // IntelliJ Platform
    intellijPlatform {
        // Target IntelliJ IDEA 2026.1.1 (unified distribution — IC no longer exists for 2025.3+)
        intellijIdea("2026.1.1")

        // Bundled plugins required at runtime
        bundledPlugin("com.intellij.java")

        // Plugin verifier + test framework
        pluginVerifier()
        zipSigner()
        testFramework(TestFrameworkType.Platform)
    }
}

intellijPlatform {
    pluginConfiguration {
        name = "JavaWiz"
        version = project.version.toString()

        ideaVersion {
            sinceBuild = "253"
            // untilBuild is intentionally left unset — the plugin supports all future builds
        }

        changeNotes = renderIntellijChangeNotes()
    }

    signing {
        certificateChain = System.getenv("CERTIFICATE_CHAIN")
        privateKey = System.getenv("PRIVATE_KEY")
        password = System.getenv("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = System.getenv("PUBLISH_TOKEN")
    }

    pluginVerification {
        ides {
            create(IntelliJPlatformType.IntellijIdeaUltimate, "2026.1.1")
        }
    }
}

// ---------------------------------------------------------------------------
// Build-time resource injection (mirrors vsc-extension/build.gradle)
// ---------------------------------------------------------------------------

// Resolve the backend project version so we can name the JAR correctly
// in config.properties without hard-coding it here.
val backendVersion: String by lazy {
    val backendProps = file("${rootDir}/backend/build.gradle").readText()
    Regex("""(?m)^version\s*=\s*['"](.+?)['"]""").find(backendProps)?.groupValues?.get(1)
        ?: error("Could not determine backend version from backend/build.gradle")
}

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
    // Disable buildSearchableOptions — the plugin adds no settings entries, and the task
    // is incompatible with the coroutines-javaagent on IntelliJ 2026+ classloaders.
    named("buildSearchableOptions") { enabled = false }

    // Replace ${placeholder} tokens in plugin.xml with values from config.properties at build time.
    // Also stamps the resolved backendJarName into the output config.properties so it matches
    // the actual backend JAR version without requiring a manual update.
    processResources {
        dependsOn(copyBackendToIntellijPlugin, copyFrontendToIntellijPlugin)
        notCompatibleWithConfigurationCache("Uses properties loaded at runtime")

        // Rewrite backendJarName in the output config.properties to match the actual backend version.
        filesMatching("**/Config/config.properties") {
            filter { line ->
                if (line.startsWith("backendJarName=")) "backendJarName=libs/backend-${backendVersion}.jar"
                else line
            }
        }

        doFirst {
            val properties = Properties().apply {
                file("src/main/resources/Config/config.properties").inputStream().use { load(it) }
            }
            // Override backendJarName with the version resolved from backend/build.gradle
            properties["backendJarName"] = "libs/backend-${backendVersion}.jar"
            val propertiesMap = properties.map { it.key.toString() to it.value }.toMap()
            filesMatching("**/plugin.xml") {
                expand(propertiesMap)
            }
        }
    }

    withType<JavaCompile> {
        sourceCompatibility = "21"
        targetCompatibility = "21"
    }
}

# Gradle to Java compatibility
See https://docs.gradle.org/current/userguide/compatibility.html.

Set suitable gradle version in `gradle.properties` file.
- e.g., at least `distributionUrl=https\://services.gradle.org/distributions/gradle-7.3-bin.zip` which is the minimum Gradle daemon version that supports Java 17.
- Java 8 can be used to execute all Gradle daemon version.
- For _building_ (not executing the Gradle daemon itself) it is now suggested to use toolchains in `build.gradle`.
    - ```
      java {
        toolchain {
          languageVersion = JavaLanguageVersion.of(18)
        }
      }
      ```
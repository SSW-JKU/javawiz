package at.jku.ssw.javawiz.intellij.components

import com.intellij.openapi.project.Project
import java.util.concurrent.CompletableFuture

abstract class Component(val project: Project) {
  abstract fun start(port : Int): Boolean
  abstract fun stop(): Boolean
  abstract var isRunning: Boolean
  abstract val readyFuture: CompletableFuture<Boolean> // Future that completes when the component is ready
}
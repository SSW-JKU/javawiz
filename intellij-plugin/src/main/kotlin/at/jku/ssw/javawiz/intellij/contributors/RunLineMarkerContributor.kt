package at.jku.ssw.javawiz.intellij.contributors

import at.jku.ssw.javawiz.intellij.general.Globals
import com.intellij.execution.lineMarker.RunLineMarkerContributor
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.psi.PsiArrayType
import com.intellij.psi.PsiClass
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiIdentifier
import com.intellij.psi.PsiMethod
import com.intellij.psi.PsiModifier
import com.intellij.psi.PsiTypes
import com.intellij.psi.util.PsiMethodUtil
import com.intellij.psi.util.PsiUtil
import com.intellij.pom.java.LanguageLevel

// https://intellij-support.jetbrains.com/hc/en-us/community/posts/10224936830994-Register-my-custom-runner-and-executor-for-creating-a-new-run-configuration
internal class RunLineMarkerContributor : RunLineMarkerContributor() {
  override fun getInfo(element: PsiElement): Info? {
    if (isJavaWizMainIdentifier(element)) {
      val action = ActionManager.getInstance().getAction(Globals.Props.ACTION_ID_RUN)
      val actions: Array<AnAction> = arrayOf(action)
      return Info(action.templatePresentation.icon, actions, null)
    }
    return null
  }
}

/**
 * Reports whether [element] names a Java entry class or candidate main method that should receive
 * the JavaWiz run-line marker. IntelliJ's language-level-aware PSI utility remains the primary
 * authority, with a narrow fallback for Java 25 instance-array main methods it does not recognize.
 */
internal fun isJavaWizMainIdentifier(element: PsiElement): Boolean {
  if (element !is PsiIdentifier) return false

  return when (val declaration = element.parent) {
    is PsiClass -> declaration.methods.any(::isJavaWizMainMethod)
    is PsiMethod -> isJavaWizMainMethod(declaration)
    else -> false
  }
}

/**
 * Reports whether [method] is launchable as a main method by JavaWiz. The platform predicate covers
 * traditional, no-argument, and compact-source forms; the fallback covers its Java 25 gap for an
 * instance method with a `String[]` parameter.
 */
private fun isJavaWizMainMethod(method: PsiMethod): Boolean =
  PsiMethodUtil.isMainMethod(method) || isJava25InstanceArrayMainMethod(method)

/**
 * Recognizes the Java 25 instance `void main(String[])` form missing from IntelliJ 2026.1's main
 * searcher. It also verifies that the containing class can be instantiated by the Java launcher.
 */
private fun isJava25InstanceArrayMainMethod(method: PsiMethod): Boolean {
  if (!PsiUtil.getLanguageLevel(method).isAtLeast(LanguageLevel.JDK_25)) return false
  if (method.name != "main" || method.hasModifierProperty(PsiModifier.STATIC)) return false
  if (method.hasModifierProperty(PsiModifier.PRIVATE) || method.returnType != PsiTypes.voidType()) return false

  val parameterType = method.parameterList.parameters.singleOrNull()?.type as? PsiArrayType ?: return false
  if (!parameterType.componentType.equalsToText("java.lang.String")) return false

  return method.containingClass?.let(::hasLauncherAccessibleConstructor) == true
}

/**
 * Checks the construction constraints for an instance main class: it must be concrete, must not be
 * a non-static inner class, and must expose either an implicit or non-private no-argument constructor.
 */
private fun hasLauncherAccessibleConstructor(psiClass: PsiClass): Boolean {
  if (psiClass.isInterface || psiClass.isAnnotationType || psiClass.hasModifierProperty(PsiModifier.ABSTRACT)) return false
  if (psiClass.containingClass != null && !psiClass.hasModifierProperty(PsiModifier.STATIC)) return false

  val constructors = psiClass.constructors
  return constructors.isEmpty() || constructors.any {
    it.parameterList.isEmpty && !it.hasModifierProperty(PsiModifier.PRIVATE)
  }
}

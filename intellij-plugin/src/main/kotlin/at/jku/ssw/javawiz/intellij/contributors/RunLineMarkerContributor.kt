package at.jku.ssw.javawiz.intellij.contributors

import at.jku.ssw.javawiz.intellij.general.Globals
import com.intellij.execution.lineMarker.RunLineMarkerContributor
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.psi.PsiClass
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiIdentifier
import com.intellij.psi.PsiMethod
import com.intellij.psi.util.PsiMethodUtil

// https://intellij-support.jetbrains.com/hc/en-us/community/posts/10224936830994-Register-my-custom-runner-and-executor-for-creating-a-new-run-configuration
internal class RunLineMarkerContributor : RunLineMarkerContributor() {
  fun isIdentifier(element: PsiElement): Boolean {
    return element is PsiIdentifier
  }

  override fun getInfo(element: PsiElement): Info? {
    if (isIdentifier(element)) {
      val element: PsiElement = element.parent
      if (element is PsiClass && PsiMethodUtil.findMainInClass(element) != null ||
        element is PsiMethod && "main" == element.name && PsiMethodUtil.isMainMethod(element)
      ) {

        val action = ActionManager.getInstance().getAction(Globals.Props.ACTION_ID_RUN)
        val actions: Array<AnAction> = arrayOf(action)
        return Info(action.templatePresentation.icon, actions, null)
      }
    }
    return null
  }
}
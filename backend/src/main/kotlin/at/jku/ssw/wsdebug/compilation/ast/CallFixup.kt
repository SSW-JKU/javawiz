@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.ast

import at.jku.ssw.wsdebug.compilation.ast.lang.MethodCallExpr
import com.sun.tools.javac.code.Symbol
import com.sun.tools.javac.tree.JCTree
import java.util.*
import javax.lang.model.type.ExecutableType
import javax.lang.model.util.Types

// Finds a set of (references to) Method objects that (might) correspond to a given Method Declaration
class CallFixup {
    private val calls = mutableListOf<Pair<MethodCallExpr, Symbol.MethodSymbol>>()
    private val methodsByName = mutableMapOf<String, MutableSet<Pair<UUID, Symbol.MethodSymbol>>>() // index for efficiency

    fun registerMethodOrConstructor(method: JCTree.JCMethodDecl): UUID {
        val uuid = UUID.randomUUID()
        val name = method.name.toString()
        methodsByName.putIfAbsent(name, mutableSetOf())
        methodsByName[method.name.toString()]!! += Pair(uuid, method.sym)
        return uuid
    }

    fun tryRegisterConstructorCall(call: JCTree.JCNewClass, constructorCall: MethodCallExpr) {
        val sym = call.constructor
        if(sym !is Symbol.MethodSymbol) return
        calls += Pair(constructorCall, sym)
    }

    fun tryRegisterCall(call: JCTree.JCMethodInvocation, expr: MethodCallExpr) {
        val sym = when (val select = call.meth) {
            is JCTree.JCFieldAccess -> {
                select.sym
            }
            is JCTree.JCIdent -> {
                select.sym
            }
            else -> {
                error("unknown kind of method invocation")
            }
        }
        if(sym !is Symbol.MethodSymbol) return // no error handling as we deal with resolution errors in later step
        calls += Pair(expr, sym)
    }

    fun resolve(types: Types) {
        calls.forEach { (expression, symbol) ->
            expression.candidates = resolveCall(symbol, types)
        }
    }

    private fun resolveCall(symbol: Symbol.MethodSymbol, types: Types): Set<UUID> {
        val candidates = mutableSetOf<UUID>()
        methodsByName[symbol.name.toString()]?.forEach { (uuid, method) ->
            val surroundingMatch = if (symbol.isStatic || symbol.isConstructor) {
                method.owner.type.equals(symbol.owner.type)
            } else {
                types.isSubtype(method.owner.type, symbol.owner.type)
            }

            val methodType = method.type
            val symbolType = symbol.type
            if(methodType !is ExecutableType || symbolType !is ExecutableType) {
                return@forEach
            }
            if (
                symbol.name.equals(method.name)
                && surroundingMatch
                && types.isSubsignature(methodType, symbolType)
            ) {
                candidates += uuid
            }
        }
        return candidates
    }

}
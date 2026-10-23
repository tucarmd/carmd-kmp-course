package com.example.devicemonitor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ObjCClass
import kotlinx.cinterop.getOriginalKotlinClass
import kotlin.reflect.KClass

// Swift can't pass a KClass, only its Objective-C class. This turns it back into the
// KClass that ViewModelProvider needs. Adapted from Android's KMP ViewModel guide.
@OptIn(BetaInteropApi::class)
@Throws(IllegalArgumentException::class)
fun ViewModelStore.resolveViewModel(
    modelClass: ObjCClass,
    factory: ViewModelProvider.Factory,
): ViewModel {
    @Suppress("UNCHECKED_CAST")
    val vmClass = getOriginalKotlinClass(modelClass) as? KClass<ViewModel>
    require(vmClass != null) { "The modelClass parameter must be a ViewModel type." }
    return ViewModelProvider.create(this, factory)[vmClass]
}

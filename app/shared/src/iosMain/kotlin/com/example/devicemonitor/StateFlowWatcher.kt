package com.example.devicemonitor

import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// Until Lesson 09: lets Swift observe a StateFlow without SKIE. Lesson 09 deletes this file.
class StateFlowWatcher<T : Any>(private val flow: StateFlow<T>) {
    val value: T get() = flow.value

    // Calls onEach on the main thread with the current value, then with every new one,
    // until the returned Watch is cancelled.
    fun watch(onEach: (T) -> Unit): Watch {
        val scope = MainScope()
        scope.launch { flow.collect { onEach(it) } }
        return Watch { scope.cancel() }
    }
}

class Watch(private val onCancel: () -> Unit) {
    fun cancel() = onCancel()
}

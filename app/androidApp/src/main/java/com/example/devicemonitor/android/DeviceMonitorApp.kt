package com.example.devicemonitor.android

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import kotlinx.serialization.Serializable

@Serializable
data object DeviceList

@Serializable
data class DeviceDetail(val id: String)

@Composable
fun DeviceMonitorApp() {
    val navController = rememberNavController()
    Scaffold { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = DeviceList,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable<DeviceList> {
                DeviceListScreen(
                    onDeviceClick = { device -> navController.navigate(DeviceDetail(device.id)) },
                )
            }
            composable<DeviceDetail> { entry ->
                val route: DeviceDetail = entry.toRoute()
                DeviceDetailScreen(
                    deviceId = route.id,
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}

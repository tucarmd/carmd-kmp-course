import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Lesson 04: watch the Xcode console")
                NavigationLink("Open detail screen") {
                    DetailView()
                }
            }
            .navigationTitle("Lifecycle")
            .onAppear { lifecycleLog.notice("ContentView onAppear") }
            .onDisappear { lifecycleLog.notice("ContentView onDisappear") }
        }
    }
}

struct DetailView: View {
    var body: some View {
        Text("Detail screen")
            .onAppear { lifecycleLog.notice("DetailView onAppear") }
            .onDisappear { lifecycleLog.notice("DetailView onDisappear") }
    }
}

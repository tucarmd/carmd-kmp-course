import SwiftUI
import Shared

struct ContentView: View {
    private let greeting = Greeting().greet()

    var body: some View {
        Text(greeting)
            .multilineTextAlignment(.center)
            .padding()
    }
}

// Màn hình duy nhất: chạy Scanner của bài 02 và hiện mỗi state thành một dòng,
// thay cho print() ở bản console.

import SwiftUI

struct ContentView: View {
    @State private var lines: [String] = []   // các dòng đã "in" ra
    @State private var running = false        // đang quét thì khoá nút

    var body: some View {
        NavigationStack {
            List {
                Section("Output (giống swift run)") {
                    ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                        Text(line)
                            .font(.system(.body, design: .monospaced))
                            .accessibilityIdentifier("line-\(index)")
                    }
                }
                Section {
                    Button(running ? "Đang quét…" : "Quét lại") {
                        Task { await runScan() }
                    }
                    .disabled(running)
                    .accessibilityIdentifier("rescan")
                }
            }
            .navigationTitle("Bài 02 · Swift")
        }
        .task { await runScan() }   // mở app là quét một lần
    }

    /// Y hệt code top-level của main.swift, chỉ đổi print(...) thành thêm vào `lines`.
    private func runScan() async {
        running = true
        lines = []
        let scanner = Scanner()
        scanner.onChange = { lines.append(render($0)) }
        lines.append(render(scanner.state))
        await scanner.start()
        running = false
    }
}

#Preview { ContentView() }

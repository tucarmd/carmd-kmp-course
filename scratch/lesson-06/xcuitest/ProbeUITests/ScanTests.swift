import XCTest

// Drives the installed Device Monitor app (m01) by bundle ID.
final class ScanTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "com.example.devicemonitor")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["Tap Scan to look for devices."].waitForExistence(timeout: 10))
    }

    private func scan(filter: String?) -> XCUIElement {
        if let filter {
            let field = app.textFields["Device name filter"]
            field.tap()
            field.typeText(filter)
        }
        let button = app.buttons["Scan"]
        button.tap()
        return button
    }

    func testScanAll() {
        let button = scan(filter: nil)
        let start = Date()
        XCTAssertTrue(app.staticTexts["Scanning…"].waitForExistence(timeout: 1))
        XCTAssertFalse(app.staticTexts["Scanning..."].exists, "status must use the single … character")
        XCTAssertFalse(button.isEnabled, "Scan must be disabled while scanning")
        XCTAssertTrue(app.activityIndicators.firstMatch.exists, "spinner must show while scanning")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "scanning"; shot.lifetime = .keepAlways; add(shot)
        XCTAssertTrue(app.staticTexts["Devices found: 5"].waitForExistence(timeout: 5))
        print("PROBE scan took ~\(String(format: "%.2f", Date().timeIntervalSince(start)))s after the tap returned")
        XCTAssertTrue(button.isEnabled)
        XCTAssertFalse(app.activityIndicators.firstMatch.exists)
    }

    func testFilterSens() {
        _ = scan(filter: "sens")
        XCTAssertTrue(app.staticTexts["Devices found: 1"].waitForExistence(timeout: 5))
    }

    func testFilterZzz() {
        let button = scan(filter: "zzz")
        XCTAssertTrue(app.staticTexts["No devices found. Try another filter."].waitForExistence(timeout: 5))
        XCTAssertTrue(button.isEnabled)
    }
}

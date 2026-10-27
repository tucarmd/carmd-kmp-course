import XCTest

// Drives the installed Device Monitor app (m02) by bundle ID.
final class ListTests: XCTestCase {
    private var app: XCUIApplication!
    private let names = ["OBD-II Adapter", "Heart Rate Monitor", "Tire Pressure Sensor", "Thermometer", "Smart Scale"]

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "com.example.devicemonitor")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["Tap Scan to look for devices."].waitForExistence(timeout: 10))
    }

    @discardableResult
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

    private func assertListShows(filter: String, count: Int, row: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(app.staticTexts["Devices found: \(count)"].waitForExistence(timeout: 3), file: file, line: line)
        XCTAssertEqual(app.textFields["Device name filter"].value as? String, filter, file: file, line: line)
        XCTAssertTrue(app.staticTexts[row].exists, file: file, line: line)
    }

    func testLaunchHasNoRows() {
        XCTAssertTrue(app.navigationBars["Device Monitor"].exists)
        XCTAssertTrue(app.textFields["Device name filter"].exists)
        XCTAssertTrue(app.buttons["Scan"].isEnabled)
        XCTAssertFalse(app.staticTexts["OBD-II Adapter"].exists)
    }

    func testScanAllShowsFiveRowsInOrder() {
        let button = scan(filter: nil)
        XCTAssertTrue(app.staticTexts["Scanning…"].waitForExistence(timeout: 1))
        XCTAssertFalse(app.staticTexts["Scanning..."].exists, "status must use the single … character")
        XCTAssertFalse(button.isEnabled, "Scan must be disabled while scanning")
        XCTAssertTrue(app.activityIndicators.firstMatch.exists, "spinner must show while scanning")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "scanning"; shot.lifetime = .keepAlways; add(shot)

        XCTAssertTrue(app.staticTexts["Devices found: 5"].waitForExistence(timeout: 5))
        XCTAssertTrue(button.isEnabled)
        let ys = names.map { app.staticTexts[$0].frame.minY }
        XCTAssertEqual(ys, ys.sorted(), "rows must follow SampleDevices order")
        XCTAssertTrue(app.staticTexts["C4:7C:8D:6A:01:10"].exists)
        XCTAssertTrue(app.staticTexts["-48 dBm"].exists)
    }

    func testFilterSensShowsOneRow() {
        scan(filter: "sens")
        XCTAssertTrue(app.staticTexts["Devices found: 1"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Tire Pressure Sensor"].exists)
        XCTAssertFalse(app.staticTexts["OBD-II Adapter"].exists)
    }

    func testFilterZzzShowsErrorAndNoRows() {
        let button = scan(filter: "zzz")
        XCTAssertTrue(app.staticTexts["No devices found. Try another filter."].waitForExistence(timeout: 5))
        XCTAssertTrue(button.isEnabled)
        for name in names { XCTAssertFalse(app.staticTexts[name].exists, "\(name) must not be listed") }
    }

    func testRowOpensDetailAndBackKeepsResults() {
        scan(filter: "sens")
        XCTAssertTrue(app.staticTexts["Devices found: 1"].waitForExistence(timeout: 5))

        // Navigation bar back button.
        app.staticTexts["Tire Pressure Sensor"].tap()
        XCTAssertTrue(app.staticTexts["ID: C4:7C:8D:6A:01:12"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Signal: -67 dBm"].exists)
        XCTAssertTrue(app.navigationBars["Device"].exists)
        app.navigationBars["Device"].buttons.element(boundBy: 0).tap()
        assertListShows(filter: "sens", count: 1, row: "Tire Pressure Sensor")

        // Swipe back from the left edge.
        app.staticTexts["Tire Pressure Sensor"].tap()
        XCTAssertTrue(app.staticTexts["ID: C4:7C:8D:6A:01:12"].waitForExistence(timeout: 3))
        let edge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5))
        edge.press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)))
        XCTAssertTrue(app.navigationBars["Device Monitor"].waitForExistence(timeout: 3), "swipe-back must pop the detail")
        assertListShows(filter: "sens", count: 1, row: "Tire Pressure Sensor")
    }
}

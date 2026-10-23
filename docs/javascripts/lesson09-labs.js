// Bài 09, Appendix: ba mô phỏng bấm được (không có trong bản gốc).
// Chuỗi lỗi và tên kiểu lấy từ bài và từ bản build m04 thật.
// Chạy lại sau mỗi lần navigation.instant đổi trang; dataset.ready chặn gắn sự kiện hai lần.
(() => {
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };
  const once = (el) => { if (!el || el.dataset.ready) return false; el.dataset.ready = "1"; return true; };
  const code = (text) => h("pre", { class: "lab-code" }, h("code", { text }));

  // ---------- 1. Swift thấy gì: bật/tắt SKIE, thêm case thứ tư ----------
  const initLens = () => {
    const root = document.getElementById("l09-lens");
    if (!once(root)) return;
    const v = { skie: true, fourth: false };
    const out = h("div", { class: "lab-grid" });
    const verdict = h("p", { class: "lab-note" });

    const draw = () => {
      const kotlin = [
        "val uiState: StateFlow<DeviceListUiState>",
        "",
        "sealed interface ScanState {",
        "    data object Idle : ScanState",
        "    data class Scanning(val found: List<Device>) : ScanState",
        "    data class Finished(val found: List<Device>) : ScanState",
        ...(v.fourth ? ["    data class Paused(val found: List<Device>) : ScanState   // mới"] : []),
        "}",
      ].join("\n");
      const sees = v.skie ? [
        "uiState: SkieSwiftStateFlow<DeviceListUiState>",
        "  → AsyncSequence, value có kiểu",
        "",
        "onEnum(of: scan) → enum __Sealed {",
        "  case idle, scanning, finished" + (v.fourth ? ", paused   // mới" : ""),
        "}",
      ] : [
        "uiState: any Kotlinx_coroutines_coreStateFlow",
        "  → value: Any?   (mất kiểu, không for await được)",
        "",
        "protocol ScanState",
        "class ScanStateIdle, ScanStateScanning, ScanStateFinished" + (v.fourth ? ", ScanStatePaused" : ""),
      ];
      const swift = v.skie ? [
        ".task {",
        "    for await newState in viewModel.uiState {",
        "        self.state = newState",
        "    }",
        "}",
        "",
        "switch onEnum(of: scan) {",
        "case .idle: nil",
        "case .scanning(let s): s.found",
        "case .finished(let f): f.found",
        "}",
      ] : [
        "// cần StateFlowWatcher + DeviceListObserver (bài 08)",
        "watch = watcher.watch { [weak self] s in self?.state = s }",
        "",
        "if let s = scan as? ScanStateScanning { return s.found }",
        "if let f = scan as? ScanStateFinished { return f.found }",
        "return nil",
      ];
      out.replaceChildren(
        h("div", {}, h("div", { class: "lab-cap", text: "Kotlin (commonMain)" }), code(kotlin)),
        h("div", {}, h("div", { class: "lab-cap", text: v.skie ? "Swift thấy (có SKIE)" : "Swift thấy (chỉ Shared.h)" }), code(sees.join("\n"))),
        h("div", {}, h("div", { class: "lab-cap", text: "Swift bạn viết" }), code(swift.join("\n"))),
      );
      if (!v.fourth) {
        verdict.className = "lab-note";
        verdict.textContent = v.skie
          ? "Có SKIE: không còn file cầu nối, không còn ép kiểu. Bấm \"Kotlin thêm case Paused\" để xem compiler làm gì."
          : "Không SKIE: phải tự viết watcher + observer, và đọc ScanState bằng as?. Bấm \"Kotlin thêm case Paused\" để xem chuyện gì xảy ra.";
      } else if (v.skie) {
        verdict.className = "lab-note err";
        verdict.textContent = "Build Xcode DỪNG: \"error: switch must be exhaustive · note: add missing case: '.paused(_)'\". Tốt! Compiler chỉ ra đúng chỗ phải sửa trước khi người dùng thấy gì.";
      } else {
        verdict.className = "lab-note warn";
        verdict.textContent = "Build Xcode THÀNH CÔNG, không một cảnh báo. Lúc chạy, trạng thái Paused rơi xuống return nil: danh sách trống trơn, dòng trạng thái ghi \"Tap Scan…\". Bug lặng lẽ.";
      }
    };

    root.append(
      h("div", { class: "lab-buttons" },
        h("label", { class: "lab-field" }, h("input", { type: "checkbox", checked: "", onchange: (e) => { v.skie = e.target.checked; draw(); } }), h("span", { text: " Bật SKIE (m04)" })),
        h("label", { class: "lab-field" }, h("input", { type: "checkbox", onchange: (e) => { v.fourth = e.target.checked; draw(); } }), h("span", { text: " Kotlin thêm case Paused" })),
      ),
      out, verdict,
    );
    draw();
  };

  // ---------- 2. Cổng phiên bản Kotlin ----------
  const SUPPORTED = ["2.0.0", "2.0.10", "…", "2.4.0", "2.4.10", "2.4.20"];
  const initGate = () => {
    const root = document.getElementById("l09-gate");
    if (!once(root)) return;
    const VERSIONS = ["2.4.0", "2.4.10", "2.4.20", "2.4.21", "2.5.0"];
    const v = { kotlin: "2.4.20", enabled: true };
    const pills = h("div", { class: "lab-buttons" });
    const gate = h("div", { class: "lab-gate" });
    const out = h("ul", { class: "lab-verdicts" });

    const draw = () => {
      pills.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === v.kotlin));
      const ok = SUPPORTED.includes(v.kotlin);
      gate.className = "lab-gate " + (!v.enabled ? "off" : ok ? "open" : "closed");
      gate.replaceChildren(
        h("span", { class: "lab-gate-box", text: `Kotlin ${v.kotlin}` }),
        h("span", { class: "lab-gate-arrow", text: !v.enabled ? "→ (SKIE tắt) →" : ok ? "→ ✓ →" : "→ ✗" }),
        h("span", { class: "lab-gate-box", text: "SKIE 0.10.15" }),
        h("span", { class: "lab-gate-arrow", text: !v.enabled || ok ? "→" : "" }),
        h("span", { class: "lab-gate-box" + (!v.enabled || ok ? "" : " dim"), text: "Shared.framework" }),
      );
      const items = [];
      if (!v.enabled) {
        items.push(["ok", "skie { isEnabled = false }: Gradle cấu hình được, framework build được, không kèm gì SKIE sinh ra."]);
        items.push(["err", "Nhưng Swift dùng for await trên uiState và onEnum(of:) KHÔNG còn compile: các kiểu đó không tồn tại nữa. Đây là lối thoát tạm, không phải cách sửa."]);
      } else if (ok) {
        items.push(["ok", `Kotlin ${v.kotlin} có trong danh sách SKIE 0.10.15 hỗ trợ: cấu hình :shared thành công, framework có thêm SkieSwiftStateFlow và onEnum.`]);
        if (v.kotlin !== "2.4.20") items.push(["info", "Chạy được, nhưng bài chọn 2.4.20: bản mới nhất mà SKIE 0.10.15 hỗ trợ."]);
      } else {
        items.push(["err", `Mọi lệnh Gradle (kể cả build Android!) dừng lúc cấu hình :shared, trước khi compile dòng nào:`]);
        items.push(["err", `Error: SKIE 0.10.15 does not support Kotlin ${v.kotlin}. Supported versions are: [2.0.0, 2.0.10, …, 2.4.0, 2.4.10, 2.4.20].`]);
        items.push(["info", "Cách sửa: chờ bản SKIE mới hỗ trợ Kotlin này (thường vài ngày), rồi nâng hai thứ cùng lúc. Hoặc tạm hạ Kotlin về 2.4.20."]);
      }
      out.replaceChildren(...items.map(([c, t]) => h("li", { class: c, text: t })));
    };
    VERSIONS.forEach((ver) => pills.append(h("button", { type: "button", "data-v": ver, text: `Kotlin ${ver}`, onclick: () => { v.kotlin = ver; draw(); } })));
    root.append(
      h("div", { class: "lab-cap", text: "Chọn phiên bản Kotlin trong build.gradle.kts gốc" }), pills,
      h("label", { class: "lab-field" }, h("input", { type: "checkbox", checked: "", onchange: (e) => { v.enabled = e.target.checked; draw(); } }), h("span", { text: " SKIE đang bật (bỏ tick = skie { isEnabled = false })" })),
      gate, out,
    );
    draw();
  };

  // ---------- 3. Ai dừng cái gì ----------
  const initLanes = () => {
    const root = document.getElementById("l09-lanes");
    if (!once(root)) return;
    const NAMES = ["OBD-II Adapter", "Heart Rate Monitor", "Tire Pressure Sensor", "Thermometer", "Smart Scale"];
    let s, timers = [];
    const lanes = h("div", { class: "lab-lanes" });
    const log = h("pre", { class: "lab-log short" });
    const btns = h("div", { class: "lab-buttons" });
    const line = (t) => { log.textContent += t + "\n"; log.scrollTop = log.scrollHeight; };
    const fresh = () => ({ screen: "list", task: true, collect: true, vm: true, scan: "Idle", found: 0, shown: "Idle" });

    const lane = (label, on, text) => h("div", { class: "lab-lane" + (on ? " on" : "") }, h("b", { text: label }), h("span", { text }));
    const draw = () => {
      lanes.replaceChildren(
        lane("Màn hình", s.screen === "list", { list: "danh sách đang hiện", detail: "danh sách bị che (đang ở chi tiết)", gone: "danh sách đã bị gỡ hẳn" }[s.screen]),
        lane("Swift Task (for await)", s.task, s.task ? `đang chạy · render: ${s.shown}` : "đã huỷ"),
        lane("Kotlin collect (SKIE)", s.collect, s.collect ? "đang collect uiState" : "đã huỷ theo Task"),
        lane("ViewModel + scan", s.vm, s.vm ? `sống · ${s.scan}` : "đã clear (owner deinit)"),
      );
      btns.querySelectorAll("button").forEach((b) => (b.disabled = !ACT[b.dataset.a].can()));
    };
    const stateText = () => (s.scan.startsWith("Scanning") || s.scan.startsWith("Finished") ? s.scan : "Idle");
    const emit = () => { if (s.task && s.collect) s.shown = stateText(); };

    const ACT = {
      scan: { label: "Bấm Scan", can: () => s.vm && s.screen === "list" && !s.scan.startsWith("Scanning"), go: () => {
        line("viewModel.startScan(): viewModelScope.launch");
        s.found = 0; s.scan = "Scanning(0)"; emit();
        NAMES.forEach((_, i) => timers.push(setTimeout(() => { if (!s.vm) return; s.found = i + 1; s.scan = `Scanning(${s.found})`; emit(); draw(); }, 600 * (i + 1))));
        timers.push(setTimeout(() => { if (!s.vm) return; s.scan = `Finished(${s.found})`; emit(); line(s.task ? "timeout 3 s → Finished, màn hình render ngay" : "timeout 3 s → Finished, nhưng không ai đang xem"); draw(); }, 3600));
      } },
      detail: { label: "Mở một thiết bị", can: () => s.screen === "list", go: () => {
        s.screen = "detail"; s.task = false; s.collect = false;
        line(".task bị huỷ → vòng for await kết thúc → SKIE huỷ Kotlin collect. ViewModel vẫn quét.");
      } },
      back: { label: "Back về danh sách", can: () => s.screen === "detail", go: () => {
        s.screen = "list"; s.task = true; s.collect = true; s.shown = stateText();
        line(`.task chạy lại → giá trị đầu tiên là state mới nhất: ${s.shown}`);
      } },
      leave: { label: "Gỡ hẳn màn hình danh sách", can: () => s.screen !== "gone", go: () => {
        s.screen = "gone"; s.task = false; s.collect = false; s.vm = false; s.scan = "—";
        timers.forEach(clearTimeout); timers = [];
        line("View bị gỡ → @State owner bị giải phóng → deinit: store.clear() → onCleared, viewModelScope huỷ: quét dừng.");
      } },
      reset: { label: "Reset", can: () => true, go: () => { timers.forEach(clearTimeout); timers = []; s = fresh(); log.textContent = ""; } },
    };
    Object.entries(ACT).forEach(([k, a]) => btns.append(h("button", { type: "button", "data-a": k, class: k === "reset" ? "lab-reset" : "", text: a.label, onclick: () => { if (a.can()) { a.go(); draw(); } } })));
    root.append(btns, lanes, log);
    s = fresh(); draw();
  };

  const init = () => { initLens(); initGate(); initLanes(); };
  if (window.document$) document$.subscribe(init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

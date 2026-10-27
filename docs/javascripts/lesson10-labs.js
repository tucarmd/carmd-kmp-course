// Bài 10, Appendix: ba mô phỏng bấm được (không có trong bản gốc).
// Tên class, chuỗi lỗi và thời gian (0,3 s, 3 s, 0,5 s) lấy từ bài; hai lỗi compile ở lab 2
// lấy từ một lần compile thật trên JVM (Kotlin 2.4.21).
// Chạy lại sau mỗi lần navigation.instant đổi trang; dataset.ready chặn gắn sự kiện hai lần.
(() => {
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
  };
  const once = (el) => { if (!el || el.dataset.ready) return false; el.dataset.ready = "1"; return true; };
  const code = (text) => h("pre", { class: "lab-code", style: "min-height:0" }, h("code", { text }));
  const PART = { screen: "var(--c-android)", inbound: "var(--c-inbound)", core: "var(--c-core)", outbound: "var(--c-outbound)" };
  const SAMPLE = [
    { id: "C4:7C:8D:6A:01:10", name: "OBD-II Adapter", rssi: -48 },
    { id: "C4:7C:8D:6A:01:11", name: "Heart Rate Monitor", rssi: -61 },
    { id: "C4:7C:8D:6A:01:12", name: "Tire Pressure Sensor", rssi: -67 },
    { id: "C4:7C:8D:6A:01:13", name: "Thermometer", rssi: -74 },
    { id: "C4:7C:8D:6A:01:14", name: "Smart Scale", rssi: -85 },
  ];

  // ---------- 1. Đi theo một lần quét ----------
  const initPath = () => {
    const root = document.getElementById("l10-path");
    if (!once(root)) return;
    const STATIONS = [
      ["screen", "screen", "Màn hình"],
      ["vm", "inbound", "DeviceListViewModel · inbound adapter"],
      ["inPort", "inbound", "DeviceScanning · inbound port"],
      ["service", "core", "ScanningService · service"],
      ["outPort", "outbound", "BleScanner · outbound port"],
      ["radio", "outbound", "SimulatedBleScanner · outbound adapter"],
    ];
    const v = { filter: "", failing: false, slow: false };
    let timers = [], running = false, t0 = 0;
    const text = {}, laneEl = {};
    const lanes = h("div", { class: "lab-lanes" });
    STATIONS.forEach(([k, part, label]) => {
      text[k] = h("span", { text: "—" });
      laneEl[k] = h("div", { class: "lab-lane", "data-k": k, style: `transition:all .2s` }, h("b", { text: label }), text[k]);
      laneEl[k].dataset.part = part;
      lanes.append(laneEl[k]);
    });
    const rows = h("div", { class: "lab-chips" });
    const status = h("p", { class: "lab-note", text: "Tap Scan to look for devices." });
    const log = h("pre", { class: "lab-log short", style: "height:9rem" });
    const scanBtn = h("button", { type: "button", text: "Scan" });
    const scale = () => (v.slow ? 3 : 1);
    const stamp = () => `t=${String(Math.round((performance.now() - t0) / scale())).padStart(4, " ")} ms`;
    const line = (t) => { log.textContent += `${stamp()}  ${t}\n`; log.scrollTop = log.scrollHeight; };
    const light = (keys, ms = 260) => {
      keys.forEach((k) => {
        const el = laneEl[k];
        el.classList.add("on");
        el.style.borderLeftColor = PART[el.dataset.part];
        el.style.background = "var(--md-code-bg-color)";
        timers.push(setTimeout(() => { if (!el.dataset.hold) { el.classList.remove("on"); el.style.background = ""; } }, ms * scale()));
      });
    };
    const hold = (k, on) => {
      const el = laneEl[k];
      if (on) { el.dataset.hold = "1"; el.classList.add("on"); el.style.borderLeftColor = PART[el.dataset.part]; el.style.background = "var(--md-code-bg-color)"; }
      else { delete el.dataset.hold; el.classList.remove("on"); el.style.background = ""; }
    };
    const later = (ms, fn) => timers.push(setTimeout(fn, ms * scale()));
    const stopAll = () => { timers.forEach(clearTimeout); timers = []; };

    const finish = (found) => {
      running = false; scanBtn.disabled = false;
      Object.keys(laneEl).forEach((k) => hold(k, false));
      status.className = "lab-note" + (found.length ? "" : " err");
      status.textContent = found.length ? `Devices found: ${found.length}` : "No devices found. Try another filter.";
    };

    const scan = () => {
      if (running) return;
      stopAll(); running = true; scanBtn.disabled = true; log.textContent = ""; rows.replaceChildren();
      t0 = performance.now();
      const wanted = v.filter.trim().toLowerCase();
      const seen = new Set(); const found = [];
      status.className = "lab-note"; status.textContent = "Scanning…";
      text.screen.textContent = "bấm Scan → viewModel.startScan(filter)";
      text.vm.textContent = "Scanning(0) · withTimeoutOrNull(3 s) { collect }";
      text.inPort.textContent = `scanning.scan("${v.filter}")`;
      text.service.textContent = `wanted = "${v.filter.trim()}", seen = {} · scanner.scan().collect`;
      text.outPort.textContent = "scanner.scan()";
      text.radio.textContent = v.failing ? "radio luôn lỗi: delay(500) rồi throw" : "radio bắt đầu quét";
      line("lời gọi đi sang phải: màn hình → ViewModel → DeviceScanning → ScanningService → BleScanner → radio");
      STATIONS.forEach(([k], i) => later(i * 90, () => light([k], 400)));
      later(600, () => ["vm", "service", "radio"].forEach((k) => hold(k, true)));
      if (v.failing) {
        later(500, () => {
          stopAll();
          ["radio", "outPort", "service", "inPort", "vm"].forEach((k, i) => later(i * 90, () => light([k], 500)));
          text.radio.textContent = 'throw ScanException("Bluetooth adapter not responding (simulated).")';
          text.service.textContent = "không bắt: exception đi tiếp sang trái";
          text.vm.textContent = "catch (e: ScanException) → Idle + errorMessage";
          text.screen.textContent = 'dialog "Scan failed"';
          line("radio ném ScanException; exception đi sang trái qua service tới catch của ViewModel");
          later(600, () => {
            running = false; scanBtn.disabled = false;
            Object.keys(laneEl).forEach((k) => hold(k, false));
            status.className = "lab-note err";
            status.textContent = "Scan failed · Bluetooth adapter not responding (simulated). → OK → Tap Scan to look for devices.";
          });
        });
        return;
      }
      let n = 0;
      for (let at = 300; at <= 3000; at += 300) {
        const d = SAMPLE[n % SAMPLE.length]; const round = Math.floor(n / SAMPLE.length) + 1; n += 1;
        if (at === 3000) break; // ở 3 s timeout thắng
        later(at, () => {
          light(["radio", "outPort"]);
          text.radio.textContent = `emit(${d.name})  · vòng ${round}`;
          if (!d.name.toLowerCase().includes(wanted)) {
            text.service.textContent = `bỏ: "${d.name}" không chứa chuỗi lọc`;
            line(`radio: ${d.name} → service bỏ (không khớp chuỗi lọc)`);
            return;
          }
          if (seen.has(d.id)) {
            text.service.textContent = `bỏ: ${d.name} đã thấy (seen.add trả false)`;
            line(`radio: ${d.name} (lặp) → service bỏ: đã thấy`);
            return;
          }
          seen.add(d.id); found.push(d);
          light(["service", "inPort", "vm", "screen"]);
          text.service.textContent = `emit(${d.name}) · seen có ${seen.size}`;
          text.inPort.textContent = `thiết bị đi ngược về: ${d.name}`;
          text.vm.textContent = `found += ${d.name} → Scanning(${found.length})`;
          text.screen.textContent = `vẽ lại danh sách: ${found.length} hàng`;
          rows.append(h("span", { class: "lab-chip on", text: d.name }));
          line(`radio: ${d.name} → service emit → ViewModel: Scanning(${found.length})`);
        });
      }
      later(3000, () => {
        text.vm.textContent = `timeout 3 s → huỷ collect → Finished(${found.length})`;
        line("3 s: withTimeoutOrNull huỷ việc collect; việc huỷ lan sang phải");
        ["vm", "inPort", "service", "outPort", "radio"].forEach((k, i) => later(i * 110, () => {
          hold(k, false);
          if (k === "service") text.service.textContent = "collect bị huỷ (seen bị bỏ cùng lần quét)";
          if (k === "radio") { text.radio.textContent = "dừng: collector đã huỷ, không ai gọi stop"; line("radio dừng"); }
          if (k === "outPort" || k === "inPort") text[k].textContent = "không còn ai collect";
        }));
        later(650, () => { text.screen.textContent = `Devices found: ${found.length}`; finish(found); });
      });
    };
    scanBtn.addEventListener("click", scan);

    const filter = h("input", { type: "text", placeholder: "Device name filter", style: "font:inherit;padding:.2rem .4rem;border:1px solid var(--dg-rule);border-radius:4px;background:transparent;color:inherit;width:100%" });
    filter.addEventListener("input", () => { v.filter = filter.value; });
    const radio = h("select", { style: "font:inherit;padding:.2rem;border:1px solid var(--dg-rule);border-radius:4px;background:transparent;color:inherit" },
      h("option", { value: "sim", text: "SimulatedBleScanner()" }),
      h("option", { value: "fail", text: "object : BleScanner (luôn lỗi, mục 6)" }));
    radio.addEventListener("change", () => {
      v.failing = radio.value === "fail";
      laneEl.radio.querySelector("b").textContent = v.failing ? "object : BleScanner (luôn lỗi) · outbound adapter" : "SimulatedBleScanner · outbound adapter";
    });
    const reset = h("button", { type: "button", class: "lab-reset", text: "Reset", onclick: () => {
      stopAll(); running = false; scanBtn.disabled = false; log.textContent = ""; rows.replaceChildren();
      Object.keys(laneEl).forEach((k) => { hold(k, false); text[k].textContent = "—"; });
      status.className = "lab-note"; status.textContent = "Tap Scan to look for devices.";
    } });
    root.append(
      h("div", { class: "lab-cap", text: "Chuỗi lọc (thử: để trống, sens, MONITOR, zzz)" }), h("div", { class: "lab-buttons" }, filter),
      h("div", { class: "lab-cap", text: "Radio cắm vào BleScanner trong AppContainer" }), h("div", { class: "lab-buttons" }, radio),
      h("div", { class: "lab-buttons" }, scanBtn,
        h("label", { class: "lab-field" }, h("input", { type: "checkbox", onchange: (e) => { v.slow = e.target.checked; } }), h("span", { text: " Chạy chậm (×3)" })), reset),
      lanes, h("div", { class: "lab-cap", style: "margin-top:.8rem", text: "Danh sách trên màn hình" }), rows, status, log,
    );
  };

  // ---------- 2. Cắm adapter vào port BleScanner ----------
  const initPlug = () => {
    const root = document.getElementById("l10-plug");
    if (!once(root)) return;
    const PLUGS = [
      { k: "sim", label: "SimulatedBleScanner()", fits: true, value: "SimulatedBleScanner()",
        screen: "Scan → 5 hàng tới từng cái, 3 s sau: Devices found: 5",
        note: "Adapter của m05: một radio giả lập trong adapter.outbound." },
      { k: "fail", label: "object : BleScanner (luôn lỗi)", fits: true, value: "object : BleScanner {\n        override fun scan(): Flow<Device> = flow {\n            delay(500)\n            throw ScanException(\"Bluetooth adapter not responding (simulated).\")\n        }\n    }",
        screen: "Scan → 0,5 s sau: dialog \"Scan failed\" · Bluetooth adapter not responding (simulated).",
        note: "Đoạn \"Đổi adapter\" ở mục 6. Cần thêm vài import, nhưng vẫn chỉ trong file này." },
      { k: "test", label: "FakeRadio (test bài 11)", fits: true, value: "FakeRadio(devices = listOf(…))",
        screen: "Test điều khiển radio: phát đúng những thiết bị test muốn, hoặc lỗi theo lệnh",
        note: "Tên FakeRadio là minh hoạ; bài 11 tự đặt tên và viết nó. Ý chính: một class implement BleScanner." },
      { k: "real", label: "radio thật Android / Swift (bài 13)", fits: true, value: "/* bài 13: radio Android trên Android, radio Swift trên iOS */",
        screen: "Thiết bị thật quanh bạn",
        note: "Bài 13 làm phép gắn này theo từng nền tảng (qua Koin, từ bài 11). Core vẫn không đổi." },
      { k: "old", label: "class OldFake { fun scan(filter: String) }", fits: false, value: "OldFake()",
        err: "e: …/AppContainer.kt: Function 'getValue' of property delegate is expected to return 'BleScanner', but returns 'OldFake'.",
        note: "Cùng tên hàm scan, nhưng không khai báo : BleScanner, và còn có tham số lọc mà port không có. Giống tên chưa đủ: phải implement port." },
      { k: "android", label: "android.bluetooth.le.BluetoothLeScanner", fits: false, value: "BluetoothLeScanner(…)",
        err: "e: …/AppContainer.kt: Unresolved reference 'android'.",
        note: "Code dùng chung không thấy class Android (lỗi trên lấy từ một project JVM thuần; trong commonMain cũng không có android.*). Muốn dùng radio Android: bọc nó trong một adapter ở androidMain (bài 13)." },
    ];
    const pick = h("div", { class: "lab-buttons" });
    const socket = h("div", { class: "lab-gate" });
    const bind = h("div");
    const out = h("ul", { class: "lab-verdicts" });
    let cur = PLUGS[0];
    const draw = () => {
      pick.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.k === cur.k));
      socket.className = "lab-gate " + (cur.fits ? "open" : "closed");
      socket.replaceChildren(
        h("span", { class: "lab-gate-box", text: "ScanningService" }),
        h("span", { class: "lab-gate-arrow", text: "→ gọi →" }),
        h("span", { class: "lab-gate-box", text: "ổ BleScanner" }),
        h("span", { class: "lab-gate-arrow", text: cur.fits ? "← cắm vừa ←" : "✗ không vừa" }),
        h("span", { class: "lab-gate-box" + (cur.fits ? "" : " dim"), text: cur.label }),
      );
      bind.replaceChildren(h("div", { class: "lab-cap", text: "di/AppContainer.kt" }),
        code(`object AppContainer {\n    private val bleScanner: BleScanner by lazy { ${cur.value} }\n    private val deviceScanning: DeviceScanning by lazy { ScanningService(bleScanner) }\n    …\n}`));
      const items = [];
      if (cur.fits) {
        items.push(["ok", "Compile được: giá trị implement BleScanner."]);
        items.push(["ok", "File phải sửa: di/AppContainer.kt (và chỉ file đó)."]);
        items.push(["info", "Không đổi: ScanningService.kt, DeviceScanning.kt, BleScanner.kt, DeviceListViewModel.kt, mọi màn hình."]);
        items.push(["info", `Màn hình: ${cur.screen}`]);
      } else {
        items.push(["err", cur.err]);
        items.push(["info", "Build dừng ở đây, trước khi app kịp chạy."]);
      }
      items.push(["warn", cur.note]);
      out.replaceChildren(...items.map(([c, t]) => h("li", { class: c, text: t })));
    };
    PLUGS.forEach((p) => pick.append(h("button", { type: "button", "data-k": p.k, text: p.label, onclick: () => { cur = p; draw(); } })));
    root.append(h("div", { class: "lab-cap", text: "Chọn phích cắm" }), pick, socket, bind, out);
    draw();
  };

  // ---------- 3. Gác cổng import của app core ----------
  const initImports = () => {
    const root = document.getElementById("l10-imports");
    if (!once(root)) return;
    const ITEMS = [
      ["kotlinx.coroutines.flow.Flow", true, "kotlinx.coroutines được phép: Flow là cách các port mô tả một luồng."],
      ["androidx.lifecycle.ViewModel", false, "Framework Android: thuộc inbound adapter (adapter.inbound), không phải core."],
      ["com.example.devicemonitor.core.outbound.BleScanner", true, "Package của chính core: service gọi outbound port."],
      ["android.bluetooth.le.ScanResult", false, "Kiểu của nền tảng: chỉ outbound adapter Android (androidMain, bài 13) được biết nó, và dịch nó sang Device."],
      ["com.example.devicemonitor.adapter.outbound.SampleDevices", false, "Code của chính app, nhưng là adapter: core không bao giờ phụ thuộc vào adapter. Mũi tên chỉ vào trong."],
      ["kotlin.time.Duration", true, "Thư viện chuẩn của Kotlin: được phép."],
      ["platform.CoreBluetooth.CBCentralManager", false, "API iOS: thuộc outbound adapter iOS (Swift trong app iOS, bài 13)."],
      ["io.ktor.client.HttpClient", false, "Thư viện mạng: thuộc một HTTP adapter trong adapter.outbound (bài E1), sau một port đặt tên theo việc."],
      ["org.koin.core.module.Module", false, "Thư viện DI: chỉ composition root (di) được biết, từ bài 11."],
      ["com.example.devicemonitor.core.inbound.DeviceScanning", true, "Package của chính core: service implement inbound port."],
    ];
    let i = 0, right = 0;
    const file = h("pre", { class: "lab-code", style: "min-height:0" }, h("code"));
    const q = h("p", { class: "lab-q" });
    const fb = h("p", { class: "lab-feedback" });
    const score = h("span", { class: "lab-score" });
    const accepted = [];
    const yes = h("button", { type: "button", text: "Cho vào core" });
    const no = h("button", { type: "button", text: "Chặn" });
    const again = h("button", { type: "button", class: "lab-reset", text: "Chơi lại" });
    const drawFile = () => {
      file.firstChild.textContent = ["package com.example.devicemonitor.core", "", ...accepted.map((a) => `import ${a}`), "", "class ScanningService(private val scanner: BleScanner) : DeviceScanning { … }"].join("\n");
    };
    const draw = () => {
      score.textContent = `${right} / ${i}`;
      drawFile();
      if (i >= ITEMS.length) {
        q.textContent = right === ITEMS.length ? "Xong! Core sạch: chỉ kotlin.*, kotlinx.coroutines.* và core.*" : `Xong: đúng ${right} / ${ITEMS.length}. Đọc lại các dòng đỏ, rồi chơi lại.`;
        yes.disabled = no.disabled = true;
        return;
      }
      yes.disabled = no.disabled = false;
      q.replaceChildren(h("span", { text: "Có ai muốn thêm: " }), h("code", { text: `import ${ITEMS[i][0]}` }));
    };
    const answer = (allow) => {
      const [imp, ok, why] = ITEMS[i];
      const good = allow === ok;
      if (good) right += 1;
      if (ok) accepted.push(imp);
      fb.className = "lab-feedback " + (good ? "ok" : "err");
      fb.textContent = (good ? "Đúng. " : ok ? "Sai: dòng này được phép. " : "Sai: dòng này phải bị chặn. ") + why;
      i += 1; draw();
    };
    yes.addEventListener("click", () => answer(true));
    no.addEventListener("click", () => answer(false));
    again.addEventListener("click", () => { i = 0; right = 0; accepted.length = 0; fb.textContent = ""; fb.className = "lab-feedback"; draw(); });
    root.append(
      h("div", { class: "lab-row" }, h("div", { class: "lab-cap", text: "core/ScanningService.kt (các import đã cho vào)" }), score),
      file, q, h("div", { class: "lab-buttons" }, yes, no, again), fb,
    );
    draw();
  };

  const init = () => { initPath(); initPlug(); initImports(); };
  if (window.document$) document$.subscribe(init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
